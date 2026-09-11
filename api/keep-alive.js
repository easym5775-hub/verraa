// ================================================================
// VERRAA — keep-alive endpoint (free Supabase pause prevention).
//
// Why: Supabase pauses Free projects after ~7 days without user DB
// activity. Hitting this endpoint once a day generates a tiny real
// PostgREST query (coach_plans?select=id&limit=1) which counts as
// activity and keeps the project alive.
//
// Called by (any one is enough, two is safer):
//   1. Vercel Cron      -> GET /api/keep-alive  (see vercel.json `crons`)
//   2. UptimeRobot      -> GET https://<your-app>.vercel.app/api/keep-alive
//   3. GitHub Actions   -> .github/workflows/keep-alive.yml (pings Supabase directly)
//
// Env (Vercel -> Project -> Settings -> Environment Variables):
//   SUPABASE_URL       (= same value as VITE_SUPABASE_URL)
//   SUPABASE_ANON_KEY  (= same value as VITE_SUPABASE_ANON_KEY)
//   KEEP_ALIVE_SECRET  (optional — if set, callers must send ?secret=... )
//
// Cost: one ~1KB SELECT per day. Negligible.
// ================================================================

export default async function handler(req, res) {
  // Never cache — every hit must reach Supabase.
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");

  // UptimeRobot / browsers use GET, some monitors use HEAD.
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).json({ ok: false, error: "Method not allowed, use GET." });
    return;
  }

  // Optional shared secret (recommended if the URL becomes public).
  const requiredSecret = (process.env.KEEP_ALIVE_SECRET ?? "").trim();
  if (requiredSecret) {
    const url = new URL(req.url ?? "/api/keep-alive", "http://localhost");
    const provided =
      url.searchParams.get("secret") ??
      (Array.isArray(req.query?.secret) ? req.query.secret[0] : req.query?.secret) ??
      "";
    if (provided !== requiredSecret) {
      res.status(401).json({ ok: false, error: "Invalid secret." });
      return;
    }
  }

  // Support both server-style and existing VITE_ names so you only
  // have to copy the same two values you already use in `.env`.
  const supabaseUrl = (
    process.env.SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL ??
    ""
  ).trim().replace(/\/+$/, "");
  const anonKey = (
    process.env.SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY ??
    ""
  ).trim();

  if (!supabaseUrl || !anonKey) {
    res.status(500).json({
      ok: false,
      error:
        "Supabase env missing. Set SUPABASE_URL + SUPABASE_ANON_KEY (same values as VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) in Vercel.",
    });
    return;
  }

  // Smallest possible real DB hit: coach_plans is publicly readable
  // (the app loads it on every boot without login), 1 row, 1 column.
  const target = `${supabaseUrl}/rest/v1/coach_plans?select=id&limit=1`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let resp;
    try {
      resp = await fetch(target, {
        method: "GET",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!resp.ok) {
      const body = (await resp.text()).slice(0, 300);
      res.status(502).json({
        ok: false,
        error: `Supabase answered ${resp.status}: ${body || resp.statusText}`,
      });
      return;
    }

    if (req.method === "HEAD") {
      res.status(200).end();
      return;
    }
    res.status(200).json({ ok: true, at: new Date().toISOString() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(502).json({ ok: false, error: `Cannot reach Supabase: ${msg}` });
  }
}
