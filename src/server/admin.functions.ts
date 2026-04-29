import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const verifyAdminPassword = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ password: z.string().min(1).max(200) }).parse(data),
  )
  .handler(async ({ data }) => {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) {
      return { ok: false as const, error: "Admin password not configured" };
    }
    if (data.password === expected) {
      return { ok: true as const };
    }
    return { ok: false as const, error: "Incorrect password" };
  });
