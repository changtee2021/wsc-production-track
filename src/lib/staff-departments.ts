/** Shared department ids for staff directory + employee floor login (client-safe). */

export const DEPARTMENTS = [
  "production",
  "qc",
  "packing",
  "maintenance",
  "office",
  "stock",
  "warehouse",
  "transport",
] as const;

export type Department = (typeof DEPARTMENTS)[number];
