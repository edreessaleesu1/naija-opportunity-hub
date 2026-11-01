
/*
 * NAIJA OPPORTUNITY HUB
 * Main Front-End Application
 * Version 3.4
 *
 * Official domain:
 * https://naijaopportunityhub.com.ng
 *
 * Features:
 * - Supabase opportunity loading
 * - Search, category filtering and sorting
 * - Complete opportunity cards
 * - Working bookmarks
 * - Application tracker with status updates
 * - CSV export
 * - View All / Show Less
 * - Loading, empty and error states
 * - Custom-domain opportunity details links
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

  const SITE_URL = "https://naijaopportunityhub.com.ng";

  const DETAILS_PAGE =
    `${SITE_URL}/opportunity-details.html`;

  const BOOKMARKS_KEY = "noh_bookmarks_v1";
  const TRACKER_KEY = "noh_tracker_v1";

  const DEFAULT_VISIBLE_COUNT = 6;

  const FALLBACK_IMAGE =
    "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=900&auto=format&fit=crop&q=80";

  const TRACKER_STATUSES = [
    "Interested",
    "Applied",
    "Interview",
    "Successful",
    "Unsuccessful"
  ];

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

    trackerList: getElement("trackerList"),

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
    ),

    toast: getElement("toast")
  };

  /* =========================================================
     3. APPLICATION STATE
  ========================================================= */

  let allOpportunities = [];
  let filteredOpportunities = [];

  let activeCategory = "All";
  let showAll = false;
  let isLoading = false;
  let toastTimer = null;

  let bookmarks = readStorage(BOOKMARKS_KEY, []);
  let tracker = readStorage(TRACKER_KEY, []);

  // Normalise previously saved tracker records.
  tracker = tracker
    .filter(item => item && item.id)
    .map(item => ({
      ...item,
      id: String(item.id),
      title: String(item.title || "Untitled Opportunity"),
      organization: String(
        item.organization ||
        item.organisation ||
        "Organisation not specified"
      ),
      category: String(item.category || "Other"),
      application_url: safeURL(item.application_url || ""),
      date_added: item.date_added || new Date().toISOString(),
      status: TRACKER_STATUSES.includes(item.status)
        ? item.status
        : "Interested"
    }));

  bookmarks = [
    ...new Set(bookmarks.map(String).filter(Boolean))
  ];

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
      return true;
    } catch (error) {
      console.error("Storage could not be saved:", key, error);
      showToast("Unable to save changes on this device.");
      return false;
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
    return String(item?.id ?? "");
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

  function getOpportunityDetailsURL(id) {
    const url = new URL(DETAILS_PAGE);
    url.searchParams.set("id", String(id));
    return url.href;
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

  function showToast(message) {
    if (!elements.toast) {
      debugLog(message);
      return;
    }

    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    elements.toast.hidden = false;

    if (toastTimer) {
      clearTimeout(toastTimer);
    }

    toastTimer = setTimeout(() => {
      elements.toast.classList.remove("show");
      elements.toast.hidden = true;
    }, 2800);
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

      image_url: safeURL(item.image_url || ""),

      application_url: safeURL(
        item.application_url ||
        item.source_url ||
        ""
      ),

      source_url: safeURL(item.source_url || "")
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

    if (elements.dataNotice) {
      elements.dataNotice.textContent = "";
      showElement(elements.dataNotice, false);
    }

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
      renderTracker();

      if (elements.dataStatus) {
        elements.dataStatus.textContent =
          `${allOpportunities.length} published opportunities available`;
      }

    } catch (error) {
      console.error("Unable to load opportunities:", error);

      if (elements.dataStatus) {
        elements.dataStatus.textContent =
          "Unable to load opportunities.";
      }

      const errorHTML = `
        <div class="empty-state">
          <h3>Unable to load opportunities</h3>
          <p>Please check your internet connection and try again.</p>
          <button
            type="button"
            class="button button-primary"
            id="retryOpportunities"
          >
            Try Again
          </button>
          ${
            DEBUG
              ? `<pre>${escapeHTML(error.message)}</pre>`
              : ""
          }
        </div>
      `;

      if (elements.error) {
        elements.error.innerHTML = errorHTML;
        showElement(elements.error, true);
      } else if (elements.opportunities) {
        elements.opportunities.innerHTML = errorHTML;
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
  ========================================================= */

  function createOpportunityCard(item) {
    const id = getOpportunityId(item);

    const image = item.image_url || FALLBACK_IMAGE;
    const detailsURL = getOpportunityDetailsURL(id);

    const title = escapeHTML(item.title);
    const category = escapeHTML(item.category);
    const organization = escapeHTML(item.organization);

    const description = escapeHTML(
      item.description || "View the full details to learn more about this opportunity."
    );

    const location = escapeHTML(item.location);
    const eligibility = escapeHTML(item.eligibility);

    const deadline = getDeadlineStatus(item.deadline);

    const bookmarked = isBookmarked(id);
    const tracked = isTracked(id);

    const applicationURL = safeURL(item.application_url);

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

          <button
            type="button"
            class="bookmark-btn ${bookmarked ? "is-bookmarked" : ""}"
            data-action="bookmark"
            data-id="${escapeHTML(id)}"
            aria-label="${bookmarked ? "Remove bookmark" : "Bookmark opportunity"}"
            aria-pressed="${bookmarked}"
          >
            ${bookmarked ? "♥ Saved" : "♡ Save"}
          </button>

        </div>

        <div class="opportunity-content">

          <p class="opportunity-organization">
            ${organization}
          </p>

          <h3 class="opportunity-title">
            <a
              class="opportunity-title-link"
              href="${escapeHTML(detailsURL)}"
            >
              ${title}
            </a>
          </h3>

          <p class="opportunity-description">
            ${description}
          </p>

          ${
            location
              ? `
                <p class="opportunity-location">
                  <span aria-hidden="true">📍</span>
                  ${location}
                </p>
              `
              : ""
          }

          ${
            eligibility
              ? `
                <p class="opportunity-eligibility">
                  <strong>Eligibility:</strong>
                  ${eligibility}
                </p>
              `
              : ""
          }

          <p class="opportunity-deadline deadline-${deadline.type}">
            ${escapeHTML(deadline.label)}
          </p>

          <div class="opportunity-actions">

            <a
              class="button button-primary"
              href="${escapeHTML(detailsURL)}"
            >
              View Details
            </a>

            ${
              applicationURL
                ? `
                  <a
                    class="button button-outline"
                    href="${escapeHTML(applicationURL)}"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Apply
                  </a>
                `
                : ""
            }

            <button
              type="button"
              class="track-btn ${tracked ? "is-tracked" : ""}"
              data-action="track"
              data-id="${escapeHTML(id)}"
              aria-pressed="${tracked}"
            >
              ${tracked ? "✓ Tracking" : "+ Track"}
            </button>

          </div>

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

    if (visibleItems.length) {
      elements.opportunities.innerHTML = visibleItems
        .map(createOpportunityCard)
        .join("");
    } else {
      elements.opportunities.innerHTML = "";
    }

    const hasResults =
      filteredOpportunities.length > 0;

    if (elements.empty) {
      elements.empty.textContent =
        "No opportunities found. Try another search or category.";

      showElement(elements.empty, !hasResults);
    } else if (!hasResults) {
      elements.opportunities.innerHTML = `
        <div class="empty-state">
          <h3>No opportunities found</h3>
          <p>Try another search or category.</p>
        </div>
      `;
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
  }

  function setupCategoryButtons() {
    const container = getElement("categoryButtons");

    container?.addEventListener("click", event => {
      const button = event.target.closest("[data-category]");

      if (!button || !container.contains(button)) return;

      event.preventDefault();

      selectCategory(
        button.dataset.category || "All"
      );
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

      showToast("Bookmark removed.");
    } else {
      bookmarks.push(id);
      showToast("Opportunity saved to bookmarks.");
    }

    saveStorage(BOOKMARKS_KEY, bookmarks);
    renderOpportunities();
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

      showToast("Removed from your application tracker.");

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
    if (!elements.trackerList) return;

    if (!tracker.length) {
      elements.trackerList.innerHTML = `
        <div class="tracker-empty">
          <p>You haven't added any opportunities to your tracker yet.</p>
          <p>Use the Track button on an opportunity to get started.</p>
        </div>
      `;

      updateCounters();
      return;
    }

    elements.trackerList.innerHTML = tracker.map(item => {
      const id = escapeHTML(item.id);
      const title = escapeHTML(item.title);
      const organization = escapeHTML(item.organization);
      const category = escapeHTML(item.category);
      const status = TRACKER_STATUSES.includes(item.status)
        ? item.status
        : "Interested";

      const applicationURL = safeURL(item.application_url);

      const statusOptions = TRACKER_STATUSES.map(option => `
        <option
          value="${escapeHTML(option)}"
          ${option === status ? "selected" : ""}
        >
          ${escapeHTML(option)}
        </option>
      `).join("");

      return `
        <article class="tracker-item" data-id="${id}">

          <div class="tracker-item-info">

            <h4>${title}</h4>

            <p>${organization}</p>

            <span class="tracker-category">
              ${category}
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
                ${statusOptions}
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
                  >
                    Open Application
                  </a>
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
      showToast("Your application tracker is empty.");
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

    showToast("Your tracker has been exported.");
  }

  /* =========================================================
     17. CLEAR TRACKER
  ========================================================= */

  function clearTracker() {
    if (!tracker.length) {
      showToast("Your application tracker is already empty.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to clear your application tracker?"
    );

    if (!confirmed) return;

    tracker = [];

    saveStorage(TRACKER_KEY, tracker);

    renderTracker();
    renderOpportunities();

    showToast("Application tracker cleared.");
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
     19. DELEGATED ACTIONS
  ========================================================= */

  function setupOpportunityActions() {
    if (!elements.opportunities) return;

    elements.opportunities.addEventListener("click", event => {
      const button = event.target.closest("[data-action]");

      if (!button || !elements.opportunities.contains(button)) {
        return;
      }

      const id = button.dataset.id;
      const action = button.dataset.action;

      if (!id) return;

      if (action === "bookmark") {
        toggleBookmark(id);
      }

      if (action === "track") {
        toggleTracker(id);
      }

      if (action === "retry") {
        loadOpportunities();
      }
    });
  }

  function setupTrackerActions() {
    if (!elements.trackerList) return;

    elements.trackerList.addEventListener("change", event => {
      const select = event.target.closest(
        '[data-action="tracker-status"]'
      );

      if (!select) return;

      updateTrackerStatus(
        select.dataset.id,
        select.value
      );
    });

    elements.trackerList.addEventListener("click", event => {
      const button = event.target.closest(
        '[data-action="tracker-remove"]'
      );

      if (!button) return;

      removeTrackerItem(button.dataset.id);
    });
  }

  /* =========================================================
     20. EVENT LISTENERS
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

    // Support the retry button in the error state.
    document.addEventListener("click", event => {
      if (event.target.closest("#retryOpportunities")) {
        loadOpportunities();
      }
    });

    setupOpportunityActions();
    setupTrackerActions();
  }

  /* =========================================================
     21. INITIALISE APPLICATION
  ========================================================= */

  function init() {
    debugLog("Naija Opportunity Hub v3.4 initialising...");
    debugLog("Official website:", SITE_URL);
    debugLog("Details page:", DETAILS_PAGE);

    setupCategoryButtons();
    setupEventListeners();

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
