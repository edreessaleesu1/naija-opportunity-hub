/*
 * NAIJA OPPORTUNITY HUB — Main Front-End Application
 * Version 3.8 | British English | 3-element opportunity cards
 * (clickable image + clickable title + Save Opportunity button)
 *
 * Saved opportunities live in the visitor's account dashboard (auth.js).
 * This file only shows the opportunities and the Save button.
 */
(() => {
  "use strict";

  /* ------------------------------------------------------------------
     1. CONFIGURATION
     ------------------------------------------------------------------ */
  const SUPABASE_URL = "https://djxornmwvkauhkcuhgxc.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_EDReCY3JcN4vMuypVfqcMQ_GcTEVuBq";
  const TABLE_NAME = "opportunities";

  // Relative link, so it works on every domain the site is served from.
  const DETAILS_PAGE = "opportunity-details.html";

  const DEFAULT_VISIBLE_COUNT = 6;
  const FALLBACK_IMAGE =
    "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=900&auto=format&fit=crop&q=80";
  const DEBUG = new URLSearchParams(location.search).get("debug") === "1";

  const getElement = (...ids) =>
    ids.map(id => document.getElementById(id)).find(Boolean) || null;

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
    loading: getElement("loadingState", "opportunitiesLoading"),
    empty: getElement("emptyState", "noOpportunities"),
    error: getElement("errorState", "opportunitiesError"),
    toast: getElement("toast")
  };

  /* ------------------------------------------------------------------
     2. STATE
     ------------------------------------------------------------------ */
  let allOpportunities = [];
  let filteredOpportunities = [];
  let activeCategory = "All";
  let showAll = false;
  let isLoading = false;
  let toastTimer = null;

  /* ------------------------------------------------------------------
     3. HELPERS
     ------------------------------------------------------------------ */
  function debugLog(...args) {
    if (DEBUG) console.log("[NOH]", ...args);
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

  function isAllCategory(value) {
    return !value || normalise(value) === "all";
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
    return `${DETAILS_PAGE}?id=${encodeURIComponent(String(id))}`;
  }

  // Parse date-only values as local dates to avoid UTC timezone shifts.
  function parseDate(value) {
    if (!value) return null;
    const raw = String(value);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    const date = match
      ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
      : new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function dateTimestamp(value) {
    const date = parseDate(value);
    return date ? date.getTime() : null;
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
    el.toast.hidden = false;
    el.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.toast.classList.remove("show");
      el.toast.hidden = true;
    }, 2800);
  }

  /* ------------------------------------------------------------------
     4. SAVED OPPORTUNITIES (stored by auth.js as window.NOH_BOOKMARKS)
     ------------------------------------------------------------------ */
  function isSaved(id) {
    return Boolean(window.NOH_BOOKMARKS?.isSaved(id));
  }

  async function isSignedIn() {
    try {
      const client = window.NOH_SUPABASE_CLIENT;
      if (!client) return false;

      const { data } = await client.auth.getSession();
      return Boolean(data?.session?.user);
    } catch (error) {
      console.warn("NOH: Could not check the sign-in session.", error);
      return false;
    }
  }

  async function toggleSaved(id) {
    if (!window.NOH_BOOKMARKS) {
      showToast("Saving is unavailable right now. Please refresh the page.");
      return;
    }

    // Saved opportunities belong to the visitor's account.
    if (!(await isSignedIn())) {
      showToast("Please sign in to save opportunities.");

      setTimeout(() => {
        window.location.assign(
          "/auth.html?mode=login&redirect=" + encodeURIComponent("/#opportunities")
        );
      }, 1400);

      return;
    }

    try {
      const nowSaved = window.NOH_BOOKMARKS.toggle(id);

      showToast(
        nowSaved
          ? "Saved. Find it under My Saved Opportunities."
          : "Removed from your saved opportunities."
      );
      // The card button refreshes through the "noh:bookmarks-updated" event.
    } catch (error) {
      console.error("NOH: Could not update saved opportunities.", error);
      showToast("We could not save that. Please try again.");
    }
  }

  /* ------------------------------------------------------------------
     5. DATA (Supabase REST)
     ------------------------------------------------------------------ */
  async function fetchOpportunities(includeImages = true) {
    const columns = [
      "id", "title", "organization", "category", "description", "eligibility",
      "location", "application_url", "source_url", "deadline", "status",
      "verified_at", "created_at"
    ];
    if (includeImages) columns.push("image_url");

    const query = new URLSearchParams({
      select: columns.join(","),
      status: "eq.published",
      order: "created_at.desc"
    });

    const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE_NAME}?${query}`, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        Accept: "application/json"
      }
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      const error = new Error(
        result?.message || result?.details || `Supabase request failed: ${response.status}`
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
        item.organization || item.organisation || "Organisation not specified"
      ).trim(),
      category: String(item.category || "Other").trim(),
      description: String(item.description || "").trim(),
      eligibility: String(item.eligibility || "").trim(),
      location: String(item.location || "").trim(),
      image_url: safeURL(item.image_url || ""),
      application_url: safeURL(item.application_url || item.source_url || ""),
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
    if (el.status) el.status.textContent = "Loading opportunities…";
    if (el.grid) el.grid.innerHTML = "";

    try {
      let data;

      try {
        data = await fetchOpportunities(true);
      } catch (error) {
        const missingImageColumn =
          /image_url|column.*does not exist|schema cache/i.test(error.message);
        if (!missingImageColumn) throw error;

        debugLog("image_url column missing; retrying without it.");
        data = await fetchOpportunities(false);

        if (el.notice) {
          el.notice.textContent =
            "Opportunity images are not configured in the database yet.";
          showElement(el.notice, true);
        }
      }

      allOpportunities = data.map(normaliseOpportunity).filter(item => item.id);
      debugLog("Loaded opportunities:", allOpportunities.length);

      populateCategorySelect();
      applyFilters();

      if (el.status) {
        el.status.textContent =
          `${allOpportunities.length} published opportunities available`;
      }
    } catch (error) {
      console.error("Unable to load opportunities:", error);

      if (el.status) el.status.textContent = "Unable to load opportunities.";

      const detail = DEBUG ? `<pre>${escapeHTML(error.message)}</pre>` : "";
      const markup = `
        <div class="empty-state">
          <h3>Unable to load opportunities</h3>
          <p>Please check your internet connection and try again.</p>
          <button type="button" class="button button-primary" id="retryOpportunities">Try Again</button>
          ${detail}
        </div>`;

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

  /* ------------------------------------------------------------------
     6. FILTERING AND SORTING
     ------------------------------------------------------------------ */

  // Fills the category dropdown from the data so it is never empty.
  function populateCategorySelect() {
    if (!el.category) return;

    // Keep the options already written in index.html. Only build them from
    // the data when the dropdown has no real choices.
    if (el.category.options.length > 1) return;

    const categories = [...new Set(allOpportunities.map(item => item.category))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "en-GB"));

    el.category.innerHTML =
      `<option value="all">All categories</option>` +
      categories
        .map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`)
        .join("");
  }

  function syncCategorySelect() {
    if (!el.category) return;

    if (isAllCategory(activeCategory)) {
      const all = Array.from(el.category.options).find(o => isAllCategory(o.value));
      el.category.value = all ? all.value : "all";
      return;
    }

    const match = Array.from(el.category.options).find(
      option => normalise(option.value) === normalise(activeCategory)
    );
    el.category.value = match ? match.value : "all";
  }

  function applyFilters() {
    const term = normalise(el.search?.value || "");

    syncCategorySelect();

    filteredOpportunities = allOpportunities.filter(item => {
      const categoryMatch =
        isAllCategory(activeCategory) ||
        normalise(item.category) === normalise(activeCategory);

      const searchable = [
        item.title, item.organization, item.category,
        item.description, item.eligibility, item.location
      ].join(" ");

      return categoryMatch && (!term || normalise(searchable).includes(term));
    });

    sortOpportunities();
    renderOpportunities();
  }

  function sortOpportunities() {
    const mode = el.sort?.value || "newest";

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Upcoming deadlines first, then past ones, then no deadline.
    const priority = d => (d === null ? 3 : d >= today.getTime() ? 1 : 2);

    filteredOpportunities.sort((a, b) => {
      if (mode === "title") return a.title.localeCompare(b.title, "en-GB");

      if (mode === "deadline") {
        const da = dateTimestamp(a.deadline);
        const db = dateTimestamp(b.deadline);
        const diff = priority(da) - priority(db);
        return diff || (da === null || db === null ? 0 : da - db);
      }

      // "newest" (also matches the "Newest first" label)
      return (dateTimestamp(b.created_at) || 0) - (dateTimestamp(a.created_at) || 0);
    });
  }

  function resetFilters() {
    activeCategory = "All";
    showAll = false;

    if (el.search) el.search.value = "";
    if (el.sort) el.sort.value = "newest";

    applyFilters();
  }

  function selectCategory(category) {
    activeCategory = isAllCategory(category) ? "All" : category;
    showAll = false;
    applyFilters();
  }

  /* ------------------------------------------------------------------
     7. RENDERING — OPPORTUNITY CARDS
     Card = clickable image + clickable title + Save button.
     ------------------------------------------------------------------ */
  function createOpportunityCard(item) {
    const id = escapeHTML(item.id);
    const title = escapeHTML(item.title);
    const url = escapeHTML(detailsURL(item.id));
    const image = escapeHTML(item.image_url || FALLBACK_IMAGE);
    const saved = isSaved(item.id);

    return `
      <article class="opportunity-card" data-id="${id}">
        <div class="opportunity-image">
          <a class="opportunity-image-link" href="${url}" aria-label="View ${title}">
            <img
              src="${image}"
              alt="${title}"
              loading="lazy"
              onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}'"
            >
          </a>
        </div>

        <div class="opportunity-content">
          <h3 class="opportunity-title">
            <a class="opportunity-title-link" href="${url}">${title}</a>
          </h3>

          <button
            type="button"
            class="save-btn ${saved ? "is-saved" : ""}"
            data-action="save"
            data-id="${id}"
            aria-pressed="${saved}"
          >${saved ? "✓ Saved" : "Save Opportunity"}</button>
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

    el.grid.innerHTML = visible.map(createOpportunityCard).join("");

    const hasResults = filteredOpportunities.length > 0;

    if (el.empty) {
      el.empty.textContent = "No opportunities found. Try another search or category.";
      showElement(el.empty, !hasResults);
    } else if (!hasResults) {
      el.grid.innerHTML = `
        <div class="empty-state">
          <h3>No opportunities found</h3>
          <p>Try another search or category.</p>
        </div>`;
    }

    if (el.results) {
      const n = filteredOpportunities.length;
      el.results.textContent = `${n} ${n === 1 ? "opportunity" : "opportunities"} found`;
    }

    if (el.viewAll) {
      const extra = filteredOpportunities.length - DEFAULT_VISIBLE_COUNT;

      showElement(el.viewAll, extra > 0);
      el.viewAll.textContent = showAll ? "View Less" : `View More (${extra} more)`;
      el.viewAll.setAttribute("aria-expanded", String(showAll));
    }

    syncCategoryButtons();
  }

  function syncCategoryButtons() {
    const container = getElement("categoryButtons");
    if (!container) return;

    container.querySelectorAll("[data-category]").forEach(button => {
      const active = isAllCategory(activeCategory)
        ? isAllCategory(button.dataset.category)
        : normalise(button.dataset.category) === normalise(activeCategory);

      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  /* ------------------------------------------------------------------
     8. EVENTS
     ------------------------------------------------------------------ */
  function setupEvents() {
    el.search?.addEventListener("input", () => {
      showAll = false;
      applyFilters();
    });

    el.category?.addEventListener("change", () => selectCategory(el.category.value));
    el.sort?.addEventListener("change", applyFilters);
    el.clearFilters?.addEventListener("click", resetFilters);

    el.viewAll?.addEventListener("click", () => {
      showAll = !showAll;
      renderOpportunities();

      // After collapsing, bring the top of the list back into view.
      if (!showAll) {
        document.getElementById("opportunities")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });

    getElement("refreshOpportunities", "refreshBtn")
      ?.addEventListener("click", loadOpportunities);

    getElement("categoryButtons")?.addEventListener("click", event => {
      const button = event.target.closest("[data-category]");
      if (button) {
        event.preventDefault();
        selectCategory(button.dataset.category || "All");
      }
    });

    el.grid?.addEventListener("click", event => {
      const button = event.target.closest('[data-action="save"]');
      if (button && el.grid.contains(button)) toggleSaved(button.dataset.id);
    });

    // Keep the Save buttons in step when something is saved or removed
    // (from the dashboard, another tab, or after signing in).
    window.addEventListener("noh:bookmarks-updated", renderOpportunities);
    window.addEventListener("storage", event => {
      if (event.key === "noh_bookmarks_v1") renderOpportunities();
    });

    document.addEventListener("click", event => {
      if (event.target.closest("#retryOpportunities")) loadOpportunities();
    });
  }

  /* ------------------------------------------------------------------
     9. INIT
     ------------------------------------------------------------------ */
  function init() {
    debugLog("Naija Opportunity Hub v3.8 initialising");
    setupEvents();
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
