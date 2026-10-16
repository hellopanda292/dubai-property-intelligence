import type { PropertyType } from "./types";

/*
 * The price model is a gradient-boosting regressor trained in Python (pipeline/build.py) and
 * exported as plain JSON: each tree is a list of nodes. predictLogPpsf walks every tree and adds up
 * the leaf values, exactly like scikit-learn does (the pipeline asserts this). Used by the estimator
 * page in the browser and by the AI assistant on the server.
 */
export interface Tree { f: number[]; t: number[]; l: number[]; r: number[]; v: number[]; leaf: number[] }
export interface PriceModel {
  baseline: number;
  trees: Tree[];
  band: { low: number; high: number };
  type_value: Record<PropertyType, number>;
  global_value: number;
  areas: Record<string, { value: number; sales_log: number; types: Partial<Record<PropertyType, number>> }>;
}

export const SQM_TO_SQFT = 10.7639;
export const SIZE_LIMITS: Record<PropertyType, { min: number; max: number }> = { Flat: { min: 200, max: 6000 }, Villa: { min: 700, max: 20000 } };

export function predictLogPpsf(model: PriceModel, x: number[]) {
  let total = model.baseline;
  for (const tree of model.trees) {
    let i = 0;
    while (!tree.leaf[i]) i = x[tree.f[i]] <= tree.t[i] ? tree.l[i] : tree.r[i];
    total += tree.v[i];
  }
  return total;
}

/** Price per sq ft for one home, or null if the area is unknown to the model. */
export function estimatePpsf(model: PriceModel, o: { area: string; type: PropertyType; bedrooms: number; sqft: number; offplan: boolean }) {
  const enc = model.areas[o.area];
  if (!enc) return null;
  const x = [enc.value, enc.types[o.type] ?? model.type_value[o.type], enc.sales_log, o.type === "Villa" ? 1 : 0, o.offplan ? 1 : 0, o.bedrooms, Math.log(o.sqft)];
  return Math.exp(predictLogPpsf(model, x));
}

export const roundPrice = (n: number) => (n >= 1e6 ? Math.round(n / 10000) * 10000 : Math.round(n / 1000) * 1000);
