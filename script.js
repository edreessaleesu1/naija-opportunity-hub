(() => {
  "use strict";

  // =====================================================
  // 1. SUPABASE CONFIGURATION
  // =====================================================

  const SUPABASE_URL =
    "https://djxornmwvkauhkcuhgxc.supabase.co";

  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_EDReCY3JcN4vMuypVfqcMQ_GcTEVuBq";

  // =====================================================
  // 2. DEMONSTRATION OPPORTUNITIES
  // These are shown if published database records cannot
  // be loaded or no published records exist.
  // =====================================================

  const sampleOpportunities = [
    {
      id: "demo-1",
      title: "Scholarship Search Starter",
      organisation: "Demonstration listing",
      category: "Scholarship",
      location: "Nigeria / International",
      eligibility: "Check official programme requirements.",
      description:
        "Explore scholarships and confirm all details through official programme websites.",
      deadline: "",
      url: "https://www.google.com/search?q=official+scholarships+for+Nigerian+students",
      image_url: "",
      verified: false,
      demo: true
    },
    {
      id: "demo-2",
      title: "Graduate Job Search Starter",
      organisation: "Demonstration listing",
      category: "Job",
      location: "Nigeria",
      eligibility: "Depends on the employer and role.",
      description:
        "Explore graduate vacancies and confirm current openings on official employer career pages.",
      deadline: "",
      url: "https://www.google.com/search?q=official+graduate+jobs+Nigeria",
      image_url: "",
      verified: false,
      demo: true
    },
    {
      id: "demo-3",
      title: "Internship Search Starter",
      organisation: "Demonstration listing",
      category: "Internship",
      location: "Nigeria / International",
      eligibility: "Depends on the programme.",
      description:
        "Explore internships and confirm requirements on the host organisation's official website.",
      deadline: "",
      url: "https://www.google.com/search?q=official+internships+Nigeria",
      image_url: "",
      verified: false,
      demo: true
    },
    {
      id: "demo-4",
      title: "Grant Search Starter",
      organisation: "Demonstration listing",
      category: "Grant",
      location: "Nigeria / International",
      eligibility: "Depends on the grant provider.",
      description:
        "Explore grants and confirm eligibility, deadlines and fees through official sources.",
      deadline: "",
      url: "https://www.google.com/search?q=official+grants+Nigeria",
      image_url: "",
      verified: false,
      demo: true
    },
    {
      id: "demo-5",
      title: "Free Training Search Starter",
      organisation: "Demonstration listing",
      category: "Training",
      location: "Online / Nigeria",
      eligibility: "Check the training provider's requirements.",
      description:
        "Explore training programmes and skills courses from recognised providers.",
      deadline: "",
      url: "https://www.google.com/search?q=official+free+online+training+Nigeria",
      image_url: "",
      verified: false,
      demo: true
    },
    {
      id: "demo-6",
      title: "Fellowship Search Starter",
      organisation: "Demonstration listing",
      category: "Fellowship",
      location: "Nigeria / International",
      eligibility: "Depends on the fellowship.",
      description:
        "Explore fellowship programmes and confirm current requirements with the programme owner.",
      deadline: "",
      url: "https://www.google.com/search?q=official+fellowships+for+Nigerians",
      image_url: "",
      verified: false,
      demo: true
    }
  ];

  // =====================================================
  // 3. APPLICATION STORAGE
  // =====================================================

  const STORAGE = {
    bookmarks: "noh_bookmarks_v1",
    tracker: "noh_tracker_v1"
  };

  let opportunities = [...sampleOpportunities];
  let activeCategory = "All";
  let supabaseClient = null;

  const $ = (id) => document.getElementById(id);

  function readJSON(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch (error) {
      return fallback;
    }
  }

  function getBookmarks() {
    return readJSON(STORAGE.bookmarks, []);
  }

  function saveBookmarks(items) {
    try {
      localStorage.setItem(
        STORAGE.bookmarks,
        JSON.stringify(items)
      );
    } catch (error) {
      console.error("Could not save bookmarks:", error);
      showToast("Bookmarks could not be saved on this device.");
    }
  }

  function getTracker() {
    return readJSON(STORAGE.tracker, []);
  }

  function saveTracker(items) {
    try {
      localStorage.setItem(
        STORAGE.tracker,
        JSON.stringify(items)
      );
    } catch (error) {
      console.error("Could not save tracker:", error);
      showToast("Tracker changes could not be saved on this device.");
    }
  }

  // =====================================================
  // 4. SECURITY AND DISPLAY HELPERS
  // =====================================================

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function safeURL(value) {
    try {
      const url = new URL(String(value || ""));

      if (url.protocol === "https:" || url.protocol === "http:") {
        return url.href;
      }

      return "";
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

    showToast.timer = setTimeout(() => {
      toast.classList.remove("show");
    }, 3500);
  }

  function formatDate(date) {
    if (!date) return "Check official source";

    const value = String(date);

    const parsed = new Date(
      value.length === 10 ? value + "T00:00:00" : value
    );

    if (Number.isNaN(parsed.getTime())) {
      return "Check official source";
    }

    return parsed.toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function setDataStatus(status, notice) {
    const statusElement = $("dataStatus");
    const noticeElement = $("dataNotice");

    if (statusElement) {
      statusElement.textContent = status;
    }

    if (noticeElement) {
      noticeElement.innerHTML = notice;
    }
  }

  // =====================================================
  // 5. RENDER OPPORTUNITY CARDS
  // =====================================================

  function renderOpportunities() {
    const searchInput = $("searchInput");
    const categoryFilter = $("categoryFilter");
    const sortFilter = $("sortFilter");
    const grid = $("opportunityGrid");
    const resultsCount = $("resultsCount");

    if (!grid) {
      console.error(
        "Opportunity Hub: The opportunityGrid element is missing."
      );
      return;
    }

    const query = searchInput
      ? searchInput.value.trim().toLowerCase()
      : "";

    const category = categoryFilter
      ? categoryFilter.value
      : "All";

    let filtered = opportunities.filter((item) => {
      const searchableText = [
        item.title,
        item.organisation,
        item.category,
        item.location,
        item.description,
        item.eligibility
      ]
        .join(" ")
        .toLowerCase();

      const matchesQuery =
        !query || searchableText.includes(query);

      const matchesCategory =
        category === "All" ||
        String(item.category).toLowerCase() ===
          String(category).toLowerCase();

      const matchesButton =
        activeCategory === "All" ||
        String(item.category).toLowerCase() ===
          String(activeCategory).toLowerCase();

      return matchesQuery && matchesCategory && matchesButton;
    });

    const sort = sortFilter ? sortFilter.value : "newest";

    if (sort === "title") {
      filtered.sort((a, b) =>
        String(a.title).localeCompare(String(b.title))
      );
    }

    if (sort === "deadline") {
      filtered.sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;

        return new Date(a.deadline) - new Date(b.deadline);
      });
    }

    if (sort === "newest") {
      filtered.sort((a, b) =>
        new Date(b.created_at || 0) -
        new Date(a.created_at || 0)
      );
    }

    if (resultsCount) {
      resultsCount.textContent =
        `${filtered.length} opportunit` +
        `${filtered.length === 1 ? "y" : "ies"} shown`;
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="empty">
          <h3>No matching opportunities</h3>
          <p>Try another keyword or clear the filters.</p>
        </div>
      `;
      return;
    }

    const bookmarks = getBookmarks();

    grid.innerHTML = filtered.map((item) => {
      const id = String(item.id);
      const saved = bookmarks.includes(id);
      const link = safeURL(item.url);
      const image = safeURL(item.image_url);

      const badgeText = item.verified
        ? "Source checked"
        : item.demo
          ? "Demo card"
          : "Check source";

      return `
        <article class="card">

          ${
            image
              ? `
                <img
                  class="opportunity-image"
                  src="${escapeHTML(image)}"
                  alt="${escapeHTML(item.title)}"
                  loading="lazy"
                  onerror="this.style.display='none'"
                >
              `
              : ""
          }

          <div class="card-top">
            <span class="badge">
              ${escapeHTML(item.category || "Opportunity")}
            </span>

            <button
              type="button"
              class="bookmark ${saved ? "saved" : ""}"
              data-bookmark="${escapeHTML(id)}"
              aria-label="${saved ? "Remove bookmark" : "Save bookmark"}"
            >
              ${saved ? "★ Saved" : "☆ Save"}
            </button>
          </div>

          <h3>${escapeHTML(item.title)}</h3>

          <div class="org">
            ${escapeHTML(
              item.organisation || "Organisation not specified"
            )}
          </div>

          <p class="card-desc">
            ${escapeHTML(
              item.description ||
              "Visit the official source for full details."
            )}
          </p>

          <div class="meta">
            <span>
              📍 ${escapeHTML(
                item.location || "Location not specified"
              )}
            </span>

            <span>
              🗓️ Deadline: ${escapeHTML(formatDate(item.deadline))}
            </span>
          </div>

          <div class="meta">
            <span>
              ${item.verified ? "✓ " : "ℹ️ "}
              ${escapeHTML(badgeText)}
            </span>
          </div>

          <div class="card-actions">
            ${
              link
                ? `
                  <a
                    class="button button-primary"
                    href="${escapeHTML(link)}"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View source ↗
                  </a>
                `
                : `
                  <span class="button button-outline">
                    Source not added
                  </span>
                `
            }

            <button
              type="button"
              class="button button-outline"
              data-track="${escapeHTML(id)}"
            >
              Track
            </button>
          </div>

        </article>
      `;
    }).join("");
  }

  // =====================================================
  // 6. APPLICATION TRACKER
  // =====================================================

  function renderTracker() {
    const tracker = getTracker();
    const list = $("trackerList");

    if (!list) return;

    if (tracker.length === 0) {
      list.innerHTML = `
        <div class="empty">
          <strong>Your tracker is empty.</strong>
          <p>Tap "Track" on an opportunity to add it here.</p>
        </div>
      `;
      return;
    }

    const statuses = [
      "Interested",
      "Preparing",
      "Applied",
      "Interview",
      "Successful",
      "Unsuccessful"
    ];

    list.innerHTML = tracker.map((item) => `
      <div class="tracker-item">
        <div>
          <strong>${escapeHTML(item.title)}</strong>
          <small>${escapeHTML(item.organisation || "")}</small>
        </div>

        <select
          data-status="${escapeHTML(item.id)}"
          aria-label="Application status for ${escapeHTML(item.title)}"
        >
          ${statuses.map((status) => `
            <option ${
              item.status === status ? "selected" : ""
            }>${escapeHTML(status)}</option>
          `).join("")}
        </select>

        <button
          type="button"
          class="bookmark"
          data-remove-track="${escapeHTML(item.id)}"
          aria-label="Remove from tracker"
        >
          ✕
        </button>
      </div>
    `).join("");
  }

  function trackOpportunity(id) {
    const item = opportunities.find(
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

    const rows = [
      ["Title", "Organisation", "Status", "Added on"],
      ...tracker.map((item) => [
        item.title,
        item.organisation,
        item.status,
        item.addedAt
      ])
    ];

    const csv = rows.map((row) =>
      row.map((value) =>
        `"${String(value ?? "").replace(/"/g, '""')}"`
      ).join(",")
    ).join("\r\n");

    const blob = new Blob(
      ["\ufeff" + csv],
      { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "naija-opportunity-tracker.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // =====================================================
  // 7. LOAD PUBLISHED OPPORTUNITIES FROM SUPABASE
  // =====================================================

  async function loadSupabaseOpportunities() {
    const key = SUPABASE_PUBLISHABLE_KEY.trim();

    if (!key) {
      setDataStatus(
        "Database key not configured",
        "Please configure the Supabase publishable key."
      );

      renderOpportunities();
      return;
    }

    if (
      !window.supabase ||
      typeof window.supabase.createClient !== "function"
    ) {
      setDataStatus(
        "Database library did not load",
        "The Supabase JavaScript library could not be loaded. Check your internet connection and script configuration."
      );

      renderOpportunities();
      return;
    }

    try {
      supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        key
      );

      const { data, error } = await supabaseClient
        .from("opportunities")
        .select(
          "id,title,organization,category,description,eligibility,location,application_url,source_url,deadline,status,verified_at,created_at,image_url"
        )
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      if (Array.isArray(data) && data.length > 0) {
        opportunities = data.map((item) => ({
          id: String(item.id),
          title: item.title || "Untitled opportunity",
          organisation:
            item.organization || "Organisation not specified",
async function loadSupabaseOpportunities() {
const key = SUPABASE_PUBLISHABLE_KEY.trim();

setDataStatus(
"Connecting to database…",
"Connecting to the published opportunities database."
);

if (
!window.supabase ||
typeof window.supabase.createClient !== "function"
) {
setDataStatus(
"Database library unavailable",
"The Supabase JavaScript library did not load. Please check your internet connection and the script tags in index.html."
);
console.error("Supabase JavaScript library is unavailable.");
return;
}

try {
supabaseClient = window.supabase.createClient(
SUPABASE_URL,
key
);

// First test: request only essential columns.
// This helps identify whether the full query contains
// a column that does not exist.
const { data, error } = await supabaseClient
  .from("opportunities")
  .select("id,title,status")
  .eq("status", "published")
  .limit(20);

if (error) {
  throw error;
}

if (!Array.isArray(data) || data.length === 0) {
  opportunities = [];

  setDataStatus(
    "Database connected · no published records returned",
    "The database request succeeded, but no published records were returned. Check the table contents and SELECT policy."
  );

  renderOpportunities();
  renderTracker();

  console.info("Supabase returned no published opportunities.");
  return;
}

// Second request: load all fields needed by the cards.
const { data: fullData, error: fullError } =
  await supabaseClient
    .from("opportunities")
    .select(
      "id,title,organization,category,description,eligibility,location,application_url,source_url,deadline,status,verified_at,created_at,image_url"
    )
    .eq("status", "published")
    .order("created_at", { ascending: false });

if (fullError) {
  throw fullError;
}

opportunities = fullData.map((item) => ({
  id: String(item.id),
  title: item.title || "Untitled opportunity",
  organisation:
    item.organization || "Organisation not specified",
  category: item.category || "Other",
  location: item.location || "Nigeria",
  eligibility:
    item.eligibility || "Check official requirements",
  description:
    item.description ||
    "Visit the official source for full details.",
  deadline: item.deadline || "",
  url: item.application_url || item.source_url || "",
  image_url: item.image_url || "",
  verified: Boolean(item.verified_at),
  created_at: item.created_at || "",
  demo: false
}));

setDataStatus(
  "Connected · published database listings loaded",
  "Your website is displaying published records from Supabase."
);

console.info(
  "Supabase successfully loaded published opportunities:",
  opportunities.length
);

renderOpportunities();
renderTracker();

} catch (error) {
console.error("Supabase database error:", error);

// Do not silently replace the listings with demo cards.
opportunities = [];

const message =
  error && error.message
    ? error.message
    : String(error);

setDataStatus(
  "Database request failed",
  "<strong>Actual database error:</strong> " +
    escapeHTML(message) +
    "<br><br>Please share this exact message so we can fix the cause."
);

renderOpportunities();
renderTracker();

}

  // =====================================================
  // 8. WEBSITE EVENT LISTENERS
  // =====================================================

  function initialiseWebsite() {
    const menuButton = $("menuBtn");
    const navigation = $("navLinks");

    if (menuButton && navigation) {
      menuButton.addEventListener("click", () => {
        const isOpen = navigation.classList.toggle("open");

        menuButton.setAttribute(
          "aria-expanded",
          String(isOpen)
        );
      });

      navigation.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => {
          navigation.classList.remove("open");
          menuButton.setAttribute("aria-expanded", "false");
        });
      });
    }

    ["searchInput", "categoryFilter", "sortFilter"].forEach((id) => {
      const element = $(id);

      if (!element) return;

      element.addEventListener(
        id === "searchInput" ? "input" : "change",
        renderOpportunities
      );
    });

    const clearFilters = $("clearFilters");

    if (clearFilters) {
      clearFilters.addEventListener("click", () => {
        if ($("searchInput")) $("searchInput").value = "";
        if ($("categoryFilter")) $("categoryFilter").value = "All";
        if ($("sortFilter")) $("sortFilter").value = "newest";

        activeCategory = "All";

        document.querySelectorAll(".category").forEach((button) => {
          button.classList.toggle(
            "active",
            button.dataset.category === "All"
          );
        });

        renderOpportunities();
      });
    }

    const categoryButtons = $("categoryButtons");

    if (categoryButtons) {
      categoryButtons.addEventListener("click", (event) => {
        const button = event.target.closest("[data-category]");

        if (!button) return;

        activeCategory = button.dataset.category;

        if ($("categoryFilter")) {
          $("categoryFilter").value = "All";
        }

        document.querySelectorAll(".category").forEach((categoryButton) => {
          categoryButton.classList.toggle(
            "active",
            categoryButton === button
          );
        });

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

          saveBookmarks(
            alreadySaved
              ? bookmarks.filter((item) => item !== id)
              : [...bookmarks, id]
          );

          renderOpportunities();

          showToast(
            alreadySaved
              ? "Bookmark removed."
              : "Opportunity saved."
          );

          return;
        }

        const trackButton = event.target.closest("[data-track]");

        if (trackButton) {
          trackOpportunity(trackButton.dataset.track);
        }
      });
    }

    const trackerList = $("trackerList");

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
          saveTracker(tracker);
          showToast("Application status updated.");
        }
      });

      trackerList.addEventListener("click", (event) => {
        const button = event.target.closest("[data-remove-track]");

        if (!button) return;

        saveTracker(
          getTracker().filter(
            (row) =>
              String(row.id) !== String(button.dataset.removeTrack)
          )
        );

        renderTracker();
        showToast("Removed from tracker.");
      });
    }

    const exportButton = $("exportTracker");

    if (exportButton) {
      exportButton.addEventListener("click", exportCSV);
    }

    const clearTracker = $("clearTracker");

    if (clearTracker) {
      clearTracker.addEventListener("click", () => {
        if (getTracker().length === 0) {
          showToast("Your tracker is already empty.");
          return;
        }

        if (
          confirm(
            "Clear all items from your application tracker on this device?"
          )
        ) {
          saveTracker([]);
          renderTracker();
          showToast("Tracker cleared.");
        }
      });
    }

    const year = $("year");

    if (year) {
      year.textContent = new Date().getFullYear();
    }

    // Show demonstration cards immediately.
    renderOpportunities();
    renderTracker();

    // Then load published records from Supabase.
    loadSupabaseOpportunities();
  }

  // =====================================================
  // 9. START THE WEBSITE
  // =====================================================

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialiseWebsite,
      { once: true }
    );
  } else {
    initialiseWebsite();
  }

})();
