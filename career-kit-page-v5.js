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

  // Colour themes (whitelisted colours only). "default" keeps each template's own colours.
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
  // TEMPLATE SELECTOR
  // --------------------------------------------------

  function configureTemplates() {
    const select = $("template");

    if (!select) return;

    const previousValue = select.value;

    select.replaceChildren();

    templates.forEach((template) => {
      const option = document.createElement("option");

      option.value = template.value;
      option.textContent = template.label;

      select.appendChild(option);
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
      overflow-wrap: anywhere;
    }

    .cv-document,
    .cv-document * {
      box-sizing: border-box;
      font-family: "Times New Roman", Times, serif !important;
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

    .modern-contact {
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
      grid-template-columns: 128px 1fr;
      column-gap: 20px;
    }

    .cv-modern .cv-section-content {
      min-width: 0;
    }

    .cv-modern h2 {
      color: #075b3b;
      font-size: 12pt;
      padding-top: 2px;
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
      grid-template-columns: 1.85fr 1fr;
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
    }

    /* GRADUATE UK */

    .cv-graduate .graduate-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
      padding-bottom: 14px;
      margin-bottom: 18px;
      border-bottom: 1px solid #cfd8dc;
    }

    .cv-graduate h1 {
      font-size: 23pt;
      color: #0b4f6c;
    }

    .cv-graduate .cv-role {
      color: #455a64;
    }

    .graduate-contact {
      text-align: right;
      font-size: 10pt;
      color: #455a64;
      line-height: 1.5;
    }

    .graduate-contact p {
      margin: 0;
    }

    .cv-graduate h2 {
      color: #0b4f6c;
      padding-bottom: 4px;
      border-bottom: 1px solid #cfd8dc;
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

    .cv-modern .modern-head,
    .cv-graduate .graduate-head {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 8px;
      text-align: center;
    }

    .cv-modern .modern-head > div,
    .cv-modern .modern-contact,
    .cv-graduate .graduate-head > div,
    .cv-graduate .graduate-contact {
      width: 100%;
      text-align: center;
    }

    .cv-modern .modern-head h1,
    .cv-modern .modern-head .cv-role,
    .cv-modern .modern-contact p,
    .cv-graduate .graduate-head h1,
    .cv-graduate .graduate-head .cv-role,
    .cv-graduate .graduate-contact p {
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

    .cv-graduate[style*="--cv-accent"] h1,
    .cv-graduate[style*="--cv-accent"] h2 {
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
      grid-template-columns: 228px minmax(0, 1fr);
      min-height: 1040px;
    }

    .sidebar-col {
      min-width: 0;
      padding: 34px 20px;
      background: var(--cv-accent, #075b3b);
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
      font-size: 25pt;
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

    .space-compact .cv-section { margin-bottom: 10px; }
    .space-compact .cv-entry { margin-bottom: 7px; }

    .cv-document.space-relaxed {
      padding: 44px 52px;
      line-height: 1.3;
    }

    .space-relaxed .cv-section { margin-bottom: 22px; }
    .space-relaxed .cv-entry { margin-bottom: 15px; }

    .space-relaxed .cv-list li { margin-bottom: 5px; }

    .cv-document.cv-sidebar.space-compact .sidebar-main { padding: 24px 26px; }
    .cv-document.cv-sidebar.space-relaxed .sidebar-main { padding: 44px 38px; }

    /* MOBILE */

    @media (max-width: 650px) {
      .cv-document {
        padding: 22px 18px;
      }

      .letter-document {
        padding: 24px 20px;
      }

      .modern-head,
      .graduate-head {
        flex-direction: column;
        align-items: center;
      }

      .modern-contact,
      .graduate-contact {
        text-align: center;
      }

      .cv-modern .cv-section,
      .executive-body,
      .sidebar-layout {
        grid-template-columns: 1fr;
        min-height: 0;
      }

      .sidebar-col {
        padding: 22px 18px;
      }

      .sidebar-main {
        padding: 22px 18px;
      }

      .cv-executive .executive-head {
        padding: 20px;
      }
    }
  `;

  function installDesignStyles() {
    if ($("noh-cv-design-styles")) return;

    const style = document.createElement("style");

    style.id = "noh-cv-design-styles";
    style.textContent = designStyles;

    document.head.appendChild(style);
  }

  // --------------------------------------------------
  // LIVE PREVIEW
  // --------------------------------------------------

  function updatePreview() {
    const preview = $("document-preview");

    if (!preview) return;

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

    setText(
      "preview-status",
      tool === "bundle"
        ? "CV and cover letter preview"
        : "Preview updated"
    );
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
    "ai-review-cv",
    "ai-extract-cv",
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
  // CV UPLOAD (read on the device; only text is sent to the AI)
  // --------------------------------------------------

  const MAX_CV_CHARS = 9000;
  const MAX_CV_FILE_BYTES = 5 * 1024 * 1024;

  function setUploadStatus(message, isError) {
    const box = $("cv-upload-status");

    if (!box) return;

    box.textContent = message || "";
    box.classList.toggle("is-error", Boolean(isError));
  }

  async function extractPDFText(file) {
    await loadScript(
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
      () => Boolean(window.pdfjsLib),
      "The PDF reader could not be loaded."
    );

    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

    const pdf = await window.pdfjsLib.getDocument({
      data: await file.arrayBuffer()
    }).promise;

    const pages = [];

    for (let number = 1; number <= Math.min(pdf.numPages, 6); number += 1) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();

      let text = "";
      let lastY = null;

      content.items.forEach((item) => {
        const y = item.transform ? item.transform[5] : null;

        if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
          text += "\n";
        } else if (text && !text.endsWith(" ") && !text.endsWith("\n")) {
          text += " ";
        }

        text += item.str;
        lastY = y;
      });

      pages.push(text);
    }

    return pages.join("\n\n");
  }

  async function extractDOCXText(file) {
    await loadScript(
      "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js",
      () => Boolean(window.mammoth),
      "The Word reader could not be loaded."
    );

    const result = await window.mammoth.extractRawText({
      arrayBuffer: await file.arrayBuffer()
    });

    return result.value || "";
  }

  async function handleCVFile(event) {
    const input = event.target;
    const file = input.files && input.files[0];

    if (!file) return;

    const name = file.name.toLowerCase();

    if (file.size > MAX_CV_FILE_BYTES) {
      setUploadStatus("That file is larger than 5 MB. Please use a smaller file.", true);
      input.value = "";
      return;
    }

    setUploadStatus("Reading your CV...");

    try {
      let text = "";

      if (name.endsWith(".pdf") || file.type === "application/pdf") {
        text = await extractPDFText(file);
      } else if (name.endsWith(".docx")) {
        text = await extractDOCXText(file);
      } else if (name.endsWith(".txt") || file.type === "text/plain") {
        text = await file.text();
      } else if (name.endsWith(".doc")) {
        setUploadStatus("Old .doc files are not supported. Save it as .docx or PDF, or paste the text below.", true);
        return;
      } else {
        setUploadStatus("Please upload a PDF, .docx or .txt file.", true);
        return;
      }

      text = text.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

      if (text.length < 40) {
        setUploadStatus("No readable text was found. A scanned or image-only PDF cannot be read. Paste your CV text below instead.", true);
        return;
      }

      const textarea = $("cv-upload-text");

      if (textarea) textarea.value = text;

      setUploadStatus(
        text.length > MAX_CV_CHARS
          ? `CV loaded. Only the first ${MAX_CV_CHARS.toLocaleString()} characters will be sent to the AI.`
          : "CV loaded. Now choose Review My CV or Fill the Form."
      );

    } catch (error) {
      console.error("CV upload error:", error);
      setUploadStatus(
        (error && error.message) || "We could not read that file. Paste your CV text below instead.",
        true
      );
    }
  }

  function parseCVJSON(raw) {
    let text = String(raw || "").trim();

    text = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");

    if (start === -1 || end <= start) return null;

    try {
      const parsed = JSON.parse(text.slice(start, end + 1));

      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }

  function applyImprovedCV(raw) {
    const data = parseCVJSON(raw);

    if (!data) return null;

    const always = {
      summary: "summary",
      education: "education",
      experience: "experience",
      skills: "skills",
      certificates: "certificates"
    };

    const onlyIfEmpty = {
      fullName: "full-name",
      jobTitle: "job-title",
      email: "email",
      phone: "phone",
      location: "location",
      country: "country",
      linkedin: "linkedin"
    };

    const snapshot = {};
    let count = 0;

    const apply = (key, id, overwrite) => {
      const field = $(id);
      const text = typeof data[key] === "string" ? data[key].trim() : "";

      if (!field || !text) return;
      if (!overwrite && field.value.trim()) return;

      snapshot[id] = field.value;
      field.value = text;
      count += 1;
    };

    Object.entries(always).forEach(([key, id]) => apply(key, id, true));
    Object.entries(onlyIfEmpty).forEach(([key, id]) => apply(key, id, false));

    if (!count) return null;

    updatePreview();

    return {
      snapshot,
      improvements: typeof data.improvements === "string" ? data.improvements.trim() : "",
      missing: typeof data.missing === "string" ? data.missing.trim() : ""
    };
  }

  function fillFormFromCV(raw) {
    const data = parseCVJSON(raw);

    if (!data) return false;

    const map = {
      fullName: "full-name",
      jobTitle: "job-title",
      email: "email",
      phone: "phone",
      location: "location",
      country: "country",
      linkedin: "linkedin",
      summary: "summary",
      education: "education",
      experience: "experience",
      skills: "skills",
      certificates: "certificates"
    };

    let count = 0;

    Object.entries(map).forEach(([key, id]) => {
      const field = $(id);
      const text = typeof data[key] === "string" ? data[key].trim() : "";

      if (field && text) {
        field.value = text;
        count += 1;
      }
    });

    updatePreview();

    return count > 0;
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
      },

      review: {
        apiAction: "review-cv",
        button: $("ai-review-cv"),
        title: "CV Review"
      },

      extract: {
        apiAction: "extract-cv",
        button: $("ai-extract-cv"),
        title: "Fill the Form from My CV"
      }
    };

    const selected = actions[action];

    if (!selected || !selected.button) return;

    if (!aiSignedIn) {
      showSignInMessage(resultBox);
      return;
    }

    const isUploadAction = action === "review" || action === "extract";

    if (isUploadAction && value("cv-upload-text").length < 80) {
      window.alert(
        "Upload your CV or paste its text first (at least a few lines)."
      );
      return;
    }

    if (
      action === "extract" &&
      (value("full-name") || value("experience") || value("education")) &&
      !window.confirm(
        "This will replace the details already in the form with details from your CV. Continue?"
      )
    ) {
      return;
    }

    if (
      action === "cv" &&
      value("cv-upload-text").length < 80 &&
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

    const candidateData = isUploadAction ? {
      cvText: value("cv-upload-text").slice(0, MAX_CV_CHARS)
    } : {
      fullName: value("full-name"),
      email: value("email"),
      phone: value("phone"),
      location: value("location"),
      country: value("country"),
      linkedin: value("linkedin"),

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

    if (
      action === "cv" &&
      value("cv-upload-text").length >= 80 &&
      !value("experience") &&
      !value("education") &&
      !value("summary")
    ) {
      candidateData.cvText = value("cv-upload-text").slice(0, MAX_CV_CHARS);
    }

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

      if (action === "cv") {
        const applied = applyImprovedCV(data.result);

        if (applied) {
          resultBox.replaceChildren();

          const h = document.createElement("h4");
          h.textContent = "Your CV has been improved";

          const p = document.createElement("p");
          p.textContent =
            "The improved CV is now in your document preview. Anything in [square brackets] is a detail we could not find, so replace it with your real information before downloading.";

          resultBox.append(h, p);

          [["What I improved", applied.improvements],
           ["Add these to make it stronger", applied.missing]].forEach(([title, text]) => {
            if (!text) return;

            const sub = document.createElement("strong");
            sub.textContent = title;

            const body = document.createElement("div");
            body.textContent = text;
            body.style.whiteSpace = "pre-wrap";
            body.style.margin = "4px 0 12px";

            resultBox.append(sub, body);
          });

          const view = document.createElement("a");
          view.className = "button button-primary";
          view.href = "#document-preview";
          view.textContent = "View my document";

          const undo = document.createElement("button");
          undo.type = "button";
          undo.className = "button button-secondary";
          undo.textContent = "Undo changes";
          undo.style.marginLeft = "8px";
          undo.addEventListener("click", () => {
            Object.entries(applied.snapshot).forEach(([id, text]) => {
              const field = $(id);
              if (field) field.value = text;
            });
            updatePreview();
            undo.disabled = true;
            undo.textContent = "Changes undone";
          });

          resultBox.append(view, undo);

          return;
        }
      }

      if (action === "extract") {
        const filled = fillFormFromCV(data.result);

        resultBox.replaceChildren();

        const doneHeading = document.createElement("h4");
        doneHeading.textContent = selected.title;

        const doneText = document.createElement("p");
        doneText.textContent = filled
          ? "Done. Your form has been filled from your CV. Check each section, add any missing dates or achievements, choose a template, then download your updated CV."
          : "The AI could not read your CV into the form. Please try again, or paste the CV text and retry.";

        resultBox.append(doneHeading, doneText);

        if (filled) {
          const toForm = document.createElement("a");
          toForm.className = "button button-secondary";
          toForm.href = "#career-form";
          toForm.textContent = "Go to the form";
          resultBox.append(toForm);
        }

        return;
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
      setUploadStatus("");
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

  const cvFileInput = $("cv-file");
  const aiReviewButton = $("ai-review-cv");
  const aiExtractButton = $("ai-extract-cv");

  if (cvFileInput) cvFileInput.addEventListener("change", handleCVFile);
  if (aiReviewButton) aiReviewButton.addEventListener("click", () => handleAI("review"));
  if (aiExtractButton) aiExtractButton.addEventListener("click", () => handleAI("extract"));

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
  updatePreview();
  initAIAccess();

  console.info(
    "[NOH Career Kit] v5 (CV upload and apply) loaded."
  );

})();
