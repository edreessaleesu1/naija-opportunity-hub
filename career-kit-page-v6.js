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
    { value: "academic", label: "Academic — Scholarships and Research" }
  ];

  const themes = {
    default: "",
    green: "#075b3b",
    navy: "#1b2a41",
    burgundy: "#7a1f3d",
    teal: "#0b4f6c",
    charcoal: "#2b2f36"
  };

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
    const style = colour ? ` style="--cv-accent:${colour}"` : "";

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

  function configureTemplates() {
    const select = $("template");

    if (!select) return;

    const previousValue = select.value;

    const templateGroups = [
      {
        label: "Essential CV",
        values: ["classic", "graduate", "ats"]
      },
      {
        label: "Professional CV",
        values: ["modern", "sidebar", "academic"]
      },
      {
        label: "Executive CV",
        values: ["executive"]
      }
    ];

    select.replaceChildren();

    templateGroups.forEach((group) => {
      const optgroup = document.createElement("optgroup");
      optgroup.label = group.label;

      group.values.forEach((templateValue) => {
        const template = templates.find(
          (item) => item.value === templateValue
        );

        if (!template) return;

        const option = document.createElement("option");
        option.value = template.value;
        option.textContent = template.label;

        optgroup.appendChild(option);
      });

      select.appendChild(optgroup);
    });

    select.value = templates.some(
      (template) => template.value === previousValue
    ) ? previousValue : "classic";
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

  function getCVData() {
    return {
      name: value("full-name", "Your Full Name"),
      job: value("job-title"),
      contact: contactDetails(),
      contactItems: contactItems(),
      summary: value("summary"),
      education: value("education"),
      experience: value("experience"),
      skills: value("skills"),
      certificates: value("certificates")
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
        ${sectionHTML("Training", data.certificates, "plain")}
      </article>
    `;
  }

  function executiveUK(data) {
    const sideHTML =
      sectionHTML("Core Skills", data.skills, "skills") +
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
        ${sectionHTML("Awards, Grants and Training", data.certificates, "plain")}
        ${sectionHTML("Skills", data.skills, "skills")}
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
      background: rgba(11, 79, 108, 0.08);
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
    }
  
