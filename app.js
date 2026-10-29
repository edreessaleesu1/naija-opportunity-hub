
/*
 * NAIJA OPPORTUNITY HUB
 * Main front-end application script
 *
 * Features:
 * - Loads published opportunities from Supabase
 * - Search and category filtering
 * - Sorting by newest, deadline and title
 * - Opportunity images with fallback
 * - Bookmarks using localStorage
 * - Application tracker using localStorage
 * - CSV export
 * - View All / Show Less
 * - Loading, empty and error states
 * - Optional debug mode: add ?debug=1 to the URL
 */

(() => {
  "use strict";

  /* =========================================================
     1. CONFIGURATION
  ========================================================= */

  const SUPABASE_URL =
    "https://djxornmwvkauhkcuhgxc.supabase.co";

  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_EDReCY3JcN4vMuypVfqcMQ_GcTEVuBq";

  const TABLE_NAME = "opportunities";

  const BOOKMARKS_KEY = "noh_bookmarks_v1";
  const TRACKER_KEY = "noh_tracker_v1";

  const DEFAULT_VISIBLE_COUNT = 6;

  const FALLBACK_IMAGE =
    "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=900&auto=format&fit=crop&q=80";

  const DEBUG =
    new URLSearchParams(window.location.search).get("debug") === "1";

  /* =========================================================
     2. DOM HELPERS
  ========================================================= */

  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const $$ = (selector, parent = document) =>
    Array.from(parent.querySelectorAll(selector));

  function getElement(...ids) {
    for (const id of ids) {
      const element = document.getElementById(id);
      if (element) return element;
    }
    return null;
  }

  const elements = {
    opportunities: getElement(
      "opportunitiesGrid",
      "opportunityGrid",
      "opportunitiesContainer"
    ),

    search: getElement(
      "searchInput",
      "opportunitySearch",
      "search"
    ),

    sort: getElement(
      "sortSelect",
      "sortOpportunities"
    ),

    viewAll: getElement(
      "viewAllBtn",
      "viewAll",
      "showAllBtn"
    ),

    bookmarks: getElement(
      "bookmarksCount",
      "bookmarkCount"
    ),

    tracker: getElement(
      "trackerCount",
      "applicationCount"
    ),

    loading: getElement(
      "loadingState",
      "opportunitiesLoading"
    ),

    empty: getElement(
      "emptyState",
      "noOpportunities"
    ),

    error: getElement(
      "errorState",
      "opportunitiesError"
    )
  };

  /* =========================================================
     3. APPLICATION STATE
  ========================================================= */

  let allOpportunities = [];
  let filteredOpportunities = [];

  let activeCategory = "All";
  let showAll = false;
  let isLoading = false;

  let bookmarks = readStorage(BOOKMARKS_KEY, []);
  let tracker = readStorage(TRACKER_KEY, []);

  /* =========================================================
     4. GENERAL HELPERS
  ========================================================= */

  function readStorage(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch (error) {
      console.warn("Storage could not be read:", key, error);
      return fallback;
    }
  }

  function saveStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error("Storage could not be saved:", error);
    }
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[character]
    );
  }

  function normalize(value) {
    return String(value ?? "").trim().toLowerCase();
  }

  function formatDate(value) {
    if (!value) return "Not specified";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Not specified";
    }

    return date.toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function getOpportunityId(item) {
    return String(item.id ?? "");
  }

  function isBookmarked(id) {
    return bookmarks.some(item => String(item) === String(id));
  }

  function isTracked(id) {
    return tracker.some(item => String(item.id) === String(id));
  }

  function showElement(element, visible) {
    if (element) {
      element.hidden = !visible;
    }
  }

  function debugLog(...args) {
    if (DEBUG) {
      console.log("[NOH]", ...args);
    }
  }

  /* =========================================================
     5. SUPABASE CONNECTION
  ========================================================= */

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

    if (includeImages) {
      columns.push("image_url");
    }

    const query = new URLSearchParams({
      select: columns.join(","),
      status: "eq.published",
      order: "created_at.desc"
    });

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE_NAME}?${query}`,
      {
        method: "GET",
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

  async function loadOpportunities() {
    if (isLoading) return;

    isLoading = true;

    showElement(elements.loading, true);
    showElement(elements.empty, false);
    showElement(elements.error, false);

    if (elements.opportunities) {
      elements.opportunities.innerHTML = "";
    }

    try {
      let data;

      try {
        data = await fetchOpportunities(true);
        debugLog("Loaded opportunities with image_url.");
      } catch (error) {
        const missingImageColumn =
          /image_url|column.*does not exist|schema cache/i.test(
            error.message
          );

        if (!missingImageColumn) {
          throw error;
        }

        debugLog(
          "image_url column unavailable. Retrying without it."
        );

        data = await fetchOpportunities(false);
      }

      allOpportunities = data.map(item => ({
        ...item,
        title: item.title || "Untitled Opportunity",
        organization:
          item.organization ||
          item.organisation ||
          "Organisation not specified",
        category: item.category || "Other",
        description: item.description || "",
        image_url: item.image_url || "",
        application_url:
          item.application_url ||
          item.source_url ||
          ""
      }));

      debugLog("Opportunities loaded:", allOpportunities);

      applyFilters();

    } catch (error) {
      console.error("Unable to load opportunities:", error);

      showElement(elements.error, true);

      if (elements.error) {
        elements.error.innerHTML = `
          <p>We couldn't load opportunities right now.</p>
          <button type="button" id="retryOpportunities">
            Try Again
          </button>
          ${
            DEBUG
              ? `<pre>${escapeHTML(error.message)}</pre>`
              : ""
          }
        `;

        const retryButton = $("#retryOpportunities", elements.error);

        retryButton?.addEventListener(
          "click",
          loadOpportunities
        );
      }
    } finally {
      isLoading = false;
      showElement(elements.loading, false);
    }
  }

  /* =========================================================
     6. FILTERING AND SORTING
  ========================================================= */

  function applyFilters() {
    const searchTerm = normalize(
      elements.search?.value || ""
    );

    filteredOpportunities = allOpportunities.filter(item => {
      const matchesCategory =
        activeCategory === "All" ||
        normalize(item.category) === normalize(activeCategory);

      const searchableText = [
        item.title,
        item.organization,
        item.category,
        item.description,
        item.eligibility,
        item.location
      ].join(" ");

      const matchesSearch =
        !searchTerm ||
        normalize(searchableText).includes(searchTerm);

      return matchesCategory && matchesSearch;
    });

    sortOpportunities();
    renderOpportunities();
  }

  function sortOpportunities() {
    const sortValue = elements.sort?.value || "newest";

    filteredOpportunities.sort((a, b) => {
      if (sortValue === "deadline") {
        const dateA = a.deadline
          ? new Date(a.deadline).getTime()
          : Infinity;

        const dateB = b.deadline
          ? new Date(b.deadline).getTime()
          : Infinity;

        return dateA - dateB;
      }

      if (sortValue === "title") {
        return String(a.title).localeCompare(String(b.title));
      }

      return (
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
      );
    });
  }

  /* =========================================================
     7. OPPORTUNITY CARD
  ========================================================= */

  function createOpportunityCard(item) {
    const id = getOpportunityId(item);
    const bookmarked = isBookmarked(id);
    const tracked = isTracked(id);

    const image = item.image_url || FALLBACK_IMAGE;

    const applicationURL = item.application_url || "";

    const safeApplicationURL = /^https?:\/\//i.test(applicationURL)
      ? applicationURL
      : "";

    const description = item.description.length > 180
      ? `${item.description.slice(0, 180)}...`
      : item.description;

    const verified = Boolean(item.verified_at);

    return `
      <article class="opportunity-card" data-id="${escapeHTML(id)}">

        <div class="opportunity-image">
          <img
            src="${escapeHTML(image)}"
            alt="${escapeHTML(item.title)}"
            loading="lazy"
            onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}'"
          >

          <span class="opportunity-category">
            ${escapeHTML(item.category)}
          </span>

          <button
            type="button"
            class="bookmark-btn ${bookmarked ? "active" : ""}"
            data-action="bookmark"
            data-id="${escapeHTML(id)}"
            aria-label="${bookmarked ? "Remove bookmark" : "Bookmark opportunity"}"
            aria-pressed="${bookmarked}"
          >
            ${bookmarked ? "♥" : "♡"}
          </button>
        </div>

        <div class="opportunity-content">

          <div class="opportunity-organisation">
            ${escapeHTML(item.organization)}
            ${verified ? '<span class="verified-label">✓ Verified</span>' : ""}
          </div>

          <h3>${escapeHTML(item.title)}</h3>

          <p class="opportunity-description">
            ${escapeHTML(description)}
          </p>

          <div class="opportunity-meta">
            <span>📍 ${escapeHTML(item.location || "Location not specified")}</span>
            <span>📅 Deadline: ${escapeHTML(formatDate(item.deadline))}</span>
          </div>

          <div class="opportunity-actions">

            ${
              safeApplicationURL
                ? `
                  <a
                    href="${escapeHTML(safeApplicationURL)}"
                    class="apply-btn"
                    target="_blank"
                    rel="noopener noreferrer"
                    data-action="apply"
                    data-id="${escapeHTML(id)}"
                  >
                    Apply Now
                  </a>
                `
                : `
                  <span class="apply-btn disabled">
                    Application link unavailable
                  </span>
                `
            }

            <button
              type="button"
              class="track-btn ${tracked ? "active" : ""}"
              data-action="track"
              data-id="${escapeHTML(id)}"
            >
              ${tracked ? "✓ Tracking" : "Track Application"}
            </button>

          </div>

        </div>
      </article>
    `;
  }

  /* =========================================================
     8. RENDER OPPORTUNITIES
  ========================================================= */

  function renderOpportunities() {
    if (!elements.opportunities) {
      debugLog(
        "Opportunity grid not found. Check your HTML element ID."
      );
      return;
    }

    const visibleItems = showAll
      ? filteredOpportunities
      : filteredOpportunities.slice(0, DEFAULT_VISIBLE_COUNT);

    elements.opportunities.innerHTML = visibleItems
      .map(createOpportunityCard)
      .join("");

    const hasResults = filteredOpportunities.length > 0;

    showElement(elements.empty, !hasResults);

    if (elements.empty && !hasResults) {
      elements.empty.textContent =
        "No opportunities found. Try another search or category.";
    }

    if (elements.viewAll) {
      const shouldShowButton =
        filteredOpportunities.length > DEFAULT_VISIBLE_COUNT;

      showElement(elements.viewAll, shouldShowButton);

      elements.viewAll.textContent = showAll
        ? "Show Less"
        : `View All (${filteredOpportunities.length})`;
    }

    updateCounters();
    syncCategoryButtons();
  }

  /* =========================================================
     9. CATEGORY BUTTONS
  ========================================================= */

  function getCategoryButtons() {
    return $$(
      "[data-category], .category, .category-button, .category-card"
    ).filter(button => {
      return (
        button.tagName === "BUTTON" ||
        button.tagName === "A" ||
        button.hasAttribute("data-category")
      );
    });
  }

  function syncCategoryButtons() {
    getCategoryButtons().forEach(button => {
      const category =
        button.dataset.category ||
        button.textContent.trim();

      const active =
        normalize(category) === normalize(activeCategory);

      button.classList.toggle("active", active);

      if (active) {
        button.setAttribute("aria-pressed", "true");
      } else {
        button.setAttribute("aria-pressed", "false");
      }
    });
  }

  function setupCategoryButtons() {
    getCategoryButtons().forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();

        activeCategory =
          button.dataset.category ||
          button.textContent.trim();

        showAll = false;
        applyFilters();

        debugLog("Category selected:", activeCategory);
      });
    });
  }

  /* =========================================================
     10. BOOKMARKS
  ========================================================= */

  function toggleBookmark(id) {
    id = String(id);

    if (isBookmarked(id)) {
      bookmarks = bookmarks.filter(
        item => String(item) !== id
      );
    } else {
      bookmarks.push(id);
    }

    saveStorage(BOOKMARKS_KEY, bookmarks);
    renderOpportunities();
  }

  /* =========================================================
     11. APPLICATION TRACKER
  ========================================================= */

  function toggleTracker(id) {
    id = String(id);

    if (isTracked(id)) {
      tracker = tracker.filter(
        item => String(item.id) !== id
      );
    } else {
      const opportunity = allOpportunities.find(
        item => getOpportunityId(item) === id
      );

      if (!opportunity) return;

      tracker.push({
        id,
        title: opportunity.title,
        organization: opportunity.organization,
        category: opportunity.category,
        application_url: opportunity.application_url,
        date_added: new Date().toISOString(),
        status: "Interested"
      });
    }

    saveStorage(TRACKER_KEY, tracker);
    renderOpportunities();
  }

  /* =========================================================
     12. COUNTERS
  ========================================================= */

  function updateCounters() {
    if (elements.bookmarks) {
      elements.bookmarks.textContent = bookmarks.length;
    }

    if (elements.tracker) {
      elements.tracker.textContent = tracker.length;
    }
  }

  /* =========================================================
     13. CSV EXPORT
  ========================================================= */

  function exportTrackerCSV() {
    if (!tracker.length) {
      alert("Your application tracker is empty.");
      return;
    }

    const headers = [
      "Title",
      "Organisation",
      "Category",
      "Application URL",
      "Date Added",
      "Status"
    ];

    const rows = tracker.map(item => [
      item.title,
      item.organization,
      item.category,
      item.application_url,
      item.date_added,
      item.status
    ]);

    const csv = [
      headers,
      ...rows
    ].map(row =>
      row.map(value =>
        `"${String(value ?? "").replace(/"/g, '""')}"`
      ).join(",")
    ).join("\n");

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
  }

  /* =========================================================
     14. CLEAR TRACKER
  ========================================================= */

  function clearTracker() {
    if (!tracker.length) {
      alert("Your tracker is already empty.");
      return;
    }

    const confirmed = confirm(
      "Are you sure you want to clear your application tracker?"
    );

    if (!confirmed) return;

    tracker = [];
    saveStorage(TRACKER_KEY, tracker);

    renderOpportunities();
  }

  /* =========================================================
     15. EVENT LISTENERS
  ========================================================= */

  function setupEventListeners() {

    elements.search?.addEventListener(
      "input",
      () => {
        showAll = false;
        applyFilters();
      }
    );

    elements.sort?.addEventListener(
      "change",
      () => {
        applyFilters();
      }
    );

    elements.viewAll?.addEventListener(
      "click",
      () => {
        showAll = !showAll;
        renderOpportunities();
      }
    );

    elements.opportunities?.addEventListener(
      "click",
      event => {
        const button = event.target.closest("[data-action]");

        if (!button) return;

        const action = button.dataset.action;
        const id = button.dataset.id;

        if (!id) return;

        if (action === "bookmark") {
          toggleBookmark(id);
        }

        if (action === "track") {
          toggleTracker(id);
        }
      }
    );

    const exportButton = getElement(
      "exportTracker",
      "exportCSV",
      "exportTrackerBtn"
    );

    exportButton?.addEventListener(
      "click",
      exportTrackerCSV
    );

    const clearButton = getElement(
      "clearTracker",
      "clearTrackerBtn"
    );

    clearButton?.addEventListener(
      "click",
      clearTracker
    );

    const refreshButton = getElement(
      "refreshOpportunities",
      "refreshBtn"
    );

    refreshButton?.addEventListener(
      "click",
      loadOpportunities
    );
  }

  /* =========================================================
     16. INITIALISE APPLICATION
  ========================================================= */

  function init() {
    debugLog("Naija Opportunity Hub initialising...");

    setupCategoryButtons();
    setupEventListeners();
    updateCounters();

    loadOpportunities();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
