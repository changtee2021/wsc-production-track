// Admin-only: send a LINE push message via the LINE Messaging API to verify
// integration. Uses LINE_CHANNEL_ACCESS_TOKEN + LINE_TARGET_USER_ID secrets.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { verifyAdminToken } from "./admin-token.server";

function assertAdmin(token: string | undefined) {
  if (!verifyAdminToken(token)) throw new Error("Unauthorized");
}

export const adminSendLineTest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);

    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const targetUserId = process.env.LINE_TARGET_USER_ID;
    if (!accessToken) throw new Error("ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN");
    if (!targetUserId) throw new Error("ยังไม่ได้ตั้งค่า LINE_TARGET_USER_ID");

    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        to: targetUserId,
        messages: [
          {
            type: "text",
            text: "🎯 Test Notification from WSC Production Track App! Your LINE integration is working 100% perfectly.",
          },
        ],
      }),
    });

    if (!res.ok) {
      let detail = "";
      try {
        const body = await res.text();
        detail = body.slice(0, 300);
      } catch {
        // ignore
      }
      throw new Error(`LINE API ${res.status}: ${detail || res.statusText}`);
    }

    return { ok: true as const, sentAt: new Date().toISOString() };
  });
