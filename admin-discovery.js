/*
 * NOH Admin — Opportunity discovery, review and publishing dashboard
 * Every button maps to a real backend call:
 *   noh-discover-opportunities       Start Discovery
 *   noh-publish-opportunities        stop_discovery, validate, review_list, approve, bulk_approve,
 *                                    reject, bulk_reject, grant/revoke/permission_status,
 *                                    publish_approved, publish_log
 *   noh-prepare-discovery-images     Prepare Images, Retry Failed Images
 */
(() => {
  "use strict";

  const SUPABASE_URL = "https://djxornmwvkauhkcuhgxc.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_EDReCY3JcN4vMuypVfqcMQ_GcTEVuBq";
  const PUBLISHER = "noh-publish-opportunities";
  const IMAGE_FUNCTION = "noh-prepare-discovery-images";
  const DISCOVERY_FUNCTION = "noh-discover-opportunities";

  const IMAGE_BATCH = 6;          // backend limit per image request
  const MAX_BATCH = 100;          // backend limit per approve/publish request
  const PAGE_SIZE = 25;           // cards shown per "Load more"
  const AUTO_IMAGE_ROUNDS = 3;    // images prepared automatically after discovery
  const IMAGE_ROUND_CAP = 25;     // safety cap for the Prepare Images loop

  const $ = id => document.getElementById(id);

  let db = null;
  let rows = [];
  let counts = {};
  let selected = new Set();
  let permission = "not_granted";
  let shown = PAGE_SIZE;
  let newIds = new Set();          // records found by the latest discovery run
  let op = null;                   // name of the running operation, or null
  let stopRequested = false;

  /* ---------------------------------------------------------------- helpers */
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  const safeHttps = v => {
    try { const u = new URL(String(v)); return u.protocol === "https:" ? u.href : ""; }
    catch { return ""; }
  };

  const dateTime = v => {
    const d = v ? new Date(v) : null;
    return d && !Number.isNaN(d.getTime())
      ? d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "Not supplied";
  };
  const dateOnly = v => {
    const d = v ? new Date(String(v) + "T00:00:00") : null;
    return d && !Number.isNaN(d.getTime())
      ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Not supplied";
  };

  function notice(message, error = false) {
    const el = $("notice");
    if (el) { el.textContent = message; el.classList.toggle("error", error); }
    let bar = $("nohFixedNotice");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "nohFixedNotice";
      bar.setAttribute("role", "status");
      bar.style.cssText =
        "position:fixed;left:10px;right:10px;bottom:10px;z-index:99999;padding:12px 14px;border-radius:12px;" +
        "font:600 14px/1.4 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.25);max-height:40vh;overflow:auto";
      document.body.appendChild(bar);
    }
    bar.textContent = message;
    bar.style.background = error ? "#fde8e8" : "#e6f4ea";
    bar.style.color = error ? "#8a1c1c" : "#14532d";
    bar.style.border = "1px solid " + (error ? "#f5b5b5" : "#b7dfc2");
    bar.hidden = false;
    clearTimeout(bar._t);
    if (!error) bar._t = setTimeout(() => { bar.hidden = true; }, 10000);
  }

  window.addEventListener("error", e => notice("Page error: " + (e.message || "unknown"), true));
  window.addEventListener("unhandledrejection", e =>
    notice("Page error: " + (e.reason?.message || e.reason || "unknown"), true));

  // Warn if a request is slow, but keep waiting for the real result.
  async function patient(promise, ms, what) {
    let timer;
    const slow = new Promise(resolve => {
      timer = setTimeout(() => {
        notice(`${what} is taking longer than usual. It is still running; please do not start it again.`, true);
        resolve({ slow: true });
      }, ms);
    });
    try {
      const first = await Promise.race([Promise.resolve(promise).then(value => ({ value })), slow]);
      return first.slow ? await promise : first.value;
    } finally { clearTimeout(timer); }
  }

  async function unwrap(result, what) {
    const { data, error } = result;
    if (error) {
      let message = error.message || what + " failed.";
      if (error.context && typeof error.context.json === "function") {
        const detail = await error.context.json().catch(() => null);
        if (detail?.error) message = detail.error;
        if (detail?.detail) message += " — " + detail.detail;
      }
      throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
    return data ?? {};
  }

  const publisher = async (action, extra = {}) =>
    unwrap(await db.functions.invoke(PUBLISHER, { body: { action, ...extra } }), "The publisher request");

  async function requireAdmin() {
    const { data: { session }, error } = await db.auth.getSession();
    if (error || !session?.user) {
      throw new Error("Sign in to your NOH administrator account first, then reopen this page.");
    }
    const { data: admin, error: adminError } = await db.from("admins")
      .select("user_id").eq("user_id", session.user.id).maybeSingle();
    if (adminError || !admin) throw new Error("This account is not listed as a NOH administrator.");
    return session.user;
  }

  /* ----------------------------------------------------- record state logic */
  const REQUIRED = [
    ["title", "title"], ["organization", "organisation"], ["category", "category"],
    ["description", "description"], ["application_url", "application link"],
    ["source_url", "source link"], ["image_url", "image"]
  ];

  const missingFields = row => REQUIRED
    .filter(([k]) => !String(row[k] ?? "").trim())
    .map(([, label]) => label);

  // The image must be this record's own Storage object (jpg/png/webp/gif/avif or generated svg).
  function ownImage(row) {
    const url = safeHttps(row.image_url);
    if (!url || !row.id) return false;
    const id = String(row.id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(
      "^https://djxornmwvkauhkcuhgxc\\.supabase\\.co/storage/v1/object/public/opportunity-images/" +
      id + "\\.(jpg|png|webp|gif|avif|svg)$", "i").test(url);
  }

  // DISCOVERED → (checks) → IMAGE_PENDING → READY_FOR_REVIEW → APPROVED → PUBLISHED
  function stageOf(row) {
    if (row.status === "rejected") return "REJECTED";
    if (row.status === "imported") return "PUBLISHED";
    if (row.status === "approved") return row.publish_error ? "PUBLISH_FAILED" : "APPROVED";
    if (row.image_status === "failed") return "IMAGE_FAILED";
    if (!ownImage(row)) {
      return row.validation_status === "unchecked" && !(row.enrich_attempts > 0) ? "DISCOVERED" : "IMAGE_PENDING";
    }
    const gaps = missingFields(row).filter(x => x !== "image");
    return gaps.length ? "NEEDS_DETAILS" : "READY_FOR_REVIEW";
  }

  const STAGE_LABEL = {
    DISCOVERED: ["Discovered", "info"], IMAGE_PENDING: ["Waiting for image", ""],
    IMAGE_FAILED: ["Image failed — retry", "failed"], NEEDS_DETAILS: ["Needs details", ""],
    READY_FOR_REVIEW: ["Ready for review", "ready"], APPROVED: ["Approved", "approved"],
    PUBLISH_FAILED: ["Publish failed — retry", "failed"], PUBLISHED: ["Published", "published"],
    REJECTED: ["Rejected", "rejected"]
  };

  /* ----------------------------------------------------------------- loading */
  function statusesForFilter() {
    const f = $("statusFilter")?.value || "active";
    if (f === "active") return ["pending", "approved"];
    if (f === "all") return ["pending", "approved", "imported", "rejected"];
    return [f];
  }

  async function loadQueue(quiet = false) {
    const result = await publisher("review_list", { statuses: statusesForFilter() });
    rows = Array.isArray(result.records) ? result.records : [];
    counts = result.counts || {};
    const ids = new Set(rows.map(r => r.id));
    selected = new Set([...selected].filter(id => ids.has(id)));
    render();
    renderStats();
    await loadPermission().catch(() => {});
    loadLastRun();
    if (!quiet) {
      notice(`Connected. ${counts.pending ?? 0} pending, ${counts.approved ?? 0} approved, ` +
        `${counts.imported ?? 0} published, ${counts.rejected ?? 0} rejected.`);
    }
  }

  async function loadLastRun() {
    try {
      const { data } = await db.from("noh_discovery_runs").select("finished_at")
        .order("id", { ascending: false }).limit(1);
      $("lastRun").textContent = data?.[0]?.finished_at ? dateTime(data[0].finished_at) : "Not run yet";
    } catch { /* optional */ }
  }

  function renderStats() {
    const pending = rows.filter(r => r.status === "pending");
    const by = s => pending.filter(r => stageOf(r) === s).length;
    // Pipeline tiles describe the pending set; counts come from the server for the rest.
    $("cntDiscovered").textContent = by("DISCOVERED") + by("NEEDS_DETAILS");
    $("cntImage").textContent = by("IMAGE_PENDING") + by("IMAGE_FAILED");
    $("cntReady").textContent = by("READY_FOR_REVIEW");
    $("cntApproved").textContent = counts.approved ?? "—";
    $("cntPublished").textContent = counts.imported ?? "—";
    $("cntRejected").textContent = counts.rejected ?? "—";
  }

  async function loadPermission() {
    const r = await publisher("permission_status");
    permission = r.permission || "not_granted";
    $("permissionLabel").textContent = permission === "granted"
      ? `Publishing unlocked until ${dateTime(r.expires_at)}.`
      : "Publishing is locked. Grant temporary permission to publish approved records.";
    syncButtons();
  }

  /* --------------------------------------------------------------- rendering */
  function filteredRows() {
    const term = ($("searchInput")?.value || "").trim().toLocaleLowerCase("en-GB");
    const stage = $("stageFilter")?.value || "all";
    return rows.filter(r =>
      (stage === "all" || stageOf(r) === stage) &&
      (!term || `${r.title} ${r.source_name} ${r.organization || ""} ${r.category || ""}`
        .toLocaleLowerCase("en-GB").includes(term)));
  }

  function selectable(row) {
    const s = stageOf(row);
    return s === "READY_FOR_REVIEW" || s === "APPROVED" || s === "PUBLISH_FAILED";
  }

  function imageBlock(row) {
    if (!ownImage(row)) {
      return `<div class="noh-image-placeholder"><span>Image not ready</span>
        <small>${row.image_status === "failed" ? "Failed — use Retry Failed Images" : "Use Prepare Images"}</small></div>`;
    }
    const url = safeHttps(row.image_url);
    const source = { source: "From the official page", organisation: "From the organisation site",
      generated: "Generated for this listing" }[row.image_source] || "Individual image attached";
    return `<a class="noh-image-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">
        <img class="noh-opportunity-image" src="${esc(url)}" alt="Image for ${esc(row.title || "opportunity")}"
             loading="lazy" data-opportunity-image></a>
      <div class="noh-image-caption">${esc(source)}</div>`;
  }

  function cardHTML(row) {
    const stage = stageOf(row);
    const [label, tone] = STAGE_LABEL[stage] || [stage, ""];
    const pending = row.status === "pending";
    const gaps = missingFields(row);
    const flags = [];
    if (row.validation_notes) flags.push(row.validation_notes);
    if (row.image_error && stage === "IMAGE_FAILED") flags.push("Image: " + row.image_error.slice(0, 240));
    if (row.publish_error) flags.push("Publishing: " + row.publish_error);
    if (row.last_error) flags.push("Check: " + row.last_error);
    if (pending && gaps.length && stage !== "DISCOVERED") flags.push("Missing: " + gaps.join(", "));

    const src = safeHttps(row.source_url), app = safeHttps(row.application_url);
    const canPick = selectable(row);

    return `
      <article class="noh-review-card ${selected.has(row.id) ? "is-selected" : ""}" data-id="${esc(row.id)}">
        <div>${canPick
          ? `<input class="noh-pick" type="checkbox" data-select="${esc(row.id)}" ${selected.has(row.id) ? "checked" : ""} aria-label="Select ${esc(row.title)}">`
          : ""}</div>
        <div class="noh-image-column">${imageBlock(row)}</div>
        <div class="noh-card-content">
          <div class="noh-card-meta">
            <span class="noh-state ${tone}">${esc(label)}</span>
            ${newIds.has(row.id) ? '<span class="noh-state info">New this run</span>' : ""}
            <span>${esc(row.source_name || "Source")}</span>
            <span>Discovered ${esc(dateTime(row.discovered_at))}</span>
          </div>
          <h3 class="noh-card-title">${esc(row.title || "Untitled opportunity")}</h3>
          <div class="noh-card-meta">
            <strong>${esc(row.organization || "Organisation not yet verified")}</strong>
            ${row.category ? `<span>· ${esc(row.category)}</span>` : ""}
            <span>· ${esc(row.location || "Location not supplied")}</span>
            <span>· Deadline: ${esc(dateOnly(row.deadline))}</span>
          </div>
          <p class="noh-card-description">${esc(row.description || row.summary || "No description yet. Open the original listing and verify the details.")}</p>
          <div class="noh-card-meta">
            <span class="noh-flag ${row.validation_status === "valid" ? "ok" : ""}">Check: ${esc(row.validation_status || "unchecked")}</span>
            <span class="noh-flag ${row.image_status === "ready" ? "ok" : ""}">Image: ${esc(row.image_status || "none")}</span>
            <span class="noh-flag ${row.status === "approved" || row.status === "imported" ? "ok" : ""}">Review: ${esc(row.status)}</span>
          </div>
          ${flags.map(f => `<div class="noh-flag">${esc(f)}</div>`).join("")}
          ${row.review_note ? `<div class="entry-meta">Review note: ${esc(row.review_note)}</div>` : ""}
          <div class="noh-card-links">
            ${src ? `<a href="${esc(src)}" target="_blank" rel="noopener noreferrer">Source listing ↗</a>` : "<span>Source link unavailable</span>"}
            ${app ? `<a href="${esc(app)}" target="_blank" rel="noopener noreferrer">Application page ↗</a>` : "<span>Application link not found</span>"}
          </div>
        </div>
        <div class="noh-card-actions">
          ${pending ? `<button class="btn btn-primary" data-action="approve" data-id="${esc(row.id)}" type="button">Review &amp; approve</button>
                       <button class="btn btn-danger" data-action="reject" data-id="${esc(row.id)}" type="button">Reject</button>` : ""}
          ${row.status === "approved" ? `<button class="btn btn-danger" data-action="reject" data-id="${esc(row.id)}" type="button">Reject</button>` : ""}
          ${stage === "IMAGE_FAILED" || stage === "IMAGE_PENDING" || stage === "DISCOVERED"
            ? `<button class="btn btn-outline" data-action="image" data-id="${esc(row.id)}" type="button">${stage === "IMAGE_FAILED" ? "Retry image" : "Prepare image"}</button>` : ""}
        </div>
      </article>`;
  }

  function render() {
    const queue = $("queue");
    const list = filteredRows();
    if (!list.length) {
      queue.innerHTML = '<div class="empty">No records match this view. Change the filters, or press Start Discovery.</div>';
      $("loadMoreBtn").hidden = true;
      syncButtons();
      return;
    }
    // Records found by the latest run come first.
    const ordered = [...list].sort((a, b) => (newIds.has(b.id) ? 1 : 0) - (newIds.has(a.id) ? 1 : 0));
    queue.innerHTML = ordered.slice(0, shown).map(cardHTML).join("");
    const left = ordered.length - shown;
    $("loadMoreBtn").hidden = left <= 0;
    $("loadMoreBtn").textContent = `Load more (${left} left)`;
    syncButtons();
  }

  /* ---------------------------------------------------- buttons and busy state */
  const selectedRows = () => rows.filter(r => selected.has(r.id));

  function syncButtons() {
    const idle = !op;
    const set = (id, disabled) => { const b = $(id); if (b) b.disabled = disabled; };
    const sel = selectedRows();
    const pendingSel = sel.filter(r => r.status === "pending");
    const approvedSel = sel.filter(r => r.status === "approved");

    set("startDiscoveryBtn", !db || !idle);
    set("stopDiscoveryBtn", !db || !(op === "discovery" || op === "images"));
    set("validateBtn", !db || !idle);
    set("prepareImagesBtn", !db || !idle);
    set("retryImagesBtn", !db || !idle);
    set("refreshBtn", !db || !idle);
    set("approveSelectedBtn", !db || !idle || !pendingSel.length || pendingSel.length > MAX_BATCH);
    set("rejectSelectedBtn", !db || !idle || !sel.length || sel.length > MAX_BATCH);
    set("grantPermissionBtn", !db || !idle);
    set("revokePermissionBtn", !db || !idle);
    set("viewPublishLogBtn", !db || !idle);
    set("publishSelectedBtn", !db || !idle || permission !== "granted" ||
      !approvedSel.length || approvedSel.length > MAX_BATCH);

    $("approveSelectedBtn").textContent = `Approve selected (${pendingSel.length})`;
    $("rejectSelectedBtn").textContent = `Reject selected (${sel.length})`;
    $("publishSelectedBtn").textContent = `Publish Approved (${approvedSel.length})`;

    $("selectionLabel").textContent = !sel.length
      ? "No records selected. Tick records, or use Select All."
      : `${sel.length} selected: ${pendingSel.length} awaiting approval, ${approvedSel.length} approved.` +
        (approvedSel.length && permission !== "granted" ? " Grant permission to publish." : "");

    $("stopDiscoveryBtn").textContent = op === "images" ? "Stop Image Preparation" : "Stop Discovery";
  }

  // Run one operation at a time; the Stop button stays available while it runs.
  async function runOp(name, fn) {
    if (op) { notice("Another operation is running. Please wait or press Stop.", true); return; }
    op = name; stopRequested = false;
    syncButtons();
    try { await fn(); }
    catch (e) { showResult("Something went wrong", [{ t: e.message || String(e), c: "bad" }], true); notice(e.message || String(e), true); }
    finally { op = null; stopRequested = false; syncButtons(); }
  }

  function showResult(title, items, error = false) {
    const box = $("discoveryResult");
    box.hidden = false;
    box.classList.toggle("error", !!error);
    box.innerHTML = `<strong>${esc(title)}</strong><ul class="result-list">` +
      items.map(i => `<li class="${i.c || ""}">${esc(i.t)}</li>`).join("") + "</ul>";
    box.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  /* --------------------------------------------------------------- discovery */
  async function startDiscovery() {
    await runOp("discovery", async () => {
      $("discoveryRunLabel").textContent = "Checking sources, extracting details and validating…";
      notice("Discovery started. Please keep this page open.");

      const d = await unwrap(await patient(
        db.functions.invoke(DISCOVERY_FUNCTION, { body: {} }), 90000, "Discovery"), "Discovery");

      newIds = new Set((d.new_records || []).map(r => r.id));
      const v = d.validation || {};
      const items = [
        { t: `${d.sources_checked ?? 0} sources checked, ${d.entries_seen ?? 0} listings seen.` },
        { t: `${d.new_pending_entries ?? 0} new record(s) added to the queue.`, c: (d.new_pending_entries ? "good" : "") },
        { t: `${d.enrichment_attempted ?? 0} record(s) enriched from their source pages.` },
        { t: `${(v.rejected_duplicate_live ?? 0) + (v.rejected_duplicate_queue ?? 0)} duplicate(s) rejected, ` +
             `${v.rejected_expired ?? 0} expired rejected.` },
        { t: `${v.valid ?? 0} record(s) have all required details; ${v.incomplete ?? 0} still need details or an image.` }
      ];
      (d.enriched || []).filter(e => e.status === "needs_attention").forEach(e =>
        items.push({ t: `Could not read "${e.title || e.id}": ${e.reason}`, c: "warn" }));
      (d.enriched || []).filter(e => e.link_warning).forEach(e =>
        items.push({ t: `Application link problem for "${e.title}": ${e.link_warning}`, c: "warn" }));
      (d.errors || []).forEach(e => items.push({ t: `${e.source}: ${e.error}`, c: "bad" }));
      if (d.stopped) items.push({ t: "Discovery was stopped before it finished.", c: "warn" });
      showResult(d.stopped ? "Discovery stopped" : "Discovery finished", items, (d.errors || []).length > 0);

      if (!d.stopped) {
        // Images for the newest records without one.
        const img = await imageLoop({ rounds: AUTO_IMAGE_ROUNDS, retry: false, ids: null });
        items.push(...img.items);
        await publisher("validate").catch(() => {});
        showResult("Discovery finished", items, (d.errors || []).length > 0 || img.failed > 0);
      }
      await loadQueue(true);
      $("discoveryRunLabel").textContent = "Last run complete. Nothing was approved or published.";
      notice("Discovery finished. Review the records below.", (d.errors || []).length > 0);
    });
  }

  async function stopDiscovery() {
    if (!op) return;
    stopRequested = true;
    try {
      const r = await publisher("stop_discovery");
      notice(`Stop requested (${r.runs_signalled ?? 0} run signalled). It will stop at the next safe point.`);
    } catch (e) { notice("Could not send the stop request: " + e.message, true); }
  }

  async function validateQueue() {
    await runOp("validate", async () => {
      const r = await publisher("validate");
      showResult("Duplicate and deadline check finished", [
        { t: `${r.rejected_duplicate_live ?? 0} duplicate(s) of live listings rejected.` },
        { t: `${r.rejected_duplicate_queue ?? 0} duplicate(s) within the queue rejected.` },
        { t: `${r.rejected_expired ?? 0} expired record(s) rejected.` },
        { t: `${r.valid ?? 0} record(s) complete; ${r.incomplete ?? 0} incomplete.` }
      ]);
      await loadQueue(true);
    });
  }

  /* ------------------------------------------------------------------ images */
  async function imageCall(body) {
    return unwrap(await patient(
      db.functions.invoke(IMAGE_FUNCTION, { body }), 90000, "Image preparation"), "Image preparation");
  }

  // Prepares images in server-sized batches. retry=true re-attempts failed records once.
  async function imageLoop({ rounds, retry, ids }) {
    const total = { ready: 0, generated: 0, failed: 0, selected: 0 };
    const items = [];
    const take = r => {
      total.ready += Number(r.image_ready || 0);
      total.generated += Number(r.generated || 0);
      total.failed += Number(r.needs_attention || 0);
      total.selected += Number(r.selected || 0);
      (r.results || []).filter(x => x.status !== "image_ready").forEach(x =>
        items.push({ t: `Image failed for "${x.title || x.id}": ${x.reason || "unknown reason"}` +
          (x.retryable ? " (you can retry)" : ""), c: "bad" }));
    };

    if (ids) {
      for (let i = 0; i < ids.length && !stopRequested; i += IMAGE_BATCH) {
        $("discoveryRunLabel").textContent = `Preparing images (${Math.min(i + IMAGE_BATCH, ids.length)} of ${ids.length})…`;
        take(await imageCall({ ids: ids.slice(i, i + IMAGE_BATCH), retry_failed: retry }));
      }
    } else {
      for (let round = 0; round < rounds && !stopRequested; round++) {
        $("discoveryRunLabel").textContent = `Preparing images, batch ${round + 1}…`;
        const r = await imageCall({ limit: IMAGE_BATCH });
        take(r);
        if (!Number(r.selected || 0)) break;
      }
    }
    items.unshift({
      t: `Images: ${total.ready} ready (${total.generated} generated), ${total.failed} failed, from ${total.selected} record(s).` +
         (stopRequested ? " Stopped early." : ""),
      c: total.failed ? "warn" : "good"
    });
    return { ...total, items };
  }

  async function prepareImages(retry) {
    await runOp("images", async () => {
      let ids = null;
      const sel = selectedRows().map(r => r.id);
      if (retry) {
        ids = (sel.length ? selectedRows() : rows).filter(r => r.image_status === "failed" &&
          (r.status === "pending" || r.status === "approved")).map(r => r.id);
        if (!ids.length) { notice("No records have a failed image."); return; }
      } else if (sel.length) {
        ids = selectedRows().filter(r => !ownImage(r)).map(r => r.id);
        if (!ids.length) { notice("The selected records already have images."); return; }
      }
      const res = await imageLoop({ rounds: IMAGE_ROUND_CAP, retry: retry || !!ids, ids });
      showResult(retry ? "Retry finished" : "Image preparation finished", res.items, res.failed > 0);
      await publisher("validate").catch(() => {});
      await loadQueue(true);
      $("discoveryRunLabel").textContent = "Image preparation finished.";
    });
  }

  async function prepareOne(id) {
    await runOp("images", async () => {
      const row = rows.find(r => r.id === id);
      const res = await imageLoop({ rounds: 1, retry: row?.image_status === "failed", ids: [id] });
      showResult("Image preparation finished", res.items, res.failed > 0);
      await publisher("validate").catch(() => {});
      await loadQueue(true);
    });
  }

  /* ---------------------------------------------------------- review actions */
  function openApproval(id) {
    const row = rows.find(x => x.id === id);
    if (!row) return;
    $("discoveryId").value = row.id;
    $("title").value = row.title || "";
    $("organization").value = row.organization || "";
    $("category").value = row.category || "Other";
    $("location").value = row.location || "Nigeria";
    $("deadline").value = row.deadline || "";
    $("applicationUrl").value = row.application_url || "";
    $("sourceUrl").value = safeHttps(row.source_url);
    $("description").value = row.description || row.summary || "";
    $("eligibility").value = row.eligibility || "";
    $("officialVerified").checked = false;
    $("sourceSummary").textContent = `Source: ${row.source_name}. This is only a discovery lead. ` +
      "Check the organisation's official site, the eligibility, the deadline and the application link before approving.";
    $("reviewDialog").querySelector("h2").textContent = "Review and approve";
    $("publishBtn").textContent = "Approve for publishing";
    $("reviewDialog").showModal();
  }

  async function approveOne(event) {
    event.preventDefault();
    if (op) { notice("Another operation is running. Please wait.", true); return; }
    if (!$("officialVerified").checked) { notice("Confirm the official-source checks first.", true); return; }

    const opportunity = {
      title: $("title").value.trim(), organization: $("organization").value.trim(),
      category: $("category").value, location: $("location").value.trim() || "Nigeria",
      deadline: $("deadline").value || null,
      application_url: safeHttps($("applicationUrl").value.trim()),
      source_url: safeHttps($("sourceUrl").value.trim()),
      description: $("description").value.trim(), eligibility: $("eligibility").value.trim() || null
    };
    if (!opportunity.application_url || !opportunity.source_url) { notice("Both links must be valid HTTPS links.", true); return; }
    if (!opportunity.title || !opportunity.organization || !opportunity.description) {
      notice("Complete the title, organisation and description.", true); return;
    }
    if (opportunity.deadline && opportunity.deadline < new Date().toISOString().slice(0, 10)) {
      notice("This deadline has passed. Do not approve it as an open opportunity.", true); return;
    }

    const btn = $("publishBtn");
    await runOp("approve", async () => {
      btn.disabled = true; btn.textContent = "Saving approval…";
      try {
        await publisher("approve", {
          id: $("discoveryId").value, opportunity,
          review_note: "Official source, eligibility, deadline and application URL checked by administrator."
        });
        $("reviewDialog").close();
        showResult("Approved", [{ t: "The record is approved but NOT published. Select it, grant permission and press Publish Approved.", c: "good" }]);
        await loadQueue(true);
      } finally { btn.disabled = false; btn.textContent = "Approve for publishing"; }
    });
  }

  async function approveSelected() {
    const list = selectedRows().filter(r => r.status === "pending");
    if (!list.length) return;
    const notReady = list.filter(r => stageOf(r) !== "READY_FOR_REVIEW");
    if (notReady.length) {
      notice(`${notReady.length} selected record(s) are not ready (missing details or image). Deselect them or fix them first.`, true);
      return;
    }
    if (!window.confirm(`Approve ${list.length} record(s)?\n\nBy continuing you confirm that you have checked each ` +
      "record's official source, eligibility, deadline and application link.")) return;
    await runOp("approve", async () => {
      const r = await publisher("bulk_approve", { ids: list.map(x => x.id), confirm_checked: true });
      const items = (r.results || []).map(x => ({
        t: `${x.title || x.id}: ${x.status === "failed" ? x.reason : x.status.replace("_", " ")}`,
        c: x.status === "failed" ? "bad" : "good" }));
      items.unshift({ t: `${r.approved ?? 0} approved, ${r.failed ?? 0} failed. Nothing has been published yet.` });
      selected.clear();
      showResult("Approval finished", items, (r.failed ?? 0) > 0);
      await loadQueue(true);
    });
  }

  async function rejectIds(ids) {
    const note = window.prompt("Why are you rejecting this? (optional)",
      "Not suitable or could not be verified from an official source.");
    if (note === null) return;
    await runOp("reject", async () => {
      const r = await publisher("bulk_reject", { ids, review_note: note.trim() || "Rejected by administrator." });
      const items = (r.results || []).map(x => ({
        t: `${x.title || x.id}: ${x.status === "failed" ? x.reason : "rejected"}`, c: x.status === "failed" ? "bad" : "" }));
      ids.forEach(id => selected.delete(id));
      showResult("Rejection finished", items, items.some(i => i.c === "bad"));
      await loadQueue(true);
    });
  }

  /* -------------------------------------------------------------- publishing */
  async function grantPermission() {
    await runOp("permission", async () => {
      const r = await publisher("grant_permission", {
        expires_in_minutes: 15, note: "Temporary permission granted from NOH discovery dashboard." });
      await loadPermission();
      notice(`Publishing unlocked until ${dateTime(r.expires_at)}.`);
    });
  }

  async function revokePermission() {
    await runOp("permission", async () => {
      await publisher("revoke_permission", { note: "Permission revoked from NOH discovery dashboard." });
      await loadPermission();
      notice("Publishing is locked again.");
    });
  }

  function publishItems(results) {
    return (results || []).map(x => ({
      t: `${x.title || x.discovery_id}: ${x.status}${x.reason ? " — " + x.reason : ""}${x.retryable ? " (retry possible)" : ""}`,
      c: x.status === "published" ? "good" : x.status === "failed" ? "bad" : "warn" }));
  }

  async function publishApproved() {
    const list = selectedRows().filter(r => r.status === "approved");
    if (!list.length) return;
    if (list.some(r => !ownImage(r))) { notice("Every record must have its own image before publishing.", true); return; }
    if (!window.confirm(`Publish ${list.length} approved record(s) to the public NOH website now?`)) return;
    await runOp("publish", async () => {
      const r = await publisher("publish_approved", { ids: list.map(x => x.id) });
      const items = publishItems(r.results);
      items.unshift({ t: `${r.inserted ?? 0} published, ${r.skipped ?? 0} skipped (duplicates), ${r.failed ?? 0} failed.`,
        c: (r.failed ?? 0) ? "bad" : "good" });
      list.forEach(x => selected.delete(x.id));
      showResult("Publishing finished", items, (r.failed ?? 0) > 0);
      await loadQueue(true);
    });
  }

  async function viewPublishLog() {
    await runOp("log", async () => {
      const r = await publisher("publish_log");
      const box = $("publishResults");
      box.hidden = false;
      const logs = r.logs || [];
      box.innerHTML = !logs.length
        ? '<p class="entry-meta">No publishing batches yet.</p>'
        : logs.map(l => `<details style="margin:8px 0"><summary><strong>${esc(dateTime(l.created_at))}</strong> — ` +
          `${l.inserted} published, ${l.skipped} skipped, ${l.failed} failed (of ${l.requested})</summary>
          <ul class="result-list">${publishItems(l.results).map(i => `<li class="${i.c}">${esc(i.t)}</li>`).join("")}</ul></details>`).join("");
    });
  }

  /* ----------------------------------------------------------------- selection */
  function selectAll() {
    const list = filteredRows().filter(selectable).slice(0, MAX_BATCH);
    list.forEach(r => selected.add(r.id));
    render();
    notice(`${list.length} record(s) selected` +
      (filteredRows().filter(selectable).length > MAX_BATCH ? ` (maximum ${MAX_BATCH} at a time).` : "."));
  }

  /* -------------------------------------------------------------------- wiring */
  function wire() {
    const on = (id, fn) => $(id)?.addEventListener("click", fn);
    on("startDiscoveryBtn", startDiscovery);
    on("stopDiscoveryBtn", stopDiscovery);
    on("validateBtn", validateQueue);
    on("prepareImagesBtn", () => prepareImages(false));
    on("retryImagesBtn", () => prepareImages(true));
    on("refreshBtn", () => runOp("refresh", async () => { await loadQueue(); }));
    on("selectAllBtn", selectAll);
    on("deselectAllBtn", () => { selected.clear(); render(); });
    on("approveSelectedBtn", approveSelected);
    on("rejectSelectedBtn", () => rejectIds(selectedRows().map(r => r.id)));
    on("grantPermissionBtn", grantPermission);
    on("revokePermissionBtn", revokePermission);
    on("publishSelectedBtn", publishApproved);
    on("viewPublishLogBtn", viewPublishLog);
    on("loadMoreBtn", () => { shown += PAGE_SIZE; render(); });

    $("searchInput")?.addEventListener("input", () => { shown = PAGE_SIZE; render(); });
    $("stageFilter")?.addEventListener("change", () => { shown = PAGE_SIZE; render(); });
    $("statusFilter")?.addEventListener("change", () => {
      shown = PAGE_SIZE;
      runOp("refresh", async () => { await loadQueue(true); });
    });

    $("approveForm")?.addEventListener("submit", approveOne);
    $("closeDialog")?.addEventListener("click", () => $("reviewDialog")?.close());
    $("reviewDialog")?.addEventListener("click", e => { if (e.target === $("reviewDialog")) $("reviewDialog").close(); });

    $("queue").addEventListener("click", e => {
      const b = e.target.closest("button[data-action]");
      if (!b) return;
      const id = b.dataset.id;
      if (b.dataset.action === "approve") openApproval(id);
      if (b.dataset.action === "reject") rejectIds([id]);
      if (b.dataset.action === "image") prepareOne(id);
    });

    $("queue").addEventListener("change", e => {
      const input = e.target.closest("input[data-select]");
      if (!input) return;
      input.checked ? selected.add(input.dataset.select) : selected.delete(input.dataset.select);
      input.closest(".noh-review-card")?.classList.toggle("is-selected", input.checked);
      syncButtons();
    });

    // A preview that fails to load is shown as a problem, never as a broken icon.
    $("queue").addEventListener("error", e => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement) || !img.matches("[data-opportunity-image]")) return;
      const box = document.createElement("div");
      box.className = "noh-image-error";
      box.textContent = "Image file did not load. Use Retry image.";
      img.closest(".noh-image-link")?.replaceWith(box);
    }, true);
  }

  async function init() {
    wire();
    syncButtons();
    try {
      if (!window.supabase?.createClient) throw new Error("Supabase client did not load. Refresh this page.");
      db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
      await requireAdmin();
      syncButtons();
      await loadQueue();

      db.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT" || !session) {
          permission = "not_granted"; selected.clear();
          notice("You have been signed out. Sign in again to use the controls.", true);
          syncButtons();
        }
      });
    } catch (e) {
      db = null;
      syncButtons();
      notice(e.message || "Administrator access required.", true);
      $("queue").innerHTML = `<div class="empty">${esc(e.message || "Administrator access required.")}</div>`;
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
