
/*
 * Naija Opportunity Hub
 * Loads published opportunities from Supabase.
 * Provides search, filters, bookmarks and an application tracker.
 */

(() => {
  "use strict";

  /* -----------------------------------------------------------
     1. CONFIGURATION
  ----------------------------------------------------------- */

  const SUPABASE_URL =
    "https://djxornmwvkauhkcuhgxc.supabase.co";

  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_EDReCY3JcN4vMuypVfqcMQ_GcTEVuBq";

  const STORAGE = {
    bookmarks: "noh_bookmarks_v1",
    tracker: "noh_tracker_v1"
  };

  const TRACKER_STATUSES = [
    "Interested",
    "Preparing",
    "Applied",
    "Interview",
    "Successful",
    "Unsuccessful"
  ];

  const HOME_OPPORTUNITIES_LIMIT = 6;
  const SEARCH_DELAY_MS = 200;
  const TOAST_DURATION_MS = 3500;

  const DEBUG =
    /(?:^|[?&])debug=1(?:&|$)/.test(window.location.search || "");

  /* -----------------------------------------------------------
     2. APPLICATION STATE
  ----------------------------------------------------------- */

  const state = {
    opportunities: [],
    activeCategory: "All",
    loadState: "loading",
    showAll: false
  };

  let supabaseClient = null;
  let toastTimer = null;

  const $ = (id) => document.getElementById(id);

  /* -----------------------------------------------------------
     3. UTILITIES
  ----------------------------------------------------------- */

  function el(tag, className = "", text = "") {
    const node = document.createElement(tag);

    if (className) node.className = className;
    if (text !== undefined && text !== null) {
      node.textContent = text;
    }

    return node;
  }

  function debounce(callback, delay) {
    let timer;

    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => callback.apply(this, args), delay);
    };
  }

  function safeURL(value) {
    try {
      const url = new URL(String(value || ""));

      if (url.protocol === "https:" || url.protocol === "http:") {
        return url.href;
      }

      return "";
    } catch {
      return "";
    }
  }

  function parseDate(value) {
    if (!value) return null;

    const text = String(value);
    const date = new Date(
      /^\d{4}-\d{2}-\d{2}$/.test(text)
        ? `${text}T00:00:00`
        : text
    );

    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDate(value) {
    const date = parseDate(value);

    if (!date) return "Not specified";

    return date.toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function isPastDeadline(value) {
    const date = parseDate(value);

    if (!date) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return date.getTime() < today.getTime();
  }

  function timeValue(value) {
    const date = parseDate(value);
    return date ? date.getTime() : 0;
  }

  function pluralizeOpportunity(count) {
    return count === 1 ? "opportunity" : "opportunities";
  }

  function showToast(message) {
    const toast = $("toast");

    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, TOAST_DURATION_MS);
  }

  function setDataStatus(status = "", notice = "") {
    const statusElement = $("dataStatus");
    const noticeElement = $("dataNotice");

    if (statusElement) {
      statusElement.textContent = status;
    }

    if (noticeElement) {
      noticeElement.textContent = notice;
      noticeElement.hidden = !notice;
    }
  }

  function setResultsCount(message) {
    const element = $("resultsCount");
    if (element) element.textContent = message;
  }

  /* -----------------------------------------------------------
     4. LOCAL STORAGE
  ----------------------------------------------------------- */

  function readList(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function writeList(key, items, message) {
    try {
      localStorage.setItem(key, JSON.stringify(items));
      return true;
    } catch (error) {
      console.error("Local storage error:", error);
      showToast(message);
      return false;
    }
  }

  function getBookmarks() {
    return readList(STORAGE.bookmarks).map(String);
  }

  function saveBookmarks(items) {
    return writeList(
      STORAGE.bookmarks,
      items,
      "Bookmarks could not be saved on this device."
    );
  }

  function getTracker() {
    return readList(STORAGE.tracker);
  }

  function saveTracker(items) {
    return writeList(
      STORAGE.tracker,
      items,
      "Tracker changes could not be saved on this device."
    );
  }

  /* -----------------------------------------------------------
     5. NORMALISE SUPABASE RECORDS
  ----------------------------------------------------------- */

  function normaliseRecord(item) {
    return {
      id: String(item.id),
      title: item.title || "Untitled opportunity",
      organisation:
        item.organization ||
        item.organisation ||
        "Organisation not specified",
      category: item.category || "Other",
      location: item.location || "Nigeria",
      eligibility:
        item.eligibility || "Check the official requirements.",
      description:
        item.description ||
        "Visit the official source for full details.",
      deadline: item.deadline || "",
      url: item.application_url || item.source_url || "",
      image_url: item.image_url || "",
      verified: Boolean(item.verified_at),
      created_at: item.created_at || ""
    };
  }

  /* -----------------------------------------------------------
     6. FILTER AND SORT OPPORTUNITIES
  ----------------------------------------------------------- */

  function getFilteredOpportunities() {
    const searchInput = $("searchInput");
    const categoryFilter = $("categoryFilter");
    const sortFilter = $("sortFilter");

    const query = searchInput
      ? searchInput.value.trim().toLowerCase()
      : "";

    const dropdownCategory = categoryFilter
      ? categoryFilter.value
      : "all";

    const selectedCategory =
      state.activeCategory !== "All"
        ? state.activeCategory
        : dropdownCategory;

    const filtered = state.opportunities.filter((item) => {
      const matchesCategory =
        !selectedCategory ||
        selectedCategory.toLowerCase() === "all" ||
        item.category.toLowerCase() ===
          selectedCategory.toLowerCase();

      const searchableText = [
        item.title,
        item.organisation,
        item.category,
        item.description,
        item.eligibility,
        item.location
      ]
        .join(" ")
        .toLowerCase();

      return matchesCategory && searchableText.includes(query);
    });

    const sort = sortFilter ? sortFilter.value : "newest";

    if (sort === "deadline") {
      filtered.sort((a, b) => {
        const aDate = timeValue(a.deadline);
        const bDate = timeValue(b.deadline);

        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;

        return aDate - bDate;
      });
    } else if (sort === "title") {
      filtered.sort((a, b) =>
        a.title.localeCompare(b.title)
      );
    } else {
      filtered.sort((a, b) =>
        timeValue(b.created_at) - timeValue(a.created_at)
      );
    }

    return filtered;
  }

  function hasActiveFilters() {
    const search = $("searchInput");
    const category = $("categoryFilter");
    const sort = $("sortFilter");

    return Boolean(
      (search && search.value.trim()) ||
      (category &&
        category.value &&
        category.value.toLowerCase() !== "all") ||
      state.activeCategory !== "All" ||
      (sort && sort.value && sort.value !== "newest")
    );
  }

  /* -----------------------------------------------------------
     7. OPPORTUNITY CARD
  ----------------------------------------------------------- */

  function buildCard(item, bookmarks) {
    const id = String(item.id);
    const saved = bookmarks.includes(id);
    const link = safeURL(item.url);
    const image = safeURL(item.image_url);
    const closed = isPastDeadline(item.deadline);

    const card = el("article", "opportunity-card card");

    // Opportunity image and fallback.
    const imageWrap = el("div", "opportunity-image-wrap");
    const img = el("img", "opportunity-image");

    img.alt = `Image for ${item.title}`;
    img.loading = "lazy";
    img.decoding = "async";

    if (image) {
      img.src = image;
    } else {
      imageWrap.classList.add("image-unavailable");
      img.hidden = true;
    }

    img.addEventListener("error", () => {
      img.removeAttribute("src");
      img.hidden = true;
      imageWrap.classList.add("image-unavailable");
    });

    imageWrap.appendChild(img);
    card.appendChild(imageWrap);

    const content = el(
      "div",
      "opportunity-card-content opportunity-card-body"
    );

    // Category and bookmark.
    const top = el("div", "card-top");

    top.appendChild(
      el("span", "badge opportunity-category", item.category)
    );

    const bookmark = el(
      "button",
      "bookmark" + (saved ? " saved" : ""),
      saved ? "★ Saved" : "☆ Save"
    );

    bookmark.type = "button";
    bookmark.dataset.bookmark = id;
    bookmark.setAttribute(
      "aria-label",
      saved ? "Remove bookmark" : "Save bookmark"
    );

    top.appendChild(bookmark);
    content.appendChild(top);

    content.appendChild(el("h3", "", item.title));

    content.appendChild(
      el("div", "org opportunity-organization", item.organisation)
    );

    content.appendChild(
      el("p", "card-desc", item.description)
    );

    const meta = el("div", "meta");

    meta.appendChild(
      el("span", "", `📍 ${item.location}`)
    );

    meta.appendChild(
      el(
        "span",
        "deadline",
        `🗓 Deadline: ${formatDate(item.deadline)}` +
          (closed ? " (closed)" : "")
      )
    );

    content.appendChild(meta);

    content.appendChild(
      el(
        "p",
        "source-status",
        item.verified
          ? "✓ Source checked"
          : "ℹ️ Verify details with the official source"
      )
    );

    const actions = el("div", "card-actions opportunity-card-actions");

    if (link) {
      const sourceLink = el(
        "a",
        "btn btn-primary button button-primary",
        "View source ↗"
      );

      sourceLink.href = link;
      sourceLink.target = "_blank";
      sourceLink.rel = "noopener noreferrer";

      actions.appendChild(sourceLink);
    } else {
      actions.appendChild(
        el("span", "btn btn-outline button button-outline", "Source not added")
      );
    }

    const trackButton = el(
      "button",
      "btn btn-outline button button-outline",
      "Track"
    );

    trackButton.type = "button";
    trackButton.dataset.track = id;

    actions.appendChild(trackButton);
    content.appendChild(actions);
    card.appendChild(content);

    return card;
  }

  /* -----------------------------------------------------------
     8. RENDER OPPORTUNITIES
  ----------------------------------------------------------- */

  function buildMessage(title, message, showRetry = false) {
    const box = el("div", "empty");
    box.appendChild(el("h3", "", title));
    box.appendChild(el("p", "", message));

    if (showRetry) {
      const retry = el("button", "btn btn-primary button button-primary", "Try Again");
      retry.type = "button";
      retry.dataset.retry = "true";
      box.appendChild(retry);
    }

    return box;
  }

  function getOrCreateViewAllButton(grid) {
    let button = $("viewAllOpportunities");

    if (button) return button;

    button = el(
      "button",
      "btn btn-primary button button-primary view-all-opportunities",
      "View All Opportunities"
    );

    button.id = "viewAllOpportunities";
    button.type = "button";
    button.hidden = true;

    grid.insertAdjacentElement("afterend", button);

    return button;
  }

  function renderOpportunities() {
    const grid = $("opportunityGrid");

    if (!grid) {
      console.error(
        "Naija Opportunity Hub: opportunityGrid element is missing."
      );
      return;
    }

    grid.textContent = "";

    const viewAllButton = getOrCreateViewAllButton(grid);

    if (state.loadState === "loading") {
      setResultsCount("Finding the latest opportunities...");
      viewAllButton.hidden = true;
      grid.appendChild(
        el("div", "loading-card", "Loading opportunities...")
      );
      return;
    }

    if (state.loadState === "error") {
      setResultsCount("Unable to load opportunities");
      viewAllButton.hidden = true;

      grid.appendChild(
        buildMessage(
          "We could not load opportunities",
          "Please check your connection and try again. If the problem continues, check the Supabase database settings.",
          true
        )
      );

      return;
    }

    const filtered = getFilteredOpportunities();
    const filtering = hasActiveFilters();

    const showEverything = filtering || state.showAll;

    const visible = showEverything
      ? filtered
      : filtered.slice(0, HOME_OPPORTUNITIES_LIMIT);

    setResultsCount(
      showEverything
        ? `${filtered.length} ${pluralizeOpportunity(filtered.length)} found`
        : `Showing ${visible.length} latest ${pluralizeOpportunity(visible.length)}`
    );

    viewAllButton.hidden =
      filtering || filtered.length <= HOME_OPPORTUNITIES_LIMIT;

    viewAllButton.textContent = state.showAll
      ? `Show Latest ${HOME_OPPORTUNITIES_LIMIT}`
      : `View All Opportunities (${filtered.length})`;

    if (state.opportunities.length === 0) {
      viewAllButton.hidden = true;

      grid.appendChild(
        buildMessage(
          "No opportunities published yet",
          "New opportunities will appear here when they are published."
        )
      );

      return;
    }

    if (filtered.length === 0) {
      viewAllButton.hidden = true;

      grid.appendChild(
        buildMessage(
          "No matching opportunities",
          "Try another keyword or category, or clear your filters."
        )
      );

      return;
    }

    const bookmarks = getBookmarks();
    const fragment = document.createDocumentFragment();

    visible.forEach((item) => {
      fragment.appendChild(buildCard(item, bookmarks));
    });

    grid.appendChild(fragment);
  }

  /* -----------------------------------------------------------
     9. CATEGORY BUTTON STATE
  ----------------------------------------------------------- */

  function syncCategoryButtons() {
    const categoryFilter = $("categoryFilter");

    let activeCategory = state.activeCategory;

    if (activeCategory === "All" && categoryFilter) {
      activeCategory =
        categoryFilter.value &&
        categoryFilter.value.toLowerCase() !== "all"
          ? categoryFilter.value
          : "All";
    }

    document.querySelectorAll(".category-button").forEach((button) => {
      const category = button.dataset.category || "All";

      const active =
        category.toLowerCase() === activeCategory.toLowerCase() ||
        (category.toLowerCase() === "all" &&
          activeCategory.toLowerCase() === "all");

      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function resetViewAll() {
    state.showAll = false;
  }

  /* -----------------------------------------------------------
     10. APPLICATION TRACKER
  ----------------------------------------------------------- */

  function renderTracker() {
    const list = $("trackerList");

    if (!list) return;

    const tracker = getTracker();
    list.textContent = "";

    if (tracker.length === 0) {
      const empty = el("div", "empty");

      empty.appendChild(el("strong", "", "Your tracker is empty."));
      empty.appendChild(
        el("p", "", "Tap Track on an opportunity to add it here.")
      );

      list.appendChild(empty);
      return;
    }

    tracker.forEach((item) => {
      const row = el("div", "tracker-item");
      const info = el("div", "tracker-info");

      info.appendChild(
        el("strong", "", item.title || "Untitled opportunity")
      );

      info.appendChild(
        el("small", "", item.organisation || "")
      );

      row.appendChild(info);

      const select = el("select");
      select.dataset.status = String(item.id);

      select.setAttribute(
        "aria-label",
        `Application status for ${item.title || "this opportunity"}`
      );

      TRACKER_STATUSES.forEach((status) => {
        const option = el("option", "", status);
        option.value = status;
        option.selected = (item.status || "Interested") === status;
        select.appendChild(option);
      });

      row.appendChild(select);

      const remove = el("button", "bookmark", "✕");
      remove.type = "button";
      remove.dataset.removeTrack = String(item.id);
      remove.setAttribute("aria-label", "Remove from tracker");

      row.appendChild(remove);
      list.appendChild(row);
    });
  }

  function trackOpportunity(id) {
    const item = state.opportunities.find(
      (opportunity) => String(opportunity.id) === String(id)
    );

    if (!item) return;

    const tracker = getTracker();

    if (tracker.some((row) => String(row.id) === String(id))) {
      showToast("This opportunity is already in your tracker.");
      return;
    }

    tracker.unshift({
      id: String(item.id),
      title: item.title,
      organisation: item.organisation,
      status: "Interested",
      addedAt: new Date().toISOString()
    });

    if (saveTracker(tracker)) {
      renderTracker();
      showToast("Added to your application tracker.");
    }
  }

  function exportCSV() {
    const tracker = getTracker();

    if (tracker.length === 0) {
      showToast("Your tracker is empty.");
      return;
    }

    const csvCell = (value) => {
      let text = String(
        value === null || value === undefined ? "" : value
      );

      // Protect spreadsheet users from formula injection.
      if (/^[=+\-@\t\r]/.test(text)) {
        text = "'" + text;
      }

      return '"' + text.replace(/"/g, '""') + '"';
    };

    const rows = [
      ["Title", "Organisation", "Status", "Added on"],
      ...tracker.map((item) => [
        item.title,
        item.organisation,
        item.status,
        item.addedAt
      ])
    ];

    const csv = rows
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "naija-opportunity-tracker.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* -----------------------------------------------------------
     11. LOAD OPPORTUNITIES FROM SUPABASE
  ----------------------------------------------------------- */

  async function requestOpportunities(includeImageColumn = true) {
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

    if (includeImageColumn) {
      columns.push("image_url");
    }

    return supabaseClient
      .from("opportunities")
      .select(columns.join(","))
      .eq("status", "published")
      .order("created_at", { ascending: false });
  }

  function failLoad(message, error) {
    console.error(
      "Naija Opportunity Hub: could not load opportunities.",
      error || message
    );

    state.opportunities = [];
    state.loadState = "error";

    if (DEBUG) {
      setDataStatus(
        "Database request failed",
        "Debug: " + message
      );
    } else {
      setDataStatus(
        "",
        "We couldn't connect to the opportunities database. Please try again shortly."
      );
    }

    renderOpportunities();
  }

  async function loadOpportunities() {
    state.loadState = "loading";

    setDataStatus("", "");
    renderOpportunities();

    if (!SUPABASE_PUBLISHABLE_KEY.trim()) {
      failLoad("Supabase publishable key is missing.");
      return;
    }

    if (
      !window.supabase ||
      typeof window.supabase.createClient !== "function"
    ) {
      failLoad(
        "The Supabase JavaScript library did not load. Check index.html."
      );
      return;
    }

    try {
      if (!supabaseClient) {
        supabaseClient = window.supabase.createClient(
          SUPABASE_URL,
          SUPABASE_PUBLISHABLE_KEY
        );
      }

      let response = await requestOpportunities(true);

      // Compatibility fallback: older database schemas may not have
      // an image_url column. Retry without it rather than losing all data.
      if (
        response.error &&
        /image_url|column/i.test(response.error.message || "")
      ) {
        console.warn(
          "The image_url column may be missing. Retrying without it."
        );

        response = await requestOpportunities(false);
      }

      if (response.error) {
        throw response.error;
      }

      state.opportunities = (response.data || []).map(normaliseRecord);
      state.loadState = "ready";

      setDataStatus("", "");

      if (state.opportunities.length === 0) {
        setDataStatus(
          "",
          "No published opportunities were found. Check that your Supabase records have status set to published."
        );
      }

      syncCategoryButtons();
      renderOpportunities();
    } catch (error) {
      const message =
        error && error.message ? error.message : String(error);

      failLoad(message, error);
    }
  }

  /* -----------------------------------------------------------
     12. NAVIGATION
  ----------------------------------------------------------- */

  function setupNavigation() {
    const menuButton = $("menuBtn");
    const navigation = $("navLinks");

    if (!menuButton || !navigation) return;

    menuButton.addEventListener("click", () => {
      const isOpen = navigation.classList.toggle("open");

      menuButton.setAttribute("aria-expanded", String(isOpen));
    });

    navigation.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navigation.classList.remove("open");
        menuButton.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* -----------------------------------------------------------
     13. SEARCH AND FILTER EVENTS
  ----------------------------------------------------------- */

  function setupFilters() {
    const searchInput = $("searchInput");
    const sortFilter = $("sortFilter");
    const categoryFilter = $("categoryFilter");
    const clearFilters = $("clearFilters");

    if (searchInput) {
      searchInput.addEventListener(
        "input",
        debounce(() => {
          resetViewAll();
          renderOpportunities();
        }, SEARCH_DELAY_MS)
      );
    }

    if (sortFilter) {
      sortFilter.addEventListener("change", () => {
        resetViewAll();
        renderOpportunities();
      });
    }

    if (categoryFilter) {
      categoryFilter.addEventListener("change", () => {
        state.activeCategory = "All";
        resetViewAll();
        syncCategoryButtons();
        renderOpportunities();
      });
    }

    if (clearFilters) {
      clearFilters.addEventListener("click", () => {
        if (searchInput) searchInput.value = "";
        if (categoryFilter) categoryFilter.value = "all";
        if (sortFilter) sortFilter.value = "newest";

        state.activeCategory = "All";
        resetViewAll();

        syncCategoryButtons();
        renderOpportunities();
      });
    }

    // Category buttons and category cards use data-category.
    // This supports both the homepage and the category tiles.
    document.addEventListener("click", (event) => {
      const button = event.target.closest(
        ".category-button, .category-card[data-category]"
      );

      if (!button) return;

      const category = button.dataset.category || "All";
      const current = state.activeCategory;

      const sameCategory =
        current.toLowerCase() === category.toLowerCase();

      state.activeCategory =
        category.toLowerCase() === "all" || sameCategory
          ? "All"
          : category;

      if (categoryFilter) {
        categoryFilter.value =
          state.activeCategory === "All"
            ? "all"
            : state.activeCategory;
      }

      resetViewAll();
      syncCategoryButtons();
      renderOpportunities();

      const section = $("opportunities");

      if (
        section &&
        typeof section.scrollIntoView === "function"
      ) {
        section.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
    });
  }

  /* -----------------------------------------------------------
     14. OPPORTUNITY GRID EVENTS
  ----------------------------------------------------------- */

  function setupOpportunityGrid() {
    const grid = $("opportunityGrid");

    if (!grid) return;

    document.addEventListener("click", (event) => {
      const button = event.target.closest("#viewAllOpportunities");

      if (!button) return;

      state.showAll = !state.showAll;
      renderOpportunities();
    });

    grid.addEventListener("click", (event) => {
      if (event.target.closest("[data-retry]")) {
        loadOpportunities();
        return;
      }

      const bookmarkButton = event.target.closest("[data-bookmark]");

      if (bookmarkButton) {
        const id = String(bookmarkButton.dataset.bookmark);
        const bookmarks = getBookmarks();
        const alreadySaved = bookmarks.includes(id);

        const updated = alreadySaved
          ? bookmarks.filter((item) => item !== id)
          : bookmarks.concat(id);

        if (saveBookmarks(updated)) {
          renderOpportunities();

          showToast(
            alreadySaved
              ? "Bookmark removed."
              : "Opportunity saved."
          );
        }

        return;
      }

      const trackButton = event.target.closest("[data-track]");

      if (trackButton) {
        trackOpportunity(trackButton.dataset.track);
      }
    });
  }

  /* -----------------------------------------------------------
     15. TRACKER EVENTS
  ----------------------------------------------------------- */

  function setupTracker() {
    const trackerList = $("trackerList");
    const exportButton = $("exportTracker");
    const clearTrackerButton = $("clearTracker");

    if (trackerList) {
      trackerList.addEventListener("change", (event) => {
        const select = event.target.closest("[data-status]");

        if (!select) return;

        const tracker = getTracker();

        const item = tracker.find(
          (row) => String(row.id) === String(select.dataset.status)
        );

        if (item) {
          item.status = select.value;

          if (saveTracker(tracker)) {
            showToast("Application status updated.");
          }
        }
      });

      trackerList.addEventListener("click", (event) => {
        const button = event.target.closest("[data-remove-track]");

        if (!button) return;

        const remaining = getTracker().filter(
          (row) =>
            String(row.id) !== String(button.dataset.removeTrack)
        );

        if (saveTracker(remaining)) {
          renderTracker();
          showToast("Removed from tracker.");
        }
      });
    }

    if (exportButton) {
      exportButton.addEventListener("click", exportCSV);
    }

    if (clearTrackerButton) {
      clearTrackerButton.addEventListener("click", () => {
        if (getTracker().length === 0) {
          showToast("Your tracker is already empty.");
          return;
        }

        const confirmed = window.confirm(
          "Clear all items from your application tracker on this device?"
        );

        if (confirmed && saveTracker([])) {
          renderTracker();
          showToast("Tracker cleared.");
        }
      });
    }
  }

  /* -----------------------------------------------------------
     16. INITIALISE
  ----------------------------------------------------------- */

  function initialise() {
    setupNavigation();
    setupFilters();
    setupOpportunityGrid();
    setupTracker();

    const year = $("year");

    if (year) {
      year.textContent = String(new Date().getFullYear());
    }

    syncCategoryButtons();
    renderTracker();
    loadOpportunities();
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialise,
      { once: true }
    );
  } else {
    initialise();
  }
})();
