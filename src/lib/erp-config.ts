/** Shared Supabase ERP project — WP GROUP (cutover after hours) */
export const ERP_PROJECT_ID = "erpzxusskbtdxvqadwxv";

export const SUPABASE_SCHEMA =
  (typeof import.meta !== "undefined" &&
    (import.meta.env?.VITE_SUPABASE_SCHEMA as string | undefined)) ||
  (typeof process !== "undefined" ? process.env.SUPABASE_SCHEMA : undefined) ||
  "wsc_production";

/** Set false in env until legacy Supabase cutover completes */
export const ERP_CUTOVER_PENDING =
  typeof process !== "undefined" && process.env.ERP_CUTOVER_PENDING === "true";

export const APP_SLUG = "wsc-production-track";
