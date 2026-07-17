import { setQcToken, clearQcSession } from "@/lib/auth/qc-session";
import { setPackingToken, clearPackingSession } from "@/lib/auth/packing-session";
import { setWarehouseToken, clearWarehouseSession } from "@/lib/auth/warehouse-session";
import { setStockToken, clearStockSession } from "@/lib/auth/stock-session";

export type DeptTokenBundle = {
  qc?: string;
  packing?: string;
  warehouse?: string;
  stock?: string;
};

/** Drop floor dept tokens so a previous shift cannot linger on a shared device. */
export function clearDeptTokens() {
  clearQcSession();
  clearPackingSession();
  clearWarehouseSession();
  clearStockSession();
}

/** Apply dept HMAC tokens issued at employee login so floor pages skip secondary passwords. */
export function applyDeptTokens(tokens: DeptTokenBundle | undefined) {
  clearDeptTokens();
  if (!tokens) return;
  if (tokens.qc) setQcToken(tokens.qc);
  if (tokens.packing) setPackingToken(tokens.packing);
  if (tokens.warehouse) setWarehouseToken(tokens.warehouse);
  if (tokens.stock) setStockToken(tokens.stock);
}
