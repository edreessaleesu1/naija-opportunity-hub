
/*
 * NAIJA OPPORTUNITY HUB
 * Account-based Application Tracker
 *
 * Signed-in users: Supabase account storage.
 * Signed-out visitors: existing homepage browser tracker.
 */

(() => {
  "use strict";

  if (window.NOH_TRACKER_ACCOUNT_LOADED) return;
  window.NOH_TRACKER_ACCOUNT_LOADED = true;

  const TABLE = "user_opportunity_tracker";
  const STORAGE_KEY = "noh_tracker_v1";

  const STATUSES = [
    "Interested",
    "Preparing",
    "Applied",
    "Interview",
    "Successful",
    "Unsuccessful"
  ];

  const $ = id => document.getElementById(id);

  let supabase = null;
  let currentUser = null;
  let trackerItems = [];
  let requestNumber = 0;

  const homepageList = $("trackerList");
  const accountList = $("accountTrackerList");

  /* -------------------------------------------------------
     HELPERS
  ------------------------------------------------------- */

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[character]);
  }

  function safeURL(value) {
    try {
      const url = new URL(String(value || ""));

      return ["http:", "https:"].includes(url.protocol)
        ? url.href
        : "";
    } catch {
      return "";
    }
  }

  function readGuestTracker() {
    try {
      const value = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]"
      );

      return Array.isArray(value) ? value : [];
    } catch (error) {
      console.warn("Could not read the previous tracker:", error);
      return [];
    }
  }

  function showTrackerMessage(message) {
    const toast = $("toast");

    if (!toast) {
      console.info("NOH Tracker:", message);
      return;
    }

    toast.textContent = message;
    toast.hidden = false;
    toast.classList.add("show");

    clearTimeout(showTrackerMessage.timer);

    showTrackerMessage.timer = setTimeout(() => {
      toast.classList.remove("show");
      toast.hidden = true;
    }, 3000);
  }

  function formatDate(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Recently added";

    return date.toLocaleDateString("en-GB");
  }

  function normaliseRecord(row) {
    const opportunity = Array.isArray(row.opportunities)
      ? row.opportunities[0]
      : row.opportunities;

    return {
      id: String(row.opportunity_id),

      title: opportunity?.title ||
        "Opportunity no longer available",

      organization: opportunity?.organization ||
        "Organisation not specified",

      category: opportunity?.category || "Other",

      application_url: safeURL(
        opportunity?.application_url || ""
      ),

      date_added: row.created_at ||
        new Date().toISOString(),

      status: STATUSES.includes(row.status)
        ? row.status
        : "Interested"
    };
  }

  /* -------------------------------------------------------
     RENDER TRACKER
  ------------------------------------------------------- */

  function renderTracker(target) {
    if (!target) return;

    if (!trackerItems.length) {
      target.innerHTML = `
        <div class="tracker-empty">
          <p>You haven't added any opportunities to your tracker yet.</p>
          <p>Browse opportunities and select Track Opportunity to get started.</p>
        </div>
      `;

      return;
    }

    target.innerHTML = trackerItems.map(item => {
      const id = escapeHTML(item.id);

      const options = STATUSES.map(status => `
        <option
          value="${escapeHTML(status)}"
          ${status === item.status ? "selected" : ""}
        >${escapeHTML(status)}</option>
      `).join("");

      const applicationURL = safeURL(item.application_url);

      return `
        <article class="tracker-item" data-id="${id}">

          <div class="tracker-item-info">

            <h4>${escapeHTML(item.title)}</h4>

            <p>${escapeHTML(item.organization)}</p>

            <span class="tracker-category">
              ${escapeHTML(item.category)}
            </span>

            <p class="tracker-date">
              Added: ${formatDate(item.date_added)}
            </p>

          </div>

          <div class="tracker-item-actions">

            <label>
              <span>Application status</span>

              <select
                class="tracker-status"
                data-action="tracker-status"
                data-id="${id}"
              >
                ${options}
              </select>
            </label>

            ${
              applicationURL
                ? `
                  <a
                    href="${escapeHTML(applicationURL)}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="tracker-apply-link"
                  >Open Application</a>
                `
                : ""
            }

            <button
              type="button"
              class="tracker-remove-btn"
              data-action="tracker-remove"
              data-id="${id}"
            >
              Remove
            </button>

          </div>

        </article>
      `;
    }).join("");
  }

  function refreshTrackButtons() {
    const trackedIDs = new Set(
      trackerItems.map(item => String(item.id))
    );

    document.querySelectorAll(
      '#opportunityGrid [data-action="track"]'
    ).forEach(button => {
      const tracked = trackedIDs.has(
        String(button.dataset.id)
      );

      button.classList.toggle("is-tracked", tracked);

      button.setAttribute(
        "aria-pressed",
        String(tracked)
      );

      button.textContent = tracked
        ? "✓ Tracking"
        : "+ Track Opportunity";
    });
  }

  function renderAccountTracker() {
    renderTracker(homepageList);
    renderTracker(accountList);

    const count = $("trackerCount");

    if (count) {
      count.textContent = String(trackerItems.length);
    }

    refreshTrackButtons();

    window.dispatchEvent(
      new CustomEvent("noh:tracker-updated")
    );
  }

  /* -------------------------------------------------------
     LOAD THE SIGNED-IN USER'S TRACKER
  ------------------------------------------------------- */

  async function loadTracker() {
    if (!currentUser || !supabase) return;

    const thisRequest = ++requestNumber;

    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select(`
          opportunity_id,
          status,
          created_at,
          opportunities (
            title,
            organization,
            category,
            application_url
          )
        `)
        .eq("user_id", currentUser.id)
        .order("created_at", {
          ascending: false
        });

      if (error) throw error;

      if (thisRequest !== requestNumber) return;

      trackerItems = (data || []).map(normaliseRecord);

      renderAccountTracker();

    } catch (error) {
      console.error(
        "NOH account tracker could not load:",
        error
      );

      showTrackerMessage(
        "We could not load your account tracker. Please refresh and try again."
      );
    }
  }

  /* -------------------------------------------------------
     IMPORT PREVIOUS BROWSER TRACKER
  ------------------------------------------------------- */

  async function importGuestTracker() {
    if (!currentUser || !supabase) return;

    const previousItems = readGuestTracker();

    if (!previousItems.length) return;

    const rows = previousItems
      .filter(item => item && item.id)
      .map(item => ({
        user_id: currentUser.id,
        opportunity_id: String(item.id),

        status: STATUSES.includes(item.status)
          ? item.status
          : "Interested"
      }));

    if (!rows.length) return;

    const { error } = await supabase
      .from(TABLE)
      .upsert(rows, {
        onConflict: "user_id,opportunity_id",
        ignoreDuplicates: true
      });

    if (error) {
      console.error(
        "NOH guest tracker import failed:",
        error
      );

      showTrackerMessage(
        "Your previous tracker remains saved on this device. We could not import it yet."
      );

      return;
    }

    localStorage.removeItem(STORAGE_KEY);

    showTrackerMessage(
      "Your previous tracker items have been added to your account."
    );
  }

  /* -------------------------------------------------------
     AUTHENTICATION CHANGES
  ------------------------------------------------------- */

  async function handleAuthChange(user) {
    currentUser = user || null;

    requestNumber++;

    if (!currentUser) {
      trackerItems = [];
      return;
    }

    await importGuestTracker();
    await loadTracker();
  }

  /* -------------------------------------------------------
     ADD OR REMOVE OPPORTUNITY
  ------------------------------------------------------- */

  async function toggleOpportunity(id) {
    if (!currentUser || !supabase) return;

    const existing = trackerItems.find(
      item => String(item.id) === String(id)
    );

    if (existing) {
      const { error } = await supabase
        .from(TABLE)
        .delete()
        .eq("user_id", currentUser.id)
        .eq("opportunity_id", String(id));

      if (error) throw error;

      trackerItems = trackerItems.filter(
        item => String(item.id) !== String(id)
      );

      showTrackerMessage(
        "Removed from your account tracker."
      );

    } else {
      const { data: opportunity, error: readError } =
        await supabase
          .from("opportunities")
          .select(`
            id,
            title,
            organization,
            category,
            application_url
          `)
          .eq("id", String(id))
          .maybeSingle();

      if (readError) throw readError;

      if (!opportunity) {
        throw new Error(
          "This opportunity is no longer available."
        );
      }

      const { error } = await supabase
        .from(TABLE)
        .upsert({
          user_id: currentUser.id,
          opportunity_id: String(id),
          status: "Interested"
        }, {
          onConflict: "user_id,opportunity_id"
        });

      if (error) throw error;

      trackerItems.unshift({
        id: String(opportunity.id),
        title: opportunity.title,
        organization: opportunity.organization,
        category: opportunity.category,
        application_url: safeURL(
          opportunity.application_url
        ),
        date_added: new Date().toISOString(),
        status: "Interested"
      });

      showTrackerMessage(
        "Saved to your account tracker."
      );
    }

    renderAccountTracker();
  }

  /* -------------------------------------------------------
     UPDATE APPLICATION STATUS
  ------------------------------------------------------- */

  async function updateStatus(id, status) {
    if (!currentUser || !supabase) return;

    if (!STATUSES.includes(status)) return;

    const { error } = await supabase
      .from(TABLE)
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", currentUser.id)
      .eq("opportunity_id", String(id));

    if (error) throw error;

    const item = trackerItems.find(
      entry => String(entry.id) === String(id)
    );

    if (item) item.status = status;

    renderAccountTracker();

    showTrackerMessage(
      "Application status updated."
    );
  }

  /* -------------------------------------------------------
     REMOVE TRACKED OPPORTUNITY
  ------------------------------------------------------- */

  async function removeOpportunity(id) {
    if (!currentUser || !supabase) return;

    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq("user_id", currentUser.id)
      .eq("opportunity_id", String(id));

    if (error) throw error;

    trackerItems = trackerItems.filter(
      item => String(item.id) !== String(id)
    );

    renderAccountTracker();

    showTrackerMessage(
      "Application removed from your tracker."
    );
  }

  /* -------------------------------------------------------
     CLEAR ACCOUNT TRACKER
  ------------------------------------------------------- */

  async function clearAccountTracker() {
    if (!currentUser || !supabase) return;

    const confirmed = window.confirm(
      "Are you sure you want to clear your account application tracker?"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq("user_id", currentUser.id);

    if (error) throw error;

    trackerItems = [];

    renderAccountTracker();

    showTrackerMessage(
      "Your account tracker has been cleared."
    );
  }

  /* -------------------------------------------------------
     EXPORT ACCOUNT TRACKER
  ------------------------------------------------------- */

  function csvCell(value) {
    let text = String(value ?? "");

    if (/^[\s]*[=+@\-]/.test(text)) {
      text = "'" + text;
    }

    return '"' + text.replace(/"/g, '""') + '"';
  }

  function exportAccountTracker() {
    if (!trackerItems.length) {
      showTrackerMessage(
        "Your application tracker is empty."
      );

      return;
    }

    const rows = [
      [
        "Title",
        "Organisation",
        "Category",
        "Application URL",
        "Date Added",
        "Status"
      ],

      ...trackerItems.map(item => [
        item.title,
        item.organization,
        item.category,
        item.application_url,
        formatDate(item.date_added),
        item.status
      ])
    ];

    const csv = rows
      .map(row => row.map(csvCell).join(","))
      .join("\r\n");

    const blob = new Blob(
      ["\uFEFF" + csv],
      { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "noh-application-tracker.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  /* -------------------------------------------------------
     EVENT HANDLERS
  ------------------------------------------------------- */

  document.addEventListener("click", event => {
    if (!currentUser) return;

    const trackButton = event.target.closest(
      '#opportunityGrid [data-action="track"]'
    );

    const removeButton = event.target.closest(
      '[data-action="tracker-remove"]'
    );

    const clearButton = event.target.closest(
      "#clearTracker, #clearTrackerBtn"
    );

    const exportButton = event.target.closest(
      "#exportTracker, #exportCSV, #exportTrackerBtn"
    );

    if (
      !trackButton &&
      !removeButton &&
      !clearButton &&
      !exportButton
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    (async () => {
      try {
        if (trackButton) {
          await toggleOpportunity(
            String(trackButton.dataset.id)
          );
        } else if (removeButton) {
          await removeOpportunity(
            String(removeButton.dataset.id)
          );
        } else if (clearButton) {
          await clearAccountTracker();
        } else if (exportButton) {
          exportAccountTracker();
        }
      } catch (error) {
        console.error(
          "NOH tracker action failed:",
          error
        );

        showTrackerMessage(
          error.message ||
          "We could not update your tracker. Please try again."
        );
      }
    })();

  }, true);

  document.addEventListener("change", event => {
    if (!currentUser) return;

    const select = event.target.closest(
      '[data-action="tracker-status"]'
    );

    if (!select) return;

    event.stopPropagation();
    event.stopImmediatePropagation();

    updateStatus(
      String(select.dataset.id),
      select.value
    ).catch(error => {
      console.error(error);

      showTrackerMessage(
        "Could not update your application status."
      );

      loadTracker();
    });

  }, true);

  /* -------------------------------------------------------
     AUTH EVENTS AND INITIALISATION
  ------------------------------------------------------- */

  window.addEventListener("noh:auth-changed", event => {
    handleAuthChange(
      event.detail?.user || null
    );
  });

  window.NOH_ACCOUNT_TRACKER = {
    refresh: loadTracker,

    getItems: () => trackerItems.slice()
  };

  async function init() {
    supabase = window.NOH_SUPABASE_CLIENT || null;

    if (!supabase) {
      console.error(
        "NOH Tracker: Supabase client is unavailable."
      );

      return;
    }

    supabase.auth.onAuthStateChange(
      (_event, session) => {
        handleAuthChange(
          session?.user || null
        );
      }
    );

    const { data, error } =
      await supabase.auth.getSession();

    if (error) {
      console.error(
        "NOH Tracker session check failed:",
        error
      );

      return;
    }

    await handleAuthChange(
      data.session?.user || null
    );

    const grid = $("opportunityGrid");

    if (grid && window.MutationObserver) {
      new MutationObserver(() => {
        refreshTrackButtons();
      }).observe(grid, {
        childList: true,
        subtree: true
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      init
    );
  } else {
    init();
  }

})();
