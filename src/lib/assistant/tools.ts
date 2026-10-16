import modelJson from "../../../public/model.json";
import { areas, insights, market, meta } from "../data";
import { estimatePpsf, roundPrice, SIZE_LIMITS, type PriceModel } from "../predict";
import type { Area, PropertyType } from "../types";

/*
 * The tools the assistant can call. Each one is a plain function over the same generated data the
 * website shows, so every number in an answer comes from DLD sales, not from the language model.
 */

const model = modelJson as unknown as PriceModel;
const MIN_SALES = 10; // ignore bedroom groups with fewer sales than this: their medians are noise

// ---------- area name matching ----------
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Everyday names → the names DLD uses.
const ALIASES: Record<string, string> = {
  jvc: "Jumeirah Village Circle",
  jvt: "Jumeirah Village Triangle",
  jlt: "Jumeirah Lakes Towers",
  jbr: "Jumeirah Beach Residence",
  downtown: "Burj Khalifa",
  "downtown dubai": "Burj Khalifa",
  marina: "Dubai Marina",
  "dubai silicon oasis": "Silicon Oasis",
  dso: "Silicon Oasis",
  "dubai hills estate": "Dubai Hills",
  "mbr city": "Hadaeq Sheikh Mohammed Bin Rashid",
  "mohammed bin rashid city": "Hadaeq Sheikh Mohammed Bin Rashid",
  "sobha hartland": "Sobha Heartland",
  "arabian ranches": "Arabian Ranches I",
  "damac hills 1": "Damac Hills",
  "dubai investment park": "Dubai Investment Park Second",
  dip: "Dubai Investment Park Second",
  "international city": "International City Ph 1",
  "tecom": "Tecom Site A",
  "al barsha": "Al Barsha First",
  "barsha heights": "Barsha Heights",
  "creek harbour": "Dubai Creek Harbour",
  "dubai creek": "Dubai Creek Harbour",
  "palm": "Palm Jumeirah",
  "the palm": "Palm Jumeirah",
  "dubai studio city": "Dubai Studio City",
  "meydan": "Meydan One",
};

export function findArea(query: string): { area?: Area; via?: string; suggestions?: string[] } {
  // Second spelling without filler words, so "JVC area" or "Dubai Hills community" still match.
  const q = norm(query).replace(/\b(area|community|in|the)\b/g, " ").replace(/\s+/g, " ").trim();
  const exact = areas.find((a) => norm(a.name) === norm(query)) ?? areas.find((a) => norm(a.name) === q);
  if (exact) return { area: exact };
  const alias = ALIASES[norm(query)] ?? ALIASES[q];
  if (alias) return { area: areas.find((a) => a.name === alias), via: `"${query}" is registered by DLD as ${alias}` };
  const contains = areas.filter((a) => norm(a.name).includes(norm(query)) || (q.length > 3 && norm(a.name).includes(q)));
  if (contains.length === 1) return { area: contains[0] };
  if (contains.length > 1) return { suggestions: contains.sort((x, y) => y.sales - x.sales).slice(0, 6).map((a) => a.name) };
  // A project name, e.g. "Azizi Venice" → its area.
  const byProject = areas.find((a) => a.projects.some((p) => norm(p.name).includes(norm(query))));
  if (byProject && norm(query).length > 3) return { area: byProject, via: `"${query}" is a project in ${byProject.name}` };
  const words = norm(query).split(" ").filter((w) => w.length > 2);
  const fuzzy = areas
    .map((a) => ({ a, hits: words.filter((w) => norm(a.name).includes(w)).length }))
    .filter((x) => x.hits > 0)
    .sort((x, y) => y.hits - x.hits || y.a.sales - x.a.sales)
    .slice(0, 5)
    .map((x) => x.a.name);
  return { suggestions: contains.length ? contains.slice(0, 5).map((a) => a.name) : fuzzy };
}

const link = (a: Area) => `/areas/${a.slug}`;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

function areaSummary(a: Area, detail: boolean) {
  const out: Record<string, unknown> = {
    area: a.name,
    page: link(a),
    sales_2026: a.sales,
    median_price_aed: a.median_price,
    median_aed_per_sqft: a.median_ppsf,
    offplan_share: a.offplan_share,
    villa_share: a.villa_share,
    by_type: a.types,
    median_ppsf_change_q1_to_q3: a.ppsf_change,
    dld_nearest_metro: a.metro ? `${a.metro.name} (listed for ${Math.round(a.metro.share * 100)}% of sales)` : null,
  };
  const lfl = insights.area_changes.find((c) => c.area === a.name);
  if (lfl) out.like_for_like_change = { raw_median_change: lfl.raw_change, like_for_like_change: lfl.like_for_like, note: "like-for-like compares the same kind of homes over time" };
  if (detail) {
    out.bedrooms = a.bedrooms.filter((b) => b.sales >= MIN_SALES).map((b) => ({ type: b.type, bedrooms: b.bedrooms, sales: b.sales, median_price: b.median_price, middle_half_price_range: [Math.round(b.p25_price), Math.round(b.p75_price)], median_sqft: b.median_sqft }));
    out.top_projects = a.projects.slice(0, 6);
    out.nearest_mall = a.mall?.name ?? null;
    out.landmark = a.landmark?.name ?? null;
    const op = insights.offplan_areas.find((o) => o.area === a.name);
    if (op) out.offplan_premium_like_for_like = op.premium;
  }
  return out;
}

// ---------- tools ----------
type Args = Record<string, unknown>;
const asType = (v: unknown): PropertyType | undefined => (v === "Villa" || v === "villa" ? "Villa" : v === "Flat" || v === "flat" || v === "Apartment" || v === "apartment" ? "Flat" : undefined);
const asNum = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);

function searchAreas(args: Args) {
  const type = asType(args.property_type) ?? "Flat";
  const bedrooms = asNum(args.bedrooms);
  const max = asNum(args.max_budget_aed);
  const min = asNum(args.min_budget_aed);
  const nearMetro = args.near_metro === true;
  const sort = String(args.sort_by ?? "price_low");
  const limit = Math.min(Math.max(asNum(args.limit) ?? 6, 1), 10);

  const rows = areas.flatMap((a) => {
    if (nearMetro && !(a.metro && a.metro.share >= 0.5)) return [];
    let stats: { sales: number; median_price: number; median_ppsf: number; range?: [number, number]; median_sqft?: number } | undefined;
    if (bedrooms !== undefined) {
      const b = a.bedrooms.find((r) => r.type === type && r.bedrooms === bedrooms);
      if (b) stats = { sales: b.sales, median_price: b.median_price, median_ppsf: b.median_ppsf, range: [Math.round(b.p25_price), Math.round(b.p75_price)], median_sqft: b.median_sqft };
    } else {
      const t = a.types[type];
      if (t) stats = { sales: t.sales, median_price: t.median_price, median_ppsf: t.median_ppsf, median_sqft: t.median_sqft };
    }
    if (!stats || stats.sales < MIN_SALES) return [];
    if (max !== undefined && stats.median_price > max) return [];
    if (min !== undefined && stats.median_price < min) return [];
    return [{ area: a.name, page: link(a), sales: stats.sales, median_price_aed: stats.median_price, middle_half_price_range: stats.range, median_aed_per_sqft: stats.median_ppsf, median_sqft: stats.median_sqft, offplan_share: a.offplan_share, dld_nearest_metro: a.metro?.name ?? null, change: a.ppsf_change }];
  });
  const sorters: Record<string, (x: (typeof rows)[number], y: (typeof rows)[number]) => number> = {
    price_low: (x, y) => x.median_price_aed - y.median_price_aed,
    price_high: (x, y) => y.median_price_aed - x.median_price_aed,
    ppsf_low: (x, y) => x.median_aed_per_sqft - y.median_aed_per_sqft,
    sales: (x, y) => y.sales - x.sales,
    rising: (x, y) => (y.change ?? -9) - (x.change ?? -9),
  };
  rows.sort(sorters[sort] ?? sorters.price_low);
  return {
    filters: { property_type: type, bedrooms: bedrooms ?? "any", max_budget_aed: max ?? null, min_budget_aed: min ?? null, near_metro: nearMetro, sort_by: sort },
    matching_areas: rows.length,
    results: rows.slice(0, limit),
    notes: [
      `Prices are medians of 2026 DLD sales; areas with fewer than ${MIN_SALES} matching sales are left out.`,
      nearMetro ? "near_metro uses DLD's 'nearest metro' field (listed for at least half the area's sales). It is not a walking distance." : undefined,
    ].filter(Boolean),
  };
}

function getArea(args: Args) {
  const name = String(args.name ?? "");
  const found = findArea(name);
  if (!found.area) return { error: `No Dubai area called "${name}" in the 2026 data.`, did_you_mean: found.suggestions ?? [] };
  return { ...(found.via ? { matched: found.via } : {}), ...areaSummary(found.area, true) };
}

function compareAreas(args: Args) {
  const names = Array.isArray(args.names) ? args.names.map(String).slice(0, 4) : [];
  return {
    areas: names.map((n) => {
      const f = findArea(n);
      return f.area ? { ...(f.via ? { matched: f.via } : {}), ...areaSummary(f.area, false) } : { error: `No area called "${n}"`, did_you_mean: f.suggestions ?? [] };
    }),
  };
}

function estimatePrice(args: Args) {
  const f = findArea(String(args.area ?? ""));
  if (!f.area) return { error: `No Dubai area called "${args.area}"`, did_you_mean: f.suggestions ?? [] };
  const type = asType(args.property_type) ?? "Flat";
  const bedrooms = asNum(args.bedrooms) ?? (type === "Villa" ? 4 : 1);
  let sqft = asNum(args.size_sqft);
  let sizeNote: string | undefined;
  if (sqft === undefined) {
    const typical = f.area.bedrooms.find((b) => b.type === type && b.bedrooms === bedrooms) ?? market.bedrooms.find((b) => b.type === type && b.bedrooms === bedrooms);
    sqft = (typical && "median_sqft" in typical ? (typical as { median_sqft: number }).median_sqft : undefined) ?? (type === "Villa" ? 2500 : 750);
    sizeNote = `No size given, so the typical size for this home type was used: ${Math.round(sqft)} sq ft.`;
  }
  const lim = SIZE_LIMITS[type];
  if (sqft < lim.min || sqft > lim.max) return { error: `Size must be between ${lim.min} and ${lim.max} sq ft for this property type.` };
  const offplan = args.offplan === true;
  const ppsf = estimatePpsf(model, { area: f.area.name, type, bedrooms, sqft, offplan });
  if (ppsf === null) return { error: `The price model has no data for ${f.area.name}.` };
  const price = ppsf * sqft;
  const typical = f.area.types[type];
  return {
    ...(f.via ? { matched: f.via } : {}),
    inputs: { area: f.area.name, property_type: type, bedrooms, size_sqft: Math.round(sqft), status: offplan ? "off-plan" : "ready" },
    estimated_price_aed: roundPrice(price),
    likely_range_aed: [roundPrice(price * model.band.low), roundPrice(price * model.band.high)],
    estimated_aed_per_sqft: Math.round(ppsf),
    typical_aed_per_sqft_in_area: typical?.median_ppsf ?? null,
    sales_of_this_type_in_area: typical?.sales ?? 0,
    model_accuracy: `median error ${(meta.model.model.median_error * 100).toFixed(1)}% on unseen sales; 80% of test sales fell inside the likely range`,
    estimator_page: `/estimate?area=${f.area.slug}`,
    ...(sizeNote ? { note: sizeNote } : {}),
  };
}

function marketOverview() {
  const flat = insights.models.Flat.index.at(-1)!;
  const villa = insights.models.Villa.index.at(-1)!;
  return {
    period: meta.period,
    sales: market.sales,
    total_value_aed: market.total_value,
    median_price_aed: market.median_price,
    median_aed_per_sqft: market.median_ppsf,
    offplan_share: market.offplan_share,
    by_type: market.by_type,
    busiest_areas: market.top.busiest.map((i) => i.name),
    most_expensive_per_sqft: market.top.expensive.map((i) => `${i.name} (${i.median_ppsf})`),
    most_affordable_per_sqft: market.top.affordable.map((i) => `${i.name} (${i.median_ppsf})`),
    rising_fastest_q1_to_q3: market.top.rising.map((i) => `${i.name} (${Math.round((i.ppsf_change ?? 0) * 100)}%)`),
    change_since_january: {
      apartments: { simple_median: r3(flat.raw_median - 1), like_for_like: r3(flat.like_for_like - 1) },
      villas: { simple_median: r3(villa.raw_median - 1), like_for_like: r3(villa.like_for_like - 1) },
      note: "The simple median moves when the mix of homes sold changes; like-for-like compares the same kind of homes.",
    },
    offplan_premium_like_for_like: { apartments: insights.models.Flat.offplan_premium, villas: insights.models.Villa.offplan_premium },
    insights_page: "/insights",
  };
}

function valueProjects(args: Args) {
  const type = asType(args.property_type);
  const direction = args.direction === "above" ? "above" : "below";
  const area = args.area ? findArea(String(args.area)).area?.name : undefined;
  const list = (direction === "below" ? insights.value.below : insights.value.above).filter((p) => (!type || p.type === type) && (!area || p.area === area));
  return {
    explanation: `Projects whose sales were ${direction} what the price model expects for their area, size, bedrooms and status (cross-validated). A gap can mean a bargain, or a real difference the model can't see, such as finish quality, floor or view.`,
    projects_scored: insights.value.projects_scored,
    results: list.map((p) => ({ ...p, premium_vs_model: p.premium, area_page: areas.find((a) => a.name === p.area) ? link(areas.find((a) => a.name === p.area)!) : null })),
    insights_page: "/insights",
  };
}

export const TOOLS: Record<string, (args: Args) => unknown> = {
  search_areas: searchAreas,
  get_area: getArea,
  compare_areas: compareAreas,
  estimate_price: estimatePrice,
  market_overview: marketOverview,
  value_projects: valueProjects,
};

// Declarations in the Gemini function-calling format (OpenAPI subset).
export const DECLARATIONS = [
  {
    name: "search_areas",
    description: "Find Dubai areas that match a budget and home type, using median 2026 sale prices. Use for questions like 'where can I buy a 2 bedroom under AED 1.5M'.",
    parameters: {
      type: "OBJECT",
      properties: {
        property_type: { type: "STRING", enum: ["Flat", "Villa"], description: "Flat = apartment. Villa includes townhouses." },
        bedrooms: { type: "INTEGER", description: "0 = studio" },
        max_budget_aed: { type: "NUMBER" },
        min_budget_aed: { type: "NUMBER" },
        near_metro: { type: "BOOLEAN", description: "Only areas where DLD lists a nearest metro station for most sales" },
        sort_by: { type: "STRING", enum: ["price_low", "price_high", "ppsf_low", "sales", "rising"] },
        limit: { type: "INTEGER", description: "1 to 10, default 6" },
      },
    },
  },
  {
    name: "get_area",
    description: "Full 2026 picture of one area: prices by type and bedrooms, top projects, off-plan share, price change. Accepts everyday names (JVC, Downtown, Marina) and project names.",
    parameters: { type: "OBJECT", properties: { name: { type: "STRING" } }, required: ["name"] },
  },
  {
    name: "compare_areas",
    description: "Side-by-side key numbers for 2 to 4 areas.",
    parameters: { type: "OBJECT", properties: { names: { type: "ARRAY", items: { type: "STRING" } } }, required: ["names"] },
  },
  {
    name: "estimate_price",
    description: "Machine-learning estimate of a fair sale price for one home. Size is optional; the typical size is used if missing.",
    parameters: {
      type: "OBJECT",
      properties: {
        area: { type: "STRING" },
        property_type: { type: "STRING", enum: ["Flat", "Villa"] },
        bedrooms: { type: "INTEGER" },
        size_sqft: { type: "NUMBER", description: "Convert square metres to sq ft (x 10.7639) first" },
        offplan: { type: "BOOLEAN", description: "true if bought before the building is finished" },
      },
      required: ["area"],
    },
  },
  {
    name: "market_overview",
    description: "Dubai-wide numbers for 2026: sales, medians, busiest/most expensive/cheapest/rising areas, whether prices are really falling (like-for-like), off-plan premium.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "value_projects",
    description: "Projects that sold below (or above) the price the model expects: possible bargains or premium projects.",
    parameters: {
      type: "OBJECT",
      properties: {
        direction: { type: "STRING", enum: ["below", "above"] },
        property_type: { type: "STRING", enum: ["Flat", "Villa"] },
        area: { type: "STRING" },
      },
    },
  },
];

export function runTool(name: string, args: Args) {
  const fn = TOOLS[name];
  if (!fn) return { error: `Unknown tool ${name}` };
  try {
    return fn(args ?? {});
  } catch (e) {
    return { error: `Tool failed: ${(e as Error).message}` };
  }
}
