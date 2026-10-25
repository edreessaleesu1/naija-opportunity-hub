(() => {
  "use strict";

  const SUPABASE_URL = "https://djxornmwvkauhkcuhgxc.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_EDReCY3JcN4vMuypVfqcMQ_GcTEVuBq";

  const $ = (id) => document.getElementById(id);

  function initAuth() {
    const signupForm = $("signupForm");
    const loginForm = $("loginForm");
    const loggedInPanel = $("loggedInPanel");
    const authMessage = $("authMessage");

    // Do nothing if the account forms are not on this page.
    if (!signupForm || !loginForm || !loggedInPanel) return;

    if (!window.supabase?.createClient) {
      if (authMessage) {
        authMessage.textContent =
          "Account services could not load. Please refresh the page.";
      }
      return;
    }

    const supabase = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY
    );

    function message(text, isError = false) {
      if (!authMessage) return;
      authMessage.textContent = text;
      authMessage.classList.toggle("error", isError);
      authMessage.classList.toggle("success", !isError && Boolean(text));
    }

    function showForm(form) {
      signupForm.hidden = form !== signupForm;
      loginForm.hidden = form !== loginForm;
      loggedInPanel.hidden = true;
      message("");
    }

    function showUser(user, text = "You are signed in.") {
      signupForm.hidden = true;
      loginForm.hidden = true;
      loggedInPanel.hidden = false;

      const email = $("accountEmail");
      if (email) email.textContent = user.email || "Signed-in user";

      const navLink = $("accountNavLink");
      if (navLink) navLink.textContent = "My Account";

      message(text);
    }

    // Switch between registration and login.
    $("showLogin")?.addEventListener("click", () => showForm(loginForm));
    $("showSignup")?.addEventListener("click", () => showForm(signupForm));

    // Register a new account.
    signupForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      message("");

      const email = $("signupEmail").value.trim();
      const password = $("signupPassword").value;
      const confirmation = $("confirmPassword").value;
      const button = $("signupButton");

      if (password.length < 8) {
        message("Use a password containing at least 8 characters.", true);
        return;
      }

      if (password !== confirmation) {
        message("Your passwords do not match.", true);
        return;
      }

      button.disabled = true;
      button.textContent = "Creating account...";

      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/account.html"
        });

        if (error) throw error;

        signupForm.reset();

        if (data.session && data.user) {
          showUser(data.user, "Your account has been created.");
        } else {
          showForm(loginForm);
          message(
            "Registration received. Check your email and confirm your account before logging in."
          );
        }
      } catch (error) {
        message(
          error.message || "Registration failed. Please try again.",
          true
        );
      } finally {
        button.disabled = false;
        button.textContent = "Create Account";
      }
    });

    // Log in.
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      message("");

      const email = $("loginEmail").value.trim();
      const password = $("loginPassword").value;
      const button = $("loginButton");

      button.disabled = true;
      button.textContent = "Logging in...";

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;

        loginForm.reset();
        showUser(data.user, "Login successful. Welcome back!");
      } catch (error) {
        message(
          error.message || "Login failed. Check your email and password.",
          true
        );
      } finally {
        button.disabled = false;
        button.textContent = "Log In";
      }
    });

    // Request a password-reset email.
    $("forgotPassword")?.addEventListener("click", async () => {
      const email = $("loginEmail").value.trim();

      if (!email) {
        message("Enter your email address first.", true);
        $("loginEmail").focus();
        return;
      }

      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/#account"
        });

        if (error) throw error;

        message(
          "If an account exists for this email, a password-reset email will be sent."
        );
      } catch (error) {
        message(
          error.message || "Could not request a password reset.",
          true
        );
      }
    });

    // Log out.
    $("logoutButton")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;

      try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;

        showForm(loginForm);
        message("You have logged out.");
      } catch (error) {
        message("Logout failed. Please try again.", true);
      } finally {
        button.disabled = false;
      }
    });

    // Restore the existing session when the page loads.
    supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        showUser(session.user);
      } else if (event === "SIGNED_OUT") {
        showForm(loginForm);
      }
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        message("Unable to check your session. Refresh the page to retry.", true);
      } else if (data.session?.user) {
        showUser(data.session.user);
      } else {
        showForm(signupForm);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAuth, { once: true });
  } else {
    initAuth();
  }
})();
