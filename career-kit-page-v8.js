(() => {
  "use strict";

  if (window.NOH_CAREER_KIT_LOADED) return;

  const $ = (id) => document.getElementById(id);
  const form = $("career-form");

  if (!form) return;

  window.NOH_CAREER_KIT_LOADED = true;

  const SUPABASE_URL =
    "https://djxornmwvkauhkcuhgxc.supabase.co";

  const AI_ENDPOINT =
    "https://djxornmwvkauhkcuhgxc.supabase.co/functions/v1/career-assistant";

  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_EDReCY3JcN4vMuypVfqcMQ_GcTEVuBq";

  const AI_REQUEST_TIMEOUT_MS = 105000;

  const params = new URLSearchParams(window.location.search);

  let tool = params.get("tool") || "cv";

  if (!["cv", "cover-letter", "bundle"].includes(tool)) {
    tool = "cv";
  }

  const templates = [
    { value: "classic", label: "British Professional — UK Standard" },
    { value: "modern", label: "Modern UK — Contemporary" },
    { value: "executive", label: "Executive UK — Leadership" },
    { value: "graduate", label: "Graduate UK — Early Career" },
    { value: "sidebar", label: "Sidebar Two-Column — Modern" },
    { value: "ats", label: "ATS-Friendly — Plain and Safe" },
    { value: "academic", label: "Academic — Scholarships and Research" },
    { value: "scholarship", label: "Scholarship CV — Chevening and Commonwealth" },
    { value: "nigerian", label: "Nigerian Graduate — NYSC Ready" },
    { value: "europass", label: "Europass-Style — Europe and EU Jobs" },
    { value: "onepage", label: "One-Page Resume — US Style" },
    { value: "creative", label: "Tech and Creative — Bold" },
    { value: "signature", label: "Gold and Emerald — Signature" },
    { value: "wordbanner", label: "Word Modern Banner — Corporate" },
    { value: "premiumphoto", label: "Premium Photo Panel — Polished" },
    { value: "timeline", label: "Timeline Professional — Career Path" },
    { value: "elegant", label: "Elegant Serif — Refined" },
    { value: "corporate", label: "Corporate Block — Photo Header" },
    { value: "twocol", label: "Two-Column Pro — Skills Strip" },
    { value: "cardspro", label: "Modern Cards — Fresh" }
  ];

  // Templates that show the optional profile photo.
  const PHOTO_TEMPLATES = ["nigerian", "wordbanner", "premiumphoto", "timeline", "elegant", "corporate", "twocol", "cardspro"];

  // Optional profile photo (kept in the browser only; used by the photo templates)
  let photoData = "";


  const themes = {
    default: "",
    green: "#075b3b",
    navy: "#1b2a41",
    burgundy: "#7a1f3d",
    teal: "#0b4f6c",
    charcoal: "#2b2f36",
    gold: "#8a6a1c"
  };

  // Light tint of an accent colour (mixed with white), used for soft backgrounds.
  function tintOf(hex, amount = 0.9) {
    const n = parseInt(hex.slice(1), 16);
    const mix = (c) => Math.round(c + (255 - c) * amount);

    return "#" + [n >> 16, (n >> 8) & 255, n & 255]
      .map((c) => mix(c).toString(16).padStart(2, "0"))
      .join("");
  }

  const titles = {
    cv: "Professional CV Builder",
    "cover-letter": "Cover Letter Studio",
    bundle: "Career Bundle"
  };

  const descriptions = {
    cv: "Build a professional CV using recruitment-friendly layouts.",
    "cover-letter": "Create a tailored cover letter for your next opportunity.",
    bundle: "Prepare your CV and cover letter together."
  };

  const cvFields = [
    "summary-field",
    "education-field",
    "experience-field",
    "skills-field",
    "certificates-field"
  ];

  const letterFields = [
    "letter-details-heading",
    "applicant-address-field",
    "application-date-field",
    "employer-field",
    "recipient-field",
    "employer-address-field",
    "vacancy-source-field",
    "job-description-field",
    "letter-body-field"
  ];

  // --------------------------------------------------
  // GENERAL HELPERS
  // --------------------------------------------------

  function setText(id, text) {
    const element = $(id);
    if (element) element.textContent = text;
  }

  function setHidden(id, hidden) {
    const element = $(id);
    if (element) element.hidden = hidden;
  }

  function value(id, fallback = "") {
    const element = $(id);

    if (!element) return fallback;

    return String(element.value || "").trim() || fallback;
  }

  function escapeHTML(text) {
    return String(text).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function cleanLink(text) {
    return String(text || "")
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .replace(/\/+$/, "");
  }

  function placeText() {
    return [value("location"), value("country")].filter(Boolean).join(", ");
  }

  function contactItems() {
    return [
      value("email"),
      value("phone"),
      placeText(),
      cleanLink(value("linkedin"))
    ].filter(Boolean);
  }

  function contactDetails() {
    return contactItems().join("  |  ");
  }

  function isLetter() {
    return tool === "cover-letter" || tool === "bundle";
  }

  function getTemplate() {
    const selected = value("template", "classic");

    return templates.some((item) => item.value === selected)
      ? selected
      : "classic";
  }

  function getSpacing() {
    const selected = value("spacing", "standard");

    return ["compact", "standard", "relaxed"].includes(selected)
      ? selected
      : "standard";
  }

  function docAttrs(extraClass = "") {
    const colour = themes[value("theme", "default")] || "";
    const style = colour
      ? ` style="--cv-accent:${colour};--cv-tint:${tintOf(colour)}"`
      : "";

    return `class="cv-document ${extraClass} space-${getSpacing()}"${style}`;
  }

  function getLines(text) {
    return String(text || "")
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  // --------------------------------------------------
  // ENTRY FORMATTING
  // --------------------------------------------------

  const BULLET = /^[-•*]\s*/;
  const DATE_HINT =
    /\b(19|20)\d{2}\b|\b(present|current|to date|ongoing)\b/i;

  function isBullet(line) {
    return BULLET.test(line);
  }

  function isTitleLine(line, next) {
    if (!line || isBullet(line) || line.length > 120) return false;

    if (next && isBullet(next)) return true;
    if (DATE_HINT.test(line)) return true;

    if (
      next &&
      !isBullet(next) &&
      DATE_HINT.test(next) &&
      next.length <= 120
    ) {
      return true;
    }

    return false;
  }

  function linesToHTML(lines, labelMode) {
    let html = "";
    let bullets = [];

    const flush = () => {
      if (!bullets.length) return;

      html += `<ul class="cv-list">${bullets.map((item) =>
        `<li>${escapeHTML(item)}</li>`
      ).join("")}</ul>`;

      bullets = [];
    };

    lines.forEach((line) => {
      if (isBullet(line)) {
        bullets.push(line.replace(BULLET, ""));
        return;
      }

      flush();

      const label =
        labelMode && line.match(/^([^:]{2,32}):\s*(.+)$/);

      html += label
        ? `<p><strong>${escapeHTML(label[1])}:</strong> ${escapeHTML(label[2])}</p>`
        : `<p>${escapeHTML(line)}</p>`;
    });

    flush();

    return html;
  }

  function formatEntries(text, kind = "entries") {
    const lines = getLines(text);

    if (!lines.length) return "";

    if (kind === "plain") return linesToHTML(lines, false);
    if (kind === "skills") return linesToHTML(lines, true);

    const groups = [];
    let current = null;

    lines.forEach((line, index) => {
      const next = lines[index + 1];

      if (isTitleLine(line, next)) {
        if (current && current.title && !current.sub && !current.body.length) {
          current.sub = line;
        } else {
          current = { title: line, sub: "", body: [] };
          groups.push(current);
        }

        return;
      }

      if (!current) {
        current = { title: "", sub: "", body: [] };
        groups.push(current);
      }

      current.body.push(line);
    });

    return groups.map((group) => `
      <div class="cv-entry">
        ${group.title
          ? `<p class="cv-entry-title">${escapeHTML(group.title)}</p>`
          : ""}
        ${group.sub
          ? `<p class="cv-entry-sub">${escapeHTML(group.sub)}</p>`
          : ""}
        ${linesToHTML(group.body, false)}
      </div>
    `).join("");
  }

  function sectionHTML(title, content, kind = "entries", extraClass = "") {
    if (!content) return "";

    return `
      <section class="cv-section ${extraClass}">
        <h2>${escapeHTML(title)}</h2>
        <div class="cv-section-content">
          ${formatEntries(content, kind)}
        </div>
      </section>
    `;
  }

  // --------------------------------------------------
  // TEMPLATE SELECTOR — GROUPED CATEGORIES
  // --------------------------------------------------

  const categories = [
    {
      id: "everyday",
      label: "Everyday",
      title: "Everyday and Graduate",
      values: ["classic", "graduate", "nigerian", "ats", "onepage"]
    },
    {
      id: "professional",
      label: "Professional",
      title: "Professional and Creative",
      values: ["modern", "wordbanner", "premiumphoto", "timeline", "elegant", "corporate", "twocol", "cardspro", "sidebar", "executive", "signature", "creative"]
    },
    {
      id: "study",
      label: "Study and Research",
      title: "Scholarship and Research",
      values: ["scholarship", "academic", "europass"]
    }
  ];

  // What each template needs from the form, matching its own headings.
  const SEC = (profile, education, experience, skills) =>
    ({ profile, education, experience, skills });

  const templateProfiles = {
    classic: {
      best: "Best for most jobs in Nigeria and the UK. Clean, centred and traditional.",
      sec: SEC("Professional Profile", "Education", "Work Experience", "Skills"),
      label: { summary: "Professional profile", education: "Education", experience: "Work experience", skills: "Skills", certificates: "Certifications and training" },
      ph: {
        summary: "Two to four lines: who you are, your strongest skills and the role you want.",
        education: "Institution, qualification and year.\nUniversity of Lagos\nBSc Accounting, 2018 - 2022",
        experience: "Job title\nOrganisation, City | 2022 - Present\n- Achievement with a number",
        skills: "e.g. Excel, communication, research, teamwork",
        certificates: "Certifications, short courses and training."
      }
    },
    graduate: {
      best: "Best for students and recent graduates. Education comes first, then projects.",
      sec: SEC("Profile", "Education", "Experience and Projects", "Skills"),
      label: { summary: "Profile", education: "Education (put your best result)", experience: "Experience, internships and projects", skills: "Skills", certificates: "Certifications and activities" },
      ph: {
        summary: "Recent graduate in ... seeking a role in ... Mention your degree and strongest skill.",
        education: "University of Ibadan\nBSc Economics, Second Class Upper, 2019 - 2023\n- Relevant modules or final-year project",
        experience: "Internship or project title\nOrganisation | 2023\n- What you did and what it achieved",
        skills: "e.g. Excel, SPSS, report writing, teamwork",
        certificates: "Leadership roles, volunteering, clubs, short courses."
      }
    },
    nigerian: {
      best: "Best for Nigerian graduates and NYSC members. Optional photo and referees line.",
      sec: SEC("Personal Profile", "Education", "Work Experience", "Skills"),
      label: { summary: "Personal profile", education: "Education (include class of degree)", experience: "Work experience", skills: "Skills", certificates: "Certifications and training" },
      ph: {
        summary: "Two or three lines about your degree, NYSC year and the job you want.",
        education: "Ahmadu Bello University\nB.Sc. Geography, Second Class Upper, 2013 - 2017",
        experience: "Sales Assistant\nCompany, Lagos | 2019 - 2021\n- Your duties and results",
        skills: "e.g. Microsoft Office, customer service, data entry",
        certificates: "Certificates, training and professional memberships."
      }
    },
    ats: {
      best: "Best for online applications and recruiter software. No colours needed, plain structure.",
      sec: SEC("Professional Summary", "Education", "Work Experience", "Skills"),
      label: { summary: "Professional summary", education: "Education", experience: "Work experience", skills: "Skills (keywords from the job advert)", certificates: "Certifications" },
      ph: {
        summary: "Use the job title and key words from the advert.",
        education: "Institution, qualification, year.",
        experience: "Job title\nOrganisation, City | 2021 - Present\n- Start each bullet with an action word",
        skills: "Plain keywords separated by commas, e.g. Project management, SQL, Excel",
        certificates: "Name of certification, issuer, year."
      }
    },
    onepage: {
      best: "Best for a tight single page. We tell you if your content runs over.",
      sec: SEC("Summary", "Education", "Experience", "Skills"),
      label: { summary: "Summary (two lines)", education: "Education", experience: "Experience (3 to 4 bullets per job)", skills: "Skills", certificates: "Certifications" },
      ph: {
        summary: "One or two lines only.",
        education: "School, degree, year.",
        experience: "Job title\nCompany | 2021 - Present\n- Short, results-focused bullet",
        skills: "Python, Excel, SQL, Tableau",
        certificates: "Short list only."
      }
    },
    modern: {
      best: "Best for corporate, NGO and office roles. Sans-serif with a section label column.",
      sec: SEC("Profile", "Education", "Experience", "Skills"),
      label: { summary: "Profile", education: "Education", experience: "Experience", skills: "Skills", certificates: "Training" },
      ph: {
        summary: "A short profile of your experience and what you offer.",
        education: "Institution, qualification and year.",
        experience: "Job title\nOrganisation, City | 2021 - Present\n- Achievement with a number",
        skills: "Technical: Python, Excel\nLanguages: English, French",
        certificates: "Training courses and certificates."
      }
    },
    sidebar: {
      best: "Best for a bold look. Contact, skills and training sit in the side panel, so keep them short.",
      sec: SEC("Profile", "Education", "Experience", "Skills (side panel)"),
      label: { summary: "Profile", education: "Education", experience: "Experience", skills: "Skills (short lines for the side panel)", certificates: "Training and certifications (short lines)" },
      ph: {
        summary: "A short profile of your experience.",
        education: "Institution, qualification and year.",
        experience: "Job title\nOrganisation, City | 2021 - Present\n- Achievement with a number",
        skills: "Excel\nProject planning\nPublic speaking",
        certificates: "PMP, 2023\nGIS Certificate"
      }
    },
    executive: {
      best: "Best for managers and senior roles. Leads with scope, budgets and results.",
      sec: SEC("Profile", "Education", "Career History", "Core Skills (side column)"),
      label: { summary: "Executive profile", education: "Education", experience: "Career history", skills: "Core skills (side column)", certificates: "Training and certifications (side column)" },
      ph: {
        summary: "Senior leader with X years in ... Mention scale: team size, budget, markets.",
        education: "Institution, qualification and year.",
        experience: "Director of Operations\nCompany, Lagos | 2019 - Present\n- Led 40 staff and a N2bn budget\n- Cut costs by 18%",
        skills: "Strategy\nP&L management\nStakeholder engagement",
        certificates: "MBA, 2018\nChartered membership"
      }
    },
    signature: {
      best: "Best for a refined, memorable CV. Emerald and gold, suited to consulting and leadership.",
      sec: SEC("Profile", "Education", "Experience", "Skills"),
      label: { summary: "Profile", education: "Education", experience: "Experience", skills: "Skills", certificates: "Training and certifications" },
      ph: {
        summary: "A confident two to four line profile.",
        education: "Institution, qualification and year.",
        experience: "Job title\nOrganisation, City | 2021 - Present\n- Achievement with a number",
        skills: "Technical: Excel, SQL\nLanguages: English, Yoruba",
        certificates: "Training and certifications."
      }
    },
    wordbanner: {
      best: "Best for corporate and office roles. A full-width colour banner with your photo, like a modern Word template.",
      sec: SEC("Profile", "Education", "Experience", "Skills"),
      label: { summary: "Profile", education: "Education", experience: "Experience", skills: "Skills", certificates: "Training and certifications" },
      ph: {
        summary: "A short profile of your experience and what you offer.",
        education: "Institution, qualification and year.\nUniversity of Lagos\nBSc Accounting, 2018 - 2022",
        experience: "Job title\nOrganisation, City | 2022 - Present\n- Achievement with a number\n- Another result",
        skills: "Excel, Project management, Stakeholder engagement",
        certificates: "Training courses and certificates."
      }
    },
    premiumphoto: {
      best: "Best for a polished, photo-led CV. Photo, contact and skills sit in a side panel on the right, so keep them short.",
      sec: SEC("Profile", "Education", "Experience", "Skills"),
      label: { summary: "Profile", education: "Education", experience: "Experience", skills: "Skills (short lines for the side panel)", certificates: "Training and certifications (short lines)" },
      ph: {
        summary: "A confident profile of two to four lines.",
        education: "Institution, qualification and year.\nUniversity of Lagos\nBSc Accounting, 2018 - 2022",
        experience: "Job title\nOrganisation, City | 2022 - Present\n- Achievement with a number\n- Another result",
        skills: "Excel\nProject planning\nPublic speaking",
        certificates: "PMP, 2023\nGIS Certificate"
      }
    },
    timeline: {
      best: "Best for showing career growth. Roles and education follow a vertical timeline, with your photo at the top.",
      sec: SEC("Profile", "Education", "Experience", "Skills"),
      label: { summary: "Profile", education: "Education", experience: "Experience (newest first)", skills: "Skills", certificates: "Training and certifications" },
      ph: {
        summary: "Who you are and where your career is heading.",
        education: "Institution, qualification and year.\nUniversity of Lagos\nBSc Accounting, 2018 - 2022",
        experience: "Job title\nOrganisation, City | 2022 - Present\n- Achievement with a number\n- Another result",
        skills: "Technical: Excel, SQL\nLanguages: English, Yoruba",
        certificates: "Training and certifications."
      }
    },
    elegant: {
      best: "Best for senior, legal, consulting and diplomatic roles. Centred serif layout with a round photo.",
      sec: SEC("Profile", "Education", "Experience", "Skills"),
      label: { summary: "Profile", education: "Education", experience: "Experience", skills: "Skills", certificates: "Training and certifications" },
      ph: {
        summary: "A refined profile that sums up your experience.",
        education: "Institution, qualification and year.\nUniversity of Lagos\nBSc Accounting, 2018 - 2022",
        experience: "Job title\nOrganisation, City | 2022 - Present\n- Achievement with a number\n- Another result",
        skills: "Technical: Excel, SQL\nLanguages: English, French",
        certificates: "Training and certifications."
      }
    },
    corporate: {
      best: "Best for banking, oil and gas, and corporate roles. A bold photo block heads the page. Without a photo it shows your initials.",
      sec: SEC("Profile", "Education", "Experience", "Skills"),
      label: { summary: "Profile", education: "Education", experience: "Experience", skills: "Skills", certificates: "Training and certifications" },
      ph: {
        summary: "Short, factual profile with your biggest strengths.",
        education: "Institution, qualification and year.\nUniversity of Lagos\nBSc Accounting, 2018 - 2022",
        experience: "Job title\nOrganisation, City | 2022 - Present\n- Achievement with a number\n- Another result",
        skills: "Financial analysis, Reporting, Excel, SAP",
        certificates: "Chartered membership, short courses."
      }
    },
    twocol: {
      best: "Best when you have many skills. A key-skills strip runs under the header, then experience beside education.",
      sec: SEC("Profile", "Education", "Experience", "Skills"),
      label: { summary: "Profile", education: "Education", experience: "Experience (main column)", skills: "Key skills (shown as a strip, separate with commas)", certificates: "Training and certifications (side column)" },
      ph: {
        summary: "Two lines about your strongest results.",
        education: "Institution, qualification and year.\nUniversity of Lagos\nBSc Accounting, 2018 - 2022",
        experience: "Job title\nOrganisation, City | 2022 - Present\n- Achievement with a number\n- Another result",
        skills: "Leadership, Budgeting, Analytics, Negotiation",
        certificates: "Certificates and short courses."
      }
    },
    cardspro: {
      best: "Best for a fresh, modern look. Every section sits in a soft card, with skills as chips.",
      sec: SEC("Profile", "Education", "Experience", "Skills"),
      label: { summary: "Profile", education: "Education", experience: "Experience", skills: "Skills (shown as chips, separate with commas)", certificates: "Training and certifications" },
      ph: {
        summary: "A friendly, confident profile.",
        education: "Institution, qualification and year.\nUniversity of Lagos\nBSc Accounting, 2018 - 2022",
        experience: "Job title\nOrganisation, City | 2022 - Present\n- Achievement with a number\n- Another result",
        skills: "Excel, Canva, Research, Customer service",
        certificates: "Certificates and short courses."
      }
    },
    creative: {
      best: "Best for tech, design and digital roles. Skills appear as chips, so separate them with commas.",
      sec: SEC("Profile", "Education", "Experience and Projects", "Skills (shown as chips)"),
      label: { summary: "Profile", education: "Education", experience: "Experience and projects", skills: "Skills (separate with commas)", certificates: "Certifications" },
      ph: {
        summary: "One punchy paragraph about what you build or design.",
        education: "Institution, qualification and year.",
        experience: "Frontend Developer\nStartup, Lagos | 2022 - Present\n- Built X used by Y people\nProject: Portfolio site (yoursite.com)\n- What it does",
        skills: "React, JavaScript, Figma, SQL, Git",
        certificates: "Certifications and courses."
      }
    },
    scholarship: {
      best: "Best for Chevening, Commonwealth, DAAD and similar. Leads with your statement and leadership.",
      sec: SEC("Personal Statement", "Education", "Experience and Leadership", "Skills"),
      label: { summary: "Personal statement (goals and impact)", education: "Education", experience: "Experience and leadership", skills: "Skills", certificates: "Awards, scholarships and certifications" },
      ph: {
        summary: "Your career goal, leadership record and how you will use the award back home.",
        education: "University, degree, class and year.\nInclude your dissertation topic if relevant.",
        experience: "Role\nOrganisation | 2020 - Present\n- Leadership or community impact with numbers",
        skills: "Research: Stata, NVivo\nLanguages: English, French",
        certificates: "Awards, scholarships, publications and volunteering."
      }
    },
    academic: {
      best: "Best for research, PhD and lecturing roles. Lists research, teaching and grants.",
      sec: SEC("Research Profile", "Education", "Research and Professional Experience", "Skills"),
      label: { summary: "Research profile", education: "Education (add thesis title)", experience: "Research, teaching and professional experience", skills: "Methods, software and languages", certificates: "Awards, grants, publications and training" },
      ph: {
        summary: "Your research area, methods and what you want to study next.",
        education: "University of Ibadan\nMSc Environmental Management, 2019 - 2021\n- Thesis: title",
        experience: "Research Assistant\nInstitute, City | 2019 - 2021\n- Research done, data used and outputs\nTeaching Assistant\nDepartment | 2020\n- Courses taught",
        skills: "Methods: Regression, GIS\nSoftware: R, Stata\nLanguages: English",
        certificates: "Publications, conferences, grants and awards."
      }
    },
    europass: {
      best: "Best for Europe and EU institutions. Left label column, with languages in your skills.",
      sec: SEC("About me", "Education and training", "Work experience", "Skills"),
      label: { summary: "About me", education: "Education and training", experience: "Work experience", skills: "Skills (add languages with levels)", certificates: "Certificates and other information" },
      ph: {
        summary: "A short personal introduction.",
        education: "Institution, qualification and year.",
        experience: "Job title\nOrganisation, City, Country | 2021 - Present\n- Main activities",
        skills: "Mother tongue: Hausa\nEnglish: C2\nFrench: B1\nDigital: Excel, Word",
        certificates: "Driving licence, volunteering, memberships, courses."
      }
    }
  };

  const fieldMap = {
    summary: ["summary", "summary-field"],
    education: ["education", "education-field"],
    experience: ["experience", "experience-field"],
    skills: ["skills", "skills-field"],
    certificates: ["certificates", "certificates-field"]
  };

  let activeCategory = "everyday";
  let appliedProfile = "";

  function categoryOf(templateValue) {
    const found = categories.find((c) => c.values.includes(templateValue));
    return found ? found.id : "everyday";
  }

  function installTemplateTabsStyle() {
    if ($("noh-template-tabs-style")) return;

    const style = document.createElement("style");

    style.id = "noh-template-tabs-style";
    style.textContent = `
      .template-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 10px; }
      .template-tabs button { flex: 1 1 0; min-width: 0; min-height: 40px; padding: 6px 6px; border: 1.5px solid #c6a24a; border-radius: 999px; background: #fffdf6; color: #1d2a20; font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; }
      .template-tabs button[aria-selected="true"] { background: #c6a24a; color: #1d2a20; }
      .template-hint { margin: 8px 0 0; font-size: 13px; line-height: 1.45; color: #4a5d53; }
    `;

    document.head.appendChild(style);
  }

  function buildTemplateOptions(select, selectedValue) {
    const category = categories.find((c) => c.id === activeCategory) || categories[0];

    select.replaceChildren();

    category.values.forEach((templateValue) => {
      const template = templates.find((item) => item.value === templateValue);

      if (!template) return;

      const option = document.createElement("option");

      option.value = template.value;
      option.textContent = template.label;

      select.appendChild(option);
    });

    select.value = category.values.includes(selectedValue)
      ? selectedValue
      : category.values[0];
  }

  function configureTemplates() {
    const select = $("template");

    if (!select) return;

    installTemplateTabsStyle();

    const field = $("template-field");
    let tabs = $("template-tabs");

    if (!tabs && field) {
      tabs = document.createElement("div");

      tabs.id = "template-tabs";
      tabs.className = "template-tabs";
      tabs.setAttribute("role", "tablist");
      tabs.setAttribute("aria-label", "Document style categories");

      categories.forEach((category) => {
        const button = document.createElement("button");

        button.type = "button";
        button.dataset.category = category.id;
        button.setAttribute("role", "tab");
        button.textContent = category.label;
        button.title = category.title;

        button.addEventListener("click", () => {
          activeCategory = category.id;
          buildTemplateOptions(select, category.values[0]);
          syncTemplateTabs();
          select.dispatchEvent(new Event("change", { bubbles: true }));
        });

        tabs.appendChild(button);
      });

      field.insertBefore(tabs, select);

      const hint = document.createElement("p");

      hint.id = "template-hint";
      hint.className = "template-hint";
      field.appendChild(hint);
    }

    const previous = select.value || "classic";

    activeCategory = categoryOf(
      templates.some((t) => t.value === previous) ? previous : "classic"
    );

    buildTemplateOptions(select, previous);
    syncTemplateTabs();
    appliedProfile = "";
    applyTemplateProfile();
  }

  function syncTemplateTabs() {
    document.querySelectorAll("#template-tabs button").forEach((button) => {
      button.setAttribute(
        "aria-selected",
        String(button.dataset.category === activeCategory)
      );
    });
  }

  // Re-label the form so every field matches the chosen template.
  function applyTemplateProfile() {
    const current = getTemplate();

    if (current === appliedProfile) return;

    appliedProfile = current;

    const profile = templateProfiles[current];

    installExtraFields();

    if (!profile) return;

    Object.entries(fieldMap).forEach(([key, [inputId, fieldId]]) => {
      const input = $(inputId);
      const wrapper = $(fieldId);
      const label = wrapper && wrapper.querySelector("label");

      if (label && profile.label[key]) label.textContent = profile.label[key];
      if (input && profile.ph[key]) input.placeholder = profile.ph[key];
    });

    setText("sec-profile-title", "Professional Profile");
    setText("sec-education-title", profile.sec.education);
    setText("sec-experience-title", profile.sec.experience);
    setText("sec-skills-title", profile.sec.skills);

    setText("template-hint", profile.best);

    setHidden("photo-field", !PHOTO_TEMPLATES.includes(current) || tool === "cover-letter");

    installExtraFields();

    const allowed = extraFor[current] || [];

    Object.keys(extraDefs).forEach((key) => {
      setHidden("x-" + key + "-field", !allowed.includes(key) || tool === "cover-letter");
    });
  }

  // --------------------------------------------------
  // PAGE CONFIGURATION
  // --------------------------------------------------

  function configureTool() {
    const coverOnly = tool === "cover-letter";

    setText("page-title", titles[tool]);
    setText("page-description", descriptions[tool]);
    setText("current-year", new Date().getFullYear());

    document.querySelectorAll("[data-tool]").forEach((link) => {
      const active = link.dataset.tool === tool;

      link.classList.toggle("active", active);

      if (active) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    setText(
      "form-heading",
      isLetter()
        ? "Your application details"
        : "Your professional details"
    );

    cvFields.forEach((id) => setHidden(id, coverOnly));
    letterFields.forEach((id) => setHidden(id, !isLetter()));

    setText("design-section-number", isLetter() ? "07" : "06");

    setHidden("job-title-field", false);
    setHidden("template-field", false);

    const jobTitle = $("job-title");

    if (jobTitle) {
      jobTitle.placeholder = coverOnly
        ? "e.g. Graduate Trainee"
        : "e.g. Data Analyst or Environmental Officer";

      const label = jobTitle.previousElementSibling;

      if (label) {
        label.textContent = coverOnly
          ? "Job title"
          : "Professional title / Target role";
      }
    }

    const downloadButton = $("download-button");

    if (downloadButton) {
      const label = downloadButton.querySelector("span:last-child");

      const buttonText = tool === "bundle"
        ? "Download Career Bundle"
        : tool === "cover-letter"
          ? "Download Cover Letter"
          : "Download CV";

      if (label) {
        label.textContent = buttonText;
      } else {
        downloadButton.textContent = buttonText;
      }
    }

    setText("ai-assistant-title", "AI Career Assistant");

    setText(
      "ai-assistant-description",
      "Improve your CV, strengthen your professional summary or prepare a tailored cover letter."
    );

    setText("ai-improve-cv", "Improve My CV with AI");
    setText("ai-improve-summary", "Improve My Professional Summary");
    setText("ai-write-letter", "Write My Cover Letter with AI");

    configureTemplates();
  }

  // --------------------------------------------------
  // CV DATA
  // --------------------------------------------------

  // Extra, template-specific fields. They appear in the form only for the
  // templates that print them.
  const extraDefs = {
    nysc: {
      title: "National Youth Service Corps (NYSC)",
      label: "NYSC service",
      kind: "entries",
      rows: 3,
      ph: "NYSC Corps Member\nMinistry of Environment, Abuja | 2018 - 2019\n- Your duties during service"
    },
    achievements: {
      title: "Key Achievements",
      label: "Key achievements (3 to 5 lines)",
      kind: "plain",
      rows: 4,
      ph: "- Grew revenue by 35% in two years\n- Led a team of 40 across 3 states"
    },
    publications: {
      title: "Publications and Conferences",
      label: "Publications, research outputs and conferences",
      kind: "plain",
      rows: 4,
      ph: "- Bello, A. (2022). Title. Journal Name, 12(3), 45-60.\n- Presented at the International Climate Conference, 2021"
    },
    languages: {
      title: "Languages",
      label: "Languages",
      kind: "skills",
      rows: 2,
      ph: "English: Fluent\nHausa: Native\nFrench: B1"
    },
    interests: {
      title: "Interests",
      label: "Interests (optional)",
      kind: "plain",
      rows: 2,
      ph: "Football, community volunteering, reading"
    },
    referees: {
      title: "Referees",
      label: "Referees (optional)",
      kind: "plain",
      rows: 3,
      ph: "Prof. A. Danjuma, University of Ibadan, a.danjuma@example.com, +234...\nMrs B. Okoro, Green Africa Initiative"
    },
    portfolio: {
      title: "",
      label: "Portfolio, GitHub or website (optional)",
      kind: "plain",
      rows: 1,
      single: true,
      ph: "yourname.com or github.com/yourname"
    }
  };

  const extraFor = {
    classic: ["interests"],
    graduate: ["interests", "referees"],
    nigerian: ["nysc", "interests", "referees"],
    ats: [],
    onepage: ["portfolio"],
    modern: ["languages", "portfolio"],
    sidebar: ["languages", "portfolio"],
    executive: ["achievements", "languages"],
    signature: ["achievements", "languages", "portfolio"],
    creative: ["portfolio", "interests"],
    scholarship: ["publications", "languages", "referees"],
    academic: ["publications", "languages", "referees"],
    europass: ["languages", "interests"],
    wordbanner: ["achievements", "languages", "portfolio"],
    premiumphoto: ["languages", "interests", "portfolio"],
    timeline: ["achievements", "languages", "portfolio"],
    elegant: ["languages", "interests", "referees"],
    corporate: ["achievements", "languages", "portfolio"],
    twocol: ["achievements", "languages", "portfolio"],
    cardspro: ["languages", "interests", "portfolio"]
  };

  function installExtraFields() {
    if ($("x-fields-installed")) return;

    const anchor = $("certificates-field");

    if (!anchor) return;

    const marker = document.createElement("span");

    marker.id = "x-fields-installed";
    marker.hidden = true;

    let after = anchor;

    Object.entries(extraDefs).forEach(([key, def]) => {
      const wrap = document.createElement("div");

      wrap.className = "field";
      wrap.id = "x-" + key + "-field";
      wrap.hidden = true;

      const label = document.createElement("label");

      label.setAttribute("for", "x-" + key);
      label.textContent = def.label;

      let input;

      if (def.single) {
        input = document.createElement("input");
        input.type = "text";
      } else {
        input = document.createElement("textarea");
        input.rows = def.rows;
      }

      input.id = "x-" + key;
      input.name = "x_" + key;
      input.placeholder = def.ph;

      wrap.append(label, input);
      after.insertAdjacentElement("afterend", wrap);
      after = wrap;
    });

    anchor.appendChild(marker);
  }

  function currentExtras() {
    const allowed = extraFor[getTemplate()] || [];
    const out = {};

    Object.keys(extraDefs).forEach((key) => {
      out[key] = allowed.includes(key) && tool !== "cover-letter"
        ? value("x-" + key)
        : "";
    });

    return out;
  }

  // Sections for the extra fields, in the order given.
  function xs(data, keys) {
    return keys.map((key) =>
      data.x[key]
        ? sectionHTML(extraDefs[key].title, data.x[key], extraDefs[key].kind)
        : ""
    ).join("");
  }

  function getCVData() {
    const x = currentExtras();
    const items = contactItems();

    if (x.portfolio) items.push(cleanLink(x.portfolio));

    return {
      name: value("full-name", "Your Full Name"),
      job: value("job-title"),
      contact: items.join("  |  "),
      contactItems: items,
      summary: value("summary"),
      education: value("education"),
      experience: value("experience"),
      skills: value("skills"),
      certificates: value("certificates"),
      x
    };
  }

  function roleHTML(data) {
    return data.job
      ? `<p class="cv-role">${escapeHTML(data.job)}</p>`
      : "";
  }

  function contactHTML(data) {
    return data.contact
      ? `<p class="cv-contact">${escapeHTML(data.contact)}</p>`
      : "";
  }

  function contactLinesHTML(data) {
    return data.contactItems
      .map((item) => `<p>${escapeHTML(item)}</p>`)
      .join("");
  }

  // --------------------------------------------------
  // CV TEMPLATES
  // --------------------------------------------------

  function britishProfessional(data) {
    return `
      <article ${docAttrs("cv-classic")}>
        <header class="cv-head">
          <h1>${escapeHTML(data.name)}</h1>
          ${roleHTML(data)}
          ${contactHTML(data)}
        </header>

        ${sectionHTML("Professional Profile", data.summary, "plain")}
        ${sectionHTML("Work Experience", data.experience)}
        ${sectionHTML("Education", data.education)}
        ${sectionHTML("Skills", data.skills, "skills")}
        ${sectionHTML("Certifications & Training", data.certificates, "plain")}
        ${xs(data, ["interests"])}
      </article>
    `;
  }

  function modernUK(data) {
    return `
      <article ${docAttrs("cv-modern")}>
        <header class="modern-head">
          <div>
            <h1>${escapeHTML(data.name)}</h1>
            ${roleHTML(data)}
          </div>

          <div class="modern-contact">
            ${contactLinesHTML(data)}
          </div>
        </header>

        ${sectionHTML("Profile", data.summary, "plain")}
        ${sectionHTML("Experience", data.experience)}
        ${sectionHTML("Education", data.education)}
        ${sectionHTML("Skills", data.skills, "skills")}
        ${xs(data, ["languages"])}
        ${sectionHTML("Training", data.certificates, "plain")}
      </article>
    `;
  }

  function executiveUK(data) {
    const sideHTML =
      sectionHTML("Core Skills", data.skills, "skills") +
      xs(data, ["languages"]) +
      sectionHTML("Training & Certifications", data.certificates, "plain");

    return `
      <article ${docAttrs("cv-executive")}>
        <header class="executive-head">
          <h1>${escapeHTML(data.name)}</h1>
          ${roleHTML(data)}
          ${contactHTML(data)}
        </header>

        <div class="executive-body${sideHTML.trim() ? "" : " no-side"}">
          <div class="executive-main">
            ${sectionHTML("Profile", data.summary, "plain")}
            ${xs(data, ["achievements"])}
            ${sectionHTML("Career History", data.experience)}
            ${sectionHTML("Education", data.education)}
          </div>

          ${sideHTML.trim()
            ? `<aside class="executive-side">${sideHTML}</aside>`
            : ""}
        </div>
      </article>
    `;
  }

  function graduateUK(data) {
    return `
      <article ${docAttrs("cv-graduate")}>
        <header class="graduate-head">
          <div>
            <h1>${escapeHTML(data.name)}</h1>
            ${roleHTML(data)}
          </div>

          <div class="graduate-contact">
            ${contactLinesHTML(data)}
          </div>
        </header>

        ${sectionHTML("Profile", data.summary, "plain")}
        ${sectionHTML("Education", data.education)}
        ${sectionHTML("Experience & Projects", data.experience)}
        ${sectionHTML("Skills", data.skills, "skills")}
        ${sectionHTML("Certifications & Activities", data.certificates, "plain")}
        ${xs(data, ["interests", "referees"])}
      </article>
    `;
  }

  function sidebarUK(data) {
    const contactBlock = data.contactItems.length
      ? `<section class="cv-section"><h2>Contact</h2><div class="cv-section-content">${contactLinesHTML(data)}</div></section>`
      : "";

    return `
      <article ${docAttrs("cv-sidebar")}>
        <div class="sidebar-layout">
          <aside class="sidebar-col">
            ${contactBlock}
            ${sectionHTML("Skills", data.skills, "skills")}
            ${xs(data, ["languages"])}
            ${sectionHTML("Training and Certifications", data.certificates, "plain")}
          </aside>

          <div class="sidebar-main">
            <header class="sidebar-head">
              <h1>${escapeHTML(data.name)}</h1>
              ${roleHTML(data)}
            </header>

            ${sectionHTML("Profile", data.summary, "plain")}
            ${sectionHTML("Experience", data.experience)}
            ${sectionHTML("Education", data.education)}
          </div>
        </div>
      </article>
    `;
  }

  function atsFriendly(data) {
    return `
      <article ${docAttrs("cv-ats")}>
        <header class="ats-head">
          <h1>${escapeHTML(data.name)}</h1>
          ${roleHTML(data)}
          ${contactHTML(data)}
        </header>

        ${sectionHTML("Professional Summary", data.summary, "plain")}
        ${sectionHTML("Work Experience", data.experience)}
        ${sectionHTML("Education", data.education)}
        ${sectionHTML("Skills", data.skills, "skills")}
        ${sectionHTML("Certifications", data.certificates, "plain")}
      </article>
    `;
  }

  function academicCV(data) {
    return `
      <article ${docAttrs("cv-academic")}>
        <header class="academic-head">
          <h1>${escapeHTML(data.name)}</h1>
          ${roleHTML(data)}
          ${contactHTML(data)}
        </header>

        ${sectionHTML("Research Profile", data.summary, "plain")}
        ${sectionHTML("Education", data.education)}
        ${sectionHTML("Research and Professional Experience", data.experience)}
        ${xs(data, ["publications"])}
        ${sectionHTML("Awards, Grants and Training", data.certificates, "plain")}
        ${sectionHTML("Skills", data.skills, "skills")}
        ${xs(data, ["languages", "referees"])}
      </article>
    `;
  }

  function skillChips(text) {
    const items = [];

    getLines(text).forEach((line) => {
      const m = line.match(/^([^:]{2,32}):\s*(.+)$/);
      const body = (m ? m[2] : line.replace(BULLET, ""));

      body.split(/[,;]+/).forEach((part) => {
        const t = part.trim();
        if (t) items.push(t);
      });
    });

    if (!items.length) return "";

    return `<div class="chip-row">${items.map((item) =>
      `<span class="chip">${escapeHTML(item)}</span>`).join("")}</div>`;
  }

  function scholarshipCV(data) {
    return `
      <article ${docAttrs("cv-scholarship")}>
        <header class="sch-head">
          <h1>${escapeHTML(data.name)}</h1>
          ${roleHTML(data)}
          ${contactHTML(data)}
        </header>

        ${sectionHTML("Personal Statement", data.summary, "plain")}
        ${sectionHTML("Education", data.education)}
        ${sectionHTML("Experience and Leadership", data.experience)}
        ${xs(data, ["publications"])}
        ${sectionHTML("Awards, Scholarships and Certifications", data.certificates, "plain")}
        ${sectionHTML("Skills", data.skills, "skills")}
        ${xs(data, ["languages", "referees"])}
        ${data.x.referees ? "" : `<p class="sch-ref">Referees available on request.</p>`}
      </article>
    `;
  }

  function nigerianCV(data) {
    const photo = photoData
      ? `<img class="ng-photo" src="${photoData}" alt="">`
      : "";

    return `
      <article ${docAttrs("cv-nigerian")}>
        <header class="ng-head${photo ? " has-photo" : ""}">
          <div class="ng-id">
            <h1>${escapeHTML(data.name)}</h1>
            ${roleHTML(data)}
            ${contactHTML(data)}
          </div>
          ${photo}
        </header>

        ${sectionHTML("Personal Profile", data.summary, "plain")}
        ${sectionHTML("Education", data.education)}
        ${xs(data, ["nysc"])}
        ${sectionHTML("Work Experience", data.experience)}
        ${sectionHTML("Skills", data.skills, "skills")}
        ${sectionHTML("Certifications and Training", data.certificates, "plain")}
        ${xs(data, ["interests", "referees"])}
        ${data.x.referees ? "" : `<p class="ng-ref">Referees available on request.</p>`}
      </article>
    `;
  }

  function europassCV(data) {
    return `
      <article ${docAttrs("cv-europass")}>
        <header class="eu-head">
          <h1>${escapeHTML(data.name)}</h1>
          ${roleHTML(data)}
        </header>
        ${data.contactItems.length
          ? `<div class="eu-contact">${data.contactItems.map((i) =>
              `<span>${escapeHTML(i)}</span>`).join("")}</div>`
          : ""}

        ${sectionHTML("About me", data.summary, "plain")}
        ${sectionHTML("Work experience", data.experience)}
        ${sectionHTML("Education and training", data.education)}
        ${sectionHTML("Skills", data.skills, "skills")}
        ${data.x.languages ? sectionHTML("Language skills", data.x.languages, "skills") : ""}
        ${sectionHTML("Certificates and other information", data.certificates, "plain")}
        ${xs(data, ["interests"])}
      </article>
    `;
  }

  function onePageCV(data) {
    return `
      <article ${docAttrs("cv-onepage")}>
        <header class="op-head">
          <h1>${escapeHTML(data.name)}</h1>
          ${data.job ? `<span class="op-role">${escapeHTML(data.job)}</span>` : ""}
          ${data.contactItems.length
            ? `<p class="op-contact">${escapeHTML(data.contactItems.join("  •  "))}</p>`
            : ""}
        </header>

        ${sectionHTML("Summary", data.summary, "plain")}
        ${sectionHTML("Experience", data.experience)}
        ${sectionHTML("Education", data.education)}
        ${sectionHTML("Skills", data.skills, "skills")}
        ${sectionHTML("Certifications", data.certificates, "plain")}
      </article>
    `;
  }

  function creativeCV(data) {
    const chips = skillChips(data.skills);

    return `
      <article ${docAttrs("cv-creative")}>
        <header class="cr-head">
          <h1>${escapeHTML(data.name)}</h1>
          ${roleHTML(data)}
          ${data.contactItems.length
            ? `<p class="cr-contact">${data.contactItems.map((i) =>
                `<span>${escapeHTML(i)}</span>`).join("")}</p>`
            : ""}
        </header>

        <div class="cr-body">
          ${sectionHTML("Profile", data.summary, "plain")}
          ${chips ? `<section class="cv-section"><h2>Skills</h2><div class="cv-section-content">${chips}</div></section>` : ""}
          ${sectionHTML("Experience and Projects", data.experience)}
          ${sectionHTML("Education", data.education)}
          ${sectionHTML("Certifications", data.certificates, "plain")}
          ${xs(data, ["interests"])}
        </div>
      </article>
    `;
  }

  function signatureCV(data) {
    return `
      <article ${docAttrs("cv-signature")}>
        <header class="sg-head">
          <h1>${escapeHTML(data.name)}</h1>
          ${roleHTML(data)}
        </header>
        ${data.contact
          ? `<p class="sg-contact">${escapeHTML(data.contact)}</p>`
          : ""}

        <div class="sg-body">
          ${sectionHTML("Profile", data.summary, "plain")}
          ${xs(data, ["achievements"])}
          ${sectionHTML("Experience", data.experience)}
          ${sectionHTML("Education", data.education)}
          ${sectionHTML("Skills", data.skills, "skills")}
          ${xs(data, ["languages"])}
          ${sectionHTML("Training and Certifications", data.certificates, "plain")}
        </div>
      </article>
    `;
  }

  function photoImg(cls) {
    return photoData ? `<img class="${cls}" src="${photoData}" alt="">` : "";
  }

  function initialsOf(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    return ((parts[0] || "?")[0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  }

  function contactSpans(data, cls) {
    return data.contactItems.length
      ? `<p class="${cls}">${data.contactItems.map((i) => `<span>${escapeHTML(i)}</span>`).join("")}</p>`
      : "";
  }

  function wordBannerCV(data) {
    return `
      <article ${docAttrs("cv-wordbanner")}>
        <header class="wb-head">
          <div class="wb-id">
            <h1>${escapeHTML(data.name)}</h1>
            ${roleHTML(data)}
          </div>
          ${photoImg("wb-photo")}
        </header>
        ${contactSpans(data, "wb-contact")}
        <div class="wb-body">
          ${sectionHTML("Profile", data.summary, "plain")}
          ${xs(data, ["achievements"])}
          ${sectionHTML("Experience", data.experience)}
          ${sectionHTML("Education", data.education)}
          ${sectionHTML("Skills", data.skills, "skills")}
          ${xs(data, ["languages"])}
          ${sectionHTML("Training and Certifications", data.certificates, "plain")}
        </div>
      </article>
    `;
  }

  function premiumPhotoCV(data) {
    const contact = data.contactItems.length
      ? `<section class="cv-section"><h2>Contact</h2><div class="cv-section-content">${contactLinesHTML(data)}</div></section>`
      : "";

    return `
      <article ${docAttrs("cv-premium")}>
        <div class="pp-layout">
          <div class="pp-main">
            <header class="pp-head">
              <h1>${escapeHTML(data.name)}</h1>
              ${roleHTML(data)}
            </header>
            ${sectionHTML("Profile", data.summary, "plain")}
            ${sectionHTML("Experience", data.experience)}
            ${sectionHTML("Education", data.education)}
          </div>
          <aside class="pp-side">
            ${photoImg("pp-photo")}
            ${contact}
            ${sectionHTML("Skills", data.skills, "skills")}
            ${xs(data, ["languages", "interests"])}
            ${sectionHTML("Training", data.certificates, "plain")}
          </aside>
        </div>
      </article>
    `;
  }

  function timelineCV(data) {
    return `
      <article ${docAttrs("cv-timeline")}>
        <header class="tl-head">
          <div class="tl-id">
            <h1>${escapeHTML(data.name)}</h1>
            ${roleHTML(data)}
            ${contactSpans(data, "tl-contact")}
          </div>
          ${photoImg("tl-photo")}
        </header>
        ${sectionHTML("Profile", data.summary, "plain")}
        ${xs(data, ["achievements"])}
        ${sectionHTML("Experience", data.experience)}
        ${sectionHTML("Education", data.education)}
        ${sectionHTML("Skills", data.skills, "skills")}
        ${xs(data, ["languages"])}
        ${sectionHTML("Training and Certifications", data.certificates, "plain")}
      </article>
    `;
  }

  function elegantCV(data) {
    return `
      <article ${docAttrs("cv-elegant")}>
        <header class="el-head">
          ${photoImg("el-photo")}
          <h1>${escapeHTML(data.name)}</h1>
          ${roleHTML(data)}
          ${contactSpans(data, "el-contact")}
        </header>
        ${sectionHTML("Profile", data.summary, "plain")}
        ${sectionHTML("Experience", data.experience)}
        ${sectionHTML("Education", data.education)}
        ${sectionHTML("Skills", data.skills, "skills")}
        ${xs(data, ["languages", "interests"])}
        ${sectionHTML("Training and Certifications", data.certificates, "plain")}
        ${xs(data, ["referees"])}
      </article>
    `;
  }

  function corporateCV(data) {
    const block = photoData
      ? `<img class="co-photo" src="${photoData}" alt="">`
      : `<div class="co-initials">${escapeHTML(initialsOf(data.name))}</div>`;

    return `
      <article ${docAttrs("cv-corporate")}>
        <header class="co-head">
          <div class="co-block">${block}</div>
          <div class="co-id">
            <h1>${escapeHTML(data.name)}</h1>
            ${roleHTML(data)}
            ${contactSpans(data, "co-contact")}
          </div>
        </header>
        <div class="co-body">
          ${sectionHTML("Profile", data.summary, "plain")}
          ${xs(data, ["achievements"])}
          ${sectionHTML("Experience", data.experience)}
          ${sectionHTML("Education", data.education)}
          ${sectionHTML("Skills", data.skills, "skills")}
          ${xs(data, ["languages"])}
          ${sectionHTML("Training and Certifications", data.certificates, "plain")}
        </div>
      </article>
    `;
  }

  function twoColCV(data) {
    const chips = skillChips(data.skills);

    return `
      <article ${docAttrs("cv-twocol")}>
        <header class="tc-head">
          <div class="tc-id">
            <h1>${escapeHTML(data.name)}</h1>
            ${roleHTML(data)}
            ${contactSpans(data, "tc-contact")}
          </div>
          ${photoImg("tc-photo")}
        </header>
        ${chips ? `<div class="tc-strip">${chips}</div>` : ""}
        <div class="tc-cols">
          <div class="tc-main">
            ${sectionHTML("Profile", data.summary, "plain")}
            ${sectionHTML("Experience", data.experience)}
          </div>
          <div class="tc-side">
            ${sectionHTML("Education", data.education)}
            ${xs(data, ["achievements", "languages"])}
            ${sectionHTML("Training", data.certificates, "plain")}
          </div>
        </div>
      </article>
    `;
  }

  function cardsCV(data) {
    const chips = skillChips(data.skills);
    const card = (title, inner) => inner ? `<section class="cv-section cp-card"><h2>${escapeHTML(title)}</h2><div class="cv-section-content">${inner}</div></section>` : "";

    return `
      <article ${docAttrs("cv-cards")}>
        <header class="cp-head">
          <div class="cp-id">
            <h1>${escapeHTML(data.name)}</h1>
            ${roleHTML(data)}
            ${contactSpans(data, "cp-contact")}
          </div>
          ${photoImg("cp-photo")}
        </header>
        <div class="cp-body">
          ${sectionHTML("Profile", data.summary, "plain", "cp-card")}
          ${sectionHTML("Experience", data.experience, "entries", "cp-card")}
          ${sectionHTML("Education", data.education, "entries", "cp-card")}
          ${card("Skills", chips)}
          ${xs(data, ["languages", "interests"]).replace(/class="cv-section /g, 'class="cv-section cp-card ')}
          ${sectionHTML("Training and Certifications", data.certificates, "plain", "cp-card")}
        </div>
      </article>
    `;
  }

  function buildCVHTML() {
    const data = getCVData();

    switch (getTemplate()) {
      case "modern":
        return modernUK(data);

      case "executive":
        return executiveUK(data);

      case "graduate":
        return graduateUK(data);

      case "sidebar":
        return sidebarUK(data);

      case "ats":
        return atsFriendly(data);

      case "academic":
        return academicCV(data);

      case "scholarship":
        return scholarshipCV(data);

      case "nigerian":
        return nigerianCV(data);

      case "europass":
        return europassCV(data);

      case "onepage":
        return onePageCV(data);

      case "creative":
        return creativeCV(data);

      case "signature":
        return signatureCV(data);

      case "wordbanner":
        return wordBannerCV(data);

      case "premiumphoto":
        return premiumPhotoCV(data);

      case "timeline":
        return timelineCV(data);

      case "elegant":
        return elegantCV(data);

      case "corporate":
        return corporateCV(data);

      case "twocol":
        return twoColCV(data);

      case "cardspro":
        return cardsCV(data);

      case "classic":
      default:
        return britishProfessional(data);
    }
  }

  // --------------------------------------------------
  // UK COVER LETTER HELPERS
  // --------------------------------------------------

  function formatUKDate(rawDate) {
    if (rawDate) {
      const parts = rawDate.split("-");

      if (parts.length === 3) {
        const date = new Date(
          Number(parts[0]),
          Number(parts[1]) - 1,
          Number(parts[2])
        );

        if (!Number.isNaN(date.getTime())) {
          return new Intl.DateTimeFormat("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric"
          }).format(date);
        }
      }
    }

    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(new Date());
  }

  function addressLinesHTML(text) {
    return getLines(text)
      .map((line) => `<p>${escapeHTML(line)}</p>`)
      .join("");
  }

  function getRecipientDetails() {
    const recipient = value("recipient");

    const genericRecipient =
      !recipient ||
      /^(hiring manager|hiring team|recruit(ment)? team|human resources|hr\b|talent acquisition|sir|madam|dear sir|dear madam|to whom)/i.test(recipient);

    let greetingName = recipient;

    if (genericRecipient) {
      greetingName =
        recipient && /recruit/i.test(recipient)
          ? "Recruitment Team"
          : "Hiring Manager";
    }

    return {
      greetingName,
      signOff: genericRecipient
        ? "Yours faithfully"
        : "Yours sincerely"
    };
  }

  // --------------------------------------------------
  // COVER LETTER
  // --------------------------------------------------

  function buildLetterHTML() {
    const name = value("full-name", "Your Full Name");
    const job = value("job-title");
    const employer = value("employer");

    const applicantAddress = value("applicant-address");
    const employerAddress = value("employer-address");

    const recipient = value("recipient");
    const date = formatUKDate(value("application-date"));

    const items = contactItems();

    const { greetingName, signOff } = getRecipientDetails();

    const body = value("letter-body");

    const subject = job
      ? `APPLICATION FOR ${job}`
      : "APPLICATION FOR ADVERTISED POSITION";

    return `
      <article ${docAttrs("letter-document letter-" + getTemplate())}>

        <header class="letter-sender">
          <h1>${escapeHTML(name)}</h1>

          ${addressLinesHTML(applicantAddress)}

          ${items.map((item) =>
            `<p>${escapeHTML(item)}</p>`
          ).join("")}
        </header>

        <p class="letter-date">${escapeHTML(date)}</p>

        <div class="letter-recipient">
          <p>${escapeHTML(greetingName)}</p>

          ${employer
            ? `<p>${escapeHTML(employer)}</p>`
            : ""}

          ${addressLinesHTML(employerAddress)}
        </div>

        <div class="letter-content">

          <p class="letter-subject">${escapeHTML(subject)}</p>

          <p>Dear ${escapeHTML(greetingName)},</p>

          ${body
            ? formatEntries(body, "plain")
            : `<p class="letter-placeholder">Your tailored application letter will appear here when you enter your letter content.</p>`}

          <p class="letter-close">${escapeHTML(signOff)},</p>

          <p class="letter-name">${escapeHTML(name)}</p>

        </div>

      </article>
    `;
  }

  // --------------------------------------------------
  // DOCUMENT DESIGN — TIMES NEW ROMAN
  // --------------------------------------------------

  const designStyles = `
    .cv-document {
      width: 100%;
      background: #ffffff;
      color: #222222;
      font-family: "Times New Roman", Times, serif;
      font-size: 11pt;
      line-height: 1.15;
      padding: 36px 44px;
      overflow-wrap: break-word;
      word-break: normal;
      hyphens: manual;
    }

    .cv-document {
      --cv-font: "Times New Roman", Times, serif;
    }

    .cv-document,
    .cv-document * {
      box-sizing: border-box;
      font-family: var(--cv-font) !important;
    }

    .cv-modern, .cv-graduate, .cv-sidebar {
      --cv-font: "Helvetica Neue", Helvetica, Arial, sans-serif;
    }

    .cv-ats {
      --cv-font: Arial, Helvetica, sans-serif;
    }

    .cv-executive, .cv-academic {
      --cv-font: Georgia, "Times New Roman", serif;
    }

    .cv-document h1 {
      margin: 0;
      font-size: 26pt;
      line-height: 1.1;
      font-weight: 700;
      color: #111111;
    }

    .cv-document h2 {
      margin: 0 0 8px;
      font-size: 12pt;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      break-after: avoid;
      page-break-after: avoid;
    }

    .cv-document p {
      margin: 0 0 5px;
    }

    .cv-role {
      font-size: 12pt;
      margin: 5px 0 0 !important;
    }

    .cv-contact {
      font-size: 10pt;
      margin: 6px 0 0 !important;
    }

    .cv-section {
      margin: 0 0 16px;
    }

    .cv-entry {
      margin: 0 0 11px;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .cv-entry-title {
      font-weight: 700;
      color: #111111;
      margin: 0 0 1px !important;
    }

    .cv-entry-sub {
      font-size: 10pt;
      color: #5c5c5c;
      margin: 0 0 4px !important;
    }

    .cv-list {
      margin: 3px 0 0;
      padding-left: 18px;
    }

    .cv-list li {
      margin: 0 0 3px;
      padding-left: 2px;
    }

    /* BRITISH PROFESSIONAL */

    .cv-classic {
      color: #1c1c1c;
    }

    .cv-classic .cv-head {
      text-align: center;
      padding-bottom: 14px;
      margin-bottom: 18px;
      border-bottom: 1.5px solid #1c1c1c;
    }

    .cv-classic h1 {
      font-size: 25pt;
      letter-spacing: 0.02em;
    }

    .cv-classic .cv-role {
      font-style: italic;
      color: #444444;
    }

    .cv-classic .cv-contact {
      color: #444444;
    }

    .cv-classic h2 {
      color: #111111;
      padding-bottom: 4px;
      border-bottom: 1px solid #bdbdbd;
    }

    /* MODERN UK */

    .cv-modern .modern-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 24px;
      padding-bottom: 16px;
      margin-bottom: 20px;
      border-bottom: 3px solid #075b3b;
    }

    .cv-modern h1 {
      color: #075b3b;
      font-size: 27pt;
    }

    .cv-modern .cv-role {
      color: #444444;
    }

    .cv-modern .modern-head > div:first-child {
      min-width: 0;
    }

    .cv-modern .cv-role {
      margin-top: 6px !important;
      font-size: 12pt;
    }

    .modern-contact {
      flex: none;
      max-width: 46%;
      text-align: right;
      font-size: 10pt;
      color: #444444;
      line-height: 1.5;
    }

    .modern-contact p {
      margin: 0;
    }

    .cv-modern .cv-section {
      display: grid;
      grid-template-columns: 112px minmax(0, 1fr);
      column-gap: 20px;
    }

    .cv-modern .cv-section-content {
      min-width: 0;
    }

    .cv-modern h2 {
      color: #075b3b;
      font-size: 10.5pt;
      padding-top: 2px;
    }

    .cv-modern .cv-entry-title {
      font-size: 11pt;
    }

    /* EXECUTIVE UK */

    .cv-executive .executive-head {
      background: #1b2a41;
      color: #ffffff;
      padding: 26px 30px;
      border-bottom: 4px solid #b08d3c;
    }

    .cv-executive .executive-head h1 {
      color: #ffffff;
      font-size: 25pt;
    }

    .cv-executive .executive-head .cv-role {
      color: #e3c77f;
    }

    .cv-executive .executive-head .cv-contact {
      color: #d6dde8;
    }

    .executive-body {
      display: grid;
      grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
      gap: 26px;
      padding-top: 20px;
    }

    .executive-body.no-side {
      grid-template-columns: 1fr;
    }

    .executive-main,
    .executive-side {
      min-width: 0;
    }

    .cv-executive h2 {
      color: #1b2a41;
      padding-bottom: 4px;
      border-bottom: 2px solid #b08d3c;
    }

    .executive-side {
      background: #f4f1ea;
      padding: 16px 16px 4px;
      align-self: start;
      font-size: 10pt;
    }

    .executive-side h2 {
      font-size: 10.5pt;
      letter-spacing: 0.02em;
    }

    .executive-side,
    .executive-side * {
      overflow-wrap: break-word;
      word-break: normal;
      hyphens: manual;
    }

    /* GRADUATE UK */

    .cv-graduate .graduate-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
      padding: 4px 0 4px 18px;
      margin-bottom: 20px;
      border-left: 7px solid var(--cv-accent, #0b4f6c);
    }

    .cv-graduate .graduate-head > div:first-child {
      min-width: 0;
    }

    .cv-graduate h1 {
      font-size: 24pt;
      color: var(--cv-accent, #0b4f6c);
    }

    .cv-graduate .cv-role {
      color: #455a64;
    }

    .graduate-contact {
      flex: none;
      max-width: 42%;
      text-align: right;
      font-size: 9.5pt;
      color: #455a64;
      line-height: 1.5;
    }

    .graduate-contact p {
      margin: 0;
    }

    .cv-graduate h2 {
      color: var(--cv-accent, #0b4f6c);
      font-size: 10.5pt;
      padding: 4px 10px;
      background: var(--cv-tint, #e7f0f4);
      border-left: 3px solid var(--cv-accent, #0b4f6c);
    }

    /* UK COVER LETTER */

    .letter-document {
      font-size: 11pt;
      line-height: 1.45;
      padding: 40px 46px;
      min-height: 700px;
      text-align: left;
    }

    .letter-document * {
      text-align: left !important;
    }

    .letter-sender {
      text-align: left;
      margin-bottom: 18px;
      padding-bottom: 12px;
      border-bottom: 1px solid #c6a24a;
    }

    .letter-sender h1 {
      font-size: 17pt;
      margin-bottom: 5px;
      color: #075b3b;
    }

    .letter-sender p {
      margin: 0;
      font-size: 10pt;
      color: #555555;
      line-height: 1.4;
    }

    .letter-date {
      text-align: left;
      margin: 0 0 18px !important;
    }

    .letter-recipient {
      margin-bottom: 18px;
      text-align: left;
    }

    .letter-recipient p {
      margin: 0;
      line-height: 1.4;
    }

    .letter-content {
      text-align: left;
    }

    .letter-content p {
      margin: 0 0 11px;
      line-height: 1.45;
      text-align: left;
    }

    .letter-subject {
      font-weight: 700;
      text-transform: uppercase;
      margin: 0 0 14px !important;
    }

    .letter-close {
      margin-top: 18px !important;
      margin-bottom: 4px !important;
    }

    .letter-name {
      font-weight: 700;
      margin-bottom: 0 !important;
    }

    .letter-placeholder {
      color: #777777;
      font-style: italic;
    }

    .letter-modern .letter-sender h1 {
      color: #075b3b;
    }

    .letter-executive .letter-sender h1 {
      color: #1b2a41;
    }

    .letter-graduate .letter-sender h1 {
      color: #0b4f6c;
    }

    /* CAREER BUNDLE */

    .bundle-preview-divider {
      height: 24px;
    }

    .page-break {
      display: block;
      height: 1px;
      page-break-before: always;
      break-before: page;
    }

    /* PDF EXPORT */

    #noh-pdf-export {
      width: 794px !important;
      background: #ffffff !important;
      color: #222222 !important;
      box-sizing: border-box !important;
      overflow: visible !important;
    }

    #noh-pdf-export .cv-document {
      width: 794px !important;
      max-width: none !important;
    }

    #noh-pdf-export .page-break {
      height: 1px !important;
      page-break-before: always !important;
      break-before: page !important;
    }

    /* CENTRED CV HEADERS */

    .cv-classic .cv-head,
    .cv-executive .executive-head {
      text-align: center;
    }

    .cv-classic .cv-head h1,
    .cv-classic .cv-head .cv-role,
    .cv-classic .cv-head .cv-contact,
    .cv-executive .executive-head h1,
    .cv-executive .executive-head .cv-role,
    .cv-executive .executive-head .cv-contact {
      width: 100%;
      text-align: center;
    }

    /* THEME COLOURS */

    .cv-classic[style*="--cv-accent"] h1,
    .cv-classic[style*="--cv-accent"] h2 {
      color: var(--cv-accent);
    }

    .cv-classic[style*="--cv-accent"] h2,
    .cv-classic[style*="--cv-accent"] .cv-head {
      border-bottom-color: var(--cv-accent);
    }

    .cv-modern[style*="--cv-accent"] .modern-head {
      border-bottom-color: var(--cv-accent);
    }

    .cv-modern[style*="--cv-accent"] h1,
    .cv-modern[style*="--cv-accent"] h2 {
      color: var(--cv-accent);
    }

    .cv-executive[style*="--cv-accent"] .executive-head {
      background: var(--cv-accent);
    }

    .cv-executive[style*="--cv-accent"] .executive-body h2 {
      color: var(--cv-accent);
    }

    .letter-document[style*="--cv-accent"] .letter-sender h1 {
      color: var(--cv-accent);
    }

    /* SIDEBAR TWO-COLUMN */

    .cv-document.cv-sidebar {
      padding: 0;
    }

    .sidebar-layout {
      display: grid;
      grid-template-columns: 32% minmax(0, 1fr);
      min-height: 1040px;
      background: linear-gradient(to right, var(--cv-accent, #075b3b) 32%, #ffffff 32%);
    }

    .sidebar-col {
      min-width: 0;
      padding: 34px 18px;
    }

    .sidebar-col,
    .sidebar-col * {
      color: #ffffff !important;
    }

    .sidebar-col h2 {
      padding-bottom: 4px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.4);
    }

    .sidebar-col p {
      font-size: 10pt;
      line-height: 1.4;
    }

    .sidebar-main {
      min-width: 0;
      padding: 34px 32px;
    }

    .sidebar-head {
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 2px solid var(--cv-accent, #075b3b);
    }

    .cv-sidebar .sidebar-head h1 {
      color: var(--cv-accent, #075b3b);
      font-size: 22pt;
    }

    .cv-sidebar .sidebar-main h2 {
      padding-bottom: 4px;
      border-bottom: 1px solid #cfcfcf;
      color: var(--cv-accent, #075b3b);
    }

    /* ATS-FRIENDLY */

    .cv-ats .ats-head {
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid #000000;
    }

    .cv-ats h1 {
      font-size: 20pt;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #000000;
    }

    .cv-ats h2 {
      padding-bottom: 2px;
      border-bottom: 1px solid #000000;
      color: #000000;
    }

    /* ACADEMIC */

    .cv-academic .academic-head {
      margin-bottom: 20px;
      padding-bottom: 14px;
      border-bottom: 2px solid var(--cv-accent, #1b2a41);
      text-align: center;
    }

    .cv-academic h1 {
      font-size: 24pt;
      color: var(--cv-accent, #1b2a41);
    }

    .cv-academic .cv-role,
    .cv-academic .cv-contact {
      text-align: center;
    }

    .cv-academic h2 {
      padding-bottom: 3px;
      border-bottom: 1px solid var(--cv-accent, #1b2a41);
      color: var(--cv-accent, #1b2a41);
      font-size: 12.5pt;
      letter-spacing: 0.02em;
      text-transform: none;
      font-variant: small-caps;
    }

    /* SCHOLARSHIP CV */

    .cv-scholarship { --cv-font: Georgia, "Times New Roman", serif; border-top: 8px solid var(--cv-accent, #7a1f3d); }
    .cv-scholarship .sch-head { margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px solid #bdbdbd; }
    .cv-scholarship h1 { font-size: 26pt; color: var(--cv-accent, #7a1f3d); }
    .cv-scholarship .cv-role { font-style: italic; color: #444444; }
    .cv-scholarship .cv-contact { color: #444444; }
    .cv-scholarship h2 { font-size: 11pt; color: var(--cv-accent, #7a1f3d); letter-spacing: 0.08em; padding-left: 10px; border-left: 4px solid #b08d3c; }
    .cv-scholarship .cv-section-content { padding-left: 14px; }
    .cv-scholarship .sch-ref { margin: 14px 0 0; font-style: italic; color: #555555; }

    /* NIGERIAN GRADUATE */

    .cv-nigerian .ng-head { display: flex; align-items: center; justify-content: space-between; gap: 22px; padding: 18px 22px; margin-bottom: 20px; background: var(--cv-tint, #eef5f0); border-bottom: 4px solid var(--cv-accent, #075b3b); }
    .cv-nigerian .ng-id { min-width: 0; flex: 1; }
    .cv-nigerian h1 { font-size: 24pt; color: var(--cv-accent, #075b3b); }
    .cv-nigerian .cv-role { font-weight: 700; color: #333333; }
    .cv-nigerian .cv-contact { color: #444444; }
    .cv-nigerian .ng-photo { flex: none; width: 104px; height: 104px; object-fit: cover; border-radius: 50%; border: 3px solid var(--cv-accent, #075b3b); }
    .cv-nigerian h2 { display: inline-block; font-size: 10.5pt; padding: 3px 12px; margin-bottom: 8px; color: #ffffff; background: var(--cv-accent, #075b3b); }
    .cv-nigerian .ng-ref { margin: 12px 0 0; font-style: italic; color: #555555; }

    /* EUROPASS-STYLE */

    .cv-europass .eu-head { padding-bottom: 10px; margin-bottom: 0; border-bottom: 3px solid var(--cv-accent, #0b5fa5); }
    .cv-europass h1 { font-size: 24pt; color: var(--cv-accent, #0b5fa5); }
    .cv-europass .cv-role { color: #333333; }
    .cv-europass .eu-contact { display: flex; flex-wrap: wrap; gap: 4px 20px; padding: 9px 12px; margin-bottom: 18px; background: var(--cv-tint, #eef3f8); font-size: 9.5pt; color: #333333; }
    .cv-europass .cv-section { display: grid; grid-template-columns: 128px minmax(0, 1fr); column-gap: 0; }
    .cv-europass h2 { padding: 2px 14px 0 0; text-align: right; font-size: 10pt; text-transform: none; letter-spacing: 0; color: var(--cv-accent, #0b5fa5); }
    .cv-europass .cv-section-content { min-width: 0; padding-left: 16px; border-left: 2px solid #c9d6e3; }

    /* ONE-PAGE RESUME */

    .cv-onepage { --cv-font: Arial, Helvetica, sans-serif; font-size: 10pt; line-height: 1.2; padding: 28px 38px; }
    .cv-onepage .op-head { margin-bottom: 10px; }
    .cv-onepage h1 { display: inline; font-size: 21pt; color: #111111; }
    .cv-onepage .op-role { margin-left: 12px; font-size: 11pt; color: var(--cv-accent, #1b2a41); font-weight: 700; }
    .cv-onepage .op-contact { margin: 3px 0 0; font-size: 9pt; color: #444444; }
    .cv-onepage h2 { margin-bottom: 4px; padding-bottom: 1px; font-size: 9.5pt; color: var(--cv-accent, #1b2a41); border-bottom: 1.5px solid var(--cv-accent, #1b2a41); }
    .cv-onepage .cv-section { margin-bottom: 9px; }
    .cv-onepage .cv-entry { margin-bottom: 6px; }
    .cv-onepage .cv-entry-sub { font-size: 9pt; }
    .cv-onepage .cv-list li { margin-bottom: 1px; }

    /* TECH AND CREATIVE */

    .cv-document.cv-creative { --cv-font: "Helvetica Neue", Helvetica, Arial, sans-serif; padding: 0; }
    .cv-creative .cr-head { padding: 30px 40px 22px; background: #1d2430; border-bottom: 5px solid var(--cv-accent, #00a389); }
    .cv-creative h1 { color: #ffffff; font-size: 27pt; letter-spacing: 0.01em; }
    .cv-creative .cv-role { color: var(--cv-accent, #00a389); font-size: 13pt; font-weight: 700; }
    .cv-creative .cr-contact { margin: 10px 0 0; display: flex; flex-wrap: wrap; gap: 4px 18px; font-size: 9.5pt; color: #cfd6e0; }
    .cv-creative .cr-body { padding: 22px 40px 30px; }
    .cv-creative h2 { display: inline-block; padding: 2px 10px; font-size: 10pt; color: #ffffff; background: var(--cv-accent, #00a389); border-radius: 3px; margin-bottom: 9px; }
    .cv-creative .chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
    .cv-creative .chip { padding: 3px 10px; font-size: 9.5pt; color: #1d2430; background: var(--cv-tint, #e3f6f2); border: 1px solid var(--cv-accent, #00a389); border-radius: 999px; }

    /* GOLD AND EMERALD SIGNATURE */

    .cv-document.cv-signature { padding: 0; }
    .cv-signature .sg-head { padding: 30px 44px 18px; text-align: center; background: var(--cv-accent, #075b3b); border-bottom: 5px solid #c6a24a; }
    .cv-signature h1 { color: #ffffff; font-size: 26pt; letter-spacing: 0.03em; }
    .cv-signature .cv-role { color: #e8cf8a; font-style: italic; font-size: 12.5pt; }
    .cv-signature .sg-contact { margin: 0; padding: 9px 44px; text-align: center; font-size: 9.5pt; color: #4a4a4a; background: #faf5e4; border-bottom: 1px solid #c6a24a; }
    .cv-signature .sg-body { padding: 20px 44px 30px; }
    .cv-signature h2 { display: flex; align-items: center; gap: 12px; font-size: 11pt; color: var(--cv-accent, #075b3b); }
    .cv-signature h2::after { content: ""; flex: 1; height: 1.5px; background: #c6a24a; }


    /* ===== WORD-STYLE PREMIUM TEMPLATES (photo ready) ===== */

    .cv-wordbanner, .cv-premium, .cv-timeline, .cv-corporate, .cv-twocol, .cv-cards {
      --cv-font: Calibri, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    }
    .cv-elegant { --cv-font: Cambria, Georgia, "Times New Roman", serif; }

    .cv-document.cv-wordbanner, .cv-document.cv-premium, .cv-document.cv-corporate,
    .cv-document.cv-cards, .cv-document.cv-twocol { padding: 0; font-size: 10.5pt; line-height: 1.25; }
    .cv-document.cv-timeline, .cv-document.cv-elegant { font-size: 10.5pt; line-height: 1.25; }

    /* 1. Word Modern Banner */
    .cv-wordbanner { --a: var(--cv-accent, #1f4e79); --t: var(--cv-tint, #e9f0f7); }
    .cv-wordbanner .wb-head { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 28px 40px; background: var(--a); }
    .cv-wordbanner h1 { color: #ffffff; font-size: 27pt; font-weight: 700; letter-spacing: 0.02em; }
    .cv-wordbanner .cv-role { color: #ffffff; font-size: 13pt; margin-top: 4px !important; opacity: 0.92; }
    .cv-wordbanner .wb-photo { flex: none; width: 96px; height: 96px; object-fit: cover; border-radius: 50%; border: 3px solid #ffffff; }
    .cv-wordbanner .wb-contact { display: flex; flex-wrap: wrap; gap: 4px 18px; margin: 0; padding: 9px 40px; background: var(--t); font-size: 9.5pt; color: #333333; }
    .cv-wordbanner .wb-body { padding: 20px 40px 30px; }
    .cv-wordbanner h2 { margin: 0 0 8px; padding-bottom: 3px; border-bottom: 1.5px solid var(--a); color: var(--a); font-size: 11pt; letter-spacing: 0.09em; }

    /* 2. Premium Photo Panel */
    .cv-premium { --a: var(--cv-accent, #075b3b); --t: var(--cv-tint, #eef5f1); }
    .cv-premium .pp-layout { display: grid; grid-template-columns: minmax(0, 1fr) 34%; min-height: 1040px; }
    .cv-premium .pp-main { min-width: 0; padding: 34px 26px 30px 38px; }
    .cv-premium .pp-side { min-width: 0; padding: 30px 16px 30px 18px; overflow-wrap: anywhere; background: var(--t); border-left: 4px solid var(--a); }
    .cv-premium h1 { color: var(--a); font-size: 25pt; line-height: 1.1; }
    .cv-premium .cv-role { color: #444444; font-size: 12.5pt; margin: 4px 0 14px !important; }
    .cv-premium .pp-photo { display: block; width: 108px; height: 108px; margin: 0 auto 16px; object-fit: cover; border-radius: 50%; border: 3px solid #c6a24a; }
    .cv-premium h2 { margin: 0 0 7px; color: var(--a); font-size: 10pt; letter-spacing: 0.06em; }
    .cv-premium .pp-main h2 { padding-bottom: 3px; border-bottom: 1px solid #c6a24a; }
    .cv-premium .pp-side p { font-size: 9.5pt; margin-bottom: 4px; }
    .cv-premium .pp-side .cv-section-content { font-size: 9.5pt; }

    /* 3. Timeline Professional */
    .cv-timeline { --a: var(--cv-accent, #0b4f6c); --t: var(--cv-tint, #e8f1f5); }
    .cv-document.cv-timeline { padding: 34px 44px; }
    .cv-timeline .tl-head { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 14px; padding-bottom: 14px; border-bottom: 3px solid var(--a); }
    .cv-timeline h1 { color: var(--a); font-size: 26pt; }
    .cv-timeline .cv-role { font-size: 12.5pt; color: #444444; }
    .cv-timeline .tl-contact { display: flex; flex-wrap: wrap; gap: 3px 16px; margin: 8px 0 0 !important; font-size: 9.5pt; color: #444444; }
    .cv-timeline .tl-photo { flex: none; width: 92px; height: 92px; object-fit: cover; border-radius: 14px; border: 2px solid var(--a); }
    .cv-timeline h2 { display: flex; align-items: center; gap: 10px; color: var(--a); font-size: 11.5pt; letter-spacing: 0.08em; }
    .cv-timeline h2::before { content: ""; flex: none; width: 12px; height: 12px; border-radius: 50%; background: var(--a); }
    .cv-timeline .cv-section-content { margin-left: 5px; padding-left: 20px; border-left: 2px solid var(--a); }
    .cv-timeline .cv-entry { position: relative; }
    .cv-timeline .cv-entry::before { content: ""; position: absolute; left: -27px; top: 5px; width: 8px; height: 8px; border-radius: 50%; background: #ffffff; border: 2px solid var(--a); }

    /* 4. Elegant Serif */
    .cv-elegant { --a: var(--cv-accent, #8a6a1c); --t: var(--cv-tint, #f7f1e0); }
    .cv-document.cv-elegant { padding: 38px 50px; }
    .cv-elegant .el-head { text-align: center; margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid var(--a); box-shadow: 0 3px 0 -2px var(--a); }
    .cv-elegant .el-photo { display: block; width: 96px; height: 96px; margin: 0 auto 10px; object-fit: cover; border-radius: 50%; border: 2px solid var(--a); padding: 3px; background: #ffffff; }
    .cv-elegant h1 { color: #1b1b1b; font-size: 25pt; font-weight: 400; letter-spacing: 0.14em; text-transform: uppercase; }
    .cv-elegant .cv-role { color: var(--a); font-style: italic; font-size: 12.5pt; }
    .cv-elegant .el-contact { margin: 8px 0 0 !important; font-size: 9.5pt; color: #444444; }
    .cv-elegant .el-contact span + span::before { content: "  •  "; color: var(--a); }
    .cv-elegant h2 { display: flex; align-items: center; gap: 12px; color: var(--a); font-size: 10.5pt; font-weight: 700; letter-spacing: 0.18em; }
    .cv-elegant h2::before, .cv-elegant h2::after { content: ""; flex: 1; height: 1px; background: var(--a); }

    /* 5. Corporate Block */
    .cv-corporate { --a: var(--cv-accent, #1b2a41); --t: var(--cv-tint, #e8ebf0); }
    .cv-corporate .co-head { display: grid; grid-template-columns: 150px minmax(0, 1fr); }
    .cv-corporate .co-block { background: var(--a); min-height: 150px; }
    .cv-corporate .co-photo { display: block; width: 150px; height: 150px; object-fit: cover; }
    .cv-corporate .co-initials { display: flex; align-items: center; justify-content: center; width: 150px; height: 150px; color: #ffffff; font-size: 44pt; font-weight: 700; letter-spacing: 0.04em; }
    .cv-corporate .co-id { display: flex; flex-direction: column; justify-content: center; padding: 20px 32px; background: var(--t); border-bottom: 4px solid var(--a); }
    .cv-corporate h1 { color: var(--a); font-size: 25pt; }
    .cv-corporate .cv-role { color: #444444; font-size: 12.5pt; }
    .cv-corporate .co-contact { display: flex; flex-wrap: wrap; gap: 3px 14px; margin: 8px 0 0 !important; font-size: 9.5pt; color: #333333; }
    .cv-corporate .co-body { padding: 20px 40px 30px; }
    .cv-corporate h2 { margin: 0 0 8px; padding: 3px 0 3px 10px; border-left: 5px solid var(--a); background: var(--t); color: var(--a); font-size: 11pt; letter-spacing: 0.08em; }

    /* 6. Two-Column Pro */
    .cv-twocol { --a: var(--cv-accent, #7a1f3d); --t: var(--cv-tint, #f5e9ed); }
    .cv-twocol .tc-head { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 26px 40px 20px; border-left: 12px solid var(--a); }
    .cv-twocol h1 { color: var(--a); font-size: 26pt; }
    .cv-twocol .cv-role { color: #444444; font-size: 12.5pt; }
    .cv-twocol .tc-contact { display: flex; flex-wrap: wrap; gap: 3px 16px; margin: 8px 0 0 !important; font-size: 9.5pt; color: #444444; }
    .cv-twocol .tc-photo { flex: none; width: 96px; height: 96px; object-fit: cover; border-radius: 10px; }
    .cv-twocol .tc-strip { padding: 10px 40px; background: var(--a); }
    .cv-twocol .tc-strip .chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
    .cv-twocol .tc-strip .chip { display: inline-block; padding: 3px 11px; border: 1px solid #ffffff; border-radius: 999px; color: #ffffff; font-size: 9pt; font-weight: 700; }
    .cv-twocol .tc-cols { display: grid; grid-template-columns: minmax(0, 1.9fr) minmax(0, 1fr); gap: 24px; padding: 20px 40px 30px; }
    .cv-twocol h2 { margin: 0 0 7px; padding-bottom: 3px; border-bottom: 2px solid var(--a); color: var(--a); font-size: 11pt; letter-spacing: 0.08em; }
    .cv-twocol .tc-side { min-width: 0; overflow-wrap: anywhere; }
    .cv-twocol .tc-main { min-width: 0; }
    .cv-twocol .tc-side .cv-section-content { font-size: 9.5pt; }

    /* 7. Modern Cards */
    .cv-cards { --a: var(--cv-accent, #0e6b4f); --t: var(--cv-tint, #eaf5f0); }
    .cv-cards .cp-head { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 28px 36px 22px; background: var(--t); }
    .cv-cards h1 { color: var(--a); font-size: 26pt; }
    .cv-cards .cv-role { color: #444444; font-size: 12.5pt; }
    .cv-cards .cp-contact { display: flex; flex-wrap: wrap; gap: 3px 14px; margin: 8px 0 0 !important; font-size: 9.5pt; color: #444444; }
    .cv-cards .cp-photo { flex: none; width: 96px; height: 96px; object-fit: cover; border-radius: 20px; border: 3px solid #ffffff; }
    .cv-cards .cp-body { padding: 18px 36px 30px; }
    .cv-cards .cp-card { margin: 0 0 12px; padding: 12px 16px; border: 1px solid #dcdcdc; border-top: 4px solid var(--a); border-radius: 10px; background: #ffffff; }
    .cv-cards h2 { margin: 0 0 7px; color: var(--a); font-size: 10.5pt; letter-spacing: 0.09em; }
    .cv-cards .chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
    .cv-cards .chip { display: inline-block; padding: 3px 10px; border-radius: 999px; background: var(--t); color: var(--a); font-size: 9pt; font-weight: 700; }

    .cv-wordbanner .cv-section, .cv-cards .cp-card { break-inside: avoid; }

    @media (max-width: 640px) {
      .cv-wordbanner .wb-head, .cv-wordbanner .wb-contact, .cv-wordbanner .wb-body,
      .cv-twocol .tc-head, .cv-twocol .tc-strip, .cv-twocol .tc-cols,
      .cv-cards .cp-head, .cv-cards .cp-body, .cv-corporate .co-body { padding-left: 16px; padding-right: 16px; }
    }

    /* COLOUR THEME ON EVERY TEMPLATE */

    .cv-ats[style*="--cv-accent"] h1,
    .cv-ats[style*="--cv-accent"] h2 {
      color: var(--cv-accent);
    }

    .cv-ats[style*="--cv-accent"] h2,
    .cv-ats[style*="--cv-accent"] .ats-head {
      border-bottom-color: var(--cv-accent);
    }

    .cv-creative[style*="--cv-accent"] .cr-head {
      background: var(--cv-accent);
      border-bottom-color: rgba(255, 255, 255, 0.55);
    }

    .cv-creative[style*="--cv-accent"] .cr-head .cv-role {
      color: #ffffff;
    }

    .cv-creative[style*="--cv-accent"] .cr-contact {
      color: #ffffff;
    }

    .cv-signature[style*="--cv-accent"] .sg-head {
      background: var(--cv-accent);
    }

    /* SPACING */

    .cv-document.space-compact {
      padding: 26px 32px;
      line-height: 1.08;
    }

    .space-compact .cv-section {
      margin-bottom: 10px;
    }

    .space-compact .cv-entry {
      margin-bottom: 7px;
    }

    .cv-document.space-relaxed {
      padding: 44px 52px;
      line-height: 1.3;
    }

    .space-relaxed .cv-section {
      margin-bottom: 22px;
    }

    .space-relaxed .cv-entry {
      margin-bottom: 15px;
    }

    .space-relaxed .cv-list li {
      margin-bottom: 5px;
    }

    .cv-document.cv-creative.space-compact,
    .cv-document.cv-creative.space-relaxed,
    .cv-document.cv-signature.space-compact,
    .cv-document.cv-signature.space-relaxed,
    .cv-document.cv-sidebar.space-compact,
    .cv-document.cv-sidebar.space-relaxed {
      padding: 0;
    }

    .cv-document.cv-sidebar.space-compact .sidebar-main {
      padding: 24px 26px;
    }

    .cv-document.cv-sidebar.space-relaxed .sidebar-main {
      padding: 44px 38px;
    }

    /* MOBILE */

    @media (max-width: 650px) {
      .cv-document {
        padding: 22px 18px;
      }

      .letter-document {
        padding: 24px 20px;
      }

      .cv-modern .cv-section,
      .cv-europass .cv-section,
      .executive-body,
      .sidebar-layout {
        grid-template-columns: 1fr;
        min-height: 0;
      }

      .sidebar-layout {
        background: none;
      }

      .sidebar-col {
        padding: 22px 18px;
        background: var(--cv-accent, #075b3b);
      }

      .modern-head,
      .graduate-head {
        flex-direction: column;
        align-items: flex-start;
      }

      .modern-contact,
      .graduate-contact {
        max-width: 100%;
        text-align: left;
      }

      .sidebar-main {
        padding: 22px 18px;
      }

      .cv-executive .executive-head {
        padding: 20px;
      }

      .cv-europass h2 { text-align: left; padding-right: 0; }
      .cv-europass .cv-section-content { padding-left: 0; border-left: 0; }
      .cv-nigerian .ng-head { padding: 14px; }
      .cv-nigerian .ng-photo { width: 76px; height: 76px; }
      .cv-creative .cr-head, .cv-creative .cr-body,
      .cv-signature .sg-head, .cv-signature .sg-body,
      .cv-signature .sg-contact { padding-left: 18px; padding-right: 18px; }
    }
  `;

  function installDesignStyles() {
    if ($("noh-cv-design-styles")) return;

    const style = document.createElement("style");

    style.id = "noh-cv-design-styles";
    style.textContent = designStyles;

    document.head.appendChild(style);
  }

  function setupPhoto() {
    const input = $("cv-photo");

    if (!input) return;

    input.addEventListener("change", () => {
      const file = input.files && input.files[0];

      photoData = "";

      if (!file || !/^image\//.test(file.type)) {
        updatePreview();
        return;
      }

      const reader = new FileReader();

      reader.onload = () => {
        const img = new Image();

        img.onload = () => {
          const size = 240;
          const canvas = document.createElement("canvas");
          const side = Math.min(img.width, img.height);

          canvas.width = size;
          canvas.height = size;

          canvas.getContext("2d").drawImage(
            img,
            (img.width - side) / 2,
            (img.height - side) / 2,
            side,
            side,
            0,
            0,
            size,
            size
          );

          photoData = canvas.toDataURL("image/jpeg", 0.85);
          updatePreview();
        };

        img.src = reader.result;
      };

      reader.readAsDataURL(file);
    });

    form.addEventListener("reset", () => {
      photoData = "";
      window.setTimeout(updatePreview, 0);
    });
  }


  // Side by side is handled by the page stylesheet on desktop and tablets
  // wider than 800px. Phones keep the stacked layout.
  function fitPreview() {}

  // --------------------------------------------------
  // LIVE PREVIEW
  // --------------------------------------------------

  function updatePreview() {
    const preview = $("document-preview");

    if (!preview) return;

    applyTemplateProfile();

    installDesignStyles();

    if (tool === "cover-letter") {
      preview.innerHTML = buildLetterHTML();

    } else if (tool === "bundle") {
      preview.innerHTML = `
        ${buildCVHTML()}
        <div class="bundle-preview-divider"></div>
        ${buildLetterHTML()}
      `;

    } else {
      preview.innerHTML = buildCVHTML();
    }

    preview.innerHTML = `<div class="noh-scale">${preview.innerHTML}</div>`;

    let status = tool === "bundle"
      ? "CV and cover letter preview"
      : "Preview updated";

    if (tool === "cv" && getTemplate() === "onepage") {
      const doc = preview.querySelector(".cv-document");

      if (doc && doc.clientWidth > 0) {
        const pageHeight = doc.clientWidth * (1123 / 794);

        status = doc.scrollHeight <= pageHeight
          ? "Fits on one page"
          : "Longer than one page: shorten some bullets";
      }
    }

    setText("preview-status", status);

    fitPreview();
  }

  function previewDocument() {
    updatePreview();

    const preview = $("document-preview");

    if (preview) {
      preview.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  }

  // --------------------------------------------------
  // PDF LIBRARY
  // --------------------------------------------------

  const scriptPromises = {};

  function loadScript(src, isReady, failMessage) {
    if (isReady()) return Promise.resolve();

    if (scriptPromises[src]) return scriptPromises[src];

    scriptPromises[src] = new Promise((resolve, reject) => {
      const script = document.createElement("script");

      script.src = src;

      script.onload = () => {
        if (isReady()) {
          resolve();
        } else {
          delete scriptPromises[src];
          reject(new Error(failMessage));
        }
      };

      script.onerror = () => {
        delete scriptPromises[src];

        reject(
          new Error(
            "Unable to load the PDF download service. Check your internet connection."
          )
        );
      };

      document.head.appendChild(script);
    });

    return scriptPromises[src];
  }

  function loadPDFLibraries() {
    return Promise.all([
      loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
        () => typeof window.html2canvas === "function",
        "The PDF renderer could not be loaded."
      ),
      loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
        () => Boolean(window.jspdf && window.jspdf.jsPDF),
        "The PDF writer could not be loaded."
      )
    ]);
  }

  function getPDFContent() {
    if (tool === "cover-letter") {
      return buildLetterHTML();
    }

    if (tool === "bundle") {
      return `
        ${buildCVHTML()}
        <div class="page-break"></div>
        ${buildLetterHTML()}
      `;
    }

    return buildCVHTML();
  }

  function getPDFFileName() {
    const name = value("full-name", "Professional Document")
      .replace(/[<>:"/\\|?*]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    const suffix = {
      cv: "CV",
      "cover-letter": "Cover-Letter",
      bundle: "Career-Bundle"
    }[tool];

    return `${name}-${suffix}.pdf`;
  }

  // --------------------------------------------------
  // PDF DOWNLOAD
  // --------------------------------------------------

  const PAGE_PX_WIDTH = 794;
  const PAGE_MARGIN_MM = 10;

  const PAGE_CONTENT_PX = Math.floor(
    ((297 - PAGE_MARGIN_MM * 2) / 210) * PAGE_PX_WIDTH
  );

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function createExportFrame(html) {
    const frame = document.createElement("iframe");

    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;

    frame.style.cssText = [
      "position:fixed",
      "left:0",
      "top:0",
      `width:${PAGE_PX_WIDTH}px`,
      "height:1123px",
      "border:0",
      "opacity:0",
      "pointer-events:none",
      "z-index:-1",
      "background:#ffffff"
    ].join(";");

    document.body.appendChild(frame);

    const doc = frame.contentDocument;

    doc.open();
    doc.write(`<!doctype html>
      <html lang="en-GB">
        <head>
          <meta charset="utf-8">
          <style>
            html, body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              overflow-x: hidden;
              font-family: "Times New Roman", Times, serif;
            }
            ${designStyles}
          </style>
        </head>
        <body>
          <div id="noh-pdf-export">${html}</div>
        </body>
      </html>`);
    doc.close();

    return frame;
  }

  function computePages(doc, root, totalHeight) {
    const rootTop = root.getBoundingClientRect().top;

    const topOf = (element) =>
      Math.round(element.getBoundingClientRect().top - rootTop);

    const candidates = [];

    doc.querySelectorAll(
      ".cv-section, .cv-entry, .letter-content > p"
    ).forEach((element) => {
      if (element.closest(".executive-side, .sidebar-col")) return;

      const isFirstEntry =
        element.classList.contains("cv-entry") &&
        element === element.parentElement.firstElementChild;

      if (isFirstEntry) return;

      candidates.push(topOf(element));
    });

    const forced = Array.from(
      doc.querySelectorAll(".page-break")
    ).map(topOf);

    const pages = [];
    let start = 0;

    while (totalHeight - start > 8) {
      let end = Math.min(start + PAGE_CONTENT_PX, totalHeight);

      if (end < totalHeight) {
        const forcedBreak = forced.find(
          (position) => position > start + 5 && position <= end
        );

        if (forcedBreak) {
          end = forcedBreak;
        } else {
          const usable = candidates.filter(
            (position) =>
              position > start + PAGE_CONTENT_PX * 0.35 &&
              position <= end
          );

          if (usable.length) end = Math.max(...usable);
        }
      }

      pages.push([start, end]);
      start = end;
    }

    return pages;
  }

  function chooseScale(totalHeight) {
    const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent);
    const maxArea = isIOS ? 14000000 : 30000000;
    const maxSide = 8192;

    const byArea = Math.sqrt(
      maxArea / (PAGE_PX_WIDTH * totalHeight)
    );

    const bySide =
      maxSide / Math.max(PAGE_PX_WIDTH, totalHeight);

    return Math.max(1, Math.min(2, byArea, bySide));
  }

  function canvasLooksBlank(canvas) {
    const probe = document.createElement("canvas");

    probe.width = 320;
    probe.height = Math.max(
      1,
      Math.round((canvas.height / canvas.width) * 320)
    );

    const context = probe.getContext("2d");

    context.drawImage(canvas, 0, 0, probe.width, probe.height);

    const pixels = context.getImageData(
      0,
      0,
      probe.width,
      probe.height
    ).data;

    for (let i = 0; i < pixels.length; i += 4) {
      if (
        pixels[i] < 254 ||
        pixels[i + 1] < 254 ||
        pixels[i + 2] < 254
      ) {
        return false;
      }
    }

    return true;
  }

  async function buildPDF() {
    await loadPDFLibraries();

    const frame = createExportFrame(getPDFContent());

    try {
      const doc = frame.contentDocument;
      const root = doc.getElementById("noh-pdf-export");

      if (
        !root ||
        !root.querySelector(".cv-document") ||
        !root.textContent.trim()
      ) {
        throw new Error(
          "The document is empty. Please complete your details and try again."
        );
      }

      await wait(150);

      const totalHeight = Math.ceil(
        root.getBoundingClientRect().height
      );

      if (totalHeight < 50) {
        throw new Error(
          "The document could not be prepared for PDF export."
        );
      }

      frame.style.height = `${totalHeight}px`;

      await wait(50);

      const pages = computePages(doc, root, totalHeight);
      const scale = chooseScale(totalHeight);

      const canvas = await window.html2canvas(root, {
        scale,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true,
        windowWidth: PAGE_PX_WIDTH,
        windowHeight: totalHeight
      });

      console.info("[NOH Career Kit] PDF render", {
        totalHeight,
        scale,
        pages: pages.length,
        canvas: `${canvas.width}x${canvas.height}`
      });

      if (
        !canvas.width ||
        !canvas.height ||
        canvasLooksBlank(canvas)
      ) {
        throw new Error(
          "Your browser could not draw the document. Please try again, or use Google Chrome."
        );
      }

      const ratio = canvas.width / PAGE_PX_WIDTH;

      const pdf = new window.jspdf.jsPDF({
        unit: "mm",
        format: "a4",
        orientation: "portrait",
        compress: true
      });

      pages.forEach(([top, bottom], index) => {
        const sliceHeight = bottom - top;

        const sourceY = Math.min(
          Math.round(top * ratio),
          canvas.height - 1
        );

        const sourceHeight = Math.max(
          1,
          Math.min(
            Math.round(sliceHeight * ratio),
            canvas.height - sourceY
          )
        );

        const pageCanvas = document.createElement("canvas");

        pageCanvas.width = canvas.width;
        pageCanvas.height = sourceHeight;

        const context = pageCanvas.getContext("2d");

        context.fillStyle = "#ffffff";
        context.fillRect(
          0,
          0,
          pageCanvas.width,
          pageCanvas.height
        );

        context.drawImage(
          canvas,
          0,
          sourceY,
          canvas.width,
          sourceHeight,
          0,
          0,
          pageCanvas.width,
          pageCanvas.height
        );

        if (index > 0) pdf.addPage();

        pdf.addImage(
          pageCanvas.toDataURL("image/jpeg", 0.95),
          "JPEG",
          0,
          PAGE_MARGIN_MM,
          210,
          (sliceHeight / PAGE_PX_WIDTH) * 210,
          undefined,
          "FAST"
        );
      });

      return pdf;

    } finally {
      if (frame.parentNode) {
        frame.parentNode.removeChild(frame);
      }
    }
  }

  async function downloadDocument() {
    const button = $("download-button");

    if (!button || button.disabled) return;

    if (!value("full-name")) {
      window.alert("Please enter your full name before downloading.");
      return;
    }

    if (isLetter() && !value("letter-body")) {
      window.alert(
        "Please write your cover letter or copy your AI-generated letter into the letter editor before downloading."
      );
      return;
    }

    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = "Preparing PDF...";

    try {
      updatePreview();

      const pdf = await buildPDF();

      pdf.save(getPDFFileName());

      const inAppBrowser =
        /FBAN|FBAV|Instagram|WhatsApp|Line\/|MicroMessenger|Snapchat|TikTok/i
          .test(navigator.userAgent);

      setText(
        "preview-status",
        inAppBrowser
          ? "PDF created. If nothing downloaded, open this page in Chrome or Safari."
          : "PDF downloaded successfully."
      );

    } catch (error) {
      console.error("PDF download error:", error);

      window.alert(
        error.message ||
        "Unable to download your PDF. Please try again."
      );

    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  // --------------------------------------------------
  // SIGN-IN FOR THE AI ASSISTANT
  // --------------------------------------------------

  function getSupabaseClient() {
    if (window.NOH_SUPABASE_CLIENT) {
      return window.NOH_SUPABASE_CLIENT;
    }

    if (
      window.supabase &&
      typeof window.supabase.createClient === "function"
    ) {
      window.NOH_SUPABASE_CLIENT = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
      );

      return window.NOH_SUPABASE_CLIENT;
    }

    return null;
  }

  async function getAccessToken() {
    const client = getSupabaseClient();

    if (!client) return null;

    try {
      const { data } = await client.auth.getSession();

      return data?.session?.access_token || null;

    } catch (error) {
      console.warn(
        "[NOH Career Kit] Unable to retrieve the session.",
        error
      );

      return null;
    }
  }

  function showSignInMessage(resultBox) {
    if (!resultBox) return;

    const returnTo = encodeURIComponent(
      `${window.location.pathname}${window.location.search}#ai-assistant`
    );

    resultBox.replaceChildren();

    const heading = document.createElement("h4");
    heading.textContent = "Sign in to use the AI assistant";

    const message = document.createElement("p");
    message.textContent =
      "The AI Career Assistant is free for signed-in members. Your CV and letter details stay on this page.";

    const link = document.createElement("a");
    link.className = "button button-primary";
    link.href = `auth.html?mode=login&redirect=${returnTo}`;
    link.textContent = "Sign in or create a free account";

    resultBox.append(heading, message, link);

    resultBox.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }

  // --------------------------------------------------
  // AI ACCESS AND BUTTON STATE
  // --------------------------------------------------

  const AI_BUTTON_IDS = [
    "ai-improve-cv",
    "ai-improve-summary",
    "ai-write-letter"
  ];

  let aiSignedIn = false;
  let isProcessingAI = false;

  function updateAIButtonStates() {
    AI_BUTTON_IDS.forEach((id) => {
      const button = $(id);

      if (!button) return;

      const disabled = !aiSignedIn || isProcessingAI;

      button.disabled = disabled;

      button.setAttribute(
        "aria-disabled",
        String(disabled)
      );
    });
  }

  function setAIAccess(signedIn) {
    aiSignedIn = Boolean(signedIn);

    updateAIButtonStates();

    const section = $("ai-assistant");

    if (!section) return;

    let notice = $("ai-signin-notice");

    if (aiSignedIn) {
      if (notice) notice.remove();
      return;
    }

    if (notice) return;

    const returnTo = encodeURIComponent(
      `${window.location.pathname}${window.location.search}#ai-assistant`
    );

    notice = document.createElement("div");

    notice.id = "ai-signin-notice";
    notice.className = "ai-signin-notice";

    const text = document.createElement("p");

    text.innerHTML =
      "<strong>Sign in to use the AI assistant.</strong> It is free for members. " +
      "You can still build, preview and download your CV or letter without signing in.";

    const actions = document.createElement("div");

    actions.className = "ai-signin-actions";

    const signIn = document.createElement("a");

    signIn.className = "button button-primary";
    signIn.href = `auth.html?mode=login&redirect=${returnTo}`;
    signIn.textContent = "Sign in";

    const signUp = document.createElement("a");

    signUp.className = "button button-secondary";
    signUp.href = `auth.html?mode=signup&redirect=${returnTo}`;
    signUp.textContent = "Create a free account";

    actions.append(signIn, signUp);

    notice.append(text, actions);

    const buttons = section.querySelector(".ai-actions");

    if (buttons) {
      section.insertBefore(notice, buttons);
    } else {
      section.appendChild(notice);
    }
  }

  function setAIProcessing(processing) {
    isProcessingAI = Boolean(processing);

    updateAIButtonStates();
  }

  async function initAIAccess() {
    const client = getSupabaseClient();

    // Register the listener before checking the initial session.
    if (
      client &&
      client.auth &&
      typeof client.auth.onAuthStateChange === "function"
    ) {
      client.auth.onAuthStateChange((_event, session) => {
        setAIAccess(Boolean(session?.access_token));
      });
    }

    const accessToken = await getAccessToken();

    setAIAccess(Boolean(accessToken));
  }

  // --------------------------------------------------
  // AI ERROR MESSAGES
  // --------------------------------------------------

  function getAIErrorMessage(data, status) {
    const rawCode =
      data?.code ||
      data?.error_code ||
      data?.error ||
      "";

    const code = String(rawCode).trim().toUpperCase();

    if (
      code.includes("AI_TIMEOUT") ||
      status === 504
    ) {
      return "The AI service took too long to respond. Please try again.";
    }

    if (
      code.includes("AI_BUSY") ||
      status === 503
    ) {
      return "The AI service is temporarily busy. Please wait a moment and try again.";
    }

    if (code.includes("AI_GENERATION_FAILED")) {
      return "The AI could not generate your result this time. Please try again.";
    }

    if (
      code.includes("AI_USAGE_LIMIT") ||
      code.includes("USAGE_LIMIT")
    ) {
      return "You have reached the current AI usage limit. Please try again later.";
    }

    if (status === 401 || status === 403) {
      return "Your sign-in session may have expired. Please sign in again to continue.";
    }

    if (status === 429) {
      return "Too many requests have been made. Please wait a little and try again.";
    }

    if (status >= 500) {
      return "The AI service is temporarily unavailable. Please try again shortly.";
    }

    if (status === 400) {
      return typeof data?.error === "string" && data.error
        ? data.error
        : "Please check your information and try again.";
    }

    if (
      typeof data?.error === "string" &&
      data.error
    ) {
      return data.error;
    }

    return `The AI request could not be completed (${status}). Please try again.`;
  }

  // --------------------------------------------------
  // AI CAREER ASSISTANT
  // --------------------------------------------------

  async function handleAI(action) {
    const resultBox = $("ai-result");

    if (!resultBox) {
      window.alert("The AI result area could not be found.");
      return;
    }

    // Prevent duplicate requests.
    if (isProcessingAI) return;

    const actions = {
      cv: {
        apiAction: "improve-cv",
        button: $("ai-improve-cv"),
        title: "AI CV Improvement"
      },

      summary: {
        apiAction: "write-summary",
        button: $("ai-improve-summary"),
        title: "Professional Summary"
      },

      letter: {
        apiAction: "write-letter",
        button: $("ai-write-letter"),
        title: "AI Cover Letter"
      }
    };

    const selected = actions[action];

    if (!selected || !selected.button) return;

    if (!aiSignedIn) {
      showSignInMessage(resultBox);
      return;
    }

    if (
      action === "cv" &&
      !value("full-name") &&
      !value("education") &&
      !value("experience") &&
      !value("skills") &&
      !value("summary")
    ) {
      window.alert(
        "Enter some CV information before requesting improvements."
      );
      return;
    }

    if (
      action === "summary" &&
      !value("job-title") &&
      !value("education") &&
      !value("experience") &&
      !value("skills")
    ) {
      window.alert(
        "Enter your target role, education, experience or skills first."
      );
      return;
    }

    if (
      action === "letter" &&
      !value("job-title") &&
      !value("job-description")
    ) {
      window.alert(
        "Enter the job title or job description first."
      );
      return;
    }

    const candidateData = {
      fullName: value("full-name"),
      email: value("email"),
      phone: value("phone"),
      location: value("location"),

      applicantAddress: value("applicant-address"),
      applicationDate: value("application-date"),

      jobTitle: value("job-title"),
      summary: value("summary"),
      education: value("education"),
      experience: value("experience"),
      skills: value("skills"),
      certificates: value("certificates"),

      employer: value("employer"),
      recipient: value("recipient"),
      employerAddress: value("employer-address"),
      vacancySource: value("vacancy-source"),
      jobDescription: value("job-description"),
      letterBody: value("letter-body")
    };

    const originalText = selected.button.textContent;

    let timeoutId = null;
    let controller = null;

    setAIProcessing(true);

    selected.button.textContent = "Working...";

    resultBox.hidden = false;
    resultBox.replaceChildren();

    const heading = document.createElement("h4");

    heading.textContent = selected.title;

    const status = document.createElement("p");

    status.textContent =
      "Preparing your result. Please wait...";

    resultBox.append(heading, status);

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        setAIAccess(false);
        showSignInMessage(resultBox);
        return;
      }

      // Set a frontend timeout slightly longer than the backend's
      // two-attempt generation window.
      controller = new AbortController();

      timeoutId = window.setTimeout(() => {
        controller.abort();
      }, AI_REQUEST_TIMEOUT_MS);

      const response = await fetch(AI_ENDPOINT, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_PUBLISHABLE_KEY,
          "Authorization": `Bearer ${accessToken}`
        },

        body: JSON.stringify({
          action: selected.apiAction,
          ...candidateData
        }),

        signal: controller.signal
      });

      let data;

      try {
        data = await response.json();
      } catch {
        throw new Error(
          "The server returned an unexpected response. Please try again."
        );
      }

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        setAIAccess(false);
        showSignInMessage(resultBox);
        return;
      }

      if (!response.ok) {
        throw new Error(
          getAIErrorMessage(data, response.status)
        );
      }

      if (
        !data.result ||
        typeof data.result !== "string"
      ) {
        throw new Error(
          "The AI returned no usable text. Please try again."
        );
      }

      resultBox.replaceChildren();

      const resultHeading = document.createElement("h4");

      resultHeading.textContent = selected.title;

      const resultText = document.createElement("div");

      resultText.textContent = data.result;
      resultText.style.whiteSpace = "pre-wrap";
      resultText.style.overflowWrap = "anywhere";
      resultText.style.lineHeight = "1.7";

      const copyButton = document.createElement("button");

      copyButton.type = "button";
      copyButton.className = "button button-secondary";
      copyButton.textContent = "Copy Result";

      copyButton.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(data.result);

          copyButton.textContent = "Copied Successfully!";

        } catch {
          window.alert(
            "Copy failed. Please select and copy the result manually."
          );
        }
      });

      resultBox.append(
        resultHeading,
        resultText,
        copyButton
      );

      resultBox.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });

    } catch (error) {
      console.error(
        "AI Career Assistant error:",
        error
      );

      resultBox.replaceChildren();

      const errorHeading = document.createElement("h4");

      errorHeading.textContent = "AI Assistant";

      const errorMessage = document.createElement("p");

      if (error.name === "AbortError") {
        errorMessage.textContent =
          "The AI request took too long. Please try again.";

      } else if (
        error instanceof TypeError ||
        /failed to fetch|networkerror|network request failed/i.test(
          error.message || ""
        )
      ) {
        errorMessage.textContent =
          "We couldn't connect to the AI service. Check your internet connection and try again.";

      } else {
        errorMessage.textContent =
          error.message || "Something went wrong. Please try again.";
      }

      resultBox.append(
        errorHeading,
        errorMessage
      );

      resultBox.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });

    } finally {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      if (controller) {
        controller.abort();
      }

      selected.button.textContent = originalText;

      setAIProcessing(false);

      // Refresh the session state before enabling the AI buttons.
      const currentToken = await getAccessToken();

      setAIAccess(Boolean(currentToken));
    }
  }

  // --------------------------------------------------
  // EVENT LISTENERS
  // --------------------------------------------------

  const previewButton = $("preview-button");
  const downloadButton = $("download-button");
  const resetButton = $("reset-button");

  if (previewButton) {
    previewButton.addEventListener("click", (event) => {
      event.preventDefault();
      previewDocument();
    });
  }

  if (downloadButton) {
    downloadButton.addEventListener("click", (event) => {
      event.preventDefault();
      downloadDocument();
    });
  }

  if (resetButton) {
    resetButton.addEventListener("click", (event) => {
      event.preventDefault();

      const confirmed = window.confirm(
        "Are you sure you want to clear the information in this form?"
      );

      if (!confirmed) return;

      form.reset();
      configureTemplates();
      updatePreview();

      const resultBox = $("ai-result");

      if (resultBox) {
        resultBox.replaceChildren();
        resultBox.hidden = true;
      }
    });
  }

  form.addEventListener("input", updatePreview);
  form.addEventListener("change", updatePreview);

  form.addEventListener("reset", () => {
    window.setTimeout(updatePreview, 0);
  });

  const aiCVButton = $("ai-improve-cv");
  const aiLetterButton = $("ai-write-letter");
  const aiSummaryButton = $("ai-improve-summary");

  if (aiCVButton) {
    aiCVButton.addEventListener("click", () => {
      handleAI("cv");
    });
  }

  if (aiLetterButton) {
    aiLetterButton.addEventListener("click", () => {
      handleAI("letter");
    });
  }

  if (aiSummaryButton) {
    aiSummaryButton.addEventListener("click", () => {
      handleAI("summary");
    });
  }

  // --------------------------------------------------
  // INITIALISE
  // --------------------------------------------------

  configureTool();
  installDesignStyles();
  setupPhoto();
  updatePreview();
  initAIAccess();

  console.info(
    "[NOH Career Kit] Updated UK-standard version loaded."
  );

})();