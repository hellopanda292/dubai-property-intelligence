import areasJson from "@/data/generated/areas.json";
import marketJson from "@/data/generated/market.json";
import metaJson from "@/data/generated/meta.json";
import type { Area, Market, Meta } from "./types";

export const areas = areasJson as Area[];
export const market = marketJson as Market;
export const meta = metaJson as Meta;

export function getArea(slug: string): Area | undefined {
  return areas.find((a) => a.slug === slug);
}

/** Small list used by client components (search box, estimator) so they don't ship every area's details. */
export const areaIndex = areas
  .map((a) => ({ slug: a.slug, name: a.name, sales: a.sales, median_ppsf: a.median_ppsf, types: Object.keys(a.types) }))
  .sort((a, b) => a.name.localeCompare(b.name));

export type AreaIndexItem = (typeof areaIndex)[number];
