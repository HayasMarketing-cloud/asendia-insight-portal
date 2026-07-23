import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  account_slug: z.string().trim().min(1).max(100),
  domain: z.string().trim().min(1).max(253),
  review_values: z.record(z.string(), z.unknown()),
});

export const requestRescore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const url = process.env.N8N_RESCORE_URL;
    const secret = process.env.RESCORE_SECRET;
    if (!url) {
      return { status: 503, body: { error: "rescore webhook not configured yet" } };
    }
    if (!secret) {
      return { status: 500, body: { error: "RESCORE_SECRET not configured" } };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-rescore-secret": secret,
      },
      body: JSON.stringify({
        account_slug: data.account_slug,
        domain: data.domain,
        review_values: data.review_values,
        reviewed_by: context.userId,
      }),
    });

    const bodyText = await res.text();
    return { status: res.status, body: bodyText };
  });
