
import { createClient } from
  "https://esm.sh/@supabase/supabase-js@2";

"use strict";

// =====================================================
// NAija OPPORTUNITY HUB — ADMIN DASHBOARD
// =====================================================

const SUPABASE_URL =
  "https://djxornmwvkauhkcuhgxc.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_EDReCY3JcN4vMuypVfqcMQ_GcTEVuBq";

const EDGE_FUNCTION = "noh-publish-opportunities";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

const $ = (id) => document.getElementById(id);

const authPanel = $("auth-panel");
const dashboard = $("dashboard");

const allowedCategories = [
  "Scholarship",
  "Job",
  "Internship",
  "Grant",
  "Fellowship",
  "Training",
  "Other"
];

let currentSession = null;

// =====================================================
// MESSAGE DISPLAY
// =====================================================

function showMessage(element, message, type = "info") {
  if (!element) return;

  element.textContent = message;
  element.className = `notice show ${type}`;
}

function clearMessage(element) {
  if (!element) return;

  element.textContent = "";
  element.className = "notice";
}

function setLoading(button, loading, loadingText = "Please wait...") {
  if (!button) return;

  if (loading) {
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
  } else {
    button.textContent =
      button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

// =====================================================
// AUTHENTICATION AND ADMIN CHECK
// =====================================================

function isAdmin(user) {
  return user?.app_metadata?.role === "admin";
}

function showLogin(message = "") {
  authPanel.hidden = false;
  dashboard.hidden = true;

  if (message) {
    showMessage($("auth-message"), message, "error");
  } else {
    clearMessage($("auth-message"));
  }
}

async function showDashboard(session) {
  currentSession = session;

  const user = session?.user;

  if (!user) {
    showLogin("Please sign in to continue.");
    return;
  }

  if (!isAdmin(user)) {
    await supabase.auth.signOut();

    currentSession = null;

    showLogin(
      "Access denied. Your account has not been assigned the NOH administrator role. Contact the system administrator."
    );

    return;
  }

  authPanel.hidden = true;
  dashboard.hidden = false;

  $("admin-email").textContent =
    `Signed in as ${user.email || "Administrator"}`;

  await loadDashboardStats();
}

// =====================================================
// SIGN IN
// =====================================================

$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const button = $("login-button");

  clearMessage($("auth-message"));
  setLoading(button, true, "Signing in...");

  try {
    const email = $("login-email").value.trim();
    const password = $("login-password").value;

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password
      });

    if (error) throw error;

    if (!data.session || !isAdmin(data.user)) {
      await supabase.auth.signOut();

      throw new Error(
        "This account does not have administrator access."
      );
    }

    await showDashboard(data.session);

  } catch (error) {
    showMessage(
      $("auth-message"),
      error.message || "Unable to sign in.",
      "error"
    );
  } finally {
    setLoading(button, false);
  }
});

// =====================================================
// AUTH SESSION RESTORATION
// =====================================================

async function initialiseAdmin() {
  try {
    const {
      data: { session },
      error
    } = await supabase.auth.getSession();

    if (error) throw error;

    if (session) {
      await showDashboard(session);
    } else {
      showLogin();
    }

  } catch (error) {
    showLogin(
      error.message || "Unable to check your session."
    );
  }
}

supabase.auth.onAuthStateChange(
  async (event, session) => {
    if (event === "SIGNED_OUT") {
      currentSession = null;
      showLogin();
      return;
    }

    if (
      event === "SIGNED_IN" ||
      event === "TOKEN_REFRESHED" ||
      event === "INITIAL_SESSION"
    ) {
      if (session) {
        await showDashboard(session);
      }
    }
  }
);

// =====================================================
// EDGE FUNCTION REQUEST
// =====================================================

async function callPublisher(payload) {
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();

  if (sessionError) throw sessionError;

  if (!session?.access_token) {
    throw new Error(
      "Your session has expired. Please sign in again."
    );
  }

  if (!isAdmin(session.user)) {
    throw new Error(
      "Administrator permission is required."
    );
  }

  const { data, error } = await supabase.functions.invoke(
    EDGE_FUNCTION,
    {
      body: payload
    }
  );

  if (error) {
    let details = error.message || "The publishing request failed.";

    if (error.context) {
      try {
        const response = error.context;

        if (typeof response.json === "function") {
          const body = await response.json();

          details = body.error || body.message || details;
        }
      } catch {
        // Keep the original error message.
      }
    }

    throw new Error(details);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

// =====================================================
// FORM DATA
// =====================================================

function getSingleOpportunity() {
  const form = $("single-form");

  const formData = new FormData(form);

  return {
    title: String(formData.get("title") || "").trim(),

    organization: String(
      formData.get("organization") || ""
    ).trim(),

    category: String(
      formData.get("category") || ""
    ).trim(),

    description: String(
      formData.get("description") || ""
    ).trim(),

    eligibility: String(
      formData.get("eligibility") || ""
    ).trim(),

    location: String(
      formData.get("location") || ""
    ).trim(),

    deadline: String(
      formData.get("deadline") || ""
    ).trim() || null,

    application_url: String(
      formData.get("application_url") || ""
    ).trim(),

    source_url: String(
      formData.get("source_url") || ""
    ).trim() || null,

    status: String(
      formData.get("status") || "pending"
    ).trim()
  };
}

// =====================================================
// CLIENT-SIDE VALIDATION
// =====================================================

function validateOpportunity(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    throw new Error("Each opportunity must be a JSON object.");
  }

  const required = [
    "title",
    "organization",
    "category",
    "description",
    "application_url"
  ];

  for (const field of required) {
    if (
      typeof item[field] !== "string" ||
      !item[field].trim()
    ) {
      throw new Error(
        `Missing or invalid required field: ${field}`
      );
    }
  }

  if (!allowedCategories.includes(item.category)) {
    throw new Error(
      `Invalid category "${item.category}".`
    );
  }

  if (
    item.status &&
    !["pending", "published"].includes(item.status)
  ) {
    throw new Error(
      "Status must be pending or published."
    );
  }

  const checkUrl = (value, fieldName) => {
    if (!value) return;

    let url;

    try {
      url = new URL(value);
    } catch {
      throw new Error(`${fieldName} is not a valid URL.`);
    }

    if (url.protocol !== "https:") {
      throw new Error(
        `${fieldName} must use HTTPS.`
      );
    }
  };

  checkUrl(item.application_url, "Application link");
  checkUrl(item.source_url, "Source link");

  if (item.deadline) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(item.deadline) ||
      Number.isNaN(Date.parse(`${item.deadline}T00:00:00Z`))
    ) {
      throw new Error(
        `Invalid deadline for "${item.title}".`
      );
    }
  }
}

// =====================================================
// PUBLISH ONE OPPORTUNITY
// =====================================================

$("single-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const button = $("single-submit");
  const message = $("dashboard-message");

  clearMessage(message);

  try {
    const opportunity = getSingleOpportunity();

    validateOpportunity(opportunity);

    const confirmed = $("verified-confirmation").checked;

    if (
      opportunity.status === "published" &&
      !confirmed
    ) {
      throw new Error(
        "Please confirm that you have verified the opportunity before publishing it."
      );
    }

    setLoading(button, true, "Submitting...");

    const result = await callPublisher({
      action: "publish",
      opportunities: [opportunity],
      verified_confirmation: confirmed
    });

    const inserted = result.inserted ?? 0;
    const duplicates = result.duplicates ?? 0;

    showMessage(
      message,
      `Submission completed.\nAdded: ${inserted}\nDuplicates skipped: ${duplicates}`,
      "success"
    );

    $("single-form").reset();

    await loadDashboardStats();

  } catch (error) {
    showMessage(
      message,
      error.message || "Unable to add opportunity.",
      "error"
    );
  } finally {
    setLoading(button, false);
  }
});

// =====================================================
// BULK JSON IMPORT
// =====================================================

$("bulk-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const button = $("bulk-submit");
  const message = $("bulk-message");

  clearMessage(message);

  try {
    const raw = $("bulk-json").value.trim();

    if (!raw) {
      throw new Error("Paste your opportunity JSON first.");
    }

    let opportunities;

    try {
      opportunities = JSON.parse(raw);
    } catch {
      throw new Error(
        "Invalid JSON. Check commas, quotation marks and brackets."
      );
    }

    if (!Array.isArray(opportunities)) {
      throw new Error(
        "Your JSON must be an array of opportunities."
      );
    }

    if (opportunities.length === 0) {
      throw new Error("The opportunity list is empty.");
    }

    if (opportunities.length > 100) {
      throw new Error(
        "You can import a maximum of 100 opportunities per submission."
      );
    }

    opportunities.forEach((item, index) => {
      try {
        validateOpportunity(item);
      } catch (error) {
        throw new Error(
          `Opportunity ${index + 1}: ${error.message}`
        );
      }
    });

    const hasPublished = opportunities.some(
      item => (item.status || "pending") === "published"
    );

    const confirmed =
      $("bulk-verified-confirmation").checked;

    if (hasPublished && !confirmed) {
      throw new Error(
        "Please confirm that you have verified every opportunity marked for publication."
      );
    }

    setLoading(button, true, "Importing opportunities...");

    const result = await callPublisher({
      action: "publish",
      opportunities,
      verified_confirmation: confirmed
    });

    const inserted = result.inserted ?? 0;
    const duplicates = result.duplicates ?? 0;

    const skipped = Array.isArray(result.skipped)
      ? result.skipped
      : [];

    let summary =
      `Import completed.\n\n` +
      `Submitted: ${opportunities.length}\n` +
      `Added: ${inserted}\n` +
      `Duplicates skipped: ${duplicates}`;

    if (skipped.length) {
      summary +=
        "\n\nSkipped records:\n" +
        skipped.map(item =>
          `• ${item.title || "Untitled"}: ${item.reason}`
        ).join("\n");
    }

    showMessage(message, summary, "success");

    $("bulk-json").value = "";
    $("bulk-verified-confirmation").checked = false;

    await loadDashboardStats();

  } catch (error) {
    showMessage(
      message,
      error.message || "Bulk import failed.",
      "error"
    );
  } finally {
    setLoading(button, false);
  }
});

// =====================================================
// DASHBOARD STATISTICS
// =====================================================

async function loadDashboardStats() {
  const message = $("dashboard-message");

  try {
    const result = await callPublisher({
      action: "stats"
    });

    $("stat-total").textContent =
      result.total ?? 0;

    $("stat-published").textContent =
      result.published ?? 0;

    $("stat-pending").textContent =
      result.pending ?? 0;

  } catch (error) {
    showMessage(
      message,
      `Could not load dashboard statistics: ${error.message}`,
      "error"
    );
  }
}

// =====================================================
// REFRESH
// =====================================================

$("refresh-button").addEventListener("click", async () => {
  const button = $("refresh-button");

  setLoading(button, true, "Refreshing...");

  try {
    await loadDashboardStats();
  } finally {
    setLoading(button, false);
  }
});

// =====================================================
// LOG OUT
// =====================================================

$("logout-button").addEventListener("click", async () => {
  const button = $("logout-button");

  setLoading(button, true, "Signing out...");

  try {
    const { error } = await supabase.auth.signOut();

    if (error) throw error;

    currentSession = null;
    showLogin();

  } catch (error) {
    showMessage(
      $("dashboard-message"),
      error.message || "Unable to sign out.",
      "error"
    );
  } finally {
    setLoading(button, false);
  }
});

// =====================================================
// BULK IMPORT EXAMPLE
// =====================================================

$("load-example").addEventListener("click", () => {
  const example = [
    {
      title: "Graduate Internship Programme 2027",
      organization: "Example Organisation",
      category: "Internship",
      description: "A graduate internship opportunity.",
      eligibility: "Graduates from recognised institutions.",
      location: "Nigeria",
      deadline: "2027-01-30",
      application_url: "https://example.org/apply",
      source_url: "https://example.org",
      status: "pending"
    }
  ];

  $("bulk-json").value =
    JSON.stringify(example, null, 2);

  clearMessage($("bulk-message"));
});

$("clear-bulk").addEventListener("click", () => {
  $("bulk-json").value = "";
  $("bulk-verified-confirmation").checked = false;
  clearMessage($("bulk-message"));
});

// =====================================================
// START
// =====================================================

initialiseAdmin();
