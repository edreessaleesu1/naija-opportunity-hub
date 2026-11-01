
/*
 * NAIJA OPPORTUNITY HUB — Main Front-End Application
 * Version 3.5 | British English | 3-element opportunity cards
 * Official domain: https://naijaopportunityhub.com.ng
 */
(() => {
  "use strict";

  const SUPABASE_URL = "https://djxornmwvkauhkcuhgxc.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_EDReCY3JcN4vMuypVfqcMQ_GcTEVuBq";
  const TABLE_NAME = "opportunities";
  const SITE_URL = "https://naijaopportunityhub.com.ng";
  const DETAILS_PAGE = `${SITE_URL}/opportunity-details.html`;
  const BOOKMARKS_KEY = "noh_bookmarks_v1";
  const TRACKER_KEY = "noh_tracker_v1";
  const DEFAULT_VISIBLE_COUNT = 6;
  const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=900&auto=format&fit=crop&q=80";
  const TRACKER_STATUSES = ["Interested", "Applied", "Interview", "Successful", "Unsuccessful"];
  const DEBUG = new URLSearchParams(location.search).get("debug") === "1";
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const getElement = (...ids) => ids.map(id => document.getElementById(id)).find(Boolean) || null;

  const el = {
    grid: getElement("opportunityGrid", "opportunitiesGrid", "opportunitiesContainer"),
    search: getElement("searchInput", "opportunitySearch", "search"),
    category: getElement("categoryFilter"),
    sort: getElement("sortFilter", "sortSelect", "sortOpportunities"),
    clearFilters: getElement("clearFilters"),
    results: getElement("resultsCount"),
    notice: getElement("dataNotice"),
    status: getElement("dataStatus"),
    viewAll: getElement("viewAllBtn", "viewAll", "showAllBtn"),
    bookmarks: getElement("bookmarksCount", "bookmarkCount"),
    trackerCount: getElement("trackerCount", "applicationCount"),
    trackerList: getElement("trackerList"),
    loading: getElement("loadingState", "opportunitiesLoading"),
    empty: getElement("emptyState", "noOpportunities"),
    error: getElement("errorState", "opportunitiesError"),
    toast: getElement("toast")
  };

  let allOpportunities = [];
  let filteredOpportunities = [];
  let activeCategory = "All";
  let showAll = false;
  let isLoading = false;
  let toastTimer = null;

  let bookmarks = readStorage(BOOKMARKS_KEY, [])
    .map(String)
    .filter(Boolean);

  let tracker = readStorage(TRACKER_KEY, [])
    .filter(item => item && item.id)
    .map(item => ({
      ...item,
      id: String(item.id),
      title: String(item.title || "Untitled Opportunity"),
      organization: String(item.organization || item.organisation || "Organisation not specified"),
      category: String(item.category || "Other"),
      application_url: safeURL(item.application_url || ""),
      date_added: item.date_added || new Date().toISOString(),
      status: TRACKER_STATUSES.includes(item.status) ? item.status : "Interested"
    }));

  function readStorage(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) ? value : fallback;
    } catch (error) {
      console.warn("Unable to read local storage:", key, error);
      return fallback;
    }
  }

  function saveStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error("Unable to save local storage:", key, error);
      showToast("Unable to save changes on this device.");
      return false;
    }
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[ch]);
  }

  function normalise(value) {
    return String(value ?? "").trim().toLocaleLowerCase("en-GB");
  }

  function debugLog(...args) {
    if (DEBUG) console.log("[NOH]", ...args);
  }

  function safeURL(value) {
    if (!value) return "";
    try {
      const url = new URL(String(value).trim());
      return ["https:", "http:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  function detailsURL(id) {
    const url = new URL(DETAILS_PAGE);
    url.searchParams.set("id", String(id));
    return url.href;
  }

  function formatDate(value) {
    if (!value) return "Not specified";
    const date = parseDate(value);

    return date
      ? date.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric"
        })
      : "Not specified";
  }

  // Parse date-only values as local dates to avoid UTC timezone shifts.
  function parseDate(value) {
    if (!value) return null;

    const raw = String(value);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);

    const date = match
      ? new Date(
          Number(match[1]),
          Number(match[2]) - 1,
          Number(match[3])
        )
      : new Date(raw);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  function dateTimestamp(value) {
    const date = parseDate(value);
    return date ? date.getTime() : null;
  }

  function deadlineStatus(value) {
    if (!value) {
      return { label: "Deadline not specified", type: "unknown" };
    }

    const deadline = parseDate(value);

    if (!deadline) {
      return { label: "Deadline not specified", type: "unknown" };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    deadline.setHours(0, 0, 0, 0);

    if (deadline < today) {
      return { label: "Application closed", type: "expired" };
    }

    if (deadline.getTime() === today.getTime()) {
      return { label: "Deadline today", type: "today" };
    }

    return {
      label: `Deadline: ${formatDate(value)}`,
      type: "upcoming"
    };
  }

  function showElement(element, visible) {
    if (element) element.hidden = !visible;
  }

  function showToast(message) {
    if (!el.toast) {
      debugLog(message);
      return;
    }

    el.toast.textContent = message;
    el.toast.classList.add("show");
    el.toast.hidden = false;

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      el.toast.classList.remove("show");
      el.toast.hidden = true;
    }, 2800);
  }

  function isBookmarked(id) {
    return bookmarks.includes(String(id));
  }

  function isTracked(id) {
    return tracker.some(item => String(item.id) === String(id));
  }

  async function fetchOpportunities(includeImages = true) {
    const columns = [
      "id",
      "title",
      "organization",
      "category",
      "description",
      "eligibility",
      "location",
      "application_url",
      "source_url",
      "deadline",
      "status",
      "verified_at",
      "created_at"
    ];

    if (includeImages) columns.push("image_url");

    const query = new URLSearchParams({
      select: columns.join(","),
      status: "eq.published",
      order: "created_at.desc"
    });

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE_NAME}?${query}`,
      {
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
          Accept: "application/json"
        }
      }
    );

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      const error = new Error(
        result?.message ||
        result?.details ||
        `Supabase request failed: ${response.status}`
      );

      error.status = response.status;
      error.details = result;
      throw error;
    }

    return Array.isArray(result) ? result : [];
  }

  function normaliseOpportunity(item) {
    return {
      ...item,
      id: String(item.id ?? ""),
      title: String(item.title || "").trim() || "Untitled Opportunity",
      organization: String(
        item.organization ||
        item.organisation ||
        "Organisation not specified"
      ).trim(),
      category: String(item.category || "Other").trim(),
      description: String(item.description || "").trim(),
      eligibility: String(item.eligibility || "").trim(),
      location: String(item.location || "").trim(),
      image_url: safeURL(item.image_url || ""),
      application_url: safeURL(
        item.application_url || item.source_url || ""
      ),
      source_url: safeURL(item.source_url || "")
    };
  }

  async function loadOpportunities() {
    if (isLoading) return;

    isLoading = true;

    showElement(el.loading, true);
    showElement(el.empty, false);
    showElement(el.error, false);

    if (el.notice) {
      el.notice.textContent = "";
      showElement(el.notice, false);
    }

    if (el.status) {
      el.status.textContent = "Loading opportunities…";
    }

    if (el.grid) el.grid.innerHTML = "";

    try {
      let data;

      try {
        data = await fetchOpportunities(true);
      } catch (error) {
        const missingImageColumn =
          /image_url|column.*does not exist|schema cache/i.test(
            error.message
          );

        if (!missingImageColumn) throw error;

        debugLog("image_url column missing; retrying without it.");

        data = await fetchOpportunities(false);

        if (el.notice) {
          el.notice.textContent =
            "Opportunity images are not configured in the database yet.";
          showElement(el.notice, true);
        }
      }

      allOpportunities = data
        .map(normaliseOpportunity)
        .filter(item => item.id);

      debugLog("Loaded opportunities:", allOpportunities.length);

      applyFilters();
      renderTracker();

      if (el.status) {
        el.status.textContent =
          `${allOpportunities.length} published opportunities available`;
      }

    } catch (error) {
      console.error("Unable to load opportunities:", error);

      if (el.status) {
        el.status.textContent = "Unable to load opportunities.";
      }

      const message = DEBUG
        ? `<pre>${escapeHTML(error.message)}</pre>`
        : "";

      const markup = `
        <div class="empty-state">
          <h3>Unable to load opportunities</h3>
          <p>Please check your internet connection and try again.</p>
          <button
            type="button"
            class="button button-primary"
            id="retryOpportunities"
          >Try Again</button>
          ${message}
        </div>
      `;

      if (el.error) {
        el.error.innerHTML = markup;
        showElement(el.error, true);
      } else if (el.grid) {
        el.grid.innerHTML = markup;
      }

    } finally {
      isLoading = false;
      showElement(el.loading, false);
    }
  }

  function applyFilters() {
    const term = normalise(el.search?.value || "");

    if (el.category) {
      el.category.value =
        activeCategory === "All" ? "all" : activeCategory;
    }

    filteredOpportunities = allOpportunities.filter(item => {
      const categoryMatch =
        activeCategory === "All" ||
        normalise(item.category) === normalise(activeCategory);

      const searchable = [
        item.title,
        item.organization,
        item.category,
        item.description,
        item.eligibility,
        item.location
      ].join(" ");

      return categoryMatch &&
        (!term || normalise(searchable).includes(term));
    });

    sortOpportunities();
    renderOpportunities();
  }

  function sortOpportunities() {
    const mode = el.sort?.value || "newest";

    filteredOpportunities.sort((a, b) => {
      if (mode === "title") {
        return a.title.localeCompare(b.title, "en-GB");
      }

      if (mode === "deadline") {
        const da = dateTimestamp(a.deadline);
        const db = dateTimestamp(b.deadline);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const priority = d =>
          d === null ? 3 : d >= today.getTime() ? 1 : 2;

        const diff = priority(da) - priority(db);

        return diff ||
          (da === null || db === null ? 0 : da - db);
      }

      return (
        (dateTimestamp(b.created_at) || 0) -
        (dateTimestamp(a.created_at) || 0)
      );
    });
  }

  // Agreed homepage card: clickable image + clickable title + Track only.
function createOpportunityCard(item) {
  const id = escapeHTML(item.id);
  const title = escapeHTML(item.title);
  const url = escapeHTML(detailsURL(item.id));
  const image = escapeHTML(item.image_url || FALLBACK_IMAGE);
  const tracked = isTracked(item.id);

  return `
    <article class="opportunity-card" data-id="${id}">
      <div class="opportunity-image">
        <a class="opportunity-image-link" href="${url}" aria-label="View ${title}">
          <img src="${image}" alt="${title}" loading="lazy"
            onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}'">
        </a>
      </div>
      <div class="opportunity-content">
        <h3 class="opportunity-title">
          <a class="opportunity-title-link" href="${url}">${title}</a>
        </h3>
        <button type="button" class="track-btn ${tracked ? "is-tracked" : ""}"
          data-action="track" data-id="${id}" aria-pressed="${tracked}">
          ${tracked ? "✓ Tracking" : "+ Track Opportunity"}
        </button>
      </div>
    </article>`;
}

  function renderOpportunities() {
    if (!el.grid) {
      debugLog("Opportunity grid not found.");
      return;
    }

    const visible = showAll
      ? filteredOpportunities
      : filteredOpportunities.slice(0, DEFAULT_VISIBLE_COUNT);

    el.grid.innerHTML = visible.length
      ? visible.map(createOpportunityCard).join("")
      : "";

    const hasResults = filteredOpportunities.length > 0;

    if (el.empty) {
      el.empty.textContent =
        "No opportunities found. Try another search or category.";

      showElement(el.empty, !hasResults);

    } else if (!hasResults) {
      el.grid.innerHTML = `
        <div class="empty-state">
          <h3>No opportunities found</h3>
          <p>Try another search or category.</p>
        </div>
      `;
    }

    if (el.results) {
      const n = filteredOpportunities.length;

      el.results.textContent =
        `${n} ${n === 1 ? "opportunity" : "opportunities"} found`;
    }

    if (el.viewAll) {
      showElement(
        el.viewAll,
        filteredOpportunities.length > DEFAULT_VISIBLE_COUNT
      );

      el.viewAll.textContent = showAll
        ? "Show Less"
        : `View All (${filteredOpportunities.length})`;
    }

    updateCounters();
    syncCategoryButtons();
  }

  function categoryButtons() {
    const container = getElement("categoryButtons");

    return container
      ? Array.from(container.querySelectorAll("[data-category]"))
      : [];
  }

  function syncCategoryButtons() {
    categoryButtons().forEach(button => {
      const active =
        normalise(button.dataset.category) ===
        normalise(activeCategory);

      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function selectCategory(category) {
    activeCategory = category || "All";
    showAll = false;
    applyFilters();
  }

  function toggleTracker(id) {
    id = String(id);

    if (isTracked(id)) {
      tracker = tracker.filter(item => String(item.id) !== id);
      showToast("Removed from your application tracker.");

    } else {
      const item = allOpportunities.find(
        entry => entry.id === id
      );

      if (!item) return;

      tracker.push({
        id,
        title: item.title,
        organization: item.organization,
        category: item.category,
        application_url: item.application_url,
        date_added: new Date().toISOString(),
        status: "Interested"
      });

      showToast("Added to your application tracker.");
    }

    saveStorage(TRACKER_KEY, tracker);
    renderOpportunities();
    renderTracker();
  }

  function updateTrackerStatus(id, status) {
    if (!TRACKER_STATUSES.includes(status)) return;

    const item = tracker.find(
      entry => String(entry.id) === String(id)
    );

    if (!item) return;

    item.status = status;

    saveStorage(TRACKER_KEY, tracker);
    renderTracker();
    updateCounters();

    showToast("Application status updated.");
  }

  function removeTrackerItem(id) {
    tracker = tracker.filter(
      item => String(item.id) !== String(id)
    );

    saveStorage(TRACKER_KEY, tracker);
    renderTracker();
    renderOpportunities();

    showToast("Application removed from tracker.");
  }

  function renderTracker() {
    if (!el.trackerList) return;

    if (!tracker.length) {
      el.trackerList.innerHTML = `
        <div class="tracker-empty">
          <p>You haven't added any opportunities to your tracker yet.</p>
          <p>Use the Track button on an opportunity to get started.</p>
        </div>
      `;

      updateCounters();
      return;
    }

    el.trackerList.innerHTML = tracker.map(item => {
      const id = escapeHTML(item.id);
      const title = escapeHTML(item.title);
      const organisation = escapeHTML(item.organization);
      const category = escapeHTML(item.category);

      const status = TRACKER_STATUSES.includes(item.status)
        ? item.status
        : "Interested";

      const options = TRACKER_STATUSES.map(option => `
        <option
          value="${escapeHTML(option)}"
          ${option === status ? "selected" : ""}
        >${escapeHTML(option)}</option>
      `).join("");

      const application = safeURL(item.application_url);

      return `
        <article class="tracker-item" data-id="${id}">
          <div class="tracker-item-info">
            <h4>${title}</h4>
            <p>${organisation}</p>
            <span class="tracker-category">${category}</span>
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
              >${options}</select>
            </label>

            ${application ? `
              <a
                href="${escapeHTML(application)}"
                target="_blank"
                rel="noopener noreferrer"
                class="tracker-apply-link"
              >Open Application</a>
            ` : ""}

            <button
              type="button"
              class="tracker-remove-btn"
              data-action="tracker-remove"
              data-id="${id}"
            >Remove</button>
          </div>
        </article>
      `;
    }).join("");

    updateCounters();
  }

  function updateCounters() {
    if (el.bookmarks) {
      el.bookmarks.textContent = bookmarks.length;
    }

    if (el.trackerCount) {
      el.trackerCount.textContent = tracker.length;
    }
  }

  function csvCell(value) {
    let text = String(value ?? "");

    // Prevent spreadsheet formula injection in exported user-controlled fields.
    if (/^[\s]*[=+@\-]/.test(text)) {
      text = `'${text}`;
    }

    return `"${text.replace(/"/g, '""')}"`;
  }

  function exportTrackerCSV() {
    if (!tracker.length) {
      showToast("Your application tracker is empty.");
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
      ...tracker.map(item => [
        item.title,
        item.organization,
        item.category,
        item.application_url,
        item.date_added,
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
    link.download = "naija-opportunity-hub-tracker.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    showToast("Your tracker has been exported.");
  }

  function clearTracker() {
    if (!tracker.length) {
      showToast("Your application tracker is already empty.");
      return;
    }

    if (!window.confirm(
      "Are you sure you want to clear your application tracker?"
    )) return;

    tracker = [];

    saveStorage(TRACKER_KEY, tracker);
    renderTracker();
    renderOpportunities();

    showToast("Application tracker cleared.");
  }

  function resetFilters() {
    activeCategory = "All";
    showAll = false;

    if (el.search) el.search.value = "";
    if (el.category) el.category.value = "All";
    if (el.sort) el.sort.value = "newest";

    applyFilters();
  }

  function setupEvents() {
    el.search?.addEventListener("input", () => {
      showAll = false;
      applyFilters();
    });

    el.category?.addEventListener("change", () => {
      selectCategory(el.category.value || "All");
    });

    el.sort?.addEventListener("change", applyFilters);
    el.clearFilters?.addEventListener("click", resetFilters);

    el.viewAll?.addEventListener("click", () => {
      showAll = !showAll;
      renderOpportunities();
    });

    getElement(
      "exportTracker",
      "exportCSV",
      "exportTrackerBtn"
    )?.addEventListener("click", exportTrackerCSV);

    getElement(
      "clearTracker",
      "clearTrackerBtn"
    )?.addEventListener("click", clearTracker);

    getElement(
      "refreshOpportunities",
      "refreshBtn"
    )?.addEventListener("click", loadOpportunities);

    getElement("categoryButtons")?.addEventListener(
      "click",
      event => {
        const button = event.target.closest("[data-category]");

        if (button) {
          event.preventDefault();
          selectCategory(button.dataset.category || "All");
        }
      }
    );

    el.grid?.addEventListener("click", event => {
      const button = event.target.closest(
        '[data-action="track"]'
      );

      if (button && el.grid.contains(button)) {
        toggleTracker(button.dataset.id);
      }
    });

    el.trackerList?.addEventListener("change", event => {
      const select = event.target.closest(
        '[data-action="tracker-status"]'
      );

      if (select) {
        updateTrackerStatus(select.dataset.id, select.value);
      }
    });

    el.trackerList?.addEventListener("click", event => {
      const button = event.target.closest(
        '[data-action="tracker-remove"]'
      );

      if (button) {
        removeTrackerItem(button.dataset.id);
      }
    });

    document.addEventListener("click", event => {
      if (event.target.closest("#retryOpportunities")) {
        loadOpportunities();
      }
    });
  }

  function init() {
    debugLog(
      "Naija Opportunity Hub v3.5 initialising",
      SITE_URL
    );

    setupEvents();
    updateCounters();
    renderTracker();
    loadOpportunities();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();

/* =========================================================
   MOBILE NAVIGATION MENU
========================================================= */

(() => {
  "use strict";

  const menuButton = document.getElementById("menuBtn");
  const navLinks = document.getElementById("navLinks");

  if (!menuButton || !navLinks) return;

  if (menuButton.dataset.menuInitialised === "true") return;
  menuButton.dataset.menuInitialised = "true";

  function openMenu() {
    navLinks.classList.add("open");
    menuButton.setAttribute("aria-expanded", "true");
    menuButton.setAttribute("aria-label", "Close navigation menu");
  }

  function closeMenu() {
    navLinks.classList.remove("open");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Open navigation menu");
  }

  function toggleMenu() {
    const isOpen = navLinks.classList.contains("open");

    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  menuButton.addEventListener("click", toggleMenu);

  // Close after selecting a navigation link.
  navLinks.addEventListener("click", (event) => {
    const link = event.target.closest("a");

    if (link) closeMenu();
  });

  // Close when clicking outside the navigation.
  document.addEventListener("click", (event) => {
    if (
      navLinks.classList.contains("open") &&
      !navLinks.contains(event.target) &&
      !menuButton.contains(event.target)
    ) {
      closeMenu();
    }
  });

  // Close with Escape.
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  // Reset mobile menu when returning to desktop layout.
  window.addEventListener("resize", () => {
    if (window.innerWidth > 760) closeMenu();
  });

})();
  
