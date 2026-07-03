// ─── AI PROXY (Vercel Serverless Function) ───────────────────────────────────
// Keeps the Anthropic API key server-side instead of baking it into the JS
// bundle. Set ANTHROPIC_API_KEY in Vercel → Project → Settings → Environment
// Variables, then redeploy. Supports optional web search for docs lookup.

export default async function handler(req, res) {
  const key = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;

  // GET = health check: visit /api/ai in a browser to see if the key is configured
  if (req.method === "GET") {
    return res.status(200).json({
      status: "AI proxy is deployed",
      keyConfigured: !!key,
      message: key
        ? "✅ API key is set — parser should work. If scans still fail, the toast will show the exact error."
        : "❌ No API key found. Add ANTHROPIC_API_KEY in Vercel → Settings → Environment Variables, then Redeploy.",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }
  if (!key) {
    return res.status(500).json({
      error:
        "ANTHROPIC_API_KEY is not set. Add it in Vercel → Project → Settings → Environment Variables, then redeploy.",
    });
  }

  const { prompt, image, useWebSearch, maxTokens } = req.body || {};
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });

  const content = [];
  if (image && image.data) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: image.mediaType || "image/jpeg",
        data: image.data,
      },
    });
  }
  content.push({ type: "text", text: prompt });

  const body = {
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens || 2000,
    messages: [{ role: "user", content }],
  };
  if (useWebSearch) {
    body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }];
    body.max_tokens = Math.max(body.max_tokens, 3000);
  }

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) {
      return res
        .status(r.status)
        .json({ error: data?.error?.message || `Anthropic API error ${r.status}` });
    }
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(502).json({ error: "Upstream call failed: " + e.message });
  }
}
