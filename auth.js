
/*
 * Naija Opportunity Hub
 * Main account authentication and navigation
 * Version 3.3
 *
 * Used by:
 * - Homepage
 * - auth.html
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

  const accountPasswordForm = $("accountPasswordForm");
  const accountPasswordButton = $("accountPasswordButton");
  const accountSettingsMessage = $("accountSettingsMessage");

  let previousFocus = null;

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

  document.addEventListener("click", (event) => {
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
    const settings = view === "settings";

    setVisible(accountOverview, !settings);
    setVisible(accountSettings, settings);

    if (accountDashboardTitle) {
      accountDashboardTitle.textContent = settings
        ? "Account Settings"
        : "My Account";
    }

    document.querySelectorAll("[data-account-tab]").forEach((tab) => {
      const active = tab.dataset.accountTab === view;

      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });

    if (settings) {
      $("accountNewPassword")?.focus();
    }
  }

  function openAccountDashboard(view = "overview") {
    if (!currentUser || !accountDashboard) return;

    previousFocus = document.activeElement;

    closeAccountDropdown();

    setVisible(accountDashboard, true);
    accountDashboard.setAttribute("aria-hidden", "false");

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
    accountDashboard.setAttribute("aria-hidden", "true");

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

  document.addEventListener("click", (event) => {
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

  document.addEventListener("keydown", (event) => {
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
      (element) => element.offsetParent !== null
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
    accountPasswordForm.addEventListener("submit", async (event) => {
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

    document.querySelectorAll("[data-auth-action]").forEach((button) => {
      if (!button.closest(".auth-tabs")) return;

      const active =
        button.dataset.authAction ===
        (loginMode ? "show-login" : "show-signup");

      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
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
    signupForm.addEventListener("submit", async (event) => {
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

          // A new authenticated account goes to NOH home.
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
    loginForm.addEventListener("submit", async (event) => {
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

          // Return to the original page when a valid
          // protected-page destination was supplied.
          // Otherwise, go to the NOH homepage.
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
    resetForm.addEventListener("submit", async (event) => {
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

  document.addEventListener("click", (event) => {
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

    // Preserve the password recovery screen.
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

    try {
      const { data, error } =
        await supabase.auth.getSession();

      if (error) throw error;

      currentUser = data.session?.user || null;

      updateHomepageNavigation(currentUser);

      if (!authPageExists) return;

      // Password recovery must take priority over login redirect.
      if (recoveryMode || isRecoveryURL()) {
        showPasswordReset();
        return;
      }

      if (currentUser) {
        // Already signed-in visitors should not remain
        // on the login or signup page.
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
