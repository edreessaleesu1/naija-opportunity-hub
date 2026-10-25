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
        authMessage.classList.add("error");
      }
      return;
    }

    const supabase = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY
    );

    // ---------- UI helpers ----------

    function message(text, isError = false) {
      if (!authMessage) return;
      authMessage.textContent = text;
      authMessage.classList.toggle("error", isError && Boolean(text));
      authMessage.classList.toggle("success", !isError && Boolean(text));
    }

    // Sets both the hidden attribute and inline display, so site CSS
    // cannot accidentally keep a "hidden" panel visible.
    function setVisible(element, visible) {
      element.hidden = !visible;
      element.style.display = visible ? "" : "none";
    }

    function showForm(form) {
      setVisible(signupForm, form === signupForm);
      setVisible(loginForm, form === loginForm);
      setVisible(loggedInPanel, false);
      message("");

      const navLink = $("accountNavLink");
      if (navLink) navLink.textContent = "Account";
    }

    function showUser(user, text = "You are signed in.") {
      setVisible(signupForm, false);
      setVisible(loginForm, false);
      setVisible(loggedInPanel, true);

      const email = $("accountEmail");
      if (email) email.textContent = user.email || "Signed-in user";

      const navLink = $("accountNavLink");
      if (navLink) navLink.textContent = "My Account";

      message(text);
    }

    // Disables a button while an async action runs, then restores it.
    async function withButton(button, busyLabel, idleLabel, action) {
      if (button) {
        button.disabled = true;
        button.textContent = busyLabel;
      }
      try {
        await action();
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = idleLabel;
        }
      }
    }

    // ---------- Switch between registration and login ----------

    $("showLogin")?.addEventListener("click", () => showForm(loginForm));
    $("showSignup")?.addEventListener("click", () => showForm(signupForm));

    // ---------- Register ----------

    signupForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      message("");

      const email = $("signupEmail").value.trim();
      const password = $("signupPassword").value;
      const confirmation = $("confirmPassword").value;

      if (password.length < 8) {
        message("Use a password containing at least 8 characters.", true);
        return;
      }

      if (password !== confirmation) {
        message("Your passwords do not match.", true);
        return;
      }

      await withButton(
        $("signupButton"),
        "Creating account...",
        "Create Account",
        async () => {
          try {
            const { data, error } = await supabase.auth.signUp({
              email,
              password,
              options: {
                emailRedirectTo: window.location.origin + "/account.html"
              }
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
  console.error("Registration error:", error);

  message(
    "Registration failed: " +
      (error.message || "Unknown error") +
      ". Please try again.",
    true
  );
}
        }
      );
    });

    // ---------- Log in ----------

    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      message("");

      const email = $("loginEmail").value.trim();
      const password = $("loginPassword").value;

      await withButton($("loginButton"), "Logging in...", "Log In", async () => {
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
        }
      });
    });

    // ---------- Forgot password ----------

    $("forgotPassword")?.addEventListener("click", async () => {
      const email = $("loginEmail").value.trim();

      if (!email) {
        message("Enter your email address first.", true);
        $("loginEmail").focus();
        return;
      }

      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/account.html"
        });

        if (error) throw error;

        message(
          "If an account exists for this email, a password-reset email will be sent."
        );
      } catch (error) {
        message(error.message || "Could not request a password reset.", true);
      }
    });

    // ---------- Log out ----------

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

    // ---------- Session handling ----------

    // Keeps the page in sync (for example when you sign in or out in
    // another tab). Does not overwrite messages already on screen.
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        showForm(loginForm);
      } else if (session?.user && loggedInPanel.hidden) {
        showUser(session.user, "");
      }
    });

    // Restore the existing session when the page loads.
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          showForm(loginForm);
          message(
            "Unable to check your session. Refresh the page to retry.",
            true
          );
        } else if (data.session?.user) {
          showUser(data.session.user);
        } else {
          showForm(signupForm);
        }
      })
      .catch(() => {
        showForm(loginForm);
        message("Unable to check your session. Refresh the page to retry.", true);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAuth, { once: true });
  } else {
    initAuth();
  }
})();
              
