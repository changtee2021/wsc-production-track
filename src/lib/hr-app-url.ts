/** HR app URL for floor staff management (moved from /manage) */
export const HR_APP_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta.env?.VITE_HR_APP_URL as string | undefined)) ||
  "https://hr-wpgroup.vercel.app";

export function hrFloorStaffUrl(company: "WPT" | "WSC" = "WSC") {
  return `${HR_APP_URL}/hr/floor-staff?company=${company}`;
}
