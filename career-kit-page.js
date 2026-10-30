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
  // Turns typed text into tidy CV entries:
  //   Role, Company            -> bold title
  //   2021 - Present           -> muted detail line
  //   - Achievement            -> bullet list
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

  // 1. British Professional: traditional serif, centred header,
  //    single column. The safest choice for UK recruiters and ATS.
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

  // 2. Modern UK: left-aligned header, section labels in a margin column.
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

  // 3. Executive UK: dark header panel, main column plus a side panel.
  function executiveUK(data) {
    return `
      <article class="cv-document cv-executive">
        <header class="executive-head">
          <h1>${escapeHTML(data.name)}</h1>
          ${roleHTML(data)}
          ${contactHTML(data)}
        </header>

        <div class="executive-body">
          <div class="executive-main">
            ${sectionHTML("Profile", data.summary, "plain")}
            ${sectionHTML("Career History", data.experience)}
            ${sectionHTML("Education", data.education)}
          </div>

          <aside class="executive-side">
            ${sectionHTML("Core Skills", data.skills, "skills")}
            ${sectionHTML("Training & Certifications", data.certificates, "plain")}
          </aside>
        </div>
      </article>
    `;
  }

  // 4. Graduate UK: education first, clean blue accents.
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
  // COVER LETTER (UK business letter format)
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
  // DOCUMENT DESIGN
  // Web-safe fonts only, so the PDF matches the preview.
  // --------------------------------------------------

  const designStyles = `
    .cv-document {
      width: 100%;
      background: #ffffff;
      color: #222222;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10pt;
      line-height: 1.5;
      padding: 36px 44px;
      overflow-wrap: anywhere;
    }

    .cv-document * {
      box-sizing: border-box;
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
      font-size: 9.5pt;
      font-weight: 700;
      letter-spacing: 0.12em;
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
      font-size: 9.5pt;
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
      font-size: 9.5pt;
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
      font-family: Georgia, "Times New Roman", serif;
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
      font-family: Arial, Helvetica, sans-serif;
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
      font-size: 9pt;
      color: #444444;
      line-height: 1.6;
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
      font-size: 9pt;
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
      font-size: 9pt;
      color: #455a64;
      line-height: 1.6;
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
      font-size: 10.5pt;
      line-height: 1.65;
      padding: 44px 52px;
      min-height: 700px;
    }

    .letter-classic {
      font-family: Georgia, "Times New Roman", serif;
    }

    .letter-sender {
      text-align: right;
      margin-bottom: 26px;
    }

    .letter-sender h1 {
      font-size: 17pt;
      margin-bottom: 4px;
    }

    .letter-sender p {
      margin: 0;
      font-size: 9.5pt;
      color: #555555;
      line-height: 1.55;
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

    #noh-pdf-export .cv-modern .cv-section {
      grid-template-columns: 128px 1fr !important;
    }

    #noh-pdf-export .executive-body {
      grid-template-columns: 1.85fr 1fr !important;
    }

    #noh-pdf-export .page-break {
      height: 1px !important;
      page-break-before: always !important;
      break-before: page !important;
    }

    /* MOBILE RESPONSIVENESS (preview only) */

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

  let pdfLibraryPromise = null;

  function loadPDFLibrary() {
    if (window.html2pdf) {
      return Promise.resolve(window.html2pdf);
    }

    if (pdfLibraryPromise) {
      return pdfLibraryPromise;
    }

    pdfLibraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");

      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.3/html2pdf.bundle.min.js";

      script.onload = () => {
        if (window.html2pdf) {
          resolve(window.html2pdf);
        } else {
          pdfLibraryPromise = null;
          reject(new Error("The PDF library could not be loaded."));
        }
      };

      script.onerror = () => {
        pdfLibraryPromise = null;

        reject(
          new Error(
            "Unable to load the PDF download service. Check your internet connection."
          )
        );
      };

      document.head.appendChild(script);
    });

    return pdfLibraryPromise;
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

  async function downloadDocument() {
    const button = $("download-button");

    if (!button || button.disabled) return;

    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = "Preparing PDF...";

    try {
      updatePreview();

      const html2pdf = await loadPDFLibrary();

      // Plain detached element: no position, no z-index, not appended.
      // html2pdf clones it into its own overlay and handles placement.
      const pdfContainer = document.createElement("div");

      pdfContainer.id = "noh-pdf-export";
      pdfContainer.innerHTML = getPDFContent();

      const exportDocument = pdfContainer.querySelector(".cv-document");

      if (!exportDocument || !exportDocument.textContent.trim()) {
        throw new Error(
          "The document is empty. Please complete your details and try again."
        );
      }

      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      const options = {
        // Vertical margins only: the page is 794px wide, so the
        // document prints at true size with its own side padding.
        margin: [10, 0, 10, 0],

        filename: getPDFFileName(),

        image: {
          type: "jpeg",
          quality: 0.98
        },

        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
          scrollX: 0,
          scrollY: 0,
          windowWidth: 794
        },

        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "portrait"
        },

        pagebreak: {
          mode: ["css", "legacy"],
          avoid: [".cv-entry", ".letter-sender"]
        }
      };

      await html2pdf()
        .set(options)
        .from(pdfContainer)
        .save();

      setText("preview-status", "PDF downloaded successfully");

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

})();

                          
