
(() => {
  "use strict";

  const SUPABASE_URL = "https://djxornmwvkauhkcuhgxc.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_EDReCY3JcN4vMuypVfqcMQ_GcTEVuBq";
  const PUBLISHER = "noh-publish-opportunities";
  const IMAGE_FUNCTION = "noh-prepare-discovery-images";
  const DISCOVERY_FUNCTION = "noh-discover-opportunities";

  const $ = id => document.getElementById(id);

  let db = null;
  let currentRows = [];
  let selectedIds = new Set();
  let busy = false;
  let discoveryBusy = false;
  let permission = "not_granted";
  let authSubscription = null;

  const MIN_PUBLISH_BATCH = 20;
  const MIN_PUBLISH_CATEGORIES = 3;
  const MAX_IMAGE_BATCH = 6;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]
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

    if (el) {
      el.textContent = message;
      el.classList.toggle("error", error);
    }

    let bar = $("nohFixedNotice");

    if (!bar) {
      bar = document.createElement("div");
      bar.id = "nohFixedNotice";
      bar.setAttribute("role", "status");

      bar.style.cssText =
        "position:fixed;left:10px;right:10px;bottom:10px;z-index:99999;" +
        "padding:12px 14px;border-radius:12px;" +
        "font:600 14px/1.4 system-ui,sans-serif;" +
        "box-shadow:0 6px 24px rgba(0,0,0,.25);" +
        "max-height:40vh;overflow:auto";

      document.body.appendChild(bar);
    }

    bar.textContent = message;
    bar.style.background = error ? "#fde8e8" : "#e6f4ea";
    bar.style.color = error ? "#8a1c1c" : "#14532d";
    bar.style.border =
      "1px solid " + (error ? "#f5b5b5" : "#b7dfc2");

    bar.hidden = false;

    clearTimeout(bar._t);

    if (!error) {
      bar._t = setTimeout(() => {
        bar.hidden = true;
      }, 12000);
    }
  }

  window.addEventListener("error", e => {
    notice("Page error: " + (e.message || "unknown"), true);
  });

  window.addEventListener("unhandledrejection", e => {
    notice(
      "Page error: " +
      (e.reason?.message || e.reason || "unknown"),
      true
    );
  });

  /*
   * A timeout warning does not cancel a Supabase request.
   * Keep the dashboard lock until the real request settles.
   */
  async function waitForOperation(promise, ms, what) {
    let timer;
    const request = Promise.resolve(promise);

    const warning = new Promise(resolve => {
      timer = setTimeout(() => {
        notice(
          `${what} is taking longer than expected. ` +
          "The request is still running. Please do not start it again.",
          true
        );
        resolve({ timedOut: true });
      }, ms);
    });

    try {
      const firstResult = await Promise.race([
        request.then(value => ({
          completed: true,
          value
        })),
        warning
      ]);

      if (firstResult.completed) {
        return firstResult.value;
      }

      return await request;
    } finally {
      clearTimeout(timer);
    }
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
    if (!db) {
      throw new Error("The database connection is not ready.");
    }

    const { data, error } = await db.functions.invoke(PUBLISHER, {
      body: {
        action,
        ...extra
      }
    });

    if (error) {
      let message =
        error.message || "The publisher request failed.";

      if (
        error.context &&
        typeof error.context.json === "function"
      ) {
        const detail = await error.context.json().catch(() => null);

        if (detail?.error) {
          message = detail.error;
        }
      }

      throw new Error(message);
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data;
  }

  async function requireAdmin() {
    const {
      data: { session },
      error
    } = await db.auth.getSession();

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
      throw new Error(
        "This account is not listed as a NOH administrator."
      );
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

    (document.querySelector("main") || document.body)
      .appendChild(element);

    return true;
  }

  function createButton(id, text, className) {
    const button = document.createElement("button");
    button.type = "button";
    button.id = id;
    button.className = className;
    button.textContent = text;
    return button;
  }

  function addWorkflowControls() {
    let discovery = $("discoveryWorkflowControls");

    if (!discovery) {
      discovery = document.createElement("section");
      discovery.id = "discoveryWorkflowControls";

      discovery.style.cssText =
        "display:flex;gap:12px;align-items:center;" +
        "justify-content:space-between;flex-wrap:wrap;" +
        "background:#fff;border:1px solid #e6e9e3;" +
        "border-radius:14px;padding:14px 16px;margin:18px 0";

      discovery.innerHTML = `
        <div style="flex:1;min-width:220px">
          <strong>Discovery and image preparation</strong>
          <div id="discoveryRunLabel"
               class="entry-meta"
               style="margin-top:5px">
            Discover listings, enrich records and prepare individual images.
            Nothing is approved or published automatically.
          </div>
        </div>
        <div id="discoveryButtonGroup"
             style="display:flex;gap:8px;flex-wrap:wrap">
        </div>
      `;

      insertWorkflowSection(discovery);
    }

    const group = $("discoveryButtonGroup");

    /*
     * Reuse the original HTML discovery button.
     * Move it into this section rather than creating a second button
     * with the same ID.
     */
    let discoveryButton = $("runDiscoveryBtn");

    if (!discoveryButton) {
      discoveryButton = createButton(
        "runDiscoveryBtn",
        "Run discovery + prepare images",
        "btn btn-primary"
      );
    }

    if (group && discoveryButton.parentElement !== group) {
      group.appendChild(discoveryButton);
    }

    discoveryButton.onclick = runDiscovery;

    let prepareButton = $("prepareImagesBtn");

    if (!prepareButton) {
      prepareButton = createButton(
        "prepareImagesBtn",
        "Prepare next 6 images",
        "btn btn-outline"
      );
    }

    if (group && prepareButton.parentElement !== group) {
      group.appendChild(prepareButton);
    }

    prepareButton.onclick = prepareNextImages;

    let publishing = $("publishWorkflowControls");

    if (!publishing) {
      publishing = document.createElement("section");
      publishing.id = "publishWorkflowControls";

      publishing.style.cssText =
        "display:flex;gap:12px;align-items:center;" +
        "justify-content:space-between;flex-wrap:wrap;" +
        "background:#fff;border:1px solid #e6e9e3;" +
        "border-radius:14px;padding:14px 16px;margin:18px 0";

      publishing.innerHTML = `
        <div style="flex:1;min-width:220px">
          <strong>Publishing control</strong>
          <div id="permissionLabel"
               class="entry-meta"
               style="margin-top:5px">
            Checking permission…
          </div>
          <div id="publishSelectionLabel"
               class="entry-meta"
               style="margin-top:5px">
            Select at least 20 approved, image-ready records across 3 categories.
          </div>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-outline"
                  type="button"
                  id="grantPermissionBtn">
            Grant 15-minute permission
          </button>

          <button class="btn btn-outline"
                  type="button"
                  id="revokePermissionBtn">
            Revoke permission
          </button>

          <button class="btn btn-primary"
                  type="button"
                  id="publishSelectedBtn"
                  disabled>
            Publish selected approved (0)
          </button>
        </div>
      `;

      discovery.insertAdjacentElement("afterend", publishing);
    }

    $("grantPermissionBtn").onclick = grantPermission;
    $("revokePermissionBtn").onclick = revokePermission;
    $("publishSelectedBtn").onclick = publishSelected;
  }

  function validIndividualImage(row) {
    if (!row?.id || !row?.image_url) return false;

    const imageUrl = safeHttps(row.image_url);

    if (!imageUrl) return false;

    const escapedId = String(row.id).replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    const pattern = new RegExp(
      "^https://djxornmwvkauhkcuhgxc\\.supabase\\.co/" +
      "storage/v1/object/public/opportunity-images/" +
      escapedId +
      "\\.(jpg|png|webp|gif|avif)$",
      "i"
    );

    return pattern.test(imageUrl);
  }

  function selectedCategoryCount() {
    const rows = currentRows.filter(row =>
      selectedIds.has(row.id)
    );

    return new Set(
      rows
        .map(row => String(row.category || "").trim())
        .filter(Boolean)
    ).size;
  }

  function updatePublishButton() {
    const button = $("publishSelectedBtn");

    const categoryCount = selectedCategoryCount();
    const selectedCount = selectedIds.size;

    const enoughRecords =
      selectedCount >= MIN_PUBLISH_BATCH;

    const enoughCategories =
      categoryCount >= MIN_PUBLISH_CATEGORIES;

    if (button) {
      button.disabled =
        permission !== "granted" ||
        !enoughRecords ||
        !enoughCategories ||
        busy;

      button.textContent =
        `Publish ${selectedCount} approved · ${categoryCount} categories`;
    }

    const label = $("publishSelectionLabel");

    if (label) {
      if (!enoughRecords) {
        label.textContent =
          `${selectedCount}/${MIN_PUBLISH_BATCH} selected. ` +
          `Select at least ${MIN_PUBLISH_BATCH} image-ready approved records.`;
      } else if (!enoughCategories) {
        label.textContent =
          `${categoryCount}/${MIN_PUBLISH_CATEGORIES} categories selected. ` +
          "Choose opportunities from at least three categories.";
      } else if (permission !== "granted") {
        label.textContent =
          "Selection target reached. Grant temporary publishing permission when ready.";
      } else {
        label.textContent =
          "Publishing requirements met. Confirm the final batch when ready.";
      }
    }
  }

  async function prepareImageBatch(body, label) {
    if (label) {
      label.textContent = "Preparing individual opportunity images…";
    }

    const result = await waitForOperation(
      db.functions.invoke(IMAGE_FUNCTION, { body }),
      120000,
      "Image preparation"
    );

    if (result.error) {
      let message =
        result.error.message || "Image preparation request failed.";

      if (
        result.error.context &&
        typeof result.error.context.json === "function"
      ) {
        const detail = await result.error.context.json().catch(() => null);

        if (detail?.error) {
          message = detail.error;
        }
      }

      throw new Error(message);
    }

    if (result.data?.error) {
      throw new Error(result.data.error);
    }

    return result.data || {};
  }

  async function runDiscovery() {
    if (discoveryBusy || busy) {
      notice(
        "Another dashboard operation is running. Please wait.",
        true
      );
      return;
    }

    if (!db) {
      notice(
        "The database connection is not ready. Refresh and sign in again.",
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

    const prepareButton = $("prepareImagesBtn");

    if (prepareButton) {
      prepareButton.disabled = true;
    }

    if (label) {
      label.textContent =
        "Checking opportunity sources and enriching pending records…";
    }

    notice("Discovery started. Please keep this page open.");

    try {
      const discoveryResult = await waitForOperation(
        db.functions.invoke(DISCOVERY_FUNCTION, {
          body: {}
        }),
        120000,
        "Discovery"
      );

      if (discoveryResult.error) {
        let message =
          discoveryResult.error.message || "Discovery request failed.";

        if (
          discoveryResult.error.context &&
          typeof discoveryResult.error.context.json === "function"
        ) {
          const detail = await discoveryResult.error.context.json().catch(() => null);

          if (detail?.error) message = detail.error;
          if (detail?.detail) message += " — " + detail.detail;
        }

        throw new Error(message);
      }

      const discovery = discoveryResult.data || {};

      if (discovery.error) {
        throw new Error(discovery.error);
      }

      const enriched = Array.isArray(discovery.enriched)
        ? discovery.enriched
        : [];

      const ids = [
        ...new Set(
          enriched
            .map(row => row?.id)
            .filter(Boolean)
        )
      ].slice(0, MAX_IMAGE_BATCH);

      let images = {};
      let imageError = null;

      /*
       * First try the records enriched in this discovery run.
       * Some already have images, so the image function may select zero.
       */
      if (ids.length) {
        try {
          images = await prepareImageBatch({ ids }, label);
        } catch (error) {
          imageError = error;
        }
      }

      /*
       * If the enriched records already have images, prepare the next
       * pending records that still need their own images.
       */
      if (
        !imageError &&
        (!images || Number(images.selected || 0) === 0)
      ) {
        if (label) {
          label.textContent =
            "The enriched batch has no missing images. Checking other pending records…";
        }

        images = await prepareImageBatch(
          { limit: MAX_IMAGE_BATCH },
          label
        );
      }

      if (imageError) {
        throw imageError;
      }

      const ready = Number(images.image_ready ?? 0);
      const selected = Number(images.selected ?? 0);
      const attention = Number(images.needs_attention ?? 0);

      const sourceErrors = Array.isArray(discovery.errors)
        ? discovery.errors.length
        : 0;

      const summary =
        `Discovery complete: ` +
        `${Number(discovery.sources_checked ?? 0)} sources checked, ` +
        `${Number(discovery.entries_seen ?? 0)} listings found, ` +
        `${Number(discovery.new_pending_entries ?? 0)} new records, ` +
        `${enriched.length} enrichment attempts. ` +
        `Images: ${ready} ready from ${selected} selected; ` +
        `${attention} need attention. ` +
        `${sourceErrors} source/database warning(s). ` +
        `Nothing was approved or published.`;

      if (label) {
        label.textContent = summary;
      }

      notice(summary, sourceErrors > 0 || attention > 0);

      await loadQueue(true);

    } catch (e) {
      const message =
        e.message ||
        "Unable to complete discovery and image preparation.";

      if (label) {
        label.textContent = message;
      }

      notice(message, true);

      try {
        await loadQueue(true);
      } catch {
        // Keep the original error visible.
      }

    } finally {
      discoveryBusy = false;
      busy = false;

      if (button) {
        button.disabled = false;
        button.textContent = "Run discovery + prepare images";
      }

      if (prepareButton) {
        prepareButton.disabled = false;
      }

      updatePublishButton();
    }
  }

  async function prepareNextImages() {
    if (busy || discoveryBusy) {
      notice(
        "Another dashboard operation is running. Please wait.",
        true
      );
      return;
    }

    if (!db) {
      notice("The database connection is not ready.", true);
      return;
    }

    const button = $("prepareImagesBtn");
    const label = $("discoveryRunLabel");

    busy = true;
    updatePublishButton();

    if (button) {
      button.disabled = true;
      button.textContent = "Preparing images…";
    }

    try {
      const images = await prepareImageBatch(
        { limit: MAX_IMAGE_BATCH },
        label
      );

      const ready = Number(images.image_ready ?? 0);
      const selected = Number(images.selected ?? 0);
      const attention = Number(images.needs_attention ?? 0);

      const summary =
        `Image preparation complete: ${ready} ready from ` +
        `${selected} selected; ${attention} need attention. ` +
        "Records without a verified individual image remain unpublished.";

      if (label) {
        label.textContent = summary;
      }

      notice(summary, attention > 0);

      await loadQueue(true);

    } catch (e) {
      notice(
        e.message || "Unable to prepare opportunity images.",
        true
      );
    } finally {
      busy = false;

      if (button) {
        button.disabled = false;
        button.textContent = "Prepare next 6 images";
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
        : "Locked — publishing is disabled until temporary permission is granted.";
    }

    updatePublishButton();
  }

  async function grantPermission() {
    if (busy) {
      notice(
        "Another dashboard operation is running. Please wait.",
        true
      );
      return;
    }

    busy = true;
    updatePublishButton();

    const button = $("grantPermissionBtn");

    if (button) {
      button.disabled = true;
      button.textContent = "Granting permission…";
    }

    try {
      const result = await invoke("grant_permission", {
        expires_in_minutes: 15,
        note: "Temporary permission granted from NOH discovery review."
      });

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

      if (button) {
        button.disabled = false;
        button.textContent = "Grant 15-minute permission";
      }

      updatePublishButton();
    }
  }

  async function revokePermission() {
    if (busy) {
      notice(
        "Another dashboard operation is running. Please wait.",
        true
      );
      return;
    }

    busy = true;
    updatePublishButton();

    const button = $("revokePermissionBtn");

    if (button) {
      button.disabled = true;
      button.textContent = "Revoking…";
    }

    try {
      await invoke("revoke_permission", {
        note: "Permission revoked from NOH discovery review."
      });

      await loadPermission();

      notice("Publishing permission revoked. Publishing is locked.");

    } catch (e) {
      notice(
        e.message || "Unable to revoke publishing permission.",
        true
      );
    } finally {
      busy = false;

      if (button) {
        button.disabled = false;
        button.textContent = "Revoke permission";
      }

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

    if ($("pendingCount")) {
      $("pendingCount").textContent = pending ?? 0;
    }

    if ($("importedCount")) {
      $("importedCount").textContent = imported ?? 0;
    }

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

    if (approvedStat) {
      approvedStat.textContent = approved ?? 0;
    }
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
        `${row.title} ${row.source_name} ${row.summary || ""} ${row.organization || ""}`
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
        'Change the search or status filter, or run discovery again.</div>';

      updatePublishButton();
      return;
    }

    queue.innerHTML = rows.map(row => {
      const approved = row.status === "approved";
      const pending = row.status === "pending";
      const imageReady = validIndividualImage(row);

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

            <p class="entry-meta">
              ${
                imageReady
                  ? "Individual image URL ready. The publishing backend will verify its Storage object."
                  : "Image not ready. This record cannot be selected for publication."
              }
            </p>

            ${
              row.review_note
                ? `<p class="entry-meta">Review note: ${esc(row.review_note)}</p>`
                : ""
            }

            ${
              approved && imageReady
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
                : approved
                  ? '<p class="entry-meta">Approved, awaiting its own individual image.</p>'
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

      currentRows = Array.isArray(result.records)
        ? result.records
        : [];

      selectedIds = new Set(
        [...selectedIds].filter(id =>
          currentRows.some(row =>
            row.id === id &&
            row.status === "approved" &&
            validIndividualImage(row)
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
      notice(
        "Another dashboard operation is running. Please wait.",
        true
      );
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

    if (
      !opportunity.application_url ||
      !opportunity.source_url
    ) {
      notice(
        "Both URLs must be valid HTTPS links.",
        true
      );
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

    const button = $("publishBtn");

    button.disabled = true;
    button.textContent = "Saving approval…";

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
        "It has NOT been published yet. Select it after its individual image is ready."
      );

      await loadQueue(true);

    } catch (e) {
      notice(
        e.message || "Unable to approve this discovery.",
        true
      );
    } finally {
      busy = false;

      button.disabled = false;
      button.textContent = "Approve for publishing";

      updatePublishButton();
    }
  }

  async function reject(id) {
    if (busy) {
      notice(
        "Another dashboard operation is running. Please wait.",
        true
      );
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
    if (busy) {
      notice(
        "Another dashboard operation is running. Please wait.",
        true
      );
      return;
    }

    if (permission !== "granted") {
      notice(
        "Grant temporary publishing permission first.",
        true
      );
      return;
    }

    const ids = [...selectedIds];

    if (ids.length < MIN_PUBLISH_BATCH) {
      notice(
        `Select at least ${MIN_PUBLISH_BATCH} approved, image-ready opportunities.`,
        true
      );
      return;
    }

    const rows = currentRows.filter(row =>
      selectedIds.has(row.id)
    );

    if (rows.length !== ids.length) {
      notice(
        "Some selected records are no longer in the current queue. Refresh and select again.",
        true
      );
      return;
    }

    if (rows.some(row =>
      row.status !== "approved" || !validIndividualImage(row)
    )) {
      notice(
        "Every selected record must be approved and have its own image URL.",
        true
      );
      return;
    }

    const categories = new Set(
      rows
        .map(row => String(row.category || "").trim())
        .filter(Boolean)
    );

    if (categories.size < MIN_PUBLISH_CATEGORIES) {
      notice(
        `Choose opportunities from at least ${MIN_PUBLISH_CATEGORIES} categories.`,
        true
      );
      return;
    }

    if (ids.length > 100) {
      notice(
        "The publishing workflow allows a maximum of 100 records per batch.",
        true
      );
      return;
    }

    if (!window.confirm(
      `Publish ${ids.length} approved opportunity records ` +
      `across ${categories.size} categories to the public NOH website now?`
    )) {
      return;
    }

    busy = true;
    updatePublishButton();

    const button = $("publishSelectedBtn");

    if (button) {
      button.disabled = true;
      button.textContent = "Publishing…";
    }

    try {
      const result = await invoke("publish_approved", { ids });

      selectedIds.clear();

      const inserted = Number(result.inserted || 0);
      const skipped = Number(result.skipped || 0);

      notice(
        `Publication completed. ${inserted} opportunity record(s) ` +
        `published to NOH. ${skipped} duplicate(s) skipped. ` +
        "The protected backend verified the records and their individual images."
      );

      await loadQueue(true);

    } catch (e) {
      notice(
        e.message || "Unable to publish the approved opportunities.",
        true
      );
    } finally {
      busy = false;

      if (button) {
        button.textContent =
          `Publish ${selectedIds.size} approved · ${selectedCategoryCount()} categories`;
      }

      updatePublishButton();
    }
  }

  async function refreshQueue() {
    if (busy) {
      notice(
        "Please wait for the current operation to finish before refreshing.",
        true
      );
      return;
    }

    const button = $("refreshBtn");

    if (button) {
      button.disabled = true;
      button.textContent = "Refreshing…";
    }

    try {
      await loadQueue();
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Refresh queue";
      }
    }
  }

  function attachQueueHandlers() {
    $("queue")?.addEventListener("click", e => {
      const target = e.target;

      if (!(target instanceof Element)) return;

      const button = target.closest("button[data-action]");

      if (!button) return;

      if (button.dataset.action === "approve") {
        openApproval(button.dataset.id);
      }

      if (button.dataset.action === "reject") {
        reject(button.dataset.id);
      }
    });

    $("queue")?.addEventListener("change", e => {
      const target = e.target;

      if (!(target instanceof Element)) return;

      const input = target.closest("input[data-select]");

      if (!input) return;

      const id = input.dataset.select;
      const row = currentRows.find(item => item.id === id);

      if (!row || row.status !== "approved" || !validIndividualImage(row)) {
        input.checked = false;
        selectedIds.delete(id);

        notice(
          "Only approved records with their own image can be selected.",
          true
        );

        updatePublishButton();
        return;
      }

      if (input.checked) {
        selectedIds.add(id);
      } else {
        selectedIds.delete(id);
      }

      updatePublishButton();
    });
  }

  function attachStaticHandlers() {
    $("refreshBtn")?.addEventListener("click", refreshQueue);

    $("searchInput")?.addEventListener("input", render);
    $("statusFilter")?.addEventListener("change", render);

    $("approveForm")?.addEventListener("submit", approve);

    $("closeDialog")?.addEventListener(
      "click",
      () => $("reviewDialog")?.close()
    );

    $("reviewDialog")?.addEventListener("click", event => {
      if (event.target === $("reviewDialog")) {
        $("reviewDialog").close();
      }
    });

    attachQueueHandlers();
  }

  async function init() {
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
        option.textContent =
          "Approved — awaiting publication";

        const importedOption =
          status.querySelector('option[value="imported"]');

        status.insertBefore(
          option,
          importedOption || null
        );
      }

      attachStaticHandlers();

      await loadQueue();

      const authResult = db.auth.onAuthStateChange(
        (event, session) => {
          if (event === "SIGNED_OUT" || !session) {
            permission = "not_granted";
            selectedIds.clear();

            notice(
              "You have been signed out. Sign in again to use administrator controls.",
              true
            );

            updatePublishButton();
            return;
          }

          if (event === "TOKEN_REFRESHED" && !busy) {
            loadQueue();
          }
        }
      );

      authSubscription = authResult?.data?.subscription || null;

      notice(
        "Admin Discovery connected. Discovery, image preparation, review and publishing controls are ready."
      );

    } catch (e) {
      notice(
        e.message || "Administrator access required.",
        true
      );

      const controls = [
        $("runDiscoveryBtn"),
        $("prepareImagesBtn"),
        $("grantPermissionBtn"),
        $("revokePermissionBtn"),
        $("publishSelectedBtn")
      ];

      controls.filter(Boolean).forEach(button => {
        button.disabled = true;
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );
  } else {
    init();
  }
})();
