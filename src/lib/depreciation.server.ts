// Straight-line monthly depreciation helper.
// monthlyDep = (purchase_price - salvage_value) / useful_life_months
// Returns 0 when inputs are missing or invalid.

export type DepreciableAsset = {
  id: string;
  name: string;
  code: string;
  purchase_price: number | null;
  salvage_value: number | null;
  useful_life_months: number | null;
  purchase_date: string | null;
};

export function monthlyDepreciation(a: DepreciableAsset): number {
  const price = Number(a.purchase_price ?? 0);
  const salvage = Number(a.salvage_value ?? 0);
  const months = Number(a.useful_life_months ?? 0);
  if (!price || months <= 0) return 0;
  const v = (price - salvage) / months;
  return v > 0 ? Math.round(v * 100) / 100 : 0;
}

/** Months elapsed since purchase_date (capped by useful_life_months). */
export function monthsInService(a: DepreciableAsset, asOf: Date = new Date()): number {
  if (!a.purchase_date) return 0;
  const p = new Date(a.purchase_date);
  if (isNaN(p.getTime())) return 0;
  const months =
    (asOf.getFullYear() - p.getFullYear()) * 12 +
    (asOf.getMonth() - p.getMonth());
  if (months <= 0) return 0;
  const life = Number(a.useful_life_months ?? 0);
  return life > 0 ? Math.min(months, life) : months;
}

export function accumulatedDepreciation(a: DepreciableAsset, asOf?: Date): number {
  return Math.round(monthlyDepreciation(a) * monthsInService(a, asOf) * 100) / 100;
}

export function bookValue(a: DepreciableAsset, asOf?: Date): number {
  const price = Number(a.purchase_price ?? 0);
  const v = price - accumulatedDepreciation(a, asOf);
  return Math.round(Math.max(v, Number(a.salvage_value ?? 0)) * 100) / 100;
}
