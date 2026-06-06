// Admin-only: send a comprehensive daily business overview via LINE Messaging
// API push. Delegates to the shared helper in line.server.ts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { verifyAdminToken } from "./admin-token.server";
import { sendDailySummary } from "./line.server";

function assertAdmin(token: string | undefined) {
  if (!verifyAdminToken(token)) throw new Error("Unauthorized");
}

export const adminSendLineTest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.token);
    return await sendDailySummary();
  });
