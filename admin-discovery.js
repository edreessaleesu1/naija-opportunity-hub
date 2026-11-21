
/*
 * Naija Opportunity Hub — Admin Discovery Dashboard
 *
 * Existing backend functions:
 *   noh-discover-opportunities
 *   noh-publish-opportunities
 *   noh-prepare-discovery-images
 *
 * Workflow:
 *   Discover → Enrich → Validate → Prepare images → Review
 *   → Approve → Grant publishing permission → Publish
 *
 * Important:
 *   - Discovery never automatically approves or publishes.
 *   - An image URL alone does not mean an image has passed validation.
 *   - Retry explicitly requests a rebuild for existing image records.
 *   - Publishing requires approval and temporary permission.
 */

(() => {
  "use strict";

  const SUPABASE_URL =
    "https://djxornmwvkauhkcuhgxc.supabase.co";

  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_EDReCY3JcN4vMuypVfqcMQ_GcTEVuBq";

  const PUBLISHER = "noh-publish-opportunities";
  const IMAGE_FUNCTION = "noh-prepare-discovery-images";
  const DISCOVERY_FUNCTION = "noh-discover-opportunities";

  const IMAGE_BATCH = 6;
  const MAX_BATCH = 100;
  const PAGE_SIZE = 25;
  const AUTO_IMAGE_ROUNDS = 3;
  const IMAGE_ROUND_CAP = 25;

  const $ = id => document.getElementById(id);

  let db = null;
  let rows = [];
  let counts = {};
  let selected = new Set();
  let permission = "not_granted";
  let shown = PAGE_SIZE;
  let newIds = new Set();
  let op = null;
  let stopRequested = false;

  /* ================================================================
     HELPERS
  ================================================================= */

  const esc = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  function safeHttps(value) {
    try {
      const url = new URL(String(value));

      return url.protocol === "https:"
        ? url.href
        : "";
    } catch {
      return "";
    }
  }

  function dateTime(value) {
    const date = value ? new Date(value) : null;

    return date && !Number.isNaN(date.getTime())
      ? date.toLocaleString("en-GB", {
          dateStyle: "medium",
          timeStyle: "short"
        })
      : "Not supplied";
  }

  function dateOnly(value) {
    const date = value
      ? new Date(String(value) + "T00:00:00")
      : null;

    return date && !Number.isNaN(date.getTime())
      ? date.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric"
        })
      : "Not supplied";
  }

  function notice(message, error = false) {
    const element = $("notice");

    if (element) {
      element.textContent = message;
      element.classList.toggle("error", error);
    }

    let bar = $("nohFixedNotice");

    if (!bar) {
      bar = document.createElement("div");
      bar.id = "nohFixedNotice";
      bar.setAttribute("role", "status");

      bar.style.cssText =
        "position:fixed;left:10px;right:10px;bottom:10px;" +
        "z-index:99999;padding:12px 14px;border-radius:12px;" +
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
      }, 10000);
    }
  }

  window.addEventListener("error", event => {
    notice(
      "Page error: " + (event.message || "unknown"),
      true
    );
  });

  window.addEventListener("unhandledrejection", event => {
    notice(
      "Page error: " +
      (event.reason?.message || event.reason || "unknown"),
      true
    );
  });

  async function patient(promise, milliseconds, description) {
    let timer;

    const slow = new Promise(resolve => {
      timer = setTimeout(() => {
        notice(
          `${description} is taking longer than usual. ` +
          "It is still running; please do not start it again.",
          true
        );

        resolve({ slow: true });
      }, milliseconds);
    });

    try {
      const first = await Promise.race([
        Promise.resolve(promise).then(value => ({ value })),
        slow
      ]);

      return first.slow ? await promise : first.value;
    } finally {
      clearTimeout(timer);
    }
  }

  async function unwrap(result, description) {
    const { data, error } = result;

    if (error) {
      let message =
        error.message || description + " failed.";

      if (
        error.context &&
        typeof error.context.json === "function"
      ) {
        const detail = await error.context
          .json()
          .catch(() => null);

        if (detail?.error) {
          message = detail.error;
        }

        if (detail?.detail) {
          message += " — " + detail.detail;
        }
      }

      throw new Error(message);
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data ?? {};
  }

  const publisher = async (action, extra = {}) => {
    return unwrap(
      await db.functions.invoke(PUBLISHER, {
        body: {
          action,
          ...extra
        }
      }),
      "The publisher request"
    );
  };

  async function requireAdmin() {
    const {
      data: { session },
      error
    } = await db.auth.getSession();

    if (error || !session?.user) {
      throw new Error(
        "Sign in to your NOH administrator account first, " +
        "then reopen this page."
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

  /* ================================================================
     OPPORTUNITY VALIDATION
  ================================================================= */

  const REQUIRED = [
    ["title", "title"],
    ["organization", "organisation"],
    ["category", "category"],
    ["description", "description"],
    ["eligibility", "source-verified eligibility"],
    ["application_url", "application link"],
    ["source_url", "source link"],
    ["image_url", "individual image"]
  ];

  function missingFields(row) {
    return REQUIRED
      .filter(([key]) => {
        const value = String(row[key] ?? "").trim();

        if (!value) return true;

        if (
          key === "eligibility" &&
          value.length < 20
        ) {
          return true;
        }

        if (
          key === "description" &&
          value.length < 30
        ) {
          return true;
        }

        return false;
      })
      .map(([, label]) => label);
  }

  /* ================================================================
     IMAGE VALIDATION
  ================================================================= */

  /*
   * A valid image must:
   *   1. Have a valid HTTPS URL.
   *   2. Be marked ready by the backend.
   *   3. Have passed unique-image quality validation.
   *   4. Have no duplicate-image reference.
   *
   * The URL is not required to follow a particular filename pattern.
   * The backend remains responsible for verifying ownership and
   * Storage integrity. This avoids rejecting valid backend-generated
   * image filenames merely because they do not match an assumed ID.
   */

  function ownImage(row) {
    if (!row) return false;

    const url = safeHttps(row.image_url);

    if (!url) return false;

    if (row.image_status !== "ready") return false;

    if (row.image_quality_status !== "passed") {
      return false;
    }

    if (row.image_duplicate_of) return false;

    return true;
  }

  function imageValidationMessage(row) {
    if (row.image_duplicate_of) {
      return (
        "This image is linked to another image record. " +
        "A unique image is required."
      );
    }

    if (row.image_status === "failed") {
      return (
        "Image preparation failed. Retry image preparation."
      );
    }

    if (row.image_quality_status === "failed") {
      return (
        "This image did not pass unique-image validation. " +
        "Rebuild the image."
      );
    }

    if (row.image_quality_status !== "passed") {
      return (
        "Unique-image quality validation is not confirmed yet."
      );
    }

    if (row.image_status !== "ready") {
      return "Image preparation is not marked as ready.";
    }

    if (!safeHttps(row.image_url)) {
      return "No valid HTTPS image URL is attached.";
    }

    return "The image is not ready for approval.";
  }

  function imageNeedsRetry(row) {
    if (!row) return false;

    return (
      row.image_status === "failed" ||
      row.image_quality_status === "failed" ||
      Boolean(row.image_duplicate_of) ||
      (
        Boolean(row.image_url) &&
        !ownImage(row)
      )
    );
  }

  function imageState(row) {
    if (ownImage(row)) return "READY";

    if (
      row.image_status === "failed" ||
      row.image_quality_status === "failed" ||
      row.image_duplicate_of
    ) {
      return "FAILED";
    }

    if (row.image_url) {
      return "CHECKING";
    }

    return "MISSING";
  }

  function imageStateLabel(row) {
    const state = imageState(row);

    if (state === "READY") return "Image ready · Unique check passed";
    if (state === "FAILED") return "Image failed — retry";
    if (state === "CHECKING") return "Image uploaded · Validation pending";

    return "Image not prepared";
  }

  /* ================================================================
     WORKFLOW STATES
  ================================================================= */

  function stageOf(row) {
    if (row.status === "rejected") {
      return "REJECTED";
    }

    if (row.status === "imported") {
      return "PUBLISHED";
    }

    if (row.status === "approved") {
      return row.publish_error
        ? "PUBLISH_FAILED"
        : "APPROVED";
    }

    if (imageState(row) === "FAILED") {
      return "IMAGE_FAILED";
    }

    if (!ownImage(row)) {
      if (row.validation_status === "unchecked" &&
          !(row.enrich_attempts > 0)) {
        return "DISCOVERED";
      }

      return "IMAGE_PENDING";
    }

    const gaps = missingFields(row);

    return gaps.length
      ? "NEEDS_DETAILS"
      : "READY_FOR_REVIEW";
  }

  const STAGE_LABEL = {
    DISCOVERED: ["Discovered", "info"],
    IMAGE_PENDING: ["Waiting for image", ""],
    IMAGE_FAILED: ["Image failed — retry", "failed"],
    NEEDS_DETAILS: ["Needs details", ""],
    READY_FOR_REVIEW: ["Ready for review", "ready"],
    APPROVED: ["Approved", "approved"],
    PUBLISH_FAILED: ["Publish failed — retry", "failed"],
    PUBLISHED: ["Published", "published"],
    REJECTED: ["Rejected", "rejected"]
  };

  function reviewReady(row) {
    return (
      row.status === "pending" &&
      stageOf(row) === "READY_FOR_REVIEW" &&
      ownImage(row) &&
      Boolean(row.title?.trim()) &&
      Boolean(row.organization?.trim()) &&
      Boolean(row.category?.trim()) &&
      String(row.description || "").trim().length >= 30 &&
      String(row.eligibility || "").trim().length >= 20 &&
      Boolean(safeHttps(row.application_url)) &&
      Boolean(safeHttps(row.source_url))
    );
  }

  /* ================================================================
     QUEUE LOADING
  ================================================================= */

  function statusesForFilter() {
    const filter = $("statusFilter")?.value || "active";

    if (filter === "active") {
      return ["pending", "approved"];
    }

    if (filter === "all") {
      return [
        "pending",
        "approved",
        "imported",
        "rejected"
      ];
    }

    return [filter];
  }

  async function loadQueue(quiet = false) {
    const result = await publisher("review_list", {
      statuses: statusesForFilter()
    });

    rows = Array.isArray(result.records)
      ? result.records
      : [];

    counts = result.counts || {};

    const ids = new Set(rows.map(row => row.id));

    selected = new Set(
      [...selected].filter(id => ids.has(id))
    );

    render();
    renderStats();

    await loadPermission().catch(() => {});
    loadLastRun();

    if (!quiet) {
      notice(
        `Connected. ${counts.pending ?? 0} pending, ` +
        `${counts.approved ?? 0} approved, ` +
        `${counts.imported ?? 0} published, ` +
        `${counts.rejected ?? 0} rejected.`
      );
    }
  }

  async function loadLastRun() {
    try {
      const { data } = await db
        .from("noh_discovery_runs")
        .select("finished_at")
        .order("id", { ascending: false })
        .limit(1);

      if ($("lastRun")) {
        $("lastRun").textContent = data?.[0]?.finished_at
          ? dateTime(data[0].finished_at)
          : "Not run yet";
      }
    } catch {
      // Optional statistics.
    }
  }

  function renderStats() {
    const pending = rows.filter(
      row => row.status === "pending"
    );

    const by = stage =>
      pending.filter(row => stageOf(row) === stage).length;

    if ($("cntDiscovered")) {
      $("cntDiscovered").textContent =
        by("DISCOVERED") + by("NEEDS_DETAILS");
    }

    if ($("cntImage")) {
      $("cntImage").textContent =
        by("IMAGE_PENDING") + by("IMAGE_FAILED");
    }

    if ($("cntReady")) {
      $("cntReady").textContent =
        by("READY_FOR_REVIEW");
    }

    if ($("cntApproved")) {
      $("cntApproved").textContent =
        counts.approved ?? "—";
    }

    if ($("cntPublished")) {
      $("cntPublished").textContent =
        counts.imported ?? "—";
    }

    if ($("cntRejected")) {
      $("cntRejected").textContent =
        counts.rejected ?? "—";
    }

    if ($("pendingCount")) {
      $("pendingCount").textContent =
        counts.pending ?? 0;
    }

    if ($("importedCount")) {
      $("importedCount").textContent =
        counts.imported ?? 0;
    }
  }

  async function loadPermission() {
    const result = await publisher("permission_status");

    permission = result.permission || "not_granted";

    if ($("permissionLabel")) {
      $("permissionLabel").textContent =
        permission === "granted"
          ? `Publishing unlocked until ${dateTime(result.expires_at)}.`
          : "Publishing is locked. Grant temporary permission to publish approved records.";
    }

    syncButtons();
  }

  /* ================================================================
     QUEUE RENDERING
  ================================================================= */

  function filteredRows() {
    const term = ($("searchInput")?.value || "")
      .trim()
      .toLocaleLowerCase("en-GB");

    const stage = $("stageFilter")?.value || "all";

    return rows.filter(row => {
      const stageMatches =
        stage === "all" || stageOf(row) === stage;

      const searchText =
        `${row.title || ""} ${row.source_name || ""} ` +
        `${row.organization || ""} ${row.category || ""}`;

      const searchMatches =
        !term ||
        searchText.toLocaleLowerCase("en-GB").includes(term);

      return stageMatches && searchMatches;
    });
  }

  function selectable(row) {
    return (
      reviewReady(row) ||
      row.status === "approved" ||
      stageOf(row) === "PUBLISH_FAILED"
    );
  }

  function imageBlock(row) {
    if (!ownImage(row)) {
      return `
        <div class="noh-image-placeholder">
          <span>Image not ready</span>
          <small>${esc(imageValidationMessage(row))}</small>
        </div>
      `;
    }

    const url = safeHttps(row.image_url);

    const sourceLabels = {
      source: "From the official page",
      organisation: "From the organisation site",
      generated: "Generated for this listing"
    };

    const source =
      sourceLabels[row.image_source] ||
      "Individual image attached";

    return `
      <a class="noh-image-link"
         href="${esc(url)}"
         target="_blank"
         rel="noopener noreferrer">
        <img
          class="noh-opportunity-image"
          src="${esc(url)}"
          alt="Image for ${esc(row.title || "opportunity")}"
          loading="lazy"
          data-opportunity-image
        >
      </a>
      <div class="noh-image-caption">
        ${esc(source)}
      </div>
    `;
  }

  function cardHTML(row) {
    const stage = stageOf(row);
    const [label, tone] =
      STAGE_LABEL[stage] || [stage, ""];

    const pending = row.status === "pending";
    const gaps = missingFields(row);
    const flags = [];

    if (row.validation_notes) {
      flags.push(row.validation_notes);
    }

    if (!ownImage(row) && row.image_url) {
      flags.push(imageValidationMessage(row));
    }

    if (row.image_error && stage === "IMAGE_FAILED") {
      flags.push(
        "Image: " + String(row.image_error).slice(0, 240)
      );
    }

    if (row.publish_error) {
      flags.push("Publishing: " + row.publish_error);
    }

    if (row.last_error) {
      flags.push("Check: " + row.last_error);
    }

    if (pending && gaps.length && stage !== "DISCOVERED") {
      flags.push("Missing: " + gaps.join(", "));
    }

    const sourceUrl = safeHttps(row.source_url);
    const applicationUrl = safeHttps(row.application_url);

    const canPick = selectable(row);
    const imageFlagClass = ownImage(row) ? "ok" : "failed";

    const approveDisabled = !reviewReady(row);

    return `
      <article
        class="noh-review-card ${selected.has(row.id) ? "is-selected" : ""}"
        data-id="${esc(row.id)}"
      >
        <div>
          ${
            canPick
              ? `
                <input
                  class="noh-pick"
                  type="checkbox"
                  data-select="${esc(row.id)}"
                  ${selected.has(row.id) ? "checked" : ""}
                  aria-label="Select ${esc(row.title)}"
                >
              `
              : ""
          }
        </div>

        <div class="noh-image-column">
          ${imageBlock(row)}
        </div>

        <div class="noh-card-content">
          <div class="noh-card-meta">
            <span class="noh-state ${tone}">
              ${esc(label)}
            </span>

            ${
              newIds.has(row.id)
                ? '<span class="noh-state info">New this run</span>'
                : ""
            }

            <span>${esc(row.source_name || "Source")}</span>
            <span>Discovered ${esc(dateTime(row.discovered_at))}</span>
          </div>

          <h3 class="noh-card-title">
            ${esc(row.title || "Untitled opportunity")}
          </h3>

          <div class="noh-card-meta">
            <strong>
              ${esc(row.organization || "Organisation not yet verified")}
            </strong>

            ${row.category ? `<span>· ${esc(row.category)}</span>` : ""}

            <span>· ${esc(row.location || "Location not supplied")}</span>

            <span>· Deadline: ${esc(dateOnly(row.deadline))}</span>
          </div>

          <p class="noh-card-description">
            ${esc(
              row.description ||
              row.summary ||
              "No description yet. Open the original listing and verify the details."
            )}
          </p>

          <div class="noh-card-meta">
            <span class="noh-flag ${
              row.validation_status === "valid" ? "ok" : ""
            }">
              Check: ${esc(row.validation_status || "unchecked")}
            </span>

            <span class="noh-flag ${imageFlagClass}">
              ${esc(imageStateLabel(row))}
            </span>

            <span class="noh-flag ${
              row.status === "approved" ||
              row.status === "imported"
                ? "ok"
                : ""
            }">
              Review: ${esc(row.status)}
            </span>
          </div>

          ${flags.map(flag => `
            <div class="noh-flag">${esc(flag)}</div>
          `).join("")}

          ${
            row.review_note
              ? `
                <div class="entry-meta">
                  Review note: ${esc(row.review_note)}
                </div>
              `
              : ""
          }

          <div class="noh-card-links">
            ${
              sourceUrl
                ? `
                  <a href="${esc(sourceUrl)}"
                     target="_blank"
                     rel="noopener noreferrer">
                    Source listing ↗
                  </a>
                `
                : "<span>Source link unavailable</span>"
            }

            ${
              applicationUrl
                ? `
                  <a href="${esc(applicationUrl)}"
                     target="_blank"
                     rel="noopener noreferrer">
                    Application page ↗
                  </a>
                `
                : "<span>Application link not found</span>"
            }
          </div>
        </div>

        <div class="noh-card-actions">
          ${
            pending
              ? `
                <button
                  class="btn btn-primary"
                  data-action="approve"
                  data-id="${esc(row.id)}"
                  type="button"
                  ${approveDisabled ? "disabled" : ""}
                  title="${
                    approveDisabled
                      ? "Complete the required details and image validation first."
                      : "Review and approve this opportunity."
                  }"
                >
                  Review &amp; approve
                </button>

                <button
                  class="btn btn-danger"
                  data-action="reject"
                  data-id="${esc(row.id)}"
                  type="button"
                >
                  Reject
                </button>
              `
              : ""
          }

          ${
            row.status === "approved"
              ? `
                <button
                  class="btn btn-danger"
                  data-action="reject"
                  data-id="${esc(row.id)}"
                  type="button"
                >
                  Reject
                </button>
              `
              : ""
          }

          ${
            stage === "IMAGE_FAILED" ||
            stage === "IMAGE_PENDING" ||
            stage === "DISCOVERED"
              ? `
                <button
                  class="btn btn-outline"
                  data-action="image"
                  data-id="${esc(row.id)}"
                  type="button"
                >
                  ${
                    stage === "IMAGE_FAILED"
                      ? "Retry image"
                      : "Prepare image"
                  }
                </button>
              `
              : ""
          }
        </div>
      </article>
    `;
  }

  function render() {
    const queue = $("queue");

    if (!queue) return;

    const list = filteredRows();

    if (!list.length) {
      queue.innerHTML =
        '<div class="empty">No records match this view. Change the filters, or press Start Discovery.</div>';

      if ($("loadMoreBtn")) {
        $("loadMoreBtn").hidden = true;
      }

      syncButtons();
      return;
    }

    const ordered = [...list].sort((a, b) =>
      (newIds.has(b.id) ? 1 : 0) -
      (newIds.has(a.id) ? 1 : 0)
    );

    queue.innerHTML = ordered
      .slice(0, shown)
      .map(cardHTML)
      .join("");

    const left = ordered.length - shown;

    if ($("loadMoreBtn")) {
      $("loadMoreBtn").hidden = left <= 0;
      $("loadMoreBtn").textContent =
        `Load more (${left} left)`;
    }

    syncButtons();
  }

  /* ================================================================
     BUTTON STATES
  ================================================================= */

  const selectedRows = () =>
    rows.filter(row => selected.has(row.id));

  function syncButtons() {
    const idle = !op;

    const set = (id, disabled) => {
      const button = $(id);

      if (button) {
        button.disabled = disabled;
      }
    };

    const selection = selectedRows();

    const pendingSelected = selection.filter(
      row => row.status === "pending"
    );

    const approvedSelected = selection.filter(
      row => row.status === "approved"
    );

    set("startDiscoveryBtn", !db || !idle);

    set(
      "stopDiscoveryBtn",
      !db || !(op === "discovery" || op === "images")
    );

    set("validateBtn", !db || !idle);
    set("prepareImagesBtn", !db || !idle);
    set("retryImagesBtn", !db || !idle);
    set("refreshBtn", !db || !idle);

    set(
      "approveSelectedBtn",
      !db ||
      !idle ||
      !pendingSelected.length ||
      pendingSelected.length > MAX_BATCH ||
      pendingSelected.some(row => !reviewReady(row))
    );

    set(
      "rejectSelectedBtn",
      !db ||
      !idle ||
      !selection.length ||
      selection.length > MAX_BATCH
    );

    set("grantPermissionBtn", !db || !idle);
    set("revokePermissionBtn", !db || !idle);
    set("viewPublishLogBtn", !db || !idle);

    set(
      "publishSelectedBtn",
      !db ||
      !idle ||
      permission !== "granted" ||
      !approvedSelected.length ||
      approvedSelected.length > MAX_BATCH ||
      approvedSelected.some(row => !ownImage(row))
    );

    if ($("approveSelectedBtn")) {
      $("approveSelectedBtn").textContent =
        `Approve selected (${pendingSelected.length})`;
    }

    if ($("rejectSelectedBtn")) {
      $("rejectSelectedBtn").textContent =
        `Reject selected (${selection.length})`;
    }

    if ($("publishSelectedBtn")) {
      $("publishSelectedBtn").textContent =
        `Publish Approved (${approvedSelected.length})`;
    }

    if ($("selectionLabel")) {
      $("selectionLabel").textContent = !selection.length
        ? "No records selected. Tick records, or use Select All."
        : `${selection.length} selected: ${pendingSelected.length} awaiting approval, ` +
          `${approvedSelected.length} approved.` +
          (
            approvedSelected.length &&
            permission !== "granted"
              ? " Grant permission to publish."
              : ""
          );
    }

    if ($("stopDiscoveryBtn")) {
      $("stopDiscoveryBtn").textContent =
        op === "images"
          ? "Stop Image Preparation"
          : "Stop Discovery";
    }
  }

  async function runOp(name, callback) {
    if (op) {
      notice(
        "Another operation is running. Please wait or press Stop.",
        true
      );

      return;
    }

    op = name;
    stopRequested = false;

    syncButtons();

    try {
      await callback();
    } catch (error) {
      showResult(
        "Something went wrong",
        [{
          t: error.message || String(error),
          c: "bad"
        }],
        true
      );

      notice(error.message || String(error), true);
    } finally {
      op = null;
      stopRequested = false;
      syncButtons();
    }
  }

  function showResult(title, items, error = false) {
    const box = $("discoveryResult");

    if (!box) return;

    box.hidden = false;
    box.classList.toggle("error", !!error);

    box.innerHTML =
      `<strong>${esc(title)}</strong>` +
      '<ul class="result-list">' +
      items.map(item =>
        `<li class="${item.c || ""}">${esc(item.t)}</li>`
      ).join("") +
      "</ul>";

    box.scrollIntoView({
      block: "nearest",
      behavior: "smooth"
    });
  }

  /* ================================================================
     DISCOVERY
  ================================================================= */

  async function startDiscovery() {
    await runOp("discovery", async () => {
      if ($("discoveryRunLabel")) {
        $("discoveryRunLabel").textContent =
          "Checking sources, extracting details and validating…";
      }

      notice(
        "Discovery started. Please keep this page open."
      );

      const result = await unwrap(
        await patient(
          db.functions.invoke(DISCOVERY_FUNCTION, {
            body: {}
          }),
          90000,
          "Discovery"
        ),
        "Discovery"
      );

      newIds = new Set(
        (result.new_records || []).map(row => row.id)
      );

      const validation = result.validation || {};

      const items = [
        {
          t:
            `${result.sources_checked ?? 0} sources checked, ` +
            `${result.entries_seen ?? 0} listings seen.`
        },
        {
          t:
            `${result.new_pending_entries ?? 0} new record(s) added to the queue.`,
          c: result.new_pending_entries ? "good" : ""
        },
        {
          t:
            `${result.enrichment_attempted ?? 0} record(s) enriched from their source pages.`
        },
        {
          t:
            `${
              (validation.rejected_duplicate_live ?? 0) +
              (validation.rejected_duplicate_queue ?? 0)
            } duplicate(s) rejected, ` +
            `${validation.rejected_expired ?? 0} expired rejected.`
        },
        {
          t:
            `${validation.valid ?? 0} record(s) have all required details; ` +
            `${validation.incomplete ?? 0} still need details or an image.`
        }
      ];

      (result.enriched || [])
        .filter(item => item.status === "needs_attention")
        .forEach(item => {
          items.push({
            t:
              `Could not read "${item.title || item.id}": ${item.reason}`,
            c: "warn"
          });
        });

      (result.enriched || [])
        .filter(item => item.link_warning)
        .forEach(item => {
          items.push({
            t:
              `Application link problem for "${item.title}": ${item.link_warning}`,
            c: "warn"
          });
        });

      (result.errors || []).forEach(item => {
        items.push({
          t: `${item.source}: ${item.error}`,
          c: "bad"
        });
      });

      if (result.stopped) {
        items.push({
          t: "Discovery was stopped before it finished.",
          c: "warn"
        });
      }

      showResult(
        result.stopped
          ? "Discovery stopped"
          : "Discovery finished",
        items,
        (result.errors || []).length > 0
      );

      if (!result.stopped) {
        const imageResult = await imageLoop({
          rounds: AUTO_IMAGE_ROUNDS,
          retry: false,
          ids: null
        });

        items.push(...imageResult.items);

        await publisher("validate").catch(() => {});

        showResult(
          "Discovery finished",
          items,
          (result.errors || []).length > 0 ||
          imageResult.failed > 0
        );
      }

      await loadQueue(true);

      if ($("discoveryRunLabel")) {
        $("discoveryRunLabel").textContent =
          "Last run complete. Nothing was approved or published.";
      }

      notice(
        "Discovery finished. Review the records below.",
        (result.errors || []).length > 0
      );
    });
  }

  async function stopDiscovery() {
    if (!op) return;

    stopRequested = true;

    try {
      const result = await publisher("stop_discovery");

      notice(
        `Stop requested (${result.runs_signalled ?? 0} run signalled). ` +
        "It will stop at the next safe point."
      );
    } catch (error) {
      notice(
        "Could not send the stop request: " + error.message,
        true
      );
    }
  }

  async function validateQueue() {
    await runOp("validate", async () => {
      const result = await publisher("validate");

      showResult(
        "Duplicate and deadline check finished",
        [
          {
            t:
              `${result.rejected_duplicate_live ?? 0} duplicate(s) of live listings rejected.`
          },
          {
            t:
              `${result.rejected_duplicate_queue ?? 0} duplicate(s) within the queue rejected.`
          },
          {
            t:
              `${result.rejected_expired ?? 0} expired record(s) rejected.`
          },
          {
            t:
              `${result.valid ?? 0} record(s) complete; ` +
              `${result.incomplete ?? 0} incomplete.`
          }
        ]
      );

      await loadQueue(true);
    });
  }

  /* ================================================================
     IMAGE PREPARATION AND RETRY
  ================================================================= */

  async function imageCall(body) {
    return unwrap(
      await patient(
        db.functions.invoke(IMAGE_FUNCTION, {
          body
        }),
        90000,
        "Image preparation"
      ),
      "Image preparation"
    );
  }

  /*
   * IMPORTANT RETRY FIX:
   *
   * When IDs are explicitly supplied for a retry, the request includes:
   *
   *   rebuild: true
   *   retry_failed: true
   *
   * This asks the backend to rebuild an existing image instead of
   * skipping the record merely because image_url is already populated.
   */

  async function imageLoop({ rounds, retry, ids }) {
    const total = {
      ready: 0,
      generated: 0,
      failed: 0,
      selected: 0
    };

    const items = [];

    const take = result => {
      total.ready += Number(result.image_ready || 0);
      total.generated += Number(result.generated || 0);
      total.failed += Number(result.needs_attention || 0);
      total.selected += Number(result.selected || 0);

      (result.results || [])
        .filter(item => item.status !== "image_ready")
        .forEach(item => {
          items.push({
            t:
              `Image failed for "${item.title || item.id}": ` +
              `${item.reason || "unknown reason"}` +
              (
                item.retryable
                  ? " (you can retry)"
                  : ""
              ),
            c: "bad"
          });
        });
    };

    if (Array.isArray(ids) && ids.length) {
      for (
        let i = 0;
        i < ids.length && !stopRequested;
        i += IMAGE_BATCH
      ) {
        const batch = ids.slice(i, i + IMAGE_BATCH);

        if ($("discoveryRunLabel")) {
          $("discoveryRunLabel").textContent =
            `Preparing images (${Math.min(i + IMAGE_BATCH, ids.length)} of ${ids.length})…`;
        }

        const request = {
          ids: batch,
          rebuild: retry === true,
          retry_failed: retry === true
        };

        take(await imageCall(request));
      }
    } else {
      for (
        let round = 0;
        round < rounds && !stopRequested;
        round++
      ) {
        if ($("discoveryRunLabel")) {
          $("discoveryRunLabel").textContent =
            `Preparing images, batch ${round + 1}…`;
        }

        const result = await imageCall({
          limit: IMAGE_BATCH
        });

        take(result);

        if (!Number(result.selected || 0)) {
          break;
        }
      }
    }

    items.unshift({
      t:
        `Images: ${total.ready} ready, ` +
        `${total.generated} generated, ` +
        `${total.failed} failed, ` +
        `${total.selected} processed.` +
        (
          stopRequested
            ? " Stopped early."
            : ""
        ),
      c: total.failed ? "warn" : "good"
    });

    return {
      ...total,
      items
    };
  }

  async function prepareImages(retry) {
    await runOp("images", async () => {
      let ids = null;

      const selectedIds = selectedRows().map(
        row => row.id
      );

      if (retry) {
        const candidates =
          selectedIds.length
            ? selectedRows()
            : rows;

        ids = candidates
          .filter(row =>
            imageNeedsRetry(row) &&
            (
              row.status === "pending" ||
              row.status === "approved"
            )
          )
          .map(row => row.id);

        if (!ids.length) {
          notice(
            "No records currently need image retry."
          );

          return;
        }
      } else if (selectedIds.length) {
        ids = selectedRows()
          .filter(row => !ownImage(row))
          .map(row => row.id);

        if (!ids.length) {
          notice(
            "The selected records already have validated individual images."
          );

          return;
        }
      }

      const result = await imageLoop({
        rounds: IMAGE_ROUND_CAP,
        retry: retry === true || Boolean(ids),
        ids
      });

      showResult(
        retry
          ? "Image retry finished"
          : "Image preparation finished",
        result.items,
        result.failed > 0
      );

      await publisher("validate").catch(() => {});
      await loadQueue(true);

      if ($("discoveryRunLabel")) {
        $("discoveryRunLabel").textContent =
          "Image preparation finished.";
      }
    });
  }

  async function prepareOne(id) {
    await runOp("images", async () => {
      const row = rows.find(item => item.id === id);

      if (!row) {
        throw new Error(
          "Opportunity record was not found."
        );
      }

      if (
        row.status !== "pending" &&
        row.status !== "approved"
      ) {
        throw new Error(
          "This record cannot be rebuilt in its current status."
        );
      }

      const result = await imageLoop({
        rounds: 1,
        retry: true,
        ids: [id]
      });

      showResult(
        "Image rebuild finished",
        result.items,
        result.failed > 0
      );

      await publisher("validate").catch(() => {});
      await loadQueue(true);

      if ($("discoveryRunLabel")) {
        $("discoveryRunLabel").textContent =
          "Image rebuild finished. Check the updated validation state.";
      }
    });
  }

  /* ================================================================
     REVIEW AND APPROVAL
  ================================================================= */

  function openApproval(id) {
    const row = rows.find(item => item.id === id);

    if (!row) return;

    if (!reviewReady(row)) {
      notice(
        "This opportunity is not ready for approval. " +
        (
          !ownImage(row)
            ? imageValidationMessage(row)
            : "Complete all required details and checks first."
        ),
        true
      );

      return;
    }

    $("discoveryId").value = row.id;
    $("title").value = row.title || "";
    $("organization").value = row.organization || "";
    $("category").value = row.category || "Other";
    $("location").value = row.location || "Nigeria";
    $("deadline").value = row.deadline || "";
    $("applicationUrl").value = row.application_url || "";
    $("sourceUrl").value = safeHttps(row.source_url);
    $("description").value =
      row.description || row.summary || "";
    $("eligibility").value = row.eligibility || "";
    $("officialVerified").checked = false;

    $("sourceSummary").textContent =
      `Source: ${row.source_name || "Not supplied"}. ` +
      "This is only a discovery lead. Check the organisation's official site, " +
      "eligibility, deadline and application link before approving.";

    $("reviewDialog").querySelector("h2").textContent =
      "Review and approve";

    $("publishBtn").textContent =
      "Approve for publishing";

    $("reviewDialog").showModal();
  }

  async function approveOne(event) {
    event.preventDefault();

    if (op) {
      notice(
        "Another operation is running. Please wait.",
        true
      );

      return;
    }

    if (!$("officialVerified").checked) {
      notice(
        "Confirm the official-source checks first.",
        true
      );

      return;
    }

    const sourceRow = rows.find(
      row => row.id === $("discoveryId").value
    );

    if (!sourceRow || !ownImage(sourceRow)) {
      notice(
        "This record does not have a verified individual image. " +
        "Prepare its image before approval.",
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
      eligibility: $("eligibility").value.trim()
    };

    if (
      !opportunity.application_url ||
      !opportunity.source_url
    ) {
      notice(
        "Both links must be valid HTTPS links.",
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

    if (opportunity.description.length < 30) {
      notice(
        "The description must contain at least 30 characters.",
        true
      );

      $("description").focus();
      return;
    }

    if (opportunity.eligibility.length < 20) {
      notice(
        "Approval blocked: enter the actual eligibility requirements from the official source.",
        true
      );

      $("eligibility").focus();
      return;
    }

    if (
      opportunity.deadline &&
      opportunity.deadline <
        new Date().toISOString().slice(0, 10)
    ) {
      notice(
        "This deadline has passed. Do not approve it as an open opportunity.",
        true
      );

      return;
    }

    const button = $("publishBtn");

    await runOp("approve", async () => {
      button.disabled = true;
      button.textContent = "Saving approval…";

      try {
        await publisher("approve", {
          id: $("discoveryId").value,
          opportunity,
          review_note:
            "Official source, eligibility, deadline and application URL checked by administrator."
        });

        $("reviewDialog").close();

        showResult(
          "Approved",
          [{
            t:
              "The record is approved but NOT published. " +
              "Select it, grant permission and press Publish Approved.",
            c: "good"
          }]
        );

        await loadQueue(true);
      } finally {
        button.disabled = false;
        button.textContent = "Approve for publishing";
      }
    });
  }

  async function approveSelected() {
    const list = selectedRows().filter(
      row => row.status === "pending"
    );

    if (!list.length) return;

    const notReady = list.filter(
      row => !reviewReady(row)
    );

    if (notReady.length) {
      notice(
        `${notReady.length} selected record(s) are not ready. ` +
        "Each needs verified eligibility, organisation, description, " +
        "links and its own validated image.",
        true
      );

      return;
    }

    if (!window.confirm(
      `Approve ${list.length} record(s)?\n\n` +
      "By continuing you confirm that you have checked each record's " +
      "official source, eligibility, deadline and application link."
    )) {
      return;
    }

    await runOp("approve", async () => {
      const result = await publisher("bulk_approve", {
        ids: list.map(row => row.id),
        confirm_checked: true
      });

      const items = (result.results || []).map(item => ({
        t:
          `${item.title || item.id}: ` +
          `${
            item.status === "failed"
              ? item.reason
              : item.status.replace("_", " ")
          }`,
        c: item.status === "failed" ? "bad" : "good"
      }));

      items.unshift({
        t:
          `${result.approved ?? 0} approved, ` +
          `${result.failed ?? 0} failed. Nothing has been published yet.`
      });

      selected.clear();

      showResult(
        "Approval finished",
        items,
        (result.failed ?? 0) > 0
      );

      await loadQueue(true);
    });
  }

  async function rejectIds(ids) {
    if (!ids.length) {
      notice(
        "Select at least one record to reject.",
        true
      );

      return;
    }

    const note = window.prompt(
      "Why are you rejecting this? (optional)",
      "Not suitable or could not be verified from an official source."
    );

    if (note === null) return;

    await runOp("reject", async () => {
      const result = await publisher("bulk_reject", {
        ids,
        review_note:
          note.trim() ||
          "Rejected by administrator."
      });

      const items = (result.results || []).map(item => ({
        t:
          `${item.title || item.id}: ` +
          `${
            item.status === "failed"
              ? item.reason
              : "rejected"
          }`,
        c: item.status === "failed" ? "bad" : ""
      }));

      ids.forEach(id => selected.delete(id));

      showResult(
        "Rejection finished",
        items,
        items.some(item => item.c === "bad")
      );

      await loadQueue(true);
    });
  }

  /* ================================================================
     PUBLISHING PERMISSIONS
  ================================================================= */

  async function grantPermission() {
    await runOp("permission", async () => {
      const result = await publisher("grant_permission", {
        expires_in_minutes: 15,
        note:
          "Temporary permission granted from NOH discovery dashboard."
      });

      await loadPermission();

      notice(
        `Publishing unlocked until ${dateTime(result.expires_at)}.`
      );
    });
  }

  async function revokePermission() {
    await runOp("permission", async () => {
      await publisher("revoke_permission", {
        note:
          "Permission revoked from NOH discovery dashboard."
      });

      await loadPermission();

      notice("Publishing is locked again.");
    });
  }

  /* ================================================================
     PUBLISHING
  ================================================================= */

  function publishItems(results) {
    return (results || []).map(item => ({
      t:
        `${item.title || item.discovery_id}: ${item.status}` +
        `${item.reason ? " — " + item.reason : ""}` +
        `${item.retryable ? " (retry possible)" : ""}`,
      c:
        item.status === "published"
          ? "good"
          : item.status === "failed"
            ? "bad"
            : "warn"
    }));
  }

  async function publishApproved() {
    const list = selectedRows().filter(
      row => row.status === "approved"
    );

    if (!list.length) return;

    if (list.length > MAX_BATCH) {
      notice(
        `Maximum ${MAX_BATCH} records can be published per batch.`,
        true
      );

      return;
    }

    if (list.some(row => !ownImage(row))) {
      notice(
        "Every record must have its own image and must pass unique-image quality validation before publishing.",
        true
      );

      return;
    }

    if (permission !== "granted") {
      notice(
        "Publishing is locked. Grant temporary publishing permission first.",
        true
      );

      return;
    }

    if (!window.confirm(
      `Publish ${list.length} approved record(s) to the public NOH website now?`
    )) {
      return;
    }

    await runOp("publish", async () => {
      const result = await publisher("publish_approved", {
        ids: list.map(row => row.id)
      });

      const items = publishItems(result.results);

      items.unshift({
        t:
          `${result.inserted ?? 0} published, ` +
          `${result.skipped ?? 0} skipped (duplicates), ` +
          `${result.failed ?? 0} failed.`,
        c: (result.failed ?? 0) ? "bad" : "good"
      });

      list.forEach(row => selected.delete(row.id));

      showResult(
        "Publishing finished",
        items,
        (result.failed ?? 0) > 0
      );

      await loadQueue(true);
    });
  }

  async function viewPublishLog() {
    await runOp("log", async () => {
      const result = await publisher("publish_log");
      const box = $("publishResults");

      box.hidden = false;

      const logs = result.logs || [];

      box.innerHTML = !logs.length
        ? '<p class="entry-meta">No publishing batches yet.</p>'
        : logs.map(log => `
            <details style="margin:8px 0">
              <summary>
                <strong>${esc(dateTime(log.created_at))}</strong> —
                ${esc(log.inserted)} published,
                ${esc(log.skipped)} skipped,
                ${esc(log.failed)} failed
                (of ${esc(log.requested)})
              </summary>

              <ul class="result-list">
                ${publishItems(log.results).map(item => `
                  <li class="${item.c}">${esc(item.t)}</li>
                `).join("")}
              </ul>
            </details>
          `).join("");
    });
  }

  /* ================================================================
     SELECTION
  ================================================================= */

  function selectAll() {
    const available = filteredRows().filter(selectable);
    const list = available.slice(0, MAX_BATCH);

    list.forEach(row => selected.add(row.id));

    render();

    notice(
      `${list.length} record(s) selected` +
      (
        available.length > MAX_BATCH
          ? ` (maximum ${MAX_BATCH} at a time).`
          : "."
      )
    );
  }

  /* ================================================================
     EVENT HANDLERS
  ================================================================= */

  function wire() {
    const on = (id, callback) => {
      $(id)?.addEventListener("click", callback);
    };

    on("startDiscoveryBtn", startDiscovery);

    on("viewDiscoveredBtn", () => {
      $("queue")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });

    on("stopDiscoveryBtn", stopDiscovery);
    on("validateBtn", validateQueue);

    on("prepareImagesBtn", () => {
      prepareImages(false);
    });

    on("retryImagesBtn", () => {
      prepareImages(true);
    });

    on("refreshBtn", () => {
      runOp("refresh", async () => {
        await loadQueue();
      });
    });

    on("selectAllBtn", selectAll);

    on("deselectAllBtn", () => {
      selected.clear();
      render();
    });

    on("approveSelectedBtn", approveSelected);

    on("rejectSelectedBtn", () => {
      rejectIds(
        selectedRows().map(row => row.id)
      );
    });

    on("grantPermissionBtn", grantPermission);
    on("revokePermissionBtn", revokePermission);
    on("publishSelectedBtn", publishApproved);
    on("viewPublishLogBtn", viewPublishLog);

    on("loadMoreBtn", () => {
      shown += PAGE_SIZE;
      render();
    });

    $("searchInput")?.addEventListener("input", () => {
      shown = PAGE_SIZE;
      render();
    });

    $("stageFilter")?.addEventListener("change", () => {
      shown = PAGE_SIZE;
      render();
    });

    $("statusFilter")?.addEventListener("change", () => {
      shown = PAGE_SIZE;

      runOp("refresh", async () => {
        await loadQueue(true);
      });
    });

    $("approveForm")?.addEventListener(
      "submit",
      approveOne
    );

    $("closeDialog")?.addEventListener("click", () => {
      $("reviewDialog")?.close();
    });

    $("reviewDialog")?.addEventListener("click", event => {
      if (event.target === $("reviewDialog")) {
        $("reviewDialog").close();
      }
    });

    $("queue").addEventListener("click", event => {
      const button = event.target.closest(
        "button[data-action]"
      );

      if (!button) return;

      const id = button.dataset.id;

      if (button.dataset.action === "approve") {
        if (button.disabled) {
          notice(
            "Complete the required details and image validation first.",
            true
          );

          return;
        }

        openApproval(id);
      }

      if (button.dataset.action === "reject") {
        rejectIds([id]);
      }

      if (button.dataset.action === "image") {
        prepareOne(id);
      }
    });

    $("queue").addEventListener("change", event => {
      const input = event.target.closest(
        "input[data-select]"
      );

      if (!input) return;

      if (input.checked) {
        selected.add(input.dataset.select);
      } else {
        selected.delete(input.dataset.select);
      }

      input.closest(".noh-review-card")
        ?.classList.toggle(
          "is-selected",
          input.checked
        );

      syncButtons();
    });

    // Display a failed preview without changing database validation.
    $("queue").addEventListener("error", event => {
      const image = event.target;

      if (
        !(image instanceof HTMLImageElement) ||
        !image.matches("[data-opportunity-image]")
      ) {
        return;
      }

      const box = document.createElement("div");

      box.className = "noh-image-error";
      box.textContent =
        "Image file did not load. Use Retry image.";

      image.closest(".noh-image-link")
        ?.replaceWith(box);
    }, true);
  }

  /* ================================================================
     INITIALISATION
  ================================================================= */

  async function init() {
    wire();
    syncButtons();

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

      syncButtons();

      await loadQueue();

      db.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT" || !session) {
          permission = "not_granted";
          selected.clear();

          notice(
            "You have been signed out. Sign in again to use the controls.",
            true
          );

          syncButtons();
        }
      });
    } catch (error) {
      db = null;
      syncButtons();

      notice(
        error.message || "Administrator access required.",
        true
      );

      if ($("queue")) {
        $("queue").innerHTML =
          `<div class="empty">${esc(
            error.message || "Administrator access required."
          )}</div>`;
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
