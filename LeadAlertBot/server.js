/**
 * Lead Alert Bot — Render web service.
 *
 * Flow:
 *   Supabase Database Webhook (INSERT on new_clients)
 *     -> POST /webhook/new-lead  (this service, secured by WEBHOOK_SECRET)
 *     -> Telegram DM to the owner.
 *
 * All secrets live in Render env vars (never in code):
 *   TELEGRAM_BOT_TOKEN   BotFather token (same bot as WebsiteSellingBot)
 *   TELEGRAM_CHAT_ID     Your personal Telegram numeric id (DM target)
 *   WEBHOOK_SECRET       Shared secret Supabase must send in the x-webhook-secret header
 *   TELEGRAM_TOPIC_ID    (optional) thread id, only if CHAT_ID is a group
 */
const express = require("express");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "64kb" }));

function env(name) {
  return String(process.env[name] || "").trim();
}

function requireTelegramEnv() {
  const token = env("TELEGRAM_BOT_TOKEN");
  const chatId = env("TELEGRAM_CHAT_ID");
  const missing = [
    !token && "TELEGRAM_BOT_TOKEN",
    !chatId && "TELEGRAM_CHAT_ID",
  ].filter(Boolean);
  return { token, chatId, missing };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function fieldLine(label, value) {
  const v = String(value ?? "").trim();
  if (!v) return null;
  return `<b>${escapeHtml(label)}:</b> ${escapeHtml(v)}`;
}

function formatTimestamp(value) {
  const v = String(value ?? "").trim();
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function humanizeKey(key) {
  return String(key)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Lead Builder form fields, in the exact order they appear on template.html.
const LEAD_BUILDER_FIELDS = [
  ["business_name", "Business Name"],
  ["price", "Price"],
  ["google_maps", "Google Maps"],
  ["phone", "Phone"],
  ["preference", "Preference"],
  ["owner_name", "Owner Name"],
];

// Fields shown in their own sections (or intentionally hidden) so the
// "Other details" catch-all doesn't repeat them.
const HANDLED_KEYS = new Set([
  ...LEAD_BUILDER_FIELDS.map(([k]) => k),
  "id",
  "rep_id",
  "rep_name",
  "lead_id",
  "created_at",
  "sale_status",
]);

function formatLeadMessage(record) {
  const r = record || {};
  const lines = ["🟢 <b>New Lead Submitted</b>", ""];

  // 1) The lead, formatted exactly like the Lead Builder form.
  for (const [key, label] of LEAD_BUILDER_FIELDS) {
    const line = fieldLine(label, r[key]);
    if (line) lines.push(line);
  }

  // 2) Submission metadata.
  const meta = [
    fieldLine("Submitted by", r.rep_name || r.rep_id),
    fieldLine("Lead ID", r.lead_id),
    fieldLine("Submitted", formatTimestamp(r.created_at)),
    r.sale_status && r.sale_status !== "submitted"
      ? fieldLine("Sale status", r.sale_status)
      : null,
  ].filter(Boolean);
  if (meta.length) lines.push("", "—", ...meta);

  // 3) Catch-all: any other non-empty field, just in case.
  const extras = Object.keys(r)
    .filter((k) => !HANDLED_KEYS.has(k) && String(r[k] ?? "").trim() !== "")
    .map((k) => fieldLine(humanizeKey(k), r[k]))
    .filter(Boolean);
  if (extras.length) lines.push("", "<b>Other details</b>", ...extras);

  return lines.join("\n");
}

async function sendTelegram(text) {
  const { token, chatId, missing } = requireTelegramEnv();
  if (missing.length) {
    return { ok: false, status: 500, error: "Server not configured", missing_env: missing };
  }

  const body = {
    chat_id: /^-?\d+$/.test(chatId) ? Number(chatId) : chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };
  const topicId = env("TELEGRAM_TOPIC_ID");
  if (topicId) body.message_thread_id = Number(topicId);

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        status: 502,
        error: data.description || `Telegram API error (${res.status})`,
        telegram_error_code: data.error_code ?? null,
      };
    }
    return { ok: true, message_id: data.result?.message_id };
  } catch {
    return { ok: false, status: 502, error: "Failed to reach Telegram" };
  }
}

app.get(["/", "/healthz"], (_req, res) => {
  res.json({ ok: true, service: "lead-alert-bot" });
});

app.post("/webhook/new-lead", async (req, res) => {
  const expected = env("WEBHOOK_SECRET");
  const provided = String(req.headers["x-webhook-secret"] || "").trim();
  if (!expected || provided !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const payload = req.body || {};
  // Supabase Database Webhook shape: { type, table, schema, record, old_record }
  const record = payload.record || payload;
  if (payload.type && payload.type !== "INSERT") {
    return res.json({ ok: true, ignored: payload.type });
  }

  const result = await sendTelegram(formatLeadMessage(record));
  if (!result.ok) {
    return res.status(result.status || 502).json(result);
  }
  return res.json({ ok: true, message_id: result.message_id });
});

/**
 * Helper to find your numeric chat id during setup.
 * 1) DM your bot and send any message (e.g. "hi").
 * 2) Open  https://<your-app>.onrender.com/get-chat-id?secret=YOUR_WEBHOOK_SECRET
 * 3) Copy the "id" of your chat and set it as TELEGRAM_CHAT_ID in Render.
 */
app.get("/get-chat-id", async (req, res) => {
  const expected = env("WEBHOOK_SECRET");
  if (!expected || String(req.query.secret || "") !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = env("TELEGRAM_BOT_TOKEN");
  if (!token) return res.status(500).json({ error: "TELEGRAM_BOT_TOKEN not set" });

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
    const data = await r.json().catch(() => ({}));
    const chats = (data.result || [])
      .map((u) => u.message?.chat || u.channel_post?.chat)
      .filter(Boolean)
      .map((c) => ({ id: c.id, type: c.type, name: c.title || `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.username }));
    return res.json({ ok: true, chats, hint: "DM the bot first if this is empty" });
  } catch {
    return res.status(502).json({ error: "Failed to reach Telegram" });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Lead Alert Bot listening on port ${PORT}`);
  });
}

module.exports = { app, formatLeadMessage, sendTelegram };
