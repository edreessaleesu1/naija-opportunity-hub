(() => {
  "use strict";

  // =====================================================
  // 1. SUPABASE CONFIGURATION
  // =====================================================

  const SUPABASE_URL = "https://djxornmwvkauhkcuhgxc.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_EDReCY3JcN4vMuypVfqcMQ_GcTEVuBq";

  // =====================================================
  // 2. DEMONSTRATION OPPORTUNITIES
  // Shown if published database records cannot be loaded
  // or none exist.
  // =====================================================

  function demo(n, title, category, location, eligibility, description, query) {
    return {
      id: "demo-" + n,
      title,
      organisation: "Demonstration listing",
      category,
      location,
      eligibility,
      description,
      deadline: "",
      url: "https://www.google.com/search?q=" + query,
      image_url: "",
      verified: false,
      demo: true
    };
  }
  
