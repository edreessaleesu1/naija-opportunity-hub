(() => {
  "use strict";

  // Supabase browser configuration.
  // Project URL is already added. Paste ONLY your new publishable key below.
  // Never put a Supabase secret/service-role key in this public HTML file.
  const SUPABASE_URL = "https://djxornmwvkauhkcuhgxc.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "PASTE_YOUR_NEW_PUBLISHABLE_KEY_HERE";

  const sampleOpportunities = [
    {
      id: "demo-1", title: "Scholarship search starter", organisation: "Demonstration listing",
      category: "Scholarship", location: "Nigeria / International", eligibility: "Check the official programme requirements",
      description: "A demonstration card showing how scholarship opportunities will appear once verified listings are added.",
      deadline: "", url: "https://www.google.com/search?q=official+scholarships+for+Nigerian+students", verified: false, demo: true
    },
    {
      id: "demo-2", title: "Graduate job search starter", organisation: "Demonstration listing",
      category: "Job", location: "Nigeria", eligibility: "Depends on the employer and role",
      description: "A demonstration card. Use official employer career pages to find current vacancies and confirm application details.",
      deadline: "", url: "https://www.google.com/search?q=official+graduate+jobs+Nigeria", verified: false, demo: true
    },
    {
      id: "demo-3", title: "Internship search starter", organisation: "Demonstration listing",
      category: "Internship", location: "Nigeria", eligibility: "Depends on the programme",
      description: "A demonstration card for internship listings. Always check the host organisation's official website.",
      deadline: "", url: "https://www.google.com/search?q=official+internships+Nigeria", verified: false, demo: true
    },
    {
      id: "demo-4", title: "Grant search starter", organisation: "Demonstration listing",
      category: "Grant", location: "Nigeria / International", eligibility: "Depends on the grant provider",
      description: "A demonstration card for grants. Confirm the provider, eligibility and any fees through official sources.",
      deadline: "", url: "https://www.google.com/search?q=official+grants+Nigeria", verified: false, demo: true
    },
    {
      id: "demo-5", title: "Free training search starter", organisation: "Demonstration listing",
      category: "Training", location: "Online / Nigeria", eligibility: "Check the training provider's requirements",
      description: "A demonstration card for training programmes and skills courses.",
      deadline: "", url: "https://www.google.com/search?q=official+free+online+training+Nigeria", verified: false, demo: true
    },
    {
      id: "demo-6", title: "Fellowship search starter", organisation: "Demonstration listing",
      category: "Fellowship", location: "Nigeria / International", eligibility: "Depends on the fellowship",
      description: "A demonstration card for fellowships. Confirm current dates and requirements with the programme owner.",
      deadline: "", url: "https://www.google.com/search?q=official+fellowships+for+Nigerians", verified: false, demo: true
    }
  ];

  const STORAGE = {
    bookmarks: "noh_bookmarks_v1",
    tracker: "noh_tracker_v1"
  };
  let opportunities = [...sampleOpportunities];
  let activeCategory = "All";
  let supabaseClient = null;

  const $ = (id) => document.getElementById(id);
  const readJSON = (key, fallback) => {
    try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; }
    catch { return fallback; }
  };
  const getBookmarks = () => readJSON(STORAGE.bookmarks, []);
  const saveBookmarks = (items) => localStorage.setItem(STORAGE.bookmarks, JSON.stringify(items));
  const getTracker = () => readJSON(STORAGE.tracker, []);
  const saveTracker = (items) => localStorage.setItem(STORAGE.tracker, JSON.stringify(items));
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[ch]));
  const safeURL = (value) => {
    try {
      const u = new URL(value);
      return ["https:", "http:"].includes(u.protocol) ? u.href : "";
    } catch { return ""; }
  };
  function showToast(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 3500);
  }
  function formatDate(date) {
    if (!date) return "Check official source";
    const parsed = new Date(date + (String(date).length === 10 ? "T00:00:00" : ""));
    return Number.isNaN(parsed.getTime()) ? "Check official source" :
      parsed.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
  }
  function renderOpportunities() {
    const query = $("searchInput").value.trim().toLowerCase();
    const category = $("categoryFilter").value;
    let filtered = opportunities.filter(item => {
      const text = [item.title, item.organisation, item.category, item.location, item.description, item.eligibility].join(" ").toLowerCase();
      const matchesQuery = !query || text.includes(query);
      const matchesCategory = category === "All" || item.category.toLowerCase() === category.toLowerCase();
      const matchesButton = activeCategory === "All" || item.category.toLowerCase() === activeCategory.toLowerCase();
      return matchesQuery && matchesCategory && matchesButton;
    });
    const sort = $("sortFilter").value;
    if (sort === "title") filtered.sort((a,b) => a.title.localeCompare(b.title));
    if (sort === "deadline") filtered.sort((a,b) => {
      if (!a.deadline) return 1; if (!b.deadline) return -1;
      return new Date(a.deadline) - new Date(b.deadline);
    });
    if (sort === "newest") filtered.sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    $("resultsCount").textContent = `${filtered.length} opportunit${filtered.length === 1 ? "y" : "ies"} shown`;
    const grid = $("opportunityGrid");
    if (!filtered.length) {
      grid.innerHTML = '<div class="empty"><h3>No matching opportunities</h3><p>Try a different keyword or clear the filters.</p></div>';
      return;
    }
    const bookmarks = getBookmarks();
    grid.innerHTML = filtered.map(item => {
      const saved = bookmarks.includes(String(item.id));
      const link = safeURL(item.url);
      const badgeText = item.verified ? "Source checked" : (item.demo ? "Demo card" : "Check source");
      return `<article class="card">
        <div class="card-top"><span class="badge">${escapeHTML(item.category || "Opportunity")}</span>
        <button class="bookmark ${saved ? "saved" : ""}" data-bookmark="${escapeHTML(item.id)}" aria-label="${saved ? "Remove bookmark" : "Save bookmark"}">${saved ? "★ Saved" : "☆ Save"}</button></div>
        <h3>${escapeHTML(item.title)}</h3>
        <div class="org">${escapeHTML(item.organisation || "Organisation not specified")}</div>
        <p class="card-desc">${escapeHTML(item.description || "Visit the official source for full details.")}</p>
        <div class="meta"><span>📍 ${escapeHTML(item.location || "Location not specified")}</span><span>🗓️ Deadline: ${escapeHTML(formatDate(item.deadline))}</span></div>
        <div class="meta"><span>${item.verified ? "✓ " : "ℹ️ "}${escapeHTML(badgeText)}</span></div>
        <div class="card-actions">
          ${link ? `<a class="button button-primary" href="${escapeHTML(link)}" target="_blank" rel="noopener noreferrer">View source ↗</a>` : '<span class="button button-outline">Source not added</span>'}
          <button class="button button-outline" data-track="${escapeHTML(item.id)}">Track</button>
        </div>
      </article>`;
    }).join("");
  }
  function renderTracker() {
    const tracker = getTracker();
    const list = $("trackerList");
    if (!tracker.length) {
      list.innerHTML = '<div class="empty"><strong>Your tracker is empty.</strong><p>Tap “Track” on an opportunity to add it here.</p></div>';
      return;
    }
    list.innerHTML = tracker.map(item => `<div class="tracker-item">
      <div><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.organisation || "")}</small></div>
      <select data-status="${escapeHTML(item.id)}" aria-label="Application status for ${escapeHTML(item.title)}">
        ${["Interested","Preparing","Applied","Interview","Successful","Unsuccessful"].map(status => `<option ${item.status === status ? "selected" : ""}>${status}</option>`).join("")}
      </select>
      <button class="bookmark" data-remove-track="${escapeHTML(item.id)}" aria-label="Remove from tracker">✕</button>
    </div>`).join("");
  }
  function trackOpportunity(id) {
    const item = opportunities.find(op => String(op.id) === String(id));
    if (!item) return;
    const tracker = getTracker();
    if (tracker.some(row => String(row.id) === String(id))) {
      showToast("This opportunity is already in your tracker.");
      return;
    }
    tracker.unshift({ id: String(item.id), title: item.title, organisation: item.organisation, status: "Interested", addedAt: new Date().toISOString() });
    saveTracker(tracker);
    renderTracker();
    showToast("Added to your application tracker.");
  }
  function exportCSV() {
    const tracker = getTracker();
    if (!tracker.length) { showToast("Your tracker is empty."); return; }
    const rows = [["Title","Organisation","Status","Added on"], ...tracker.map(x => [x.title, x.organisation, x.status, x.addedAt])];
    const csv = rows.map(row => row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "naija-opportunity-tracker.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function loadSupabaseOpportunities() {
    const key = SUPABASE_PUBLISHABLE_KEY.trim();
    if (!key || key === "PASTE_YOUR_NEW_PUBLISHABLE_KEY_HERE") {
      $("dataStatus").textContent = "Database key not added yet";
      $("dataNotice").innerHTML = "<strong>Setup needed:</strong> Add your new Supabase publishable key in the code before publishing. The cards currently shown are demonstration cards, not verified listings.";
      renderOpportunities();
      return;
    }
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      $("dataStatus").textContent = "Database library did not load";
      renderOpportunities();
      return;
    }
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, key);
      const { data, error } = await supabaseClient
        .from("opportunities")
        .select("id,title,organization,category,description,eligibility,location,application_url,source_url,deadline,status,verified_at,created_at")
        .eq("status", "published")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (Array.isArray(data) && data.length) {
        opportunities = data.map(item => ({
          id: String(item.id),
          title: item.title || "Untitled opportunity",
          organisation: item.organization || "Organisation not specified",
          category: item.category || "Opportunity",
          location: item.location || "Nigeria",
          eligibility: item.eligibility || "Check official requirements",
          description: item.description || "Visit the official source for full details.",
          deadline: item.deadline || "",
          url: item.application_url || item.source_url || "",
          verified: Boolean(item.verified_at),
          created_at: item.created_at || ""
        }));
        $("dataNotice").innerHTML = "<strong>Reminder:</strong> Listings are loaded from the database. Check each official source to confirm eligibility and deadlines before applying.";
        $("dataStatus").textContent = "Connected · published database listings loaded";
      } else {
        $("dataStatus").textContent = "Connected · no published listings yet";
        $("dataNotice").innerHTML = "<strong>Database connected:</strong> No published opportunities have been added yet, so demonstration cards are shown. They are not confirmed live opportunities.";
      }
      renderOpportunities();
      renderTracker();
    } catch (error) {
      console.error("Supabase connection error:", error);
      $("dataStatus").textContent = "Could not connect to database";
      $("dataNotice").innerHTML = "<strong>Connection issue:</strong> Demonstration cards are shown for now. Check that the Project URL and publishable key are correct and that the public read policy allows published opportunities.";
      renderOpportunities();
    }
  }

  $("menuBtn").addEventListener("click", () => {
    const nav = $("navLinks");
    const isOpen = nav.classList.toggle("open");
    $("menuBtn").setAttribute("aria-expanded", String(isOpen));
  });
  $("navLinks").querySelectorAll("a").forEach(a => a.addEventListener("click", () => {
    $("navLinks").classList.remove("open");
    $("menuBtn").setAttribute("aria-expanded", "false");
  }));
  ["searchInput","categoryFilter","sortFilter"].forEach(id => $(id).addEventListener(id === "searchInput" ? "input" : "change", renderOpportunities));
  $("clearFilters").addEventListener("click", () => {
    $("searchInput").value = ""; $("categoryFilter").value = "All"; $("sortFilter").value = "newest";
    activeCategory = "All";
    document.querySelectorAll(".category").forEach(btn => btn.classList.toggle("active", btn.dataset.category === "All"));
    renderOpportunities();
  });
  $("categoryButtons").addEventListener("click", event => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    activeCategory = button.dataset.category;
    $("categoryFilter").value = "All";
    document.querySelectorAll(".category").forEach(btn => btn.classList.toggle("active", btn === button));
    renderOpportunities();
  });
  $("opportunityGrid").addEventListener("click", event => {
    const bookmarkButton = event.target.closest("[data-bookmark]");
    if (bookmarkButton) {
      const id = String(bookmarkButton.dataset.bookmark);
      const bookmarks = getBookmarks();
      saveBookmarks(bookmarks.includes(id) ? bookmarks.filter(x => x !== id) : [...bookmarks, id]);
      renderOpportunities();
      showToast(bookmarks.includes(id) ? "Bookmark removed." : "Opportunity saved.");
      return;
    }
    const trackButton = event.target.closest("[data-track]");
    if (trackButton) trackOpportunity(trackButton.dataset.track);
  });
  $("trackerList").addEventListener("change", event => {
    const select = event.target.closest("[data-status]");
    if (!select) return;
    const tracker = getTracker();
    const item = tracker.find(row => String(row.id) === String(select.dataset.status));
    if (item) { item.status = select.value; saveTracker(tracker); showToast("Application status updated."); }
  });
  $("trackerList").addEventListener("click", event => {
    const button = event.target.closest("[data-remove-track]");
    if (!button) return;
    saveTracker(getTracker().filter(row => String(row.id) !== String(button.dataset.removeTrack)));
    renderTracker(); showToast("Removed from tracker.");
  });
  $("exportTracker").addEventListener("click", exportCSV);
  $("clearTracker").addEventListener("click", () => {
    if (!getTracker().length) { showToast("Your tracker is already empty."); return; }
    if (confirm("Clear all items from your application tracker on this device?")) {
      saveTracker([]); renderTracker(); showToast("Tracker cleared.");
    }
  });

  $("year").textContent = new Date().getFullYear();
  renderOpportunities();
  renderTracker();
  loadSupabaseOpportunities();
})();
