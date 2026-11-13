
(() => {
  "use strict";

  const SUPABASE_URL = "https://djxornmwvkauhkcuhgxc.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_EDReCY3JcN4vMuypVfqcMQ_GcTEVuBq";
  const PUBLISHER = "noh-publish-opportunities";
  const $ = id => document.getElementById(id);

  let db = null;
  let currentRows = [];
  let selectedIds = new Set();
  let busy = false;
  let discoveryBusy = false;
  let permission = "not_granted";

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]
  );

  const safeHttps = value => {
    try {
      const u = new URL(String(value));
      return u.protocol === "https:" ? u.href : "";
    } catch {
      return "";
    }
  };

  function notice(message, error = false) {
    const el = $("notice");
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("error", error);
  }

  function dateLabel(value) {
    if (!value) return "Date not supplied";
    const d = new Date(value);
    return Number.isNaN(d.getTime())
      ? "Date not supplied"
      : d.toLocaleString("en-GB", {
          dateStyle: "medium",
          timeStyle: "short"
        });
  }

  async function invoke(action, extra = {}) {
    const { data, error } = await db.functions.invoke(PUBLISHER, {
      body: { action, ...extra }
    });

    if (error) {
      let message = error.message || "The publisher request failed.";

      if (error.context && typeof error.context.json === "function") {
        const detail = await error.context.json().catch(() => null);
        if (detail?.error) message = detail.error;
      }

      throw new Error(message);
    }

    if (data?.error) throw new Error(data.error);
    return data;
  }

  async function requireAdmin() {
    const { data: { session }, error } = await db.auth.getSession();

    if (error || !session?.user) {
      throw new Error(
        "Sign in to your NOH administrator account first, then reopen this page."
      );
    }

    const { data: admin, error: adminError } = await db
      .from("admins")
      .select("user_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (adminError || !admin) {
      throw new Error("This account is not listed as a NOH administrator.");
    }

    return session.user;
  }

  function insertWorkflowSection(element) {
    const stats = $("pendingCount")?.closest(".review-stats");
    const queue = $("queue");

    if (stats) {
      stats.insertAdjacentElement("afterend", element);
      return true;
    }

    if (queue?.parentNode) {
      queue.parentNode.insertBefore(element, queue);
      return true;
    }

    (document.querySelector("main") || document.body).appendChild(element);
    return true;
  }

  function addWorkflowControls() {
    // Discovery controls are independent of publishing controls.
    if (!$("discoveryWorkflowControls")) {
      const discovery = document.createElement("section");
      discovery.id = "discoveryWorkflowControls";

      discovery.style.cssText =
        "display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;background:#fff;border:1px solid #e6e9e3;border-radius:14px;padding:14px 16px;margin:18px 0";

      discovery.innerHTML = `
        <div>
          <strong>Discovery and image preparation</strong>
          <div id="discoveryRunLabel" class="entry-meta" style="margin-top:5px">
            Runs discovery, enriches up to six records, then prepares their images.
            No approval or publication takes place.
          </div>
        </div>
        <button class="btn btn-primary" type="button" id="runDiscoveryBtn">
          Run discovery + prepare images
        </button>
      `;

      insertWorkflowSection(discovery);
    }

    if (!$("publishWorkflowControls")) {
      const section = document.createElement("section");
      section.id = "publishWorkflowControls";

      section.style.cssText =
        "display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;background:#fff;border:1px solid #e6e9e3;border-radius:14px;padding:14px 16px;margin:18px 0";

      section.innerHTML = `
        <div>
          <strong>Publishing control</strong>
          <div id="permissionLabel" class="entry-meta" style="margin-top:5px">
            Checking permission…
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-outline" type="button" id="grantPermissionBtn">
            Grant 15-minute permission
          </button>
          <button class="btn btn-outline" type="button" id="revokePermissionBtn">
            Revoke permission
          </button>
          <button class="btn btn-primary" type="button" id="publishSelectedBtn" disabled>
            Publish selected approved (0)
          </button>
        </div>
      `;

      const discoverySection = $("discoveryWorkflowControls");

      if (discoverySection?.parentNode) {
        discoverySection.insertAdjacentElement("afterend", section);
      } else {
        insertWorkflowSection(section);
      }
    }

    // onclick assignment is safe if initialisation runs more than once.
    const runButton = $("runDiscoveryBtn");
    if (runButton) runButton.onclick = runDiscovery;

    const grantButton = $("grantPermissionBtn");
    if (grantButton) grantButton.onclick = grantPermission;

    const revokeButton = $("revokePermissionBtn");
    if (revokeButton) revokeButton.onclick = revokePermission;

    const publishButton = $("publishSelectedBtn");
    if (publishButton) publishButton.onclick = publishSelected;
  }

  async function runDiscovery() {
    if (discoveryBusy || busy) {
      notice(
        "The dashboard is completing another operation. Please wait a moment and try again.",
        true
      );
      return;
    }

    if (!db) {
      notice(
        "The database connection is not ready. Refresh the page and sign in again.",
        true
      );
      return;
    }

    const button = $("runDiscoveryBtn");
    const label = $("discoveryRunLabel");

    discoveryBusy = true;
    busy = true;

    if (button) {
      button.disabled = true;
      button.textContent = "Running discovery…";
    }

    if (label) {
      label.textContent =
        "Checking sources and enriching up to six pending records…";
    }

    notice("Discovery started. Please keep this page open.");

    try {
      const {
        data: discovery,
        error: discoveryError
      } = await db.functions.invoke("noh-discover-opportunities", {
        body: {}
      });

      if (discoveryError) {
        let message =
          discoveryError.message || "Discovery request failed.";

        if (
          discoveryError.context &&
          typeof discoveryError.context.json === "function"
        ) {
          const detail = await discoveryError.context.json().catch(() => null);

          if (detail?.error) message = detail.error;
          if (detail?.detail) message += ` — ${detail.detail}`;
        }

        throw new Error(message);
      }

      if (discovery?.error) {
        throw new Error(discovery.error);
      }

      const enriched = Array.isArray(discovery?.enriched)
        ? discovery.enriched
        : [];

      const ids = [
        ...new Set(
          enriched
            .map(row => row?.id)
            .filter(Boolean)
        )
      ].slice(0, 6);

      if (label) {
        label.textContent =
          "Discovery finished. Preparing images for the discovered batch…";
      }

      const imageBody = ids.length ? { ids } : { limit: 6 };

      const {
        data: images,
        error: imageError
      } = await db.functions.invoke("noh-prepare-discovery-images", {
        body: imageBody
      });

      if (imageError) {
        let message =
          imageError.message || "Image preparation request failed.";

        if (
          imageError.context &&
          typeof imageError.context.json === "function"
        ) {
          const detail = await imageError.context.json().catch(() => null);
          if (detail?.error) message = detail.error;
        }

        throw new Error(
          `Discovery ran, but image preparation failed: ${message}`
        );
      }

      if (images?.error) {
        throw new Error(
          `Discovery ran, but image preparation failed: ${images.error}`
        );
      }

      const ready = Number(images?.image_ready ?? 0);
      const selected = Number(images?.selected ?? 0);
      const attention = Number(images?.needs_attention ?? 0);

      const sourceErrors = Array.isArray(discovery?.errors)
        ? discovery.errors.length
        : 0;

      const summary =
        `Discovery complete: ` +
        `${Number(discovery?.sources_checked ?? 0)} sources checked, ` +
        `${Number(discovery?.entries_seen ?? 0)} listings found, ` +
        `${Number(discovery?.new_pending_entries ?? 0)} new records, ` +
        `${enriched.length} enrichment attempts. ` +
        `Images: ${ready} ready from ${selected} selected; ` +
        `${attention} need attention. ` +
        `${sourceErrors} source/database warning(s). ` +
        `Nothing was approved or published.`;

      if (label) label.textContent = summary;
      notice(summary, sourceErrors > 0 || attention > 0);

      await loadQueue(true);

    } catch (e) {
      const message =
        e.message || "Unable to complete discovery and image preparation.";

      if (label) label.textContent = message;
      notice(message, true);

    } finally {
      discoveryBusy = false;
      busy = false;

      if (button) {
        button.disabled = false;
        button.textContent = "Run discovery + prepare images";
      }

      updatePublishButton();
    }
  }

  async function loadPermission() {
    const result = await invoke("permission_status");

    permission = result.permission || "not_granted";

    const label = $("permissionLabel");

    if (label) {
      label.textContent = permission === "granted"
        ? `Active until ${dateLabel(result.expires_at)}`
        : "Locked — publishing is disabled until you grant temporary permission.";
    }

    updatePublishButton();
  }

  function updatePublishButton() {
    const button = $("publishSelectedBtn");
    if (!button) return;

    button.disabled =
      permission !== "granted" ||
      selectedIds.size === 0 ||
      busy;

    button.textContent =
      `Publish selected approved (${selectedIds.size})`;
  }

  async function grantPermission() {
    if (busy) {
      notice("Another dashboard operation is running. Please wait.", true);
      return;
    }

    busy = true;
    updatePublishButton();

    try {
      const result = await invoke("grant_permission", {
        expires_in_minutes: 15,
        note: "Temporary permission granted from NOH discovery review."
      });

      permission = "granted";
      await loadPermission();

      notice(
        `Publishing permission granted until ${dateLabel(result.expires_at)}. ` +
        "Only approved records can now be published."
      );

    } catch (e) {
      notice(
        e.message || "Unable to grant publishing permission.",
        true
      );
    } finally {
      busy = false;
      updatePublishButton();
    }
  }

  async function revokePermission() {
    if (busy) {
      notice("Another dashboard operation is running. Please wait.", true);
      return;
    }

    busy = true;
    updatePublishButton();

    try {
      await invoke("revoke_permission", {
        note: "Permission revoked from NOH discovery review."
      });

      permission = "not_granted";
      await loadPermission();

      notice("Publishing permission revoked. Publishing is locked.");

    } catch (e) {
      notice(
        e.message || "Unable to revoke publishing permission.",
        true
      );
    } finally {
      busy = false;
      updatePublishButton();
    }
  }

  async function loadStats() {
    const [
      { count: pending, error: pErr },
      { count: approved, error: aErr },
      { count: imported, error: iErr },
      { data: runs, error: rErr }
    ] = await Promise.all([
      db.from("noh_discovered_opportunities")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),

      db.from("noh_discovered_opportunities")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved"),

      db.from("noh_discovered_opportunities")
        .select("id", { count: "exact", head: true })
        .eq("status", "imported"),

      db.from("noh_discovery_runs")
        .select("finished_at,entries_added,errors")
        .order("id", { ascending: false })
        .limit(1)
    ]);

    if (pErr || aErr || iErr || rErr) {
      throw pErr || aErr || iErr || rErr;
    }

    if ($("pendingCount")) $("pendingCount").textContent = pending ?? 0;
    if ($("importedCount")) $("importedCount").textContent = imported ?? 0;

    if ($("lastRun")) {
      $("lastRun").textContent = runs?.[0]?.finished_at
        ? dateLabel(runs[0].finished_at)
        : "Not run yet";
    }

    let approvedStat = $("approvedCount");

    if (!approvedStat) {
      const stat = document.createElement("div");
      stat.className = "stat";
      stat.innerHTML =
        '<strong id="approvedCount">—</strong>' +
        '<span>Approved, awaiting publication</span>';

      $("pendingCount")
        ?.closest(".review-stats")
        ?.append(stat);

      approvedStat = $("approvedCount");
    }

    if (approvedStat) approvedStat.textContent = approved ?? 0;
  }

  function render() {
    const status = $("statusFilter")?.value || "all";
    const term = ($("searchInput")?.value || "")
      .trim()
      .toLocaleLowerCase("en-GB");

    const rows = currentRows.filter(row =>
      (status === "all" || row.status === status) &&
      (
        !term ||
        `${row.title} ${row.source_name} ${row.summary || ""}`
          .toLocaleLowerCase("en-GB")
          .includes(term)
      )
    );

    const queue = $("queue");

    if (!queue) {
      updatePublishButton();
      return;
    }

    if (!rows.length) {
      queue.innerHTML =
        '<div class="empty">No entries match this view. ' +
        'New discoveries will appear here after the next discovery run.</div>';

      updatePublishButton();
      return;
    }

    queue.innerHTML = rows.map(row => {
      const approved = row.status === "approved";
      const pending = row.status === "pending";

      return `
        <article class="entry" data-id="${esc(row.id)}">
          <div>
            <div class="entry-meta">
              <span class="pill">${esc(row.status)}</span>
              · ${esc(row.source_name)}
              · Discovered ${esc(dateLabel(row.discovered_at))}
            </div>

            <h3>${esc(row.title)}</h3>

            <p>
              ${esc(
                row.summary ||
                "No summary supplied by feed. Open the source and verify the details."
              )}
            </p>

            <p class="entry-meta">
              Published by source: ${esc(dateLabel(row.published_at))}
            </p>

            <a
              href="${esc(safeHttps(row.source_url))}"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open original listing →
            </a>

            ${
              row.review_note
                ? `<p class="entry-meta">Review note: ${esc(row.review_note)}</p>`
                : ""
            }

            ${
              approved
                ? `
                  <label style="display:inline-flex;gap:8px;align-items:center;margin-top:12px;font-weight:650">
                    <input
                      type="checkbox"
                      data-select="${esc(row.id)}"
                      ${selectedIds.has(row.id) ? "checked" : ""}
                    >
                    Select for publication
                  </label>
                `
                : ""
            }
          </div>

          <div class="entry-actions">
            ${
              pending
                ? `
                  <button
                    class="btn btn-primary"
                    data-action="approve"
                    data-id="${esc(row.id)}"
                  >
                    Review & approve
                  </button>

                  <button
                    class="btn btn-danger"
                    data-action="reject"
                    data-id="${esc(row.id)}"
                  >
                    Reject
                  </button>
                `
                : ""
            }
          </div>
        </article>
      `;
    }).join("");

    updatePublishButton();
  }

  async function loadQueue(force = false) {
    if (busy && !force) return;

    const callerOwnsLock = busy;
    busy = true;

    try {
      const result = await invoke("review_list");

      currentRows = result.records || [];

      selectedIds = new Set(
        [...selectedIds].filter(id =>
          currentRows.some(row =>
            row.id === id && row.status === "approved"
          )
        )
      );

      render();

      await Promise.all([
        loadStats(),
        loadPermission()
      ]);

      notice(
        `Connected. ` +
        `${currentRows.filter(x => x.status === "pending").length} pending and ` +
        `${currentRows.filter(x => x.status === "approved").length} approved listings ` +
        `are in the review queue.`
      );

    } catch (e) {
      notice(
        e.message || "Unable to load the discovery queue.",
        true
      );

    } finally {
      busy = callerOwnsLock;
      updatePublishButton();
    }
  }

  function openApproval(id) {
    const row = currentRows.find(x => x.id === id);
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

    $("sourceSummary").textContent =
      `Source: ${row.source_name}. ` +
      "This feed item is only a discovery lead. Verify the organisation's " +
      "official website, eligibility, deadline and application channel before approving.";

    const heading = $("reviewDialog")?.querySelector("h2");

    if (heading) {
      heading.textContent = "Review and approve";
    }

    $("publishBtn").textContent = "Approve for publishing";
    $("reviewDialog").showModal();
  }

  async function approve(event) {
    event.preventDefault();

    if (busy) {
      notice("Another dashboard operation is running. Please wait.", true);
      return;
    }

    const id = $("discoveryId").value;

    if (!$("officialVerified").checked) {
      notice(
        "Confirm the official-source checks before approving.",
        true
      );
      return;
    }

    const opportunity = {
      title: $("title").value.trim(),
      organization: $("organization").value.trim(),
      category: $("category").value,
      location: $("location").value.trim() || "Nigeria",
      deadline: $("deadline").value || null,
      application_url: safeHttps(
        $("applicationUrl").value.trim()
      ),
      source_url: safeHttps(
        $("sourceUrl").value.trim()
      ),
      description: $("description").value.trim(),
      eligibility: $("eligibility").value.trim() || null
    };

    if (!opportunity.application_url || !opportunity.source_url) {
      notice("Both URLs must be valid HTTPS links.", true);
      return;
    }

    if (
      !opportunity.title ||
      !opportunity.organization ||
      !opportunity.description
    ) {
      notice(
        "Complete the title, organisation and description.",
        true
      );
      return;
    }

    if (
      opportunity.deadline &&
      opportunity.deadline < new Date().toISOString().slice(0, 10)
    ) {
      notice(
        "This deadline has passed. Do not approve it as an open opportunity.",
        true
      );
      return;
    }

    busy = true;
    updatePublishButton();

    $("publishBtn").disabled = true;
    $("publishBtn").textContent = "Saving approval…";

    try {
      await invoke("approve", {
        id,
        opportunity,
        review_note:
          "Official source, eligibility, deadline and application URL checked by administrator."
      });

      $("reviewDialog").close();

      notice(
        "Opportunity approved and saved in the queue. " +
        "It has NOT been published yet. Select it and use " +
        "Publish selected approved when ready."
      );

      await loadQueue(true);

    } catch (e) {
      notice(
        e.message || "Unable to approve this discovery.",
        true
      );

    } finally {
      busy = false;
      $("publishBtn").disabled = false;
      $("publishBtn").textContent = "Approve for publishing";
      updatePublishButton();
    }
  }

  async function reject(id) {
    if (busy) {
      notice("Another dashboard operation is running. Please wait.", true);
      return;
    }

    const note = window.prompt(
      "Why are you rejecting this discovery? (Optional)",
      "Not suitable or could not be verified from an official source."
    );

    if (note === null) return;

    busy = true;
    updatePublishButton();

    try {
      await invoke("reject", {
        id,
        review_note: note.trim() || "Rejected by administrator."
      });

      selectedIds.delete(id);
      notice("Discovery rejected.");
      await loadQueue(true);

    } catch (e) {
      notice(
        e.message || "Unable to reject this discovery.",
        true
      );
    } finally {
      busy = false;
      updatePublishButton();
    }
  }

  async function publishSelected() {
    if (busy || permission !== "granted" || selectedIds.size === 0) {
      if (busy) notice("Another dashboard operation is running. Please wait.", true);
      else if (permission !== "granted") notice("Grant temporary publishing permission first.", true);
      else notice("Select at least one approved opportunity to publish.", true);
      return;
    }

    const ids = [...selectedIds];

    if (
      !window.confirm(
        `Publish ${ids.length} approved opportunity record(s) ` +
        "to the public NOH website now?"
      )
    ) {
      return;
    }

    busy = true;
    updatePublishButton();

    try {
      const result = await invoke("publish_approved", { ids });

      selectedIds.clear();

      const inserted = Number(result.inserted || 0);

      notice(
        `Publication completed. ${inserted} opportunity record(s) ` +
        `published to NOH. ${Number(result.skipped || 0)} duplicate(s) skipped. ` +
        "Images were already checked by the publishing safeguards."
      );

      await loadQueue(true);

    } catch (e) {
      notice(
        e.message || "Unable to publish the approved opportunities.",
        true
      );

    } finally {
      busy = false;
      updatePublishButton();
    }
  }

  async function init() {
    // Wire an existing HTML button before any asynchronous setup.
    const existingRunButton = $("runDiscoveryBtn");
    if (existingRunButton) existingRunButton.onclick = runDiscovery;

    try {
      if (!window.supabase?.createClient) {
        throw new Error(
          "Supabase client did not load. Refresh this page."
        );
      }

      db = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
      );

      await requireAdmin();

      addWorkflowControls();

      const status = $("statusFilter");

      if (
        status &&
        ![...status.options].some(o => o.value === "approved")
      ) {
        const option = document.createElement("option");
        option.value = "approved";
        option.textContent = "Approved — awaiting publication";

        const importedOption = status.querySelector('option[value="imported"]');
        status.insertBefore(option, importedOption || null);
      }

      await loadQueue();

    } catch (e) {
      notice(
        e.message || "Administrator access required.",
        true
      );
    }

    $("refreshBtn")?.addEventListener("click", () => loadQueue());
    $("searchInput")?.addEventListener("input", render);
    $("statusFilter")?.addEventListener("change", render);

    $("queue")?.addEventListener("click", e => {
      const b = e.target.closest("button[data-action]");
      if (!b) return;

      if (b.dataset.action === "approve") {
        openApproval(b.dataset.id);
      }

      if (b.dataset.action === "reject") {
        reject(b.dataset.id);
      }
    });

    $("queue")?.addEventListener("change", e => {
      const input = e.target.closest("input[data-select]");
      if (!input) return;

      if (input.checked) {
        selectedIds.add(input.dataset.select);
      } else {
        selectedIds.delete(input.dataset.select);
      }

      updatePublishButton();
    });

    $("approveForm")?.addEventListener("submit", approve);

    $("closeDialog")?.addEventListener(
      "click",
      () => $("reviewDialog")?.close()
    );

    db?.auth.onAuthStateChange(() => {
      if (db && !busy) loadQueue();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
