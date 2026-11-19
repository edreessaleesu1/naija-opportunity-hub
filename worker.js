/*
  Naija Opportunity Hub - Cloudflare Worker
  Gives every /opportunity-details?id=... page its own title, description,
  canonical link, heading and summary BEFORE the page reaches the browser,
  so Google sees a unique page instead of an empty "Loading" shell.
  Everything else on the site is served as normal static files.
*/
const SITE = "https://naijaopportunityhub.com.ng";
const SUPABASE_URL = "https://djxornmwvkauhkcuhgxc.supabase.co";
const SUPABASE_KEY = "sb_publishable_EDReCY3JcN4vMuypVfqcMQ_GcTEVuBq";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clip = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s; };

async function getPage(env, url) {
  let res = await env.ASSETS.fetch(new Request(new URL("/opportunity-details", url).href));
  for (let i = 0; i < 2 && res.status >= 300 && res.status < 400; i++) {
    const loc = res.headers.get("Location");
    if (!loc) break;
    res = await env.ASSETS.fetch(new Request(new URL(loc, url).href));
  }
  return res;
}

async function getOpportunity(id) {
  const q = new URLSearchParams({ select: "*", id: "eq." + id, status: "in.(published,closed)", limit: "1" });
  const r = await fetch(SUPABASE_URL + "/rest/v1/opportunities?" + q, {
    headers: { apikey: SUPABASE_KEY, Accept: "application/json" },
    cf: { cacheTtl: 300, cacheEverything: true },
  });
  if (!r.ok) return null;
  const rows = await r.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

function paragraphs(o) {
  const parts = [];
  if (o.description) parts.push(String(o.description));
  if (o.eligibility) parts.push("Eligibility: " + String(o.eligibility));
  return parts.join("\n\n").split(/\n{1,}/).map((t) => t.trim()).filter(Boolean).map((t) => "<p>" + esc(t) + "</p>").join("");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const page = await getPage(env, url);
    const id = (url.searchParams.get("id") || "").toLowerCase();
    if (!page.ok || !UUID.test(id)) return page;

    let o = null;
    try { o = await getOpportunity(id); } catch (e) { return page; }
    if (!o) {
      return new HTMLRewriter()
        .on("head", { element(el) { el.append('<meta name="robots" content="noindex">', { html: true }); } })
        .transform(page);
    }

    const title = clip(o.title || "Opportunity", 62);
    const fullTitle = title + " | Naija Opportunity Hub";
    const desc = clip(
      o.description ||
        [o.organization, o.category, o.location].filter(Boolean).join(" - ") + ". Eligibility, deadline and how to apply on Naija Opportunity Hub.",
      158
    );
    const canonical = SITE + "/opportunity-details?id=" + id;
    const img = o.image_url && /^https:\/\//i.test(o.image_url) ? o.image_url : SITE + "/naija-opportunity-hub-logo.png";
    const deadline = o.deadline ? String(o.deadline).slice(0, 10) : "";

    const rewriter = new HTMLRewriter()
      .on("title", { element(el) { el.setInnerContent(fullTitle); } })
      .on('meta[name="description"]', { element(el) { el.setAttribute("content", desc); } })
      .on("head", {
        element(el) {
          el.append(
            '<link rel="canonical" href="' + esc(canonical) + '">' +
              '<meta property="og:type" content="article">' +
              '<meta property="og:title" content="' + esc(fullTitle) + '">' +
              '<meta property="og:description" content="' + esc(desc) + '">' +
              '<meta property="og:url" content="' + esc(canonical) + '">' +
              '<meta property="og:image" content="' + esc(img) + '">' +
              '<meta name="twitter:card" content="summary_large_image">' +
              '<meta name="twitter:title" content="' + esc(fullTitle) + '">' +
              '<meta name="twitter:description" content="' + esc(desc) + '">' +
              '<meta name="twitter:image" content="' + esc(img) + '">',
            { html: true }
          );
        },
      })
      .on("#loadingState", { element(el) { el.setAttribute("hidden", ""); } })
      .on("#detailsContent", { element(el) { el.removeAttribute("hidden"); } })
      .on("#opportunityTitle", { element(el) { el.setInnerContent(o.title || title); } })
      .on("#opportunityOrganisation", { element(el) { el.setInnerContent(o.organization || ""); } })
      .on("#opportunityCategory", { element(el) { if (o.category) el.setInnerContent(o.category); } })
      .on("#factDeadlineVal", { element(el) { if (deadline) el.setInnerContent(deadline); } })
      .on("#factLocationVal", { element(el) { if (o.location) el.setInnerContent(o.location); } })
      .on("#factCategoryVal", { element(el) { if (o.category) el.setInnerContent(o.category); } })
      .on("#opportunityDescription", { element(el) { const h = paragraphs(o); if (h) el.setInnerContent(h, { html: true }); } });

    const out = rewriter.transform(page);
    const headers = new Headers(out.headers);
    headers.set("Cache-Control", "public, max-age=0, s-maxage=300");
    return new Response(out.body, { status: 200, headers });
  },
};
