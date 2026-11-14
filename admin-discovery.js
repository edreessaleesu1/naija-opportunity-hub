
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

  const MAX_IMAGE_BATCH = 6;
  const MAX_PUBLISH_BATCH = 100;

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

  function dateOnlyLabel(value) {
    if (!value) return "Not supplied";

    const d = new Date(String(value) + "T00:00:00");

    return Number.isNaN(d.getTime())
      ? "Not supplied"
      : d.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric"
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
    if (!db) {
      throw new Error("The database connection is not ready.");
    }

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
    discoveryButton.disabled = false;
    discoveryButton.textContent = "Run discovery + prepare images";

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
            Select any number of approved records with individual verified images.
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

  function updatePublishButton() {
    const button = $("publishSelectedBtn");
    const selectedCount = selectedIds.size;

    const canPublish =
      selectedCount > 0 &&
      selectedCount <= MAX_PUBLISH_BATCH &&
      permission === "granted" &&
      !busy;

    if (button) {
      button.disabled = !canPublish;
      button.textContent =
        "Publish selected approved (" + selectedCount + ")";
    }

    const label = $("publishSelectionLabel");

    if (label) {
      if (!selectedCount) {
        label.textContent =
          "Select any number of approved opportunities with their own verified images.";
      } else if (selectedCount > MAX_PUBLISH_BATCH) {
        label.textContent =
          "Maximum 100 records per publication batch.";
      } else if (permission !== "granted") {
        label.textContent =
          selectedCount +
          " selected. Grant temporary publishing permission to continue.";
      } else if (busy) {
        label.textContent =
          "Please wait for the current operation to finish.";
      } else {
        label.textContent =
          selectedCount +
          " approved, image-ready record(s) selected. Ready to publish.";
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
        "Checking administrator access and opportunity sources…";
    }

    notice("Discovery started. Please keep this page open.");

    try {
      await requireAdmin();

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
          const detail =
            await discoveryResult.error.context.json().catch(() => null);

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

      if (ids.length) {
        try {
          images = await prepareImageBatch({ ids }, label);
        } catch (error) {
          imageError = error;
        }
      }

      if (
        !imageError &&
        (!images || Number(images.selected || 0) === 0)
      ) {
        if (label) {
          label.textContent =
            "Checking other pending records for image preparation…";
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

      // Immediately retrieve and display the updated review queue.
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
      await requireAdmin();

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
      await requireAdmin();

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
      await requireAdmin();

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

  function imageMarkup(row) {
    const imageUrl = validIndividualImage(row)
      ? safeHttps(row.image_url)
      : "";

    if (!imageUrl) {
      return `
        <div class="noh-image-placeholder">
          <span>Image not ready</span>
          <small>Prepare an individual image</small>
        </div>
      `;
    }

    return `
      <a class="noh-image-link"
         href="${esc(imageUrl)}"
         target="_blank"
         rel="noopener noreferrer"
         title="Open full-size opportunity image">

        <img
          class="noh-opportunity-image"
          src="${esc(imageUrl)}"
          alt="Image for ${esc(row.title || "opportunity")}"
          loading="lazy"
          data-opportunity-image
        >

      </a>

      <div class="noh-image-caption">
        Individual image attached
      </div>
    `;
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
        `${row.title} ${row.source_name} ${row.summary || ""} ${row.organization || ""} ${row.category || ""}`
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

    queue.innerHTML = `
      <style>
        .noh-review-card {
          display:grid;
          grid-template-columns:160px minmax(0,1fr) auto;
          gap:16px;
          align-items:start;
          background:#fff;
          border:1px solid #e6e9e3;
          border-radius:16px;
          padding:16px;
          margin-bottom:14px;
          min-width:0;
        }

        .noh-image-column {
          min-width:0;
        }

        .noh-image-link {
          display:block;
          width:100%;
          overflow:hidden;
          border-radius:11px;
          background:#f0f3ee;
        }

        .noh-opportunity-image {
          display:block;
          width:100%;
          height:125px;
          object-fit:cover;
          background:#f0f3ee;
        }

        .noh-image-placeholder {
          width:100%;
          height:125px;
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;
          gap:5px;
          border:1px dashed #cbd6cb;
          border-radius:11px;
          background:#f8faf6;
          color:#68766e;
          text-align:center;
          font-size:13px;
          padding:8px;
        }

        .noh-image-placeholder small {
          font-size:11px;
        }

        .noh-image-caption {
          margin-top:6px;
          font-size:11px;
          color:#167044;
          font-weight:650;
        }

        .noh-card-content {
          min-width:0;
          overflow-wrap:anywhere;
        }

        .noh-card-title {
          margin:9px 0 7px;
          font-size:1.08rem;
          line-height:1.4;
          color:#20332a;
        }

        .noh-card-meta {
          display:flex;
          flex-wrap:wrap;
          gap:7px;
          margin:7px 0;
          color:#68766e;
          font-size:12px;
        }

        .noh-card-links {
          display:flex;
          flex-wrap:wrap;
          gap:12px;
          margin-top:11px;
          font-size:13px;
        }

        .noh-card-links a {
          color:#086b45;
          font-weight:650;
          overflow-wrap:anywhere;
        }

        .noh-card-description {
          color:#52635a;
          line-height:1.55;
          margin:9px 0;
          font-size:14px;
          white-space:pre-line;
        }

        .noh-card-actions {
          display:flex;
          flex-direction:column;
          gap:8px;
          min-width:125px;
        }

        .noh-card-actions button {
          white-space:nowrap;
        }

        .noh-status {
          display:inline-block;
          padding:4px 9px;
          border-radius:99px;
          background:#fff5dc;
          color:#77550d;
          font-size:11px;
          font-weight:750;
          text-transform:uppercase;
        }

        .noh-status.approved {
          background:#e6f4ea;
          color:#14532d;
        }

        .noh-status.rejected {
          background:#fff0ee;
          color:#94392d;
        }

        .noh-image-error {
          height:125px;
          display:flex;
          align-items:center;
          justify-content:center;
          padding:10px;
          text-align:center;
          background:#fff0ee;
          color:#94392d;
          border-radius:11px;
          font-size:12px;
        }

        @media(max-width:700px) {
          .noh-review-card {
            grid-template-columns:105px minmax(0,1fr);
            gap:12px;
            padding:12px;
          }

          .noh-opportunity-image,
          .noh-image-placeholder,
          .noh-image-error {
            height:100px;
          }

          .noh-card-actions {
            grid-column:1/-1;
            flex-direction:row;
            flex-wrap:wrap;
            min-width:0;
          }

          .noh-card-actions button {
            flex:1;
          }
        }

        @media(max-width:390px) {
          .noh-review-card {
            grid-template-columns:1fr;
          }

          .noh-image-column {
            max-width:100%;
          }

          .noh-opportunity-image,
          .noh-image-placeholder,
          .noh-image-error {
            height:180px;
          }
        }
      </style>

      ${rows.map(row => {
        const approved = row.status === "approved";
        const pending = row.status === "pending";
        const imageReady = validIndividualImage(row);

        const sourceUrl = safeHttps(row.source_url);
        const applicationUrl = safeHttps(row.application_url);

        return `
          <article class="noh-review-card"
                   data-id="${esc(row.id)}">

            <div class="noh-image-column">
              ${imageMarkup(row)}
            </div>

            <div class="noh-card-content">

              <div class="noh-card-meta">
                <span class="noh-status ${esc(row.status)}">
                  ${esc(row.status)}
                </span>

                <span>${esc(row.source_name || "Discovery source")}</span>

                <span>
                  Discovered ${esc(dateLabel(row.discovered_at))}
                </span>
              </div>

              <h3 class="noh-card-title">
                ${esc(row.title || "Untitled opportunity")}
              </h3>

              <div class="noh-card-meta">
                <strong>
                  ${esc(row.organization || "Organisation not yet verified")}
                </strong>

                ${row.category
                  ? `<span>· ${esc(row.category)}</span>`
                  : ""}

                ${row.location
                  ? `<span>· ${esc(row.location)}</span>`
                  : ""}
              </div>

              <p class="noh-card-description">
                ${esc(
                  row.summary ||
                  row.description ||
                  "No description supplied. Open the original listing and verify its details."
                )}
              </p>

              <div class="noh-card-meta">
                <span>
                  Deadline: ${esc(dateOnlyLabel(row.deadline))}
                </span>

                <span>
                  Source publication: ${esc(dateLabel(row.published_at))}
                </span>
              </div>

              <div class="noh-card-links">
                ${
                  sourceUrl
                    ? `<a href="${esc(sourceUrl)}"
                          target="_blank"
                          rel="noopener noreferrer">
                         Open original listing ↗
                       </a>`
                    : "<span>Source link unavailable</span>"
                }

                ${
                  applicationUrl
                    ? `<a href="${esc(applicationUrl)}"
                          target="_blank"
                          rel="noopener noreferrer">
                         Open application page ↗
                       </a>`
                    : "<span>Application link not supplied</span>"
                }
              </div>

              <div class="noh-card-meta" style="margin-top:10px">
                ${
                  imageReady
                    ? '<span style="color:#167044;font-weight:700">Individual image URL attached</span>'
                    : '<span style="color:#9a5b12;font-weight:700">Individual image not ready</span>'
                }
              </div>

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

            <div class="noh-card-actions">
              ${
                pending
                  ? `
                    <button
                      class="btn btn-primary"
                      data-action="approve"
                      data-id="${esc(row.id)}"
                      type="button">
                      Review & approve
                    </button>

                    <button
                      class="btn btn-danger"
                      data-action="reject"
                      data-id="${esc(row.id)}"
                      type="button">
                      Reject
                    </button>
                  `
                  : ""
              }
            </div>

          </article>
        `;
      }).join("")}
    `;

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
      await requireAdmin();

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
      await requireAdmin();

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

    if (ids.length === 0) {
      notice(
        "Select at least one approved, image-ready opportunity.",
        true
      );
      return;
    }

    if (ids.length > MAX_PUBLISH_BATCH) {
      notice(
        "The publishing workflow allows a maximum of 100 records per batch.",
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

    if (!window.confirm(
      `Publish ${ids.length} approved opportunity records ` +
      `to the public NOH website now?`
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
      await requireAdmin();

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
          "Publish selected approved (" + selectedIds.size + ")";
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
    const queue = $("queue");

    if (!queue) return;

    queue.addEventListener("click", e => {
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

    queue.addEventListener("change", e => {
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

    // Handle broken image URLs without leaving broken-image icons.
    queue.addEventListener("error", event => {
      const image = event.target;

      if (
        !(image instanceof HTMLImageElement) ||
        !image.matches("[data-opportunity-image]")
      ) {
        return;
      }

      const link = image.closest(".noh-image-link");

      if (!link) return;

      const fallback = document.createElement("div");
      fallback.className = "noh-image-error";
      fallback.textContent = "Image preview unavailable. Check the image file.";

      link.replaceWith(fallback);
    }, true);
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
    const earlyDiscoveryButton = $("runDiscoveryBtn");

    if (earlyDiscoveryButton) {
      earlyDiscoveryButton.disabled = false;
      earlyDiscoveryButton.onclick = runDiscovery;
    }

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
        $("prepareImagesBtn"),
        $("grantPermissionBtn"),
        $("revokePermissionBtn"),
        $("publishSelectedBtn")
      ];

      controls.filter(Boolean).forEach(button => {
        button.disabled = true;
      });

      if (earlyDiscoveryButton) {
        earlyDiscoveryButton.disabled = false;
        earlyDiscoveryButton.onclick = runDiscovery;
      }
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
