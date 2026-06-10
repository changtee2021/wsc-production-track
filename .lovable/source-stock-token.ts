import { makeToken, readToken, type ModuleCompany } from "./module-token.server";

const TTL_MS = 1000 * 60 * 60 * 12;
const PREFIX = "stk";
const ENV = "PACKING_PASSWORD"; // reuse existing secret as HMAC fallback

export function issueStockToken(company: ModuleCompany = "wsc"): string {
  return makeToken(PREFIX, ENV, TTL_MS, company);
}
export function readStockToken(token: string | undefined | null) {
  return readToken(PREFIX, ENV, token);
}
export function verifyStockToken(token: string | undefined | null): boolean {
  return readStockToken(token) !== null;
}
