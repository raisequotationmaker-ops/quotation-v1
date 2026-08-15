// Follow-up reminder emails via Zoho Mail API
// Deploy: supabase functions deploy send-followup-reminders --project-ref <RLE_PROJECT>
// Schedule: daily cron via Supabase Dashboard → Edge Functions → Schedules
// Secrets: ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_FROM_ADDRESS, ZOHO_ACCOUNT_ID, APP_URL

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ZOHO_TOKEN_URL = "https://accounts.zoho.in/oauth/v2/token";
const ZOHO_API_BASE = "https://mail.zoho.in/api/accounts";

async function getZohoAccessToken() {
  const clientId = Deno.env.get("ZOHO_CLIENT_ID");
  const clientSecret = Deno.env.get("ZOHO_CLIENT_SECRET");
  const refreshToken = Deno.env.get("ZOHO_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing Zoho OAuth env vars");
  }
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });
  const res = await fetch(ZOHO_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Zoho token refresh failed: ${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token as string;
}

async function sendZohoMail(
  accessToken: string,
  toAddress: string,
  subject: string,
  content: string,
) {
  const accountId = Deno.env.get("ZOHO_ACCOUNT_ID");
  const fromAddress = Deno.env.get("ZOHO_FROM_ADDRESS");
  if (!accountId || !fromAddress) throw new Error("Missing Zoho account/from");

  const res = await fetch(`${ZOHO_API_BASE}/${accountId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fromAddress,
      toAddress,
      subject,
      content,
      mailFormat: "html",
    }),
  });
  if (!res.ok) {
    throw new Error(`Zoho send failed: ${await res.text()}`);
  }
}

Deno.serve(async (req) => {
  try {
    // Optional shared secret for cron
    const cronSecret = Deno.env.get("CRON_SECRET");
    if (cronSecret) {
      const header = req.headers.get("Authorization");
      if (header !== `Bearer ${cronSecret}`) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
        });
      }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = new Date().toISOString().slice(0, 10);

    const { data: due, error } = await supabase
      .from("quotations")
      .select("id, quotation_number, created_by, client_name, client_company")
      .eq("follow_up_date", today)
      .eq("reminder_sent", false);

    if (error) throw error;
    if (!due?.length) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const ownerIds = [...new Set(due.map((d) => d.created_by))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ownerIds);

    const { data: users } = await supabase.auth.admin.listUsers({
      perPage: 1000,
    });
    const emailById = new Map(
      (users?.users ?? []).map((u) => [u.id, u.email ?? ""]),
    );
    const nameById = new Map(
      (profiles ?? []).map((p) => [p.id, p.full_name ?? ""]),
    );

    const accessToken = await getZohoAccessToken();
    const appUrl = Deno.env.get("APP_URL") || "http://localhost:3000";
    let sent = 0;

    for (const q of due) {
      const to = emailById.get(q.created_by);
      if (!to) continue;
      const name = nameById.get(q.created_by) || "there";
      const link = `${appUrl}/quotations/${q.id}`;
      const subject = `Follow-up reminder: ${q.quotation_number}`;
      const content = `
        <p>Hi ${name},</p>
        <p>This is a reminder to follow up on quotation <strong>${q.quotation_number}</strong>
        for ${q.client_name ?? ""} (${q.client_company ?? ""}).</p>
        <p><a href="${link}">Open quotation</a></p>
        <p>— RLE Quotation Maker</p>
      `;
      await sendZohoMail(accessToken, to, subject, content);
      await supabase
        .from("quotations")
        .update({ reminder_sent: true })
        .eq("id", q.id);
      sent += 1;
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
