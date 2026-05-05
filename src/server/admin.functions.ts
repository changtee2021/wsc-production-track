import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { timingSafeEqual } from "crypto";

export const verifyAdminPassword = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ password: z.string().min(1).max(200) }).parse(data),
  )
  .handler(async ({ data }) => {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) {
      return { ok: false as const, error: "Admin password not configured" };
    }
    // Timing-safe comparison to prevent password length / content side-channel.
    const a = Buffer.from(data.password);
    const b = Buffer.from(expected);
    const equal = a.length === b.length && timingSafeEqual(a, b);
    return equal
      ? ({ ok: true as const })
      : ({ ok: false as const, error: "Incorrect password" });
  });
