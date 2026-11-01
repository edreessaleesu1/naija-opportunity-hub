
/*
 * Naija Opportunity Hub
 * Main account authentication
 * Version 2.0
 *
 * Shared by:
 * - Homepage navigation
 * - auth.html
 *
 * Career Kit authentication should use a separate Supabase
 * storage key/client after its current code has been reviewed.
 */

(() => {
  "use strict";

  if (window.NOH_AUTH_INITIALISED) return;
  window.NOH_AUTH_INITIALISED = true;

  const SUPABASE_URL =
    "https://djxornmwvkauhkcuhgxc.supabase.co";

  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_EDReCY3JcN4vMuypVfqcMQ_GcTEVuBq";

  const $ = (id) => document.getElementById(id);

  const supabaseLibrary = window.supabase;

  if (!supabaseLibrary || !supabaseLibrary.createClient) {
    console.error(
      "NOH Auth: Supabase library was not loaded. Check the Supabase CDN script."
    );
    return;
  }

  /*
   * Use one shared client on the main NOH website.
   * The default Supabase storage key is shared by pages
   * using this same project and client configuration.
   */
  const supabase = window.NOH_SUPABASE_CLIENT ||
    supabaseLibrary.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY
    );

  window.NOH_SUPABASE_CLIENT = supabase;

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
    signupForm && loginForm && resetForm && loggedInPanel
  );

  let currentMode = "signup";
  let recoveryMode = false;

  /* ---------------------------------------------------------
     Helpers
  --------------------------------------------------------- */

  function setVisible(element, visible) {
    if (!element) return;
    element.hidden = !visible;
  }

  function showMessage(message, type = "error") {
    if (!authMessage) return;

    authMessage.textContent = message;
    authMessage.className = `auth-message show ${type}`;
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

  function setAuthMode(mode) {
    if (!authPageExists) return;

    currentMode = mode;
    recoveryMode = false;
    clearMessage();

    setVisible(signupForm, mode === "signup");
    setVisible(loginForm, mode === "login");
    setVisible(resetForm, false);
    setVisible(loggedInPanel, false);

    if (authHeading) {
      authHeading.textContent =
        mode === "login" ? "Welcome back" : "Create your account";
    }

    if (authSubheading) {
      authSubheading.textContent =
        mode === "login"
          ? "Sign in to continue managing your opportunities."
          : "Join NOH and keep track of opportunities that matter to you.";
    }

    document.querySelectorAll("[data-auth-action]").forEach((button) => {
      const active =
        (mode === "signup" &&
          button.dataset.authAction === "show-signup") ||
        (mode === "login" &&
          button.dataset.authAction === "show-login");

      if (button.closest(".auth-tabs")) {
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", String(active));
      }
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
  }

  function showLoggedInUser(user) {
    const email = user?.email || "Signed-in user";

    if (accountEmail) {
      accountEmail.textContent = email;
    }

    if (authPageExists) {
      clearMessage();
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
  }

  function showSignedOutState() {
    if (authPageExists) {
      const params = new URLSearchParams(window.location.search);
      const requestedMode = params.get("mode");

      setAuthMode(
        requestedMode === "login" ? "login" : "signup"
      );
    }
  }

  /* ---------------------------------------------------------
     Homepage navigation
  --------------------------------------------------------- */

  function updateHomepageNavigation(user) {
  const signInLink = $("signInLink");
  const createAccountLink = $("createAccountLink");
  const accountMenu = $("accountMenu");
  const myAccountLink = $("myAccountLink");
  const navLogoutButton = $("navLogoutButton");

  const signedIn = Boolean(user);

  if (signInLink) {
    signInLink.hidden = signedIn;
  }

  if (createAccountLink) {
    createAccountLink.hidden = signedIn;
  }

  if (accountMenu) {
    accountMenu.hidden = !signedIn;
  }

  // Never display the user's email in the homepage navigation.
  if (myAccountLink) {
    myAccountLink.textContent = signedIn ? "Signed in" : "My Account";
    myAccountLink.href = "./auth.html";
  }

  if (navLogoutButton && !navLogoutButton.dataset.authBound) {
    navLogoutButton.dataset.authBound = "true";

    navLogoutButton.addEventListener("click", async () => {
      navLogoutButton.disabled = true;

      const { error } = await supabase.auth.signOut();

      navLogoutButton.disabled = false;

      if (error) {
        console.error("NOH sign-out error:", error.message);
        alert("We could not sign you out. Please try again.");
      } else {
        window.location.href = "./index.html";
      }
    });
  }
}


  /* ---------------------------------------------------------
     Signup
  --------------------------------------------------------- */

  if (signupForm) {
    signupForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearMessage();

      const email = $("signupEmail")?.value.trim();
      const password = $("signupPassword")?.value;
      const confirmPassword = $("confirmPassword")?.value;

      if (!email || !password || !confirmPassword) {
        showMessage("Please complete all the required fields.");
        return;
      }

      if (password.length < 8) {
        showMessage("Your password must contain at least 8 characters.");
        return;
      }

      if (password !== confirmPassword) {
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
          showLoggedInUser(data.user);
          updateHomepageNavigation(data.user);
          showMessage("Your account has been created successfully.", "success");
        } else {
          showMessage(
            "Your account has been created. Please check your email and follow the confirmation link before signing in.",
            "success"
          );

          signupForm.reset();
        }
      } catch (error) {
        console.error("NOH signup error:", error);

        const message = /already registered|already exists/i.test(
          error.message || ""
        )
          ? "An account with this email may already exist. Please sign in instead."
          : error.message || "We could not create your account. Please try again.";

        showMessage(message);
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
     Login
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

        if (data.user) {
          showLoggedInUser(data.user);
          updateHomepageNavigation(data.user);
          showMessage("You have signed in successfully.", "success");

          const redirectTo = new URLSearchParams(
            window.location.search
          ).get("redirect");

          if (redirectTo && redirectTo.startsWith("/")) {
            window.location.href = redirectTo;
          }
        }
      } catch (error) {
        console.error("NOH login error:", error);

        showMessage(
          error.message || "Sign-in failed. Check your details and try again."
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
     Forgot password
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
        const { error } = await supabase.auth.resetPasswordForEmail(
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
        console.error("NOH password reset request error:", error);
        showMessage(
          error.message || "We could not send the reset email. Please try again."
        );
      } finally {
        forgotPasswordButton.disabled = false;
      }
    });
  }

  /* ---------------------------------------------------------
     Set a new password
  --------------------------------------------------------- */

  if (resetForm) {
    resetForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearMessage();

      const password = $("newPassword")?.value;
      const confirmPassword = $("confirmNewPassword")?.value;

      if (!password || !confirmPassword) {
        showMessage("Please complete both password fields.");
        return;
      }

      if (password.length < 8) {
        showMessage("Your new password must contain at least 8 characters.");
        return;
      }

      if (password !== confirmPassword) {
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

        showMessage(
          "Your password has been updated successfully. You can now continue to NOH.",
          "success"
        );

        const { data } = await supabase.auth.getUser();

        if (data.user) {
          showLoggedInUser(data.user);
        }
      } catch (error) {
        console.error("NOH password update error:", error);
        showMessage(
          error.message || "We could not update your password. Please try again."
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
     Sign out from the authentication page
  --------------------------------------------------------- */

  const logoutButton = $("logoutButton");

  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      logoutButton.disabled = true;

      try {
        const { error } = await supabase.auth.signOut();

        if (error) throw error;

        window.location.href = "./index.html";
      } catch (error) {
        console.error("NOH sign-out error:", error);
        showMessage("We could not sign you out. Please try again.");
        logoutButton.disabled = false;
      }
    });
  }

  /* ---------------------------------------------------------
     Switch between sign-in and signup
  --------------------------------------------------------- */

  document.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-auth-action]");

    if (!actionButton) return;

    const action = actionButton.dataset.authAction;

    if (action === "show-login") {
      setAuthMode("login");
    }

    if (action === "show-signup") {
      setAuthMode("signup");
    }
  });

  /* ---------------------------------------------------------
     Restore and monitor the main NOH session
  --------------------------------------------------------- */

  supabase.auth.onAuthStateChange((event, session) => {
    const user = session?.user || null;

    updateHomepageNavigation(user);

    if (!authPageExists) return;

    if (event === "PASSWORD_RECOVERY") {
      showPasswordReset();
      return;
    }

    if (user) {
      if (!recoveryMode) {
        showLoggedInUser(user);
      }
    } else if (event === "SIGNED_OUT") {
      showSignedOutState();
    }
  });

  async function initialiseAuth() {
    updateHomepageNavigation(null);

    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) throw error;

      const user = data.session?.user || null;

      updateHomepageNavigation(user);

      if (!authPageExists) return;

      const hashParams = new URLSearchParams(
        window.location.hash.replace(/^#/, "")
      );

      const isRecoveryLink =
        hashParams.get("type") === "recovery";

      if (isRecoveryLink) {
        showPasswordReset();
        return;
      }

      if (user) {
        showLoggedInUser(user);
        return;
      }

      const requestedMode = new URLSearchParams(
        window.location.search
      ).get("mode");

      setAuthMode(
        requestedMode === "login" ? "login" : "signup"
      );
    } catch (error) {
      console.error("NOH session initialisation error:", error);

      if (authPageExists) {
        setAuthMode("signup");
        showMessage(
          "We could not check your sign-in session. Please refresh the page and try again."
        );
      }
    }
  }

  initialiseAuth();

})();
