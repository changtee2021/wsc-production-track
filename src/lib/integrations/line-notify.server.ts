// Server-only LINE notification helpers for the expense workflow.
// Reuses LINE_CHANNEL_ACCESS_TOKEN + LINE_TARGET_GROUP_ID secrets.

import { serverAppPublicUrl } from "@/lib/app-public-url";

async function pushText(text: string): Promise<void> {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const targetId = process.env.LINE_TARGET_GROUP_ID || process.env.LINE_TARGET_USER_ID;
  if (!accessToken || !targetId) return; // silently skip if not configured
  try {
    await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        to: targetId,
        messages: [{ type: "text", text: text.slice(0, 4900) }],
      }),
    });
  } catch (e) {
    console.error("LINE push failed", e);
  }
}

const APP = serverAppPublicUrl();

export async function notifyExpenseSubmitted(args: {
  exp_no: string;
  requester_name: string;
  merchant_name: string | null;
  total: number;
  bill_type: string;
}) {
  const typeLabel =
    args.bill_type === "full_tax" ? "ใบกำกับเต็ม"
    : args.bill_type === "short_tax" ? "ใบกำกับย่อ" : "บิลเงินสด";
  await pushText(
    `🧾 [WSC Expense] เบิกใหม่\n` +
    `${args.exp_no} — ${args.requester_name}\n` +
    `ร้าน: ${args.merchant_name ?? "—"}\n` +
    `ยอด: ฿${args.total.toLocaleString()} (${typeLabel})\n` +
    `อนุมัติได้ที่: ${APP}/expenses-dashboard`,
  );
}

export async function notifyExpenseStatusChanged(args: {
  exp_no: string;
  requester_name: string;
  status: "approved" | "rejected" | "paid";
  approver_name?: string | null;
  reason?: string | null;
  total?: number;
}) {
  const statusLabel =
    args.status === "approved" ? "✅ อนุมัติแล้ว"
    : args.status === "rejected" ? "❌ ไม่อนุมัติ" : "💸 จ่ายเงินแล้ว";
  const lines = [
    `🧾 [WSC Expense] ${statusLabel}`,
    `${args.exp_no} — ${args.requester_name}`,
  ];
  if (args.total) lines.push(`ยอด: ฿${args.total.toLocaleString()}`);
  if (args.approver_name) lines.push(`โดย: ${args.approver_name}`);
  if (args.reason) lines.push(`เหตุผล: ${args.reason}`);
  lines.push(`รายละเอียด: ${APP}/expense-mine`);
  await pushText(lines.join("\n"));
}
