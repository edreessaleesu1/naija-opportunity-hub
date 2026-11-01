
(() => {
  "use strict";

  const SUPABASE_URL =
    "https://djxornmwvkauhkcuhgxc.supabase.co";

  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_EDReCY3JcN4vMuypVfqcMQ_GcTEVuBq";

  const SESSION_KEY = "noh_career_kit_auth";

  const status = document.getElementById("sessionStatus");
  const indicator = document.getElementById("sessionIndicator");
  const signOutButton = document.getElementById("careerSignOut");

  if (!status || !indicator || !window.supabase) {
    console.error("Career Kit authentication could not initialise.");
    return;
  }

  const careerSupabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        storageKey: SESSION_KEY,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );

  window.NOH_CAREER_SUPABASE = careerSupabase;

  function displaySession(session) {
    if (session?.user) {
      status.textContent = `Signed in as ${session.user.email}`;
      indicator.classList.add("is-active");
      indicator.classList.remove("is-inactive");
      signOutButton.hidden = false;
    } else {
      status.textContent = "Not signed in";
      indicator.classList.remove("is-active");
      indicator.classList.add("is-inactive");
      signOutButton.hidden = true;
    }
  }

  async function checkSession() {
    status.textContent = "Checking session...";

    const { data, error } = await careerSupabase.auth.getSession();

    if (error) {
      console.error("Session check failed:", error.message);
      status.textContent = "Unable to verify session";
      return;
    }

    displaySession(data.session);
  }

  careerSupabase.auth.onAuthStateChange((event, session) => {
    displaySession(session);
  });

  signOutButton.addEventListener("click", async () => {
    signOutButton.disabled = true;

    const { error } = await careerSupabase.auth.signOut();

    signOutButton.disabled = false;

    if (error) {
      console.error("Sign-out failed:", error.message);
      return;
    }

    displaySession(null);
  });

  checkSession();
})();
