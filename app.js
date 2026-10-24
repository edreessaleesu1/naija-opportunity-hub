(() => {
"use strict";

const SUPABASE_URL = "https://djxornmwvkauhkcuhgxc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_EDReCY3JcN4vMuypVfqcMQ_GcTEVuBq";

function demo(n, title, category, location, eligibility, description, query) {
  return {
    id: "demo-" + n,
    title: title,
    organisation: "Demonstration listing",
    category: category,
    location: location,
    eligibility: eligibility,
    description: description,
    deadline: "",
    url: "https://www.google.com/search?q=" + query,
    image_url: "",
    verified: false,
    demo: true
  };
}

const sampleOpportunities = [
  demo(1, "Scholarship Search Starter", "Scholarship", "Nigeria / International",
    "Check official programme requirements.",
    "Explore scholarships and confirm all details through official programme websites.",
    "official+scholarships+for+Nigerian+students"),
  demo(2, "Graduate Job Search Starter", "Job", "Nigeria",
    "Depends on the employer and role.",
    "Explore graduate vacancies and confirm current openings on official employer career pages.",
    "official+graduate+jobs+Nigeria"),
  demo(3, "Internship Search Starter", "Internship", "Nigeria / International",
    "Depends on the programme.",
    "Explore internships and confirm requirements on the host organisation's official website.",
    "official+internships+Nigeria"),
  demo(4, "Grant Search Starter", "Grant", "Nigeria / International",
    "Depends on the grant provider.",
    "Explore grants and confirm eligibility, deadlines and fees through official sources.",
    "official+grants+Nigeria"),
  demo(5, "Free Training Search Starter", "Training", "Online / Nigeria",
    "Check the training provider's requirements.",
    "Explore training programmes and skills courses from recognised providers.",
    "official+free+online+training+Nigeria"),
  demo(6, "Fellowship Search Starter", "Fellowship", "Nigeria / International",
    "Depends on the fellowship.",
    "Explore fellowship programmes and confirm current requirements with the programme owner.",
    "official+fellowships+for+Nigerians")
];

const STORAGE = {
  bookmarks: "noh_bookmarks_v1",
  tracker: "noh_tracker_v1"
};

let opportunities = sampleOpportunities.slice();
let activeCategory = "All";
let supabaseClient = null;

const $ = (id) => document.getElementById(id);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function readJSON(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value === null || value === undefined ? fallback : value;
  } catch (error) {
    return fallback;
  }
}

function getBookmarks() {
  const value = readJSON(STORAGE.bookmarks, []);
  return Array.isArray(value) ? value : [];
}

function saveBookmarks(items) {
  try {
    localStorage.setItem(STORAGE.bookmarks, JSON.stringify(items));
  } catch (error) {
    console.error("Could not save bookmarks:", error);
    showToast("Bookmarks could not be saved on this device.");
  }
}

function getTracker() {
  const value = readJSON(STORAGE.tracker, []);
  return Array.isArray(value) ? value : [];
}

function saveTracker(items) {
  try {
    localStorage.setItem(STORAGE.tracker, JSON.stringify(items));
  } catch (error) {
    console.error("Could not save tracker:", error);
    showToast("Tracker changes could not be saved on this device.");
  }
}

function safeURL(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch (error) {
    return "";
  }
}

function showToast(message) {
  const toast = $("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 3500);
}

function formatDate(date) {
  if (!date) return "Check official source";
  const value = String(date);
  const parsed = new Date(value.length === 10 ? value + "T00:00:00" : value);
  if (Number.isNaN(parsed.getTime())) return "Check official source";
  return parsed.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function setDataStatus(status, notice) {
  const statusElement = $("dataStatus");
  const noticeElement = $("dataNotice");
  if (statusElement) statusElement.textContent = status;
  if (noticeElement) {
    noticeElement.textContent = notice || "";
    noticeElement.hidden = !notice;
  }
}

function timeValue(value) {
  const t = new Date(value || 0).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function buildCard(item, bookmarks) {
  const id = String(item.id);
  const saved = bookmarks.includes(id);
  const link = safeURL(item.url);
  const image = safeURL(item.image_url);
  const badgeText = item.verified ? "Source checked" : (item.demo ? "Demo card" : "Check source");

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
  const bookmark = el("button", "bookmark" + (saved ? " saved" : ""), saved ? "\u2605 Saved" : "\u2606 Save");
  bookmark.type = "button";
  bookmark.dataset.bookmark = id;
  bookmark.setAttribute("aria-label", saved ? "Remove bookmark" : "Save bookmark");
  top.appendChild(bookmark);
  card.appendChild(top);

  card.appendChild(el("h3", "", item.title));
  card.appendChild(el("div", "org", item.organisation || "Organisation not specified"));
  card.appendChild(el("p", "card-desc", item.description || "Visit the official source for full details."));

  const meta1 = el("div", "meta");
  meta1.appendChild(el("span", "", "\uD83D\uDCCD " + (item.location || "Location not specified")));
  meta1.appendChild(el("span", "", "\uD83D\uDDD3\uFE0F Deadline: " + formatDate(item.deadline)));
  card.appendChild(meta1);

  const meta2 = el("div", "meta");
  meta2.appendChild(el("span", "", (item.verified ? "\u2713 " : "\u2139\uFE0F ") + badgeText));
  card.appendChild(meta2);

  const actions = el("div", "card-actions");
  if (link) {
    const a = el("a", "button button-primary", "View source \u2197");
    a.href = link;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    actions.appendChild(a);
  } else {
    actions.appendChild(el("span", "button button-outline", "Source not added"));
  }
  const track = el("button", "button button-outline", "Track");
  track.type = "button";
  track.dataset.track = id;
  actions.appendChild(track);
  card.appendChild(actions);

  return card;
}

function renderOpportunities() {
  const searchInput = $("searchInput");
  const categoryFilter = $("categoryFilter");
  const sortFilter = $("sortFilter");
  const grid = $("opportunityGrid");
  const resultsCount = $("resultsCount");

  if (!grid) {
    console.error("The opportunityGrid element is missing.");
    return;
  }

  const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const category = categoryFilter ? categoryFilter.value : "All";

  const filtered = opportunities.filter((item) => {
    const searchableText = [
      item.title,
      item.organisation,
      item.category,
      item.location,
      item.description,
      item.eligibility
    ].map((part) => String(part === null || part === undefined ? "" : part)).join(" ").toLowerCase();

    const itemCategory = String(item.category).toLowerCase();
    const matchesQuery = !query || searchableText.includes(query);
    const matchesCategory = category === "All" || itemCategory === String(category).toLowerCase();
    const matchesButton = activeCategory === "All" || itemCategory === String(activeCategory).toLowerCase();

    return matchesQuery && matchesCategory && matchesButton;
  });

  const sort = sortFilter ? sortFilter.value : "newest";

  if (sort === "title") {
    filtered.sort((a, b) => String(a.title).localeCompare(String(b.title)));
  } else if (sort === "deadline") {
    filtered.sort((a, b) => {
      const aTime = a.deadline ? timeValue(a.deadline) : 0;
      const bTime = b.deadline ? timeValue(b.deadline) : 0;
      if (!aTime && !bTime) return 0;
      if (!aTime) return 1;
      if (!bTime) return -1;
      return aTime - bTime;
    });
  } else {
    filtered.sort((a, b) => timeValue(b.created_at) - timeValue(a.created_at));
  }

  if (resultsCount) {
    resultsCount.textContent = filtered.length + " opportunit" + (filtered.length === 1 ? "y" : "ies") + " shown";
  }

  grid.textContent = "";

  if (filtered.length === 0) {
    const empty = el("div", "empty");
    empty.appendChild(el("h3", "", "No matching opportunities"));
    empty.appendChild(el("p", "", "Try another keyword or clear the filters."));
    grid.appendChild(empty);
    return;
  }

  const bookmarks = getBookmarks();
  const fragment = document.createDocumentFragment();
  filtered.forEach((item) => {
    fragment.appendChild(buildCard(item, bookmarks));
  });
  grid.appendChild(fragment);
}

function renderTracker() {
  const tracker = getTracker();
  const list = $("trackerList");

  if (!list) return;

  list.textContent = "";

  if (tracker.length === 0) {
    const empty = el("div", "empty");
    empty.appendChild(el("strong", "", "Your tracker is empty."));
    empty.appendChild(el("p", "", "Tap Track on an opportunity to add it here."));
    list.appendChild(empty);
    return;
  }

  const statuses = ["Interested", "Preparing", "Applied", "Interview", "Successful", "Unsuccessful"];

  tracker.forEach((item) => {
    const row = el("div", "tracker-item");

    const info = el("div");
    info.appendChild(el("strong", "", item.title));
    info.appendChild(el("small", "", item.organisation || ""));
    row.appendChild(info);

    const select = el("select");
    select.dataset.status = String(item.id);
    select.setAttribute("aria-label", "Application status for " + item.title);
    statuses.forEach((status) => {
      const option = el("option", "", status);
      option.value = status;
      if (item.status === status) option.selected = true;
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
  const item = opportunities.find((opportunity) => String(opportunity.id) === String(id));
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

  saveTracker(tracker);
  renderTracker();
  showToast("Added to your application tracker.");
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
    tracker.map((item) => [item.title, item.organisation, item.status, item.addedAt])
  );

  const csv = rows.map((row) => row.map(cell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "naija-opportunity-tracker.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function loadSupabaseOpportunities() {
  const key = SUPABASE_PUBLISHABLE_KEY.trim();

  if (!key) {
    setDataStatus("Database key not configured", "Please configure the Supabase publishable key. Showing demonstration cards.");
    return;
  }

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    setDataStatus(
      "Database library did not load",
      "The Supabase JavaScript library could not be loaded. Check your internet connection and the script tags in index.html. Showing demonstration cards."
    );
    console.error("Supabase JavaScript library is unavailable.");
    return;
  }

  setDataStatus("Connecting to database...", "Connecting to the published opportunities database.");

  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, key);

    const response = await supabaseClient
      .from("opportunities")
      .select("id,title,organization,category,description,eligibility,location,application_url,source_url,deadline,status,verified_at,created_at,image_url")
      .eq("status", "published")
      .order("created_at", { ascending: false });

    if (response.error) throw response.error;

    const data = response.data;

    if (!Array.isArray(data) || data.length === 0) {
      setDataStatus(
        "Database connected - no published records returned",
        "The database request succeeded, but no published records were returned, so demonstration cards are shown. Check the table contents and SELECT policy."
      );
      return;
    }

    opportunities = data.map((item) => ({
      id: String(item.id),
      title: item.title || "Untitled opportunity",
      organisation: item.organization || "Organisation not specified",
      category: item.category || "Other",
      location: item.location || "Nigeria",
      eligibility: item.eligibility || "Check official requirements",
      description: item.description || "Visit the official source for full details.",
      deadline: item.deadline || "",
      url: item.application_url || item.source_url || "",
      image_url: item.image_url || "",
      verified: Boolean(item.verified_at),
      created_at: item.created_at || "",
      demo: false
    }));

    setDataStatus("Connected - published database listings loaded", "");
  } catch (error) {
    console.error("Supabase database error:", error);
    const message = error && error.message ? error.message : String(error);
    setDataStatus("Database request failed", "Database error: " + message + " (showing demonstration cards instead)");
  }

  renderOpportunities();
  renderTracker();
}

function syncCategoryButtons() {
  document.querySelectorAll(".category").forEach((button) => {
    button.classList.toggle("active", button.dataset.category === activeCategory);
  });
}

function initialiseWebsite() {
  const menuButton = $("menuBtn");
  const navigation = $("navLinks");

  if (menuButton && navigation) {
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

  const searchInput = $("searchInput");
  if (searchInput) searchInput.addEventListener("input", renderOpportunities);

  const sortFilter = $("sortFilter");
  if (sortFilter) sortFilter.addEventListener("change", renderOpportunities);

  const categoryFilter = $("categoryFilter");
  if (categoryFilter) {
    categoryFilter.addEventListener("change", () => {
      activeCategory = "All";
      syncCategoryButtons();
      renderOpportunities();
    });
  }

  const clearFilters = $("clearFilters");
  if (clearFilters) {
    clearFilters.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      if (categoryFilter) categoryFilter.value = "All";
      if (sortFilter) sortFilter.value = "newest";
      activeCategory = "All";
      syncCategoryButtons();
      renderOpportunities();
    });
  }

  const categoryButtons = $("categoryButtons");
  if (categoryButtons) {
    categoryButtons.addEventListener("click", (event) => {
      const button = event.target.closest("[data-category]");
      if (!button) return;
      activeCategory = button.dataset.category;
      if (categoryFilter) categoryFilter.value = "All";
      syncCategoryButtons();
      renderOpportunities();
    });
  }

  const opportunityGrid = $("opportunityGrid");
  if (opportunityGrid) {
    opportunityGrid.addEventListener("click", (event) => {
      const bookmarkButton = event.target.closest("[data-bookmark]");

      if (bookmarkButton) {
        const id = String(bookmarkButton.dataset.bookmark);
        const bookmarks = getBookmarks();
        const alreadySaved = bookmarks.includes(id);

        saveBookmarks(alreadySaved ? bookmarks.filter((item) => item !== id) : bookmarks.concat([id]));
        renderOpportunities();
        showToast(alreadySaved ? "Bookmark removed." : "Opportunity saved.");
        return;
      }

      const trackButton = event.target.closest("[data-track]");
      if (trackButton) trackOpportunity(trackButton.dataset.track);
    });
  }

  const trackerList = $("trackerList");
  if (trackerList) {
    trackerList.addEventListener("change", (event) => {
      const select = event.target.closest("[data-status]");
      if (!select) return;

      const tracker = getTracker();
      const item = tracker.find((row) => String(row.id) === String(select.dataset.status));

      if (item) {
        item.status = select.value;
        saveTracker(tracker);
        showToast("Application status updated.");
      }
    });

    trackerList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-track]");
      if (!button) return;

      saveTracker(getTracker().filter((row) => String(row.id) !== String(button.dataset.removeTrack)));
      renderTracker();
      showToast("Removed from tracker.");
    });
  }

  const exportButton = $("exportTracker");
  if (exportButton) exportButton.addEventListener("click", exportCSV);

  const clearTracker = $("clearTracker");
  if (clearTracker) {
    clearTracker.addEventListener("click", () => {
      if (getTracker().length === 0) {
        showToast("Your tracker is already empty.");
        return;
      }

      if (confirm("Clear all items from your application tracker on this device?")) {
        saveTracker([]);
        renderTracker();
        showToast("Tracker cleared.");
      }
    });
  }

  const year = $("year");
  if (year) year.textContent = String(new Date().getFullYear());

  renderOpportunities();
  renderTracker();
  loadSupabaseOpportunities();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialiseWebsite, { once: true });
} else {
  initialiseWebsite();
}
})();
       
