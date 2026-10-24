/*
 * Naija Opportunity Hub
 * Front-end application script.
 * Loads published opportunities from Supabase and provides search,
 * filtering, bookmarks and a local application tracker.
 */
(() => {
"use strict";

/* ---------------------------------------------------------------
   Configuration
---------------------------------------------------------------- */

const SUPABASE_URL = "https://djxornmwvkauhkcuhgxc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_EDReCY3JcN4vMuypVfqcMQ_GcTEVuBq";

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

const SEARCH_DELAY_MS = 200;
const TOAST_DURATION_MS = 3500;

/* Add ?debug=1 to the page address to see technical error details. */
const DEBUG = /(?:^|[?&])debug=1(?:&|$)/.test(window.location.search || "");

/* ---------------------------------------------------------------
   Application state
---------------------------------------------------------------- */

const state = {
  opportunities: [],
  activeCategory: "All",
  loadState: "loading"
};

/* ---------------------------------------------------------------
   Utilities
---------------------------------------------------------------- */

const $ = (id) => document.getElementById(id);

function el(tag, className, text) {
  const node = document.createElement(tag);

  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;

  return node;
}

function debounce(callback, delay) {
  let timer = null;

  return function () {
    clearTimeout(timer);
    timer = setTimeout(callback, delay);
  };
}

function safeURL(value) {
  try {
    const url = new URL(String(value || ""));

    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : "";
  } catch (error) {
    return "";
  }
}

function parseDate(value) {
  if (!value) return null;

  const text = String(value);
  const parsed = new Date(text.length === 10 ? text + "T00:00:00" : text);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value) {
  const date = parseDate(value);

  if (!date) return "Check official source";

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

function showToast(message) {
  const toast = $("toast");

  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, TOAST_DURATION_MS);
}

function setDataStatus(status, notice) {
  const statusElement = $("dataStatus");
  const noticeElement = $("dataNotice");

  if (statusElement) statusElement.textContent = status || "";

  if (noticeElement) {
    noticeElement.textContent = notice || "";
    noticeElement.hidden = !notice;
  }
}

/* ---------------------------------------------------------------
   Local storage
---------------------------------------------------------------- */

function readList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));

    return Array.isArray(value) ? value : [];
  } catch (error) {
    return [];
  }
}

function writeList(key, items, failureMessage) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
    return true;
  } catch (error) {
    console.error(failureMessage, error);
    showToast(failureMessage);
    return false;
  }
}

function getBookmarks() {
  return readList(STORAGE.bookmarks);
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

/* ---------------------------------------------------------------
   Opportunity cards
---------------------------------------------------------------- */

function buildCard(item, bookmarks) {
  const id = String(item.id);
  const saved = bookmarks.includes(id);
  const link = safeURL(item.url);
  const image = safeURL(item.image_url);
  const badgeText = item.verified ? "Source checked" : "Check source";
  const closed = isPastDeadline(item.deadline);

  const card = el("article", "card");

  if (image) {
    const img = el("img", "opportunity-image");

    img.src = image;
    img.alt = item.title || "";
    img.loading = "lazy";

    img.addEventListener("error", () => {
      img.style.display = "none";
    });

    card.appendChild(img);
  }

  const top = el("div", "card-top");

  top.appendChild(el("span", "badge", item.category || "Opportunity"));

  const bookmark = el(
    "button",
    "bookmark" + (saved ? " saved" : ""),
    saved ? "\u2605 Saved" : "\u2606 Save"
  );

  bookmark.type = "button";
  bookmark.dataset.bookmark = id;
  bookmark.setAttribute(
    "aria-label",
    saved ? "Remove bookmark" : "Save bookmark"
  );

  top.appendChild(bookmark);
  card.appendChild(top);

  card.appendChild(el("h3", "", item.title || "Untitled opportunity"));

  card.appendChild(
    el("div", "org", item.organisation || "Organisation not specified")
  );

  card.appendChild(
    el(
      "p",
      "card-desc",
      item.description || "Visit the official source for full details."
    )
  );

  const meta1 = el("div", "meta");

  meta1.appendChild(
    el("span", "", "\uD83D\uDCCD " + (item.location || "Nigeria"))
  );

  meta1.appendChild(
    el(
      "span",
      "",
      "\uD83D\uDDD3\uFE0F Deadline: " +
        formatDate(item.deadline) +
        (closed ? " (closed)" : "")
    )
  );

  card.appendChild(meta1);

  const meta2 = el("div", "meta");

  meta2.appendChild(
    el(
      "span",
      "",
      (item.verified ? "\u2713 " : "\u2139\uFE0F ") + badgeText
    )
  );

  card.appendChild(meta2);

  const actions = el("div", "card-actions");

  if (link) {
    const sourceLink = el("a", "button button-primary", "View source \u2197");

    sourceLink.href = link;
    sourceLink.target = "_blank";
    sourceLink.rel = "noopener noreferrer";

    actions.appendChild(sourceLink);
  } else {
    actions.appendChild(el("span", "button button-outline", "Source not added"));
  }

  const trackButton = el("button", "button button-outline", "Track");

  trackButton.type = "button";
  trackButton.dataset.track = id;

  actions.appendChild(trackButton);
  card.appendChild(actions);

  return card;
}

function getFilteredOpportunities() {
  const searchInput = $("searchInput");
  const categoryFilter = $("categoryFilter");
  const sortFilter = $("sortFilter");

  const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const category = categoryFilter ? categoryFilter.value : "All";
  const sort = sortFilter ? sortFilter.value : "newest";

  const results = state.opportunities.filter((item) => {
    const searchableText = [
      item.title,
      item.organisation,
      item.category,
      item.location,
      item.description,
      item.eligibility
    ]
      .map((part) => String(part === null || part === undefined ? "" : part))
      .join(" ")
      .toLowerCase();

    const itemCategory = String(item.category || "").toLowerCase();

    const matchesQuery = !query || searchableText.includes(query);

    const matchesDropdown =
      category === "All" || itemCategory === String(category).toLowerCase();

    const matchesButton =
      state.activeCategory === "All" ||
      itemCategory === String(state.activeCategory).toLowerCase();

    return matchesQuery && matchesDropdown && matchesButton;
  });

  if (sort === "title") {
    results.sort((a, b) => String(a.title).localeCompare(String(b.title)));
  } else if (sort === "deadline") {
    results.sort((a, b) => {
      const aTime = timeValue(a.deadline);
      const bTime = timeValue(b.deadline);

      if (!aTime && !bTime) return 0;
      if (!aTime) return 1;
      if (!bTime) return -1;

      return aTime - bTime;
    });
  } else {
    results.sort((a, b) => timeValue(b.created_at) - timeValue(a.created_at));
  }

  return results;
}

function buildMessage(title, text, retry) {
  const box = el("div", "empty");

  box.appendChild(el("h3", "", title));
  box.appendChild(el("p", "", text));

  if (retry) {
    const retryButton = el("button", "button button-outline", "Try again");

    retryButton.type = "button";
    retryButton.dataset.retry = "true";

    box.appendChild(retryButton);
  }

  return box;
}
function renderOpportunities() {
const grid = $("opportunityGrid");
const resultsCount = $("resultsCount");

if (!grid) {
console.error("Opportunity Hub: the opportunityGrid element is missing.");
return;
}

grid.textContent = "";

// Find or create the View All button.
let viewAllButton = $("viewAllOpportunities");

if (!viewAllButton) {
viewAllButton = el(
"button",
"button button-primary view-all-opportunities",
"View All Opportunities"
);

viewAllButton.id = "viewAllOpportunities";
viewAllButton.type = "button";
viewAllButton.hidden = true;

grid.insertAdjacentElement("afterend", viewAllButton);

}

const hasActiveFilters = () => {
const search = $("searchInput");
const category = $("categoryFilter");
const sort = $("sortFilter");

return Boolean(
  (search && search.value.trim()) ||
  (category && category.value !== "All") ||
  state.activeCategory !== "All" ||
  (sort && sort.value && sort.value !== "newest")
);

};

// Show a loading state while Supabase responds.
if (state.loadState === "loading") {
if (resultsCount) {
resultsCount.textContent = "Finding the latest opportunities...";
}

viewAllButton.hidden = true;
grid.appendChild(el("div", "loading-card", "Loading opportunities..."));
return;

}

// Show an error and allow visitors to retry.
if (state.loadState === "error") {
if (resultsCount) resultsCount.textContent = "Unable to load";

viewAllButton.hidden = true;

grid.appendChild(
  buildMessage(
    "We could not load opportunities",
    "Please check your internet connection and try again.",
    true
  )
);
return;

}

const filtered = getFilteredOpportunities();
const showAll = viewAllButton.dataset.showAll === "true";
const filtering = hasActiveFilters();

// When searching or filtering, show every matching result.
// Otherwise, show just the six newest on the homepage.
const visible = filtering || showAll
? filtered
: filtered.slice(0, HOME_OPPORTUNITIES_LIMIT);

if (resultsCount) {
if (filtering || showAll) {
resultsCount.textContent =
filtered.length +
" opportunit" +
(filtered.length === 1 ? "y" : "ies") +
" found";
} else {
resultsCount.textContent =
"Showing " +
visible.length +
" latest opportunit" +
(visible.length === 1 ? "y" : "ies");
function renderOpportunities() {
const grid = $("opportunityGrid");
const resultsCount = $("resultsCount");

if (!grid) {
console.error("Opportunity Hub: the opportunityGrid element is missing.");
return;
}

grid.textContent = "";

// Find or create the View All button.
let viewAllButton = $("viewAllOpportunities");

if (!viewAllButton) {
viewAllButton = el(
"button",
"button button-primary view-all-opportunities",
"View All Opportunities"
);

viewAllButton.id = "viewAllOpportunities";
viewAllButton.type = "button";
viewAllButton.hidden = true;

grid.insertAdjacentElement("afterend", viewAllButton);

}

const hasActiveFilters = () => {
const search = $("searchInput");
const category = $("categoryFilter");
const sort = $("sortFilter");

return Boolean(
  (search && search.value.trim()) ||
  (category && category.value !== "All") ||
  state.activeCategory !== "All" ||
  (sort && sort.value && sort.value !== "newest")
);

};

// Show a loading state while Supabase responds.
if (state.loadState === "loading") {
if (resultsCount) {
resultsCount.textContent = "Finding the latest opportunities...";
}

viewAllButton.hidden = true;
grid.appendChild(el("div", "loading-card", "Loading opportunities..."));
return;

}

// Show an error and allow visitors to retry.
if (state.loadState === "error") {
if (resultsCount) resultsCount.textContent = "Unable to load";

viewAllButton.hidden = true;

grid.appendChild(
  buildMessage(
    "We could not load opportunities",
    "Please check your internet connection and try again.",
    true
  )
);
return;

}

const filtered = getFilteredOpportunities();
const showAll = viewAllButton.dataset.showAll === "true";
const filtering = hasActiveFilters();

// When searching or filtering, show every matching result.
// Otherwise, show just the six newest on the homepage.
const visible = filtering || showAll
? filtered
: filtered.slice(0, HOME_OPPORTUNITIES_LIMIT);

if (resultsCount) {
if (filtering || showAll) {
resultsCount.textContent =
filtered.length +
" opportunit" +
(filtered.length === 1 ? "y" : "ies") +
" found";
} else {
resultsCount.textContent =
"Showing " +
visible.length +
" latest opportunit" +
(visible.length === 1 ? "y" : "ies");
}
}

viewAllButton.hidden = filtering || filtered.length <= HOME_OPPORTUNITIES_LIMIT;

viewAllButton.textContent = showAll
? "Show Latest 6"
: "View All Opportunities (" + filtered.length + ")";

if (state.opportunities.length === 0) {
viewAllButton.hidden = true;

grid.appendChild(
  buildMessage(
    "No opportunities published yet",
    "New opportunities are added regularly. Please check back soon.",
    false
  )
);
return;

}

if (filtered.length === 0) {
viewAllButton.hidden = true;

grid.appendChild(
  buildMessage(
    "No matching opportunities",
    "Try another keyword or clear the filters.",
    false
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

/* ---------------------------------------------------------------
   Application tracker
---------------------------------------------------------------- */

function renderTracker() {
  const list = $("trackerList");

  if (!list) return;

  const tracker = getTracker();

  list.textContent = "";

  if (tracker.length === 0) {
    const empty = el("div", "empty");

    empty.appendChild(el("strong", "", "Your tracker is empty."));
    empty.appendChild(el("p", "", "Tap Track on an opportunity to add it here."));

    list.appendChild(empty);
    return;
  }

  tracker.forEach((item) => {
    const row = el("div", "tracker-item");
    const info = el("div");

    info.appendChild(el("strong", "", item.title || "Untitled opportunity"));
    info.appendChild(el("small", "", item.organisation || ""));
    row.appendChild(info);

    const select = el("select");

    select.dataset.status = String(item.id);
    select.setAttribute(
      "aria-label",
      "Application status for " + (item.title || "this opportunity")
    );

    TRACKER_STATUSES.forEach((status) => {
      const option = el("option", "", status);

      option.value = status;
      option.selected = item.status === status;

      select.appendChild(option);
    });

    row.appendChild(select);

    const remove = el("button", "bookmark", "\u2715");

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

  const cell = (value) => {
    let text = String(value === null || value === undefined ? "" : value);

    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;

    return '"' + text.replace(/"/g, '""') + '"';
  };

  const rows = [["Title", "Organisation", "Status", "Added on"]].concat(
    tracker.map((item) => [
      item.title,
      item.organisation,
      item.status,
      item.addedAt
    ])
  );

  const csv = rows.map((row) => row.map(cell).join(",")).join("\r\n");

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

/* ---------------------------------------------------------------
   Data loading
---------------------------------------------------------------- */

function normaliseRecord(item) {
  return {
    id: String(item.id),
    title: item.title || "Untitled opportunity",
    organisation: item.organization || "Organisation not specified",
    category: item.category || "Other",
    location: item.location || "Nigeria",
    eligibility: item.eligibility || "Check official requirements",
    description:
      item.description || "Visit the official source for full details.",
    deadline: item.deadline || "",
    url: item.application_url || item.source_url || "",
    image_url: item.image_url || "",
    verified: Boolean(item.verified_at),
    created_at: item.created_at || ""
  };
}

function failLoad(technicalMessage, error) {
  console.error("Opportunity Hub: could not load opportunities.", error || technicalMessage);

  state.opportunities = [];
  state.loadState = "error";

  if (DEBUG) {
    setDataStatus("Database request failed", "Debug: " + technicalMessage);
  } else {
    setDataStatus("", "");
  }

  renderOpportunities();
}

async function loadOpportunities() {
  state.loadState = "loading";

  setDataStatus("", "");
  renderOpportunities();

  const key = SUPABASE_PUBLISHABLE_KEY.trim();

  if (!key) {
    failLoad("The Supabase publishable key is not configured.");
    return;
  }

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    failLoad("The Supabase library did not load. Check the script tag in index.html.");
    return;
  }

  try {
    const client = window.supabase.createClient(SUPABASE_URL, key);

    const response = await client
      .from("opportunities")
      .select(
        "id,title,organization,category,description,eligibility,location,application_url,source_url,deadline,status,verified_at,created_at,image_url"
      )
      .eq("status", "published")
      .order("created_at", { ascending: false });

    if (response.error) throw response.error;

    state.opportunities = (response.data || []).map(normaliseRecord);
    state.loadState = "ready";

    setDataStatus("", "");
  } catch (error) {
    const message = error && error.message ? error.message : String(error);

    failLoad(message, error);
    return;
  }

  renderOpportunities();
}

/* ---------------------------------------------------------------
   Page setup and events
---------------------------------------------------------------- */

function syncCategoryButtons() {
  document.querySelectorAll(".category").forEach((button) => {
    const active = button.dataset.category === state.activeCategory;

    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

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

function setupFilters() {
  const searchInput = $("searchInput");
  const sortFilter = $("sortFilter");
  const categoryFilter = $("categoryFilter");
  const clearFilters = $("clearFilters");
  const categoryButtons = $("categoryButtons");

  if (searchInput) {
    searchInput.addEventListener(
      "input",
      debounce(renderOpportunities, SEARCH_DELAY_MS)
    );
  }

  if (sortFilter) {
    sortFilter.addEventListener("change", renderOpportunities);
  }

  if (categoryFilter) {
    categoryFilter.addEventListener("change", () => {
      state.activeCategory = "All";
      syncCategoryButtons();
      renderOpportunities();
    });
  }

  if (clearFilters) {
    clearFilters.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      if (categoryFilter) categoryFilter.value = "All";
      if (sortFilter) sortFilter.value = "newest";

      state.activeCategory = "All";

      syncCategoryButtons();
      renderOpportunities();
    });
  }

  if (categoryButtons) {
    categoryButtons.addEventListener("click", (event) => {
      const button = event.target.closest("[data-category]");

      if (!button) return;

      state.activeCategory = button.dataset.category;

      if (categoryFilter) categoryFilter.value = "All";

      syncCategoryButtons();
      renderOpportunities();

      const section = $("opportunities");

      if (section && typeof section.scrollIntoView === "function") {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }
}

function setupOpportunityGrid() {
  const grid = $("opportunityGrid");

  if (!grid) return;
   document.addEventListener("click", (event) => {
const button = event.target.closest("#viewAllOpportunities");

if (!button) return;

const showAll = button.dataset.showAll !== "true";
button.dataset.showAll = String(showAll);

renderOpportunities();

});

}
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
        : bookmarks.concat([id]);

      if (saveBookmarks(updated)) {
        renderOpportunities();
        showToast(alreadySaved ? "Bookmark removed." : "Opportunity saved.");
      }

      return;
    }

    const trackButton = event.target.closest("[data-track]");

    if (trackButton) trackOpportunity(trackButton.dataset.track);
  });
}

function setupTracker() {
  const trackerList = $("trackerList");
  const exportButton = $("exportTracker");
  const clearTracker = $("clearTracker");

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

        if (saveTracker(tracker)) showToast("Application status updated.");
      }
    });

    trackerList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-track]");

      if (!button) return;

      const remaining = getTracker().filter(
        (row) => String(row.id) !== String(button.dataset.removeTrack)
      );

      if (saveTracker(remaining)) {
        renderTracker();
        showToast("Removed from tracker.");
      }
    });
  }

  if (exportButton) exportButton.addEventListener("click", exportCSV);

  if (clearTracker) {
    clearTracker.addEventListener("click", () => {
      if (getTracker().length === 0) {
        showToast("Your tracker is already empty.");
        return;
      }

      if (
        confirm("Clear all items from your application tracker on this device?")
      ) {
        if (saveTracker([])) {
          renderTracker();
          showToast("Tracker cleared.");
        }
      }
    });
  }
}

function initialise() {
  setupNavigation();
  setupFilters();
  setupOpportunityGrid();
  setupTracker();

  const year = $("year");

  if (year) year.textContent = String(new Date().getFullYear());

  syncCategoryButtons();
  renderTracker();
  loadOpportunities();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialise, { once: true });
} else {
  initialise();
}
})();
