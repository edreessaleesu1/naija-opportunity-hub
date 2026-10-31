
/*
 * NAIJA OPPORTUNITY HUB
 * Main Front-End Application
 * Version 3.1
 *
 * Opportunity card:
 * Clickable image → Clickable title → Details page
 *
 * Features:
 * - Supabase opportunity loading
 * - Search and category filtering
 * - Sorting
 * - Bookmarks storage
 * - Application tracker storage
 * - CSV export
 * - View All / Show Less
 * - Loading, empty and error states
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

  const DETAILS_PAGE = "opportunity-details.html";

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
      "opportunityGrid",
      "opportunitiesGrid",
      "opportunitiesContainer"
    ),

    search: getElement(
      "searchInput",
      "opportunitySearch",
      "search"
    ),

    categoryFilter: getElement("categoryFilter"),

    sort: getElement(
      "sortFilter",
      "sortSelect",
      "sortOpportunities"
    ),

    clearFilters: getElement("clearFilters"),
    resultsCount: getElement("resultsCount"),
    dataNotice: getElement("dataNotice"),
    dataStatus: getElement("dataStatus"),

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
      return Array.isArray(value) ? value : fallback;
    } catch (error) {
      console.warn("Storage could not be read:", key, error);
      return fallback;
    }
  }

  function saveStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error("Storage could not be saved:", key, error);
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

  function debugLog(...args) {
    if (DEBUG) console.log("[NOH]", ...args);
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
    if (element) element.hidden = !visible;
  }

  function safeURL(value) {
    if (!value) return "";

    try {
      const url = new URL(String(value).trim());

      if (
        url.protocol === "https:" ||
        url.protocol === "http:"
      ) {
        return url.href;
      }

      return "";
    } catch {
      return "";
    }
  }

  function formatDate(value) {
    if (!value) return "Not specified";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Not specified";
    }

    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function getDeadlineStatus(value) {
    if (!value) {
      return {
        label: "Deadline not specified",
        type: "unknown"
      };
    }

    const deadline = new Date(value);

    if (Number.isNaN(deadline.getTime())) {
      return {
        label: "Deadline not specified",
        type: "unknown"
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const deadlineDay = new Date(deadline);
    deadlineDay.setHours(0, 0, 0, 0);

    if (deadlineDay < today) {
      return {
        label: "Application closed",
        type: "expired"
      };
    }

    if (deadlineDay.getTime() === today.getTime()) {
      return {
        label: "Deadline today",
        type: "today"
      };
    }

    return {
      label: `Deadline: ${formatDate(value)}`,
      type: "upcoming"
    };
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

  /* =========================================================
     6. NORMALISE OPPORTUNITY DATA
  ========================================================= */

  function normalizeOpportunity(item) {
    const organization =
      item.organization ||
      item.organisation ||
      "Organisation not specified";

    const applicationURL = safeURL(
      item.application_url ||
      item.source_url ||
      ""
    );

    const imageURL = safeURL(item.image_url || "");

    return {
      ...item,

      id: String(item.id ?? ""),

      title:
        String(item.title || "").trim() ||
        "Untitled Opportunity",

      organization: String(organization).trim(),

      category:
        String(item.category || "Other").trim(),

      description:
        String(item.description || "").trim(),

      eligibility:
        String(item.eligibility || "").trim(),

      location:
        String(item.location || "").trim(),

      image_url: imageURL,

      application_url: applicationURL
    };
  }

  /* =========================================================
     7. LOAD OPPORTUNITIES
  ========================================================= */

  async function loadOpportunities() {
    if (isLoading) return;

    isLoading = true;

    showElement(elements.loading, true);
    showElement(elements.empty, false);
    showElement(elements.error, false);
    showElement(elements.dataNotice, true);

    if (elements.dataStatus) {
      elements.dataStatus.textContent =
        "Loading opportunities...";
    }

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

        if (!missingImageColumn) throw error;

        debugLog("Retrying without image_url.");

        data = await fetchOpportunities(false);
      }

      allOpportunities = data
        .map(normalizeOpportunity)
        .filter(item => item.id);

      debugLog("Opportunities loaded:", allOpportunities);

      applyFilters();

      if (elements.dataStatus) {
        elements.dataStatus.textContent =
          `${allOpportunities.length} published opportunities available`;
      }

      showElement(elements.dataNotice, true);

    } catch (error) {
      console.error("Unable to load opportunities:", error);

      showElement(elements.error, true);

      if (elements.dataStatus) {
        elements.dataStatus.textContent =
          "Unable to load opportunities.";
      }

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

        $("#retryOpportunities", elements.error)
          ?.addEventListener("click", loadOpportunities);
      }

    } finally {
      isLoading = false;
      showElement(elements.loading, false);
    }
  }

  /* =========================================================
     8. FILTERING
  ========================================================= */

  function applyFilters() {
    const searchTerm = normalize(
      elements.search?.value || ""
    );

    if (elements.categoryFilter) {
      elements.categoryFilter.value = activeCategory;
    }

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

  /* =========================================================
     9. SORTING
  ========================================================= */

  function getDateTimestamp(value) {
    if (!value) return null;

    const timestamp = new Date(value).getTime();

    return Number.isNaN(timestamp) ? null : timestamp;
  }

  function sortOpportunities() {
    const sortValue = elements.sort?.value || "newest";

    filteredOpportunities.sort((a, b) => {
      if (sortValue === "deadline") {
        const dateA = getDateTimestamp(a.deadline);
        const dateB = getDateTimestamp(b.deadline);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayTime = today.getTime();

        const getPriority = date => {
          if (date === null) return 3;
          if (date >= todayTime) return 1;
          return 2;
        };

        const difference =
          getPriority(dateA) - getPriority(dateB);

        if (difference !== 0) return difference;
        if (dateA === null || dateB === null) return 0;

        return dateA - dateB;
      }

      if (sortValue === "title") {
        return a.title.localeCompare(b.title);
      }

      const createdA =
        getDateTimestamp(a.created_at) || 0;

      const createdB =
        getDateTimestamp(b.created_at) || 0;

      return createdB - createdA;
    });
  }

  /* =========================================================
     10. OPPORTUNITY CARD
     Image and title both open the details page.
  ========================================================= */

  function createOpportunityCard(item) {
    const id = getOpportunityId(item);

    const image = item.image_url || FALLBACK_IMAGE;

    const detailsURL =
      `${DETAILS_PAGE}?id=${encodeURIComponent(id)}`;

    const title = escapeHTML(item.title);
    const category = escapeHTML(item.category);

    return `
      <article
        class="opportunity-card"
        data-id="${escapeHTML(id)}"
      >

        <div class="opportunity-image">

          <a
            class="opportunity-image-link"
            href="${escapeHTML(detailsURL)}"
            aria-label="View ${title}"
          >
            <img
              src="${escapeHTML(image)}"
              alt="${title}"
              loading="lazy"
              onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}'"
            >
          </a>

          <span class="opportunity-category">
            ${category}
          </span>

        </div>

        <div class="opportunity-content">

          <h3 class="opportunity-title">
            <a
              class="opportunity-title-link"
              href="${escapeHTML(detailsURL)}"
            >
              ${title}
            </a>
          </h3>

        </div>

      </article>
    `;
  }

  /* =========================================================
     11. RENDER OPPORTUNITIES
  ========================================================= */

  function renderOpportunities() {
    if (!elements.opportunities) {
      debugLog("Opportunity grid not found.");
      return;
    }

    const visibleItems = showAll
      ? filteredOpportunities
      : filteredOpportunities.slice(
          0,
          DEFAULT_VISIBLE_COUNT
        );

    elements.opportunities.innerHTML = visibleItems
      .map(createOpportunityCard)
      .join("");

    const hasResults =
      filteredOpportunities.length > 0;

    showElement(elements.empty, !hasResults);

    if (elements.empty && !hasResults) {
      elements.empty.textContent =
        "No opportunities found. Try another search or category.";
    }

    if (elements.resultsCount) {
      const count = filteredOpportunities.length;

      elements.resultsCount.textContent =
        `${count} ${count === 1 ? "opportunity" : "opportunities"} found`;
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
     12. CATEGORY BUTTONS
  ========================================================= */

  function getCategoryButtons() {
    const categoryContainer = getElement("categoryButtons");

    if (!categoryContainer) return [];

    return $$("[data-category]", categoryContainer);
  }

  function syncCategoryButtons() {
    getCategoryButtons().forEach(button => {
      const category = button.dataset.category || "";

      const active =
        normalize(category) === normalize(activeCategory);

      button.classList.toggle("active", active);

      button.setAttribute("aria-pressed", String(active));
    });
  }

  function selectCategory(category) {
    activeCategory = category || "All";
    showAll = false;

    applyFilters();

    debugLog("Category selected:", activeCategory);
  }

  function setupCategoryButtons() {
    getCategoryButtons().forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();

        selectCategory(
          button.dataset.category || "All"
        );
      });
    });
  }

  /* =========================================================
     13. BOOKMARKS
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
    updateCounters();
  }

  /* =========================================================
     14. APPLICATION TRACKER
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
    updateCounters();
  }

  /* =========================================================
     15. COUNTERS
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
     16. CSV EXPORT
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
     17. CLEAR TRACKER
  ========================================================= */

  function clearTracker() {
    if (!tracker.length) {
      alert("Your application tracker is already empty.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to clear your application tracker?"
    );

    if (!confirmed) return;

    tracker = [];

    saveStorage(TRACKER_KEY, tracker);
    updateCounters();
  }

  /* =========================================================
     18. CLEAR FILTERS
  ========================================================= */

  function resetFilters() {
    activeCategory = "All";
    showAll = false;

    if (elements.search) {
      elements.search.value = "";
    }

    if (elements.categoryFilter) {
      elements.categoryFilter.value = "All";
    }

    if (elements.sort) {
      elements.sort.value = "newest";
    }

    applyFilters();
  }

  /* =========================================================
     19. EVENT LISTENERS
  ========================================================= */

  function setupEventListeners() {

    elements.search?.addEventListener(
      "input",
      () => {
        showAll = false;
        applyFilters();
      }
    );

    elements.categoryFilter?.addEventListener(
      "change",
      () => {
        selectCategory(
          elements.categoryFilter.value || "All"
        );
      }
    );

    elements.sort?.addEventListener(
      "change",
      applyFilters
    );

    elements.clearFilters?.addEventListener(
      "click",
      resetFilters
    );

    elements.viewAll?.addEventListener(
      "click",
      () => {
        showAll = !showAll;
        renderOpportunities();
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
     20. INITIALISE APPLICATION
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
