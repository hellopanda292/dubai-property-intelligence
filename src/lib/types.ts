// Shapes of the JSON files written by pipeline/build.py.

export type PropertyType = "Flat" | "Villa";

export interface Place {
  name: string;
  share: number;
}

export interface BedroomRow {
  type: PropertyType;
  bedrooms: number;
  sales: number;
  median_price: number;
  p25_price: number;
  p75_price: number;
  median_ppsf: number;
  median_sqft: number;
}

export interface TypeStats {
  sales: number;
  median_price: number;
  median_ppsf: number;
  median_sqft?: number;
}

export interface Area {
  slug: string;
  name: string;
  sales: number;
  total_value: number;
  median_price: number;
  median_ppsf: number;
  offplan_share: number;
  villa_share: number;
  ppsf_change: number | null;
  types: Partial<Record<PropertyType, TypeStats>>;
  bedrooms: BedroomRow[];
  monthly: { month: string; sales: number; median_ppsf: number }[];
  projects: { name: string; sales: number; median_ppsf: number; median_price: number; offplan_share: number }[];
  metro: Place | null;
  mall: Place | null;
  landmark: Place | null;
}

export interface RankItem {
  slug: string;
  name: string;
  sales: number;
  median_ppsf?: number;
  ppsf_change?: number;
}

export interface Market {
  sales: number;
  total_value: number;
  median_price: number;
  median_ppsf: number;
  offplan_share: number;
  areas: number;
  by_type: Record<PropertyType, TypeStats>;
  bedrooms: { type: PropertyType; bedrooms: number; sales: number; median_price: number }[];
  monthly: {
    month: string;
    sales: number;
    value: number;
    flat_sales?: number;
    flat_ppsf?: number;
    villa_sales?: number;
    villa_ppsf?: number;
  }[];
  top: { busiest: RankItem[]; expensive: RankItem[]; affordable: RankItem[]; rising: RankItem[] };
}

export interface Accuracy {
  median_error: number;
  within_10: number;
  within_20: number;
}

export interface Meta {
  period: { from: string; to: string };
  cleaning: { sales: { step: string; rows: number }[] };
  model: {
    train_months: [string, string];
    test_months: string[];
    train_sales: number;
    test_sales: number;
    model: Accuracy;
    baseline: Accuracy;
    band: { low: number; high: number };
  };
  source: string;
}

export interface ProjectValue {
  project: string;
  area: string;
  type: PropertyType;
  sales: number;
  premium: number;
  median_ppsf: number;
  median_price: number;
  offplan_share: number;
}

export interface TypeModel {
  offplan_premium: number;
  size_elasticity: number;
  ppsf_change_10pct_bigger: number;
  index: { month: string; like_for_like: number; raw_median: number }[];
  sales: number;
}

export interface Insights {
  value: { projects_scored: number; within_10: number; below: ProjectValue[]; above: ProjectValue[]; cv_median_error: number };
  models: Record<PropertyType, TypeModel>;
  offplan_areas: { area: string; premium: number; compared: number; sales: number }[];
  bedrooms: { bedrooms: number; relative_ppsf: number; areas: number }[];
  area_changes: { area: string; sales: number; raw_change: number; like_for_like: number }[];
}
