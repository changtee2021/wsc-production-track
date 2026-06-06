// Single source of truth for the app's displayed version code.
// AI assistant updates `revision` (+1) and `date` (DD.MM.YY) on every code change.
export const APP_VERSION = {
  code: "APP-QC-000",
  revision: "R.00",
  date: "06.06.26", // DD.MM.YY
} as const;

export const APP_VERSION_STRING =
  `${APP_VERSION.code} ${APP_VERSION.revision} bfd ${APP_VERSION.date}`;
