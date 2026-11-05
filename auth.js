
/*
 * Naija Opportunity Hub
 * Main account authentication and navigation
 * Version 3.6
 *
 * Used by:
 * - Homepage
 * - auth.html
 * - Opportunity details page
 *
 * Includes:
 * - Sign up and sign in
 * - Password recovery and reset
 * - Account dashboard
 * - Account settings
 * - Saved Opportunities
 * - Bookmark management
 *
 * Career Kit authentication remains separate.
 */

(() => {
  "use strict";

  if (window.NOH_AUTH_INITIALISED) return;

  const SUPABASE_URL =
    "https://djxornmwvkauhkcuhgxc.supabase.co";

  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_EDReCY3JcN4vMuypVfqcMQ_GcTEVuBq";

  const BOOKMARKS_KEY = "noh_bookmarks_v1";
  const STATUS_KEY = "noh_saved_status_v1";
  const LEGACY_TRACKER_KEY = "noh_tracker_v1";
  const LEGACY_MIGRATED_KEY = "noh_tracker_migrated_v1";

  const SAVED_STATUSES = [
    "Interested",
    "Applied",
    "Interview",
    "Successful",
    "Unsuccessful"
  ];

  const $ = (id) => document.getElementById(id);

  const library = window.supabase;
  const existingClient = window.NOH_SUPABASE_CLIENT;

  if (!existingClient && !library?.createClient) {
    console.error("NOH Auth: Supabase library was not loaded.");
    return;
  }

  const supabase =
    existingClient ||
    library.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY
    );

  window.NOH_SUPABASE_CLIENT = supabase;

  // Authentication page elements
  const signupForm = $("signupForm");
  const loginForm = $("loginForm");
  const resetForm = $("resetForm");
  const loggedInPanel = $("loggedInPanel");

  const authMessage = $("authMessage");
  const authHeading = $("authHeading");
  const authSubheading = $("authSubheading");

  const signupButton = $("signupButton");
  const loginButton = $("loginButton");
  const resetButton = $("resetButton");

  const accountEmail = $("accountEmail");

  const authPageExists = Boolean(
    signupForm &&
    loginForm &&
    resetForm &&
    loggedInPanel
  );

  // Authentication state
  let recoveryMode = false;
  let currentUser = null;

  // Homepage account elements
  const accountMenu = $("accountMenu");
  const accountMenuButton = $("accountMenuButton");
  const accountDropdown = $("accountDropdown");
  const navLogoutButton = $("navLogoutButton");

  // Account dashboard elements
  const accountDashboard = $("accountDashboard");
  const accountDashboardEmail = $("accountDashboardEmail");
  const accountDashboardTitle = $("accountDashboardTitle");

  const accountOverview = $("accountOverview");
  const accountSettings = $("accountSettings");

  // Saved Opportunities dashboard elements
  const savedOpportunitiesPanel =
    $("accountSavedOpportunities");

  const savedOpportunitiesTab =
    $("accountSavedTab");

  const savedOpportunitiesList =
    $("accountSavedOpportunitiesList");

  const accountPasswordForm = $("accountPasswordForm");
  const accountPasswordButton = $("accountPasswordButton");
  const accountSettingsMessage = $("accountSettingsMessage");

  let previousFocus = null;
  let savedOpportunitiesRequest = 0;
  let lastSavedOpportunities = [];

  /* ---------------------------------------------------------
     GENERAL HELPERS
  --------------------------------------------------------- */

  function setVisible(element, visible) {
    if (element) {
      element.hidden = !visible;
    }
  }

  function showMessage(message, type = "error") {
    if (!authMessage) return;

    authMessage.textContent = message;
    authMessage.className = `auth-message show ${type}`;
    authMessage.setAttribute("role", "status");
    authMessage.setAttribute("aria-live", "polite");
  }

  function clearMessage() {
    if (!authMessage) return;

    authMessage.textContent = "";
    authMessage.className = "auth-message";
  }

  function setLoading(button, loading, loadingText, normalText) {
    if (!button) return;

    button.disabled = loading;
    button.textContent = loading ? loadingText : normalText;
  }

  function getAuthPageURL() {
    return `${window.location.origin}/auth.html`;
  }

  function safeRedirect(path) {
    if (
      typeof path !== "string" ||
      !path.startsWith("/") ||
      path.startsWith("//") ||
      path.includes("\\")
    ) {
      return false;
    }

    try {
      const destination = new URL(
        path,
        window.location.origin
      );

      if (destination.origin !== window.location.origin) {
        return false;
      }

      window.location.assign(destination.href);
      return true;

    } catch (error) {
      console.warn("NOH Auth: Invalid redirect rejected.");
      return false;
    }
  }

  function friendlyAuthError(error, fallback) {
    const message = String(
      error?.message || ""
    ).toLowerCase();

    if (
      message.includes("invalid login credentials") ||
      message.includes("invalid credentials")
    ) {
      return "Your email address or password is incorrect. Please check and try again.";
    }

    if (message.includes("email not confirmed")) {
      return "Please confirm your email address before signing in.";
    }

    if (
      message.includes("already registered") ||
      message.includes("already exists")
    ) {
      return "An account with this email may already exist. Please sign in instead.";
    }

    if (
      message.includes("password should be at least") ||
      message.includes("password is too short")
    ) {
      return "Your password must contain at least 8 characters.";
    }

    if (
      message.includes("rate limit") ||
      message.includes("too many requests")
    ) {
      return "Too many attempts. Please wait a little and try again.";
    }

    return fallback;
  }

  function getURLParameters() {
    return new URLSearchParams(window.location.search);
  }

  function isRecoveryURL() {
    const query = getURLParameters();

    const hash = new URLSearchParams(
      window.location.hash.replace(/^#/, "")
    );

    return (
      query.get("type") === "recovery" ||
      hash.get("type") === "recovery"
    );
  }

  /* ---------------------------------------------------------
     SAVED OPPORTUNITIES - STORAGE
  --------------------------------------------------------- */

  function getSavedOpportunityIds() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(BOOKMARKS_KEY) || "[]"
      );

      if (!Array.isArray(saved)) return [];

      return [
        ...new Set(
          saved
            .filter(id =>
              typeof id === "string" ||
              typeof id === "number"
            )
            .map(String)
            .filter(Boolean)
        )
      ];

    } catch (error) {
      console.warn(
        "NOH: Could not read saved opportunities.",
        error
      );

      return [];
    }
  }

  function storeSavedOpportunityIds(ids) {
    const uniqueIds = [
      ...new Set(
        ids
          .filter(Boolean)
          .map(String)
      )
    ];

    try {
      localStorage.setItem(
        BOOKMARKS_KEY,
        JSON.stringify(uniqueIds)
      );

      window.dispatchEvent(
        new CustomEvent("noh:bookmarks-updated", {
          detail: { ids: uniqueIds }
        })
      );

    } catch (error) {
      console.error(
        "NOH: Could not save bookmarks.",
        error
      );

      throw error;
    }
  }

  function addSavedOpportunity(id) {
    if (id === undefined || id === null || id === "") {
      return false;
    }

    const opportunityId = String(id);
    const ids = getSavedOpportunityIds();

    if (ids.includes(opportunityId)) {
      return true;
    }

    ids.push(opportunityId);
    storeSavedOpportunityIds(ids);

    return true;
  }

  function removeSavedOpportunity(id) {
    if (id === undefined || id === null || id === "") {
      return;
    }

    const opportunityId = String(id);

    const ids = getSavedOpportunityIds().filter(
      savedId => savedId !== opportunityId
    );

    storeSavedOpportunityIds(ids);
  }

  function toggleSavedOpportunity(id) {
    if (id === undefined || id === null || id === "") {
      return false;
    }

    const opportunityId = String(id);
    const ids = getSavedOpportunityIds();

    if (ids.includes(opportunityId)) {
      removeSavedOpportunity(opportunityId);
      return false;
    }

    addSavedOpportunity(opportunityId);
    return true;
  }

  function isOpportunitySaved(id) {
    return getSavedOpportunityIds().includes(String(id));
  }

  // Public bookmark interface for other NOH scripts.
  window.NOH_BOOKMARKS = {
    getAll: getSavedOpportunityIds,
    add: addSavedOpportunity,
    remove: removeSavedOpportunity,
    toggle: toggleSavedOpportunity,
    isSaved: isOpportunitySaved
  };

  /* ---------------------------------------------------------
     SAVED OPPORTUNITIES - APPLICATION STATUS
     (this replaces the old homepage application tracker)
  --------------------------------------------------------- */

  function getSavedStatusMap() {
    try {
      const value = JSON.parse(
        localStorage.getItem(STATUS_KEY) || "{}"
      );

      return value &&
        typeof value === "object" &&
        !Array.isArray(value)
        ? value
        : {};

    } catch (error) {
      return {};
    }
  }

  function storeSavedStatusMap(map) {
    try {
      localStorage.setItem(STATUS_KEY, JSON.stringify(map));
    } catch (error) {
      console.error("NOH: Could not save status.", error);
    }
  }

  function getSavedStatus(id) {
    const status = getSavedStatusMap()[String(id)];

    return SAVED_STATUSES.includes(status)
      ? status
      : "Interested";
  }

  function setSavedStatus(id, status) {
    if (!SAVED_STATUSES.includes(status)) return;

    const map = getSavedStatusMap();
    map[String(id)] = status;
    storeSavedStatusMap(map);
  }

  // One-time move of items from the old homepage tracker into the
  // saved opportunities list, keeping their application status.
  function migrateLegacyTracker() {
    try {
      if (localStorage.getItem(LEGACY_MIGRATED_KEY)) return;

      const raw = localStorage.getItem(LEGACY_TRACKER_KEY);

      if (raw) {
        const legacy = JSON.parse(raw);

        if (Array.isArray(legacy) && legacy.length) {
          const ids = getSavedOpportunityIds();
          const statuses = getSavedStatusMap();

          legacy.forEach(item => {
            if (!item || item.id === undefined || item.id === null) {
              return;
            }

            const id = String(item.id);

            if (!ids.includes(id)) ids.push(id);

            if (
              !statuses[id] &&
              SAVED_STATUSES.includes(item.status)
            ) {
              statuses[id] = item.status;
            }
          });

          storeSavedStatusMap(statuses);
          storeSavedOpportunityIds(ids);
        }
      }

      localStorage.setItem(LEGACY_MIGRATED_KEY, "1");

    } catch (error) {
      console.warn("NOH: Tracker migration skipped.", error);
    }
  }

  function safeHttpURL(value) {
    if (!value) return "";

    try {
      const url = new URL(String(value).trim());

      return ["https:", "http:"].includes(url.protocol)
        ? url.href
        : "";

    } catch (error) {
      return "";
    }
  }

  function csvCell(value) {
    let text = String(value ?? "");

    // Stop spreadsheet formulas in exported text.
    if (/^\s*[=+@-]/.test(text)) text = `'${text}`;

    return `"${text.replace(/"/g, '""')}"`;
  }

  /* ---------------------------------------------------------
     SAVED OPPORTUNITIES - DASHBOARD
  --------------------------------------------------------- */

  function renderSavedMessage(container, message) {
    if (!container) return;

    container.replaceChildren();

    const paragraph = document.createElement("p");
    paragraph.className = "empty";
    paragraph.textContent = message;

    container.appendChild(paragraph);
  }

  function createSavedOpportunityCard(opportunity) {
    const card = document.createElement("article");

    card.className = "account-saved-card";

    const title = document.createElement("h4");
    title.textContent =
      opportunity.title || "Untitled opportunity";

    const organisation = document.createElement("p");
    organisation.textContent =
      opportunity.organization || "Organisation not specified";

    const category = document.createElement("p");
    category.textContent =
      opportunity.category || "Opportunity";

    card.append(title, organisation, category);

    if (opportunity.location) {
      const location = document.createElement("p");
      location.textContent = `Location: ${opportunity.location}`;
      card.appendChild(location);
    }

    if (opportunity.deadline) {
      const deadline = document.createElement("p");
      deadline.textContent = `Deadline: ${opportunity.deadline}`;
      card.appendChild(deadline);
    }

    // Application progress
    const statusLabel = document.createElement("label");
    statusLabel.className = "account-saved-status";

    const statusText = document.createElement("span");
    statusText.textContent = "Application status";

    const statusSelect = document.createElement("select");
    statusSelect.dataset.savedStatus = String(opportunity.id);

    const currentStatus = getSavedStatus(opportunity.id);

    SAVED_STATUSES.forEach(status => {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = status;
      option.selected = status === currentStatus;
      statusSelect.appendChild(option);
    });

    statusLabel.append(statusText, statusSelect);
    card.appendChild(statusLabel);

    const actions = document.createElement("div");
    actions.className = "account-saved-actions";

    const openLink = document.createElement("a");

    openLink.href =
      `/opportunity-details.html?id=` +
      encodeURIComponent(String(opportunity.id));

    openLink.className = "button button-primary";
    openLink.textContent = "View opportunity";

    actions.appendChild(openLink);

    const applicationURL = safeHttpURL(
      opportunity.application_url || opportunity.source_url
    );

    if (applicationURL) {
      const applyLink = document.createElement("a");

      applyLink.href = applicationURL;
      applyLink.target = "_blank";
      applyLink.rel = "noopener noreferrer";
      applyLink.className = "button button-outline";
      applyLink.textContent = "Open application";

      actions.appendChild(applyLink);
    }

    const removeButton = document.createElement("button");

    removeButton.type = "button";
    removeButton.className = "button button-danger";
    removeButton.textContent = "Remove";
    removeButton.dataset.removeSavedOpportunity =
      String(opportunity.id);

    actions.appendChild(removeButton);
    card.appendChild(actions);

    return card;
  }

  async function renderSavedOpportunities() {
    if (!savedOpportunitiesList) return;

    const requestNumber = ++savedOpportunitiesRequest;
    const ids = getSavedOpportunityIds();

    if (!ids.length) {
      renderSavedMessage(
        savedOpportunitiesList,
        "You have not saved any opportunities yet. Browse opportunities and bookmark the ones you want to revisit."
      );

      return;
    }

    renderSavedMessage(
      savedOpportunitiesList,
      "Loading your saved opportunities..."
    );

    try {
      const { data, error } = await supabase
        .from("opportunities")
        .select(
          "id, title, organization, category, deadline, location, status, application_url, source_url"
        )
        .in("id", ids)
        .eq("status", "published");

      if (error) throw error;

      // Ignore an older request if a newer one has started.
      if (requestNumber !== savedOpportunitiesRequest) {
        return;
      }

      const opportunities = data || [];
      lastSavedOpportunities = opportunities;

      // Preserve the order in which the user saved items.
      opportunities.sort(
        (a, b) =>
          ids.indexOf(String(a.id)) -
          ids.indexOf(String(b.id))
      );

      savedOpportunitiesList.replaceChildren();

      if (!opportunities.length) {
        renderSavedMessage(
          savedOpportunitiesList,
          "Your saved opportunities are no longer available. Browse the latest opportunities and save new ones."
        );

        return;
      }

      opportunities.forEach(opportunity => {
        savedOpportunitiesList.appendChild(
          createSavedOpportunityCard(opportunity)
        );
      });

    } catch (error) {
      console.error(
        "NOH saved opportunities error:",
        error
      );

      if (requestNumber === savedOpportunitiesRequest) {
        renderSavedMessage(
          savedOpportunitiesList,
          "We could not load your saved opportunities. Please try again."
        );
      }
    }
  }

  /* ---------------------------------------------------------
     BOOKMARK BUTTONS - OPPORTUNITY DETAILS
  --------------------------------------------------------- */

  function updateBookmarkButton(button) {
    if (!button) return;

    const id = button.dataset.nohBookmark;

    if (!id) return;

    const saved = isOpportunitySaved(id);

    button.textContent = saved
      ? "Saved"
      : "Save opportunity";

    button.setAttribute(
      "aria-pressed",
      String(saved)
    );
  }

  function updateAllBookmarkButtons() {
    document.querySelectorAll("[data-noh-bookmark]")
      .forEach(updateBookmarkButton);
  }

  document.addEventListener("click", event => {
    const target = event.target;

    if (!(target instanceof Element)) return;

    const removeButton = target.closest(
      "[data-remove-saved-opportunity]"
    );

    if (removeButton) {
      removeSavedOpportunity(
        removeButton.dataset.removeSavedOpportunity
      );

      return;
    }

    const bookmarkButton = target.closest(
      "[data-noh-bookmark]"
    );

    if (!bookmarkButton) return;

    const id = bookmarkButton.dataset.nohBookmark;

    if (!id) return;

    try {
      toggleSavedOpportunity(id);
      updateBookmarkButton(bookmarkButton);

    } catch (error) {
      console.error("NOH bookmark update error:", error);

      alert(
        "We could not update your saved opportunities. Please check your browser storage and try again."
      );
    }
  });

  /* ---------------------------------------------------------
     BOOKMARK CHANGE EVENTS
  --------------------------------------------------------- */

  window.addEventListener("storage", event => {
    if (event.key === BOOKMARKS_KEY) {
      updateAllBookmarkButtons();

      if (
        accountDashboard &&
        !accountDashboard.hidden &&
        savedOpportunitiesPanel &&
        !savedOpportunitiesPanel.hidden
      ) {
        renderSavedOpportunities();
      }
    }
  });

  window.addEventListener("noh:bookmarks-updated", () => {
    updateAllBookmarkButtons();

    if (
      accountDashboard &&
      !accountDashboard.hidden &&
      savedOpportunitiesPanel &&
      !savedOpportunitiesPanel.hidden
    ) {
      renderSavedOpportunities();
    }
  });

  /* ---------------------------------------------------------
     HOMEPAGE NAVIGATION
  --------------------------------------------------------- */

  function closeAccountDropdown() {
    setVisible(accountDropdown, false);

    if (accountMenuButton) {
      accountMenuButton.setAttribute(
        "aria-expanded",
        "false"
      );
    }
  }

  function updateHomepageNavigation(user) {
    const signedIn = Boolean(user);

    // Keep the account control visible for everyone.
    setVisible(accountMenu, true);

    // The green "Active" badge is for signed-in visitors only.
    setVisible($("accountActiveBadge"), signedIn);

    if (accountMenuButton) {
      accountMenuButton.setAttribute(
        "aria-label",
        signedIn
          ? "Open your account menu"
          : "Sign in or create an account"
      );

      accountMenuButton.setAttribute(
        "aria-expanded",
        "false"
      );
    }

    if (!signedIn) {
      closeAccountDropdown();
      closeAccountDashboard();

      if (accountDashboardEmail) {
        accountDashboardEmail.textContent = "";
      }
    }

    if (accountDashboardEmail && user?.email) {
      accountDashboardEmail.textContent = user.email;
    }
  }

  if (accountMenuButton) {
    accountMenuButton.addEventListener("click", () => {
      if (!currentUser) {
        window.location.assign("/auth.html?mode=login");
        return;
      }

      const isOpen =
        accountMenuButton.getAttribute("aria-expanded") === "true";

      setVisible(accountDropdown, !isOpen);

      accountMenuButton.setAttribute(
        "aria-expanded",
        String(!isOpen)
      );
    });
  }

  document.addEventListener("click", event => {
    if (
      !accountMenu ||
      !accountDropdown ||
      accountDropdown.hidden
    ) {
      return;
    }

    if (!accountMenu.contains(event.target)) {
      closeAccountDropdown();
    }
  });

  /* ---------------------------------------------------------
     ACCOUNT DASHBOARD
  --------------------------------------------------------- */

  function showAccountView(view) {
    const validViews = [
      "overview",
      "saved",
      "settings"
    ];

    if (!validViews.includes(view)) {
      view = "overview";
    }

    const settings = view === "settings";
    const saved = view === "saved";

    setVisible(accountOverview, !settings && !saved);
    setVisible(accountSettings, settings);
    setVisible(savedOpportunitiesPanel, saved);

    if (accountDashboardTitle) {
      accountDashboardTitle.textContent = settings
        ? "Account Settings"
        : saved
          ? "My Saved Opportunities"
          : "My Account";
    }

    document.querySelectorAll("[data-account-tab]")
      .forEach(tab => {
        const active = tab.dataset.accountTab === view;

        tab.classList.toggle("active", active);

        tab.setAttribute(
          "aria-selected",
          String(active)
        );
      });

    if (settings) {
      $("accountNewPassword")?.focus();
    }

    if (saved) {
      renderSavedOpportunities();
    }
  }

  function openAccountDashboard(view = "overview") {
    if (!currentUser || !accountDashboard) return;

    previousFocus = document.activeElement;

    closeAccountDropdown();

    setVisible(accountDashboard, true);

    accountDashboard.setAttribute(
      "aria-hidden",
      "false"
    );

    document.body.classList.add("account-dashboard-open");

    if (accountDashboardEmail) {
      accountDashboardEmail.textContent =
        currentUser.email || "Account email unavailable";
    }

    showAccountView(view);

    accountDashboard
      .querySelector(".account-dashboard-close")
      ?.focus();
  }

  function closeAccountDashboard() {
    if (!accountDashboard || accountDashboard.hidden) return;

    setVisible(accountDashboard, false);

    accountDashboard.setAttribute(
      "aria-hidden",
      "true"
    );

    document.body.classList.remove("account-dashboard-open");

    if (
      previousFocus &&
      typeof previousFocus.focus === "function" &&
      document.contains(previousFocus)
    ) {
      previousFocus.focus();
    }

    previousFocus = null;
  }

  document.addEventListener("click", event => {
    const target = event.target;

    if (!(target instanceof Element)) return;

    const viewButton = target.closest("[data-account-view]");

    if (viewButton) {
      event.preventDefault();

      openAccountDashboard(
        viewButton.dataset.accountView || "overview"
      );

      return;
    }

    const tabButton = target.closest("[data-account-tab]");

    if (tabButton) {
      showAccountView(tabButton.dataset.accountTab);
      return;
    }

    if (target.closest("[data-close-account]")) {
      closeAccountDashboard();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeAccountDropdown();
      closeAccountDashboard();
      return;
    }

    if (
      event.key !== "Tab" ||
      !accountDashboard ||
      accountDashboard.hidden
    ) {
      return;
    }

    const focusable = accountDashboard.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    const items = Array.from(focusable).filter(
      element => element.offsetParent !== null
    );

    if (!items.length) return;

    const first = items[0];
    const last = items[items.length - 1];

    if (
      event.shiftKey &&
      document.activeElement === first
    ) {
      event.preventDefault();
      last.focus();

    } else if (
      !event.shiftKey &&
      document.activeElement === last
    ) {
      event.preventDefault();
      first.focus();
    }
  });

  /* ---------------------------------------------------------
     SAVED OPPORTUNITIES - STATUS, EXPORT AND CLEAR
  --------------------------------------------------------- */

  function exportSavedOpportunities() {
    if (!lastSavedOpportunities.length) {
      alert("You have no saved opportunities to export yet.");
      return;
    }

    const rows = [
      [
        "Title",
        "Organisation",
        "Category",
        "Deadline",
        "Application URL",
        "Status"
      ],
      ...lastSavedOpportunities.map(item => [
        item.title,
        item.organization,
        item.category,
        item.deadline || "",
        safeHttpURL(item.application_url || item.source_url),
        getSavedStatus(item.id)
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
    link.download = "naija-opportunity-hub-saved.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  function clearSavedOpportunities() {
    if (!getSavedOpportunityIds().length) {
      alert("You have no saved opportunities to clear.");
      return;
    }

    if (!window.confirm(
      "Remove all your saved opportunities? This cannot be undone."
    )) {
      return;
    }

    storeSavedStatusMap({});
    storeSavedOpportunityIds([]);
  }

  document.addEventListener("click", event => {
    const target = event.target;

    if (!(target instanceof Element)) return;

    if (target.closest("[data-saved-export]")) {
      exportSavedOpportunities();
      return;
    }

    if (target.closest("[data-saved-clear]")) {
      clearSavedOpportunities();
    }
  });

  document.addEventListener("change", event => {
    const target = event.target;

    if (!(target instanceof Element)) return;

    const select = target.closest("[data-saved-status]");

    if (!select) return;

    setSavedStatus(select.dataset.savedStatus, select.value);
  });

  /* ---------------------------------------------------------
     SIGN OUT
  --------------------------------------------------------- */

  async function signOut(button) {
    if (button) button.disabled = true;

    try {
      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      currentUser = null;

      closeAccountDropdown();
      closeAccountDashboard();

      window.location.assign("/");

    } catch (error) {
      console.error("NOH sign-out error:", error);

      alert("We could not sign you out. Please try again.");

      if (button) {
        button.disabled = false;
      }
    }
  }

  if (navLogoutButton) {
    navLogoutButton.addEventListener("click", () => {
      signOut(navLogoutButton);
    });
  }

  const logoutButton = $("logoutButton");

  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      signOut(logoutButton);
    });
  }

  /* ---------------------------------------------------------
     ACCOUNT PASSWORD SETTINGS
  --------------------------------------------------------- */

  if (accountPasswordForm) {
    accountPasswordForm.addEventListener("submit", async event => {
      event.preventDefault();

      if (!currentUser) {
        if (accountSettingsMessage) {
          accountSettingsMessage.textContent =
            "Please sign in again to update your password.";
        }

        return;
      }

      const password =
        $("accountNewPassword")?.value || "";

      const confirmation =
        $("accountConfirmPassword")?.value || "";

      if (password.length < 8) {
        if (accountSettingsMessage) {
          accountSettingsMessage.textContent =
            "Your password must contain at least 8 characters.";
        }

        return;
      }

      if (password !== confirmation) {
        if (accountSettingsMessage) {
          accountSettingsMessage.textContent =
            "Your passwords do not match.";
        }

        return;
      }

      setLoading(
        accountPasswordButton,
        true,
        "Updating password...",
        "Update Password"
      );

      if (accountSettingsMessage) {
        accountSettingsMessage.textContent = "";
        accountSettingsMessage.classList.remove("success");
      }

      try {
        const { error } = await supabase.auth.updateUser({
          password
        });

        if (error) throw error;

        accountPasswordForm.reset();

        if (accountSettingsMessage) {
          accountSettingsMessage.textContent =
            "Your password has been updated successfully.";

          accountSettingsMessage.classList.add("success");
        }

      } catch (error) {
        console.error(
          "NOH account password update error:",
          error
        );

        if (accountSettingsMessage) {
          accountSettingsMessage.textContent =
            friendlyAuthError(
              error,
              "We could not update your password. Please try again."
            );

          accountSettingsMessage.classList.remove("success");
        }

      } finally {
        setLoading(
          accountPasswordButton,
          false,
          "Updating password...",
          "Update Password"
        );
      }
    });
  }

  /* ---------------------------------------------------------
     AUTHENTICATION PAGE VIEW CONTROLS
  --------------------------------------------------------- */

  function setAuthMode(mode) {
    if (!authPageExists) return;

    recoveryMode = false;

    clearMessage();

    const loginMode = mode === "login";

    setVisible(signupForm, !loginMode);
    setVisible(loginForm, loginMode);
    setVisible(resetForm, false);
    setVisible(loggedInPanel, false);

    if (authHeading) {
      authHeading.textContent = loginMode
        ? "Welcome back"
        : "Create your account";
    }

    if (authSubheading) {
      authSubheading.textContent = loginMode
        ? "Sign in to continue managing your opportunities."
        : "Join NOH and keep track of opportunities that matter to you.";
    }

    document.querySelectorAll("[data-auth-action]")
      .forEach(button => {
        if (!button.closest(".auth-tabs")) return;

        const active =
          button.dataset.authAction ===
          (loginMode ? "show-login" : "show-signup");

        button.classList.toggle("active", active);

        button.setAttribute(
          "aria-selected",
          String(active)
        );
      });
  }

  function showPasswordReset() {
    if (!authPageExists) return;

    recoveryMode = true;

    clearMessage();

    setVisible(signupForm, false);
    setVisible(loginForm, false);
    setVisible(resetForm, true);
    setVisible(loggedInPanel, false);

    if (authHeading) {
      authHeading.textContent = "Reset your password";
    }

    if (authSubheading) {
      authSubheading.textContent =
        "Choose a new password for your NOH account.";
    }

    $("newPassword")?.focus();
  }

  function showLoggedInUser(user) {
    if (!user) return;

    if (accountEmail) {
      accountEmail.textContent = user.email || "Signed-in user";
    }

    if (!authPageExists) return;

    setVisible(signupForm, false);
    setVisible(loginForm, false);
    setVisible(resetForm, false);
    setVisible(loggedInPanel, true);

    if (authHeading) {
      authHeading.textContent = "Your NOH account";
    }

    if (authSubheading) {
      authSubheading.textContent =
        "You are signed in and ready to continue.";
    }
  }

  function showSignedOutState() {
    if (!authPageExists) return;

    const requestedMode = getURLParameters().get("mode");

    setAuthMode(
      requestedMode === "login" ? "login" : "signup"
    );
  }

  /* ---------------------------------------------------------
     SIGNUP
  --------------------------------------------------------- */

  if (signupForm) {
    signupForm.addEventListener("submit", async event => {
      event.preventDefault();

      clearMessage();

      const email = $("signupEmail")?.value.trim();
      const password = $("signupPassword")?.value;
      const confirmation = $("confirmPassword")?.value;

      if (!email || !password || !confirmation) {
        showMessage("Please complete all the required fields.");
        return;
      }

      if (password.length < 8) {
        showMessage(
          "Your password must contain at least 8 characters."
        );

        return;
      }

      if (password !== confirmation) {
        showMessage("Your passwords do not match.");
        return;
      }

      setLoading(
        signupButton,
        true,
        "Creating account...",
        "Create account"
      );

      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: getAuthPageURL()
          }
        });

        if (error) throw error;

        if (data.session && data.user) {
          currentUser = data.user;

          showLoggedInUser(data.user);
          updateHomepageNavigation(data.user);

          showMessage(
            "Your account has been created successfully.",
            "success"
          );

          safeRedirect("/");

        } else {
          showMessage(
            "Your account has been created. Please check your email and follow the confirmation link before signing in.",
            "success"
          );

          signupForm.reset();
        }

      } catch (error) {
        console.error("NOH signup error:", error);

        showMessage(
          friendlyAuthError(
            error,
            "We could not create your account. Please try again."
          )
        );

      } finally {
        setLoading(
          signupButton,
          false,
          "Creating account...",
          "Create account"
        );
      }
    });
  }

  /* ---------------------------------------------------------
     LOGIN
  --------------------------------------------------------- */

  if (loginForm) {
    loginForm.addEventListener("submit", async event => {
      event.preventDefault();

      clearMessage();

      const email = $("loginEmail")?.value.trim();
      const password = $("loginPassword")?.value;

      if (!email || !password) {
        showMessage("Enter your email address and password.");
        return;
      }

      setLoading(
        loginButton,
        true,
        "Signing in...",
        "Sign in"
      );

      try {
        const { data, error } =
          await supabase.auth.signInWithPassword({
            email,
            password
          });

        if (error) throw error;

        currentUser = data.user || null;

        if (currentUser) {
          showLoggedInUser(currentUser);
          updateHomepageNavigation(currentUser);

          const redirect =
            getURLParameters().get("redirect");

          if (redirect && safeRedirect(redirect)) {
            return;
          }

          safeRedirect("/");
          return;
        }

      } catch (error) {
        console.error("NOH login error:", error);

        showMessage(
          friendlyAuthError(
            error,
            "Sign-in failed. Check your details and try again."
          )
        );

      } finally {
        setLoading(
          loginButton,
          false,
          "Signing in...",
          "Sign in"
        );
      }
    });
  }

  /* ---------------------------------------------------------
     FORGOT PASSWORD
  --------------------------------------------------------- */

  const forgotPasswordButton = $("forgotPassword");

  if (forgotPasswordButton) {
    forgotPasswordButton.addEventListener("click", async () => {
      clearMessage();

      const email = $("loginEmail")?.value.trim();

      if (!email) {
        showMessage("Enter your email address first.");
        $("loginEmail")?.focus();
        return;
      }

      forgotPasswordButton.disabled = true;

      try {
        const { error } =
          await supabase.auth.resetPasswordForEmail(
            email,
            {
              redirectTo: getAuthPageURL()
            }
          );

        if (error) throw error;

        showMessage(
          "If an account exists for that email, a password-reset link will be sent. Please check your inbox.",
          "success"
        );

      } catch (error) {
        console.error(
          "NOH password reset request error:",
          error
        );

        showMessage(
          friendlyAuthError(
            error,
            "We could not send the reset email. Please try again."
          )
        );

      } finally {
        forgotPasswordButton.disabled = false;
      }
    });
  }

  /* ---------------------------------------------------------
     SET A NEW PASSWORD FROM RECOVERY EMAIL
  --------------------------------------------------------- */

  if (resetForm) {
    resetForm.addEventListener("submit", async event => {
      event.preventDefault();

      clearMessage();

      const password =
        $("newPassword")?.value || "";

      const confirmation =
        $("confirmNewPassword")?.value || "";

      if (!password || !confirmation) {
        showMessage("Please complete both password fields.");
        return;
      }

      if (password.length < 8) {
        showMessage(
          "Your new password must contain at least 8 characters."
        );

        return;
      }

      if (password !== confirmation) {
        showMessage("Your new passwords do not match.");
        return;
      }

      setLoading(
        resetButton,
        true,
        "Updating password...",
        "Update password"
      );

      try {
        const { error } = await supabase.auth.updateUser({
          password
        });

        if (error) throw error;

        resetForm.reset();
        recoveryMode = false;

        const { data } = await supabase.auth.getUser();

        if (data.user) {
          currentUser = data.user;

          showLoggedInUser(data.user);
          updateHomepageNavigation(data.user);
        }

        showMessage(
          "Your password has been updated successfully.",
          "success"
        );

      } catch (error) {
        console.error(
          "NOH password update error:",
          error
        );

        showMessage(
          friendlyAuthError(
            error,
            "We could not update your password. Please try again."
          )
        );

      } finally {
        setLoading(
          resetButton,
          false,
          "Updating password...",
          "Update password"
        );
      }
    });
  }

  /* ---------------------------------------------------------
     SWITCH LOGIN/SIGNUP TABS
  --------------------------------------------------------- */

  document.addEventListener("click", event => {
    const target = event.target;

    if (!(target instanceof Element)) return;

    const button = target.closest("[data-auth-action]");

    if (!button) return;

    if (button.dataset.authAction === "show-login") {
      setAuthMode("login");
    }

    if (button.dataset.authAction === "show-signup") {
      setAuthMode("signup");
    }
  });

  /* ---------------------------------------------------------
     RESTORE AND MONITOR THE MAIN NOH SESSION
  --------------------------------------------------------- */

  supabase.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;

    updateHomepageNavigation(currentUser);

    if (!authPageExists) return;

    if (event === "PASSWORD_RECOVERY") {
      showPasswordReset();
      return;
    }

    if (recoveryMode) return;

    if (currentUser) {
      showLoggedInUser(currentUser);

    } else if (event === "SIGNED_OUT") {
      showSignedOutState();
    }
  });

  /* ---------------------------------------------------------
     INITIALISE AUTHENTICATION
  --------------------------------------------------------- */

  async function initialiseAuth() {
    setVisible(accountMenu, false);

    if (accountDashboard) {
      accountDashboard.setAttribute("aria-hidden", "true");
    }

    // Move anything saved in the old homepage tracker into the account.
    migrateLegacyTracker();

    // Sync bookmark buttons on pages that contain them.
    updateAllBookmarkButtons();

    try {
      const { data, error } =
        await supabase.auth.getSession();

      if (error) throw error;

      currentUser = data.session?.user || null;

      updateHomepageNavigation(currentUser);

      if (!authPageExists) return;

      if (recoveryMode || isRecoveryURL()) {
        showPasswordReset();
        return;
      }

      if (currentUser) {
        safeRedirect("/");
        return;
      }

      showSignedOutState();

    } catch (error) {
      console.error(
        "NOH session initialisation error:",
        error
      );

      currentUser = null;

      updateHomepageNavigation(null);

      if (authPageExists) {
        if (recoveryMode || isRecoveryURL()) {
          showPasswordReset();
          return;
        }

        setAuthMode("signup");

        showMessage(
          "We could not check your sign-in session. Please refresh the page and try again."
        );
      }
    }
  }

  // Prevent duplicate authentication initialisation.
  window.NOH_AUTH_INITIALISED = true;

  window.NOH_AUTH_READY = initialiseAuth();

})();
