// Run the assistant's tools directly (no AI) to check their output: npx tsx scripts/try-tools.ts
import { findArea, runTool } from "../src/lib/assistant/tools";

const show = (label: string, v: unknown) => console.log(`\n# ${label}\n` + JSON.stringify(v, null, 1).slice(0, 900));
for (const q of ["JVC", "Downtown", "dubai marina", "Azizi Venice", "The Greens", "Palm", "Dubai Hills Estate", "Abu Dhabi", "Jumeirah"]) {
  const f = findArea(q);
  console.log(q.padEnd(20), "->", f.area?.name ?? `none, suggestions: ${f.suggestions?.join(", ")}`, f.via ? `(${f.via})` : "");
}
show("search 2BR flat under 1.5M near metro", runTool("search_areas", { property_type: "Flat", bedrooms: 2, max_budget_aed: 1500000, near_metro: true }));
show("estimate", runTool("estimate_price", { area: "JVC", property_type: "Flat", bedrooms: 1 }));
show("compare", runTool("compare_areas", { names: ["JVC", "Business Bay", "Nowhere"] }));
show("value", runTool("value_projects", { direction: "below", property_type: "Flat" }));
show("market", runTool("market_overview", {}));
