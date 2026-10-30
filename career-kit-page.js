
(() => {
  "use strict";

  if (window.__NOH_CAREER_KIT_LOADED__) return;

  const $ = (id) => document.getElementById(id);
  const form = $("career-form");

  if (!form) return;

  window.__NOH_CAREER_KIT_LOADED__ = true;

  const AI_ENDPOINT =
    "https://djxornmwvkauhkcuhgxc.supabase.co/functions/v1/career-assistant";

  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_EDReCY3JcN4vMuypVfqcMQ_GcTEVuBq";

  const params = new URLSearchParams(window.location.search);

  let tool = params.get("tool") || "cv";

  if (!["cv", "cover-letter", "bundle"].includes(tool)) {
    tool = "cv";
  }

  const templates = [
    { value: "classic", label: "British Professional — UK Standard" },
    { value: "modern", label: "Modern UK — Contemporary" },
    { value: "executive", label: "Executive UK — Leadership" },
    { value: "graduate", label: "Graduate UK — Early Career" }
  ];

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
    "employer-field",
    "recipient-field",
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

  function contactItems() {
    return [
      value("email"),
      value("phone"),
      value("location")
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
  const DATE_HINT = /\b(19|20)\d{2}\b|\b(present|current|to date|ongoing)\b/i;

  function isBullet(line) {
    return BULLET.test(line);
  }

  function isTitleLine(line, next) {
    if (!line || isBullet(line) || line.length > 120) return false;

    if (next && isBullet(next)) return true;
    if (DATE_HINT.test(line)) return true;

    if (next && !isBullet(next) && DATE_HINT.test(next) && next.length <= 120) {
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

      const label = labelMode && line.match(/^([^:]{2,32}):\s*(.+)$/);

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

    setText(
      "download-button",
      tool === "bundle"
        ? "Download Career Bundle"
        : tool === "cover-letter"
          ? "Download Cover Letter"
          : "Download CV"
    );

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
  // FOUR UK CV TEMPLATES
  // --------------------------------------------------

  // 1. British Professional
  function britishProfessional(data) {
    return `
      <article class="cv-document cv-classic">
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

  // 2. Modern UK
  function modernUK(data) {
    return `
      <article class="cv-document cv-modern">
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

  // 3. Executive UK
  function executiveUK(data) {
    const sideHTML =
      sectionHTML("Core Skills", data.skills, "skills") +
      sectionHTML("Training & Certifications", data.certificates, "plain");

    return `
      <article class="cv-document cv-executive">
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

  // 4. Graduate UK
  function graduateUK(data) {
    return `
      <article class="cv-document cv-graduate">
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

  function buildCVHTML() {
    const data = getCVData();

    switch (getTemplate()) {
      case "modern":
        return modernUK(data);

      case "executive":
        return executiveUK(data);

      case "graduate":
        return graduateUK(data);

      case "classic":
      default:
        return britishProfessional(data);
    }
  }

  // --------------------------------------------------
  // COVER LETTER
  // --------------------------------------------------

  function buildLetterHTML() {
    const name = value("full-name", "Your Full Name");
    const job = value("job-title");
    const employer = value("employer");
    const recipient = value("recipient");
    const items = contactItems();

    const genericRecipient =
      !recipient ||
      /^(hiring|recruit|human resources|hr\b|talent|sir|madam|to whom)/i
        .test(recipient);

    const greetingName = recipient || "Hiring Manager";
    const signOff = genericRecipient ? "Yours faithfully" : "Yours sincerely";

    const fallbackBody = [
      `I am writing to apply for ${job ? `the ${job} position` : "the advertised position"}${employer ? ` at ${employer}` : ""}.`,
      "Use this space to explain your suitability for the role."
    ].join("\n");

    const body = value("letter-body", fallbackBody);

    const date = new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(new Date());

    return `
      <article class="cv-document letter-document letter-${getTemplate()}">
        <header class="letter-sender">
          <h1>${escapeHTML(name)}</h1>
          ${items.map((item) => `<p>${escapeHTML(item)}</p>`).join("")}
        </header>

        <p class="letter-date">${escapeHTML(date)}</p>

        <div class="letter-recipient">
          ${recipient ? `<p>${escapeHTML(recipient)}</p>` : ""}
          ${employer ? `<p>${escapeHTML(employer)}</p>` : ""}
        </div>

        <div class="letter-content">
          <p>Dear ${escapeHTML(greetingName)},</p>

          ${job
            ? `<p class="letter-subject">Application for ${escapeHTML(job)}</p>`
            : ""}

          ${formatEntries(body, "plain")}

          <p class="letter-close">${signOff},</p>
          <p class="letter-name">${escapeHTML(name)}</p>
        </div>
      </article>
    `;
  }

  // --------------------------------------------------
  // DOCUMENT DESIGN — TIMES NEW ROMAN
  // --------------------------------------------------

  const designStyles = `
    /* GLOBAL DOCUMENT FONT */

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

    /* 1. BRITISH PROFESSIONAL */

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

    /* 2. MODERN UK */

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

    .cv-modern .cv-entry-title {
      color: #111111;
    }

    /* 3. EXECUTIVE UK */

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

    /* 4. GRADUATE UK */

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

    .cv-graduate .cv-entry-title {
      color: #0b4f6c;
    }

    /* COVER LETTER */

    .letter-document {
      font-size: 11pt;
      line-height: 1.5;
      padding: 44px 52px;
      min-height: 700px;
    }

    .letter-sender {
      text-align: right;
      margin-bottom: 26px;
    }

    .letter-sender h1 {
      font-size: 18pt;
      margin-bottom: 4px;
    }

    .letter-sender p {
      margin: 0;
      font-size: 10pt;
      color: #555555;
      line-height: 1.5;
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

    .letter-date {
      text-align: right;
      margin: 0 0 22px !important;
    }

    .letter-recipient {
      margin-bottom: 22px;
    }

    .letter-recipient p {
      margin: 0;
    }

    .letter-content p {
      margin: 0 0 13px;
    }

    .letter-subject {
      font-weight: 700;
    }

    .letter-close {
      margin-top: 20px !important;
      margin-bottom: 34px !important;
    }

    .letter-name {
      font-weight: 700;
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

    /* PDF EXPORT LAYOUT */

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

    /* MOBILE RESPONSIVENESS */

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
        align-items: flex-start;
      }

      .modern-contact,
      .graduate-contact {
        text-align: left;
      }

      .cv-modern .cv-section,
      .executive-body {
        grid-template-columns: 1fr;
      }

      .cv-executive .executive-head {
        padding: 20px;
      }
    }

    /* --------------------------------------------------
       CENTRED HEADERS — ALL FOUR CV TEMPLATES
       Applies to live preview and PDF export.
    -------------------------------------------------- */

    .cv-classic .cv-head {
      text-align: center;
    }

    .cv-classic .cv-head h1,
    .cv-classic .cv-head .cv-role,
    .cv-classic .cv-head .cv-contact {
      width: 100%;
      text-align: center;
    }

    .cv-modern .modern-head {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 8px;
      text-align: center;
    }

    .cv-modern .modern-head > div,
    .cv-modern .modern-contact {
      width: 100%;
      text-align: center;
    }

    .cv-modern .modern-head h1,
    .cv-modern .modern-head .cv-role,
    .cv-modern .modern-contact p {
      width: 100%;
      text-align: center;
    }

    .cv-executive .executive-head {
      text-align: center;
    }

    .cv-executive .executive-head h1,
    .cv-executive .executive-head .cv-role,
    .cv-executive .executive-head .cv-contact {
      width: 100%;
      text-align: center;
    }

    .cv-graduate .graduate-head {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 8px;
      text-align: center;
    }

    .cv-graduate .graduate-head > div,
    .cv-graduate .graduate-contact {
      width: 100%;
      text-align: center;
    }

    .cv-graduate .graduate-head h1,
    .cv-graduate .graduate-head .cv-role,
    .cv-graduate .graduate-contact p {
      width: 100%;
      text-align: center;
    }

    @media (max-width: 650px) {
      .cv-classic .cv-head,
      .cv-modern .modern-head,
      .cv-executive .executive-head,
      .cv-graduate .graduate-head {
        text-align: center;
      }

      .cv-modern .modern-head,
      .cv-graduate .graduate-head {
        flex-direction: column;
        align-items: center;
      }

      .cv-modern .modern-contact,
      .cv-graduate .graduate-contact {
        width: 100%;
        text-align: center;
      }

      .cv-modern .modern-contact p,
      .cv-graduate .graduate-contact p {
        text-align: center;
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

    doc.querySelectorAll(".cv-section, .cv-entry, .letter-content > p")
      .forEach((element) => {
        if (element.closest(".executive-side")) return;

        const isFirstEntry =
          element.classList.contains("cv-entry") &&
          element === element.parentElement.firstElementChild;

        if (isFirstEntry) return;

        candidates.push(topOf(element));
      });

    const forced = Array.from(doc.querySelectorAll(".page-break"))
      .map(topOf);

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
              position > start + PAGE_CONTENT_PX * 0.35 && position <= end
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

    const byArea = Math.sqrt(maxArea / (PAGE_PX_WIDTH * totalHeight));
    const bySide = maxSide / Math.max(PAGE_PX_WIDTH, totalHeight);

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

    const pixels = context.getImageData(0, 0, probe.width, probe.height).data;

    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] < 254 || pixels[i + 1] < 254 || pixels[i + 2] < 254) {
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

      const totalHeight = Math.ceil(root.getBoundingClientRect().height);

      if (totalHeight < 50) {
        throw new Error("The document could not be prepared for PDF export.");
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

      if (!canvas.width || !canvas.height || canvasLooksBlank(canvas)) {
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
        context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

        context.drawImage(
          canvas,
          0, sourceY, canvas.width, sourceHeight,
          0, 0, pageCanvas.width, pageCanvas.height
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
          ? "PDF created (Times New Roman). If nothing downloaded, open this page in Chrome or Safari."
          : "PDF downloaded successfully (Times New Roman)"
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
  // AI CAREER ASSISTANT
  // --------------------------------------------------

  async function handleAI(action) {
    const resultBox = $("ai-result");

    if (!resultBox) {
      window.alert("The AI result area could not be found.");
      return;
    }

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

    if (!selected) return;

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
      jobTitle: value("job-title"),
      summary: value("summary"),
      education: value("education"),
      experience: value("experience"),
      skills: value("skills"),
      certificates: value("certificates"),
      employer: value("employer"),
      recipient: value("recipient"),
      jobDescription: value("job-description"),
      letterBody: value("letter-body")
    };

    const buttons = [
      $("ai-improve-cv"),
      $("ai-improve-summary"),
      $("ai-write-letter")
    ].filter(Boolean);

    const originalText = selected.button
      ? selected.button.textContent
      : "";

    buttons.forEach((button) => {
      button.disabled = true;
    });

    if (selected.button) {
      selected.button.textContent = "Working...";
    }

    resultBox.hidden = false;
    resultBox.replaceChildren();

    const heading = document.createElement("h4");
    heading.textContent = selected.title;

    const status = document.createElement("p");
    status.textContent = "Preparing your result. Please wait...";

    resultBox.append(heading, status);

    try {
      const response = await fetch(AI_ENDPOINT, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_PUBLISHABLE_KEY
        },

        body: JSON.stringify({
          action: selected.apiAction,
          ...candidateData
        })
      });

      let data;

      try {
        data = await response.json();
      } catch {
        throw new Error(
          "The server returned an unexpected response."
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
          `The AI request failed (${response.status}).`
        );
      }

      if (!data.result || typeof data.result !== "string") {
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
      console.error("AI Career Assistant error:", error);

      resultBox.replaceChildren();

      const errorHeading = document.createElement("h4");
      errorHeading.textContent = "AI Assistant";

      const errorMessage = document.createElement("p");
      errorMessage.textContent =
        error.message || "Something went wrong.";

      resultBox.append(errorHeading, errorMessage);

    } finally {
      buttons.forEach((button) => {
        button.disabled = false;
      });

      if (selected.button) {
        selected.button.textContent = originalText;
      }
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
  updatePreview();

  console.info(
    "[NOH Career Kit] v5 loaded — Times New Roman, centred CV headers"
  );

})();
