
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
  // HELPERS
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

  function contactDetails() {
    return [
      value("email"),
      value("phone"),
      value("location")
    ].filter(Boolean).join(" | ");
  }

  function isLetter() {
    return tool === "cover-letter" || tool === "bundle";
  }

  function isCV() {
    return tool === "cv" || tool === "bundle";
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

  function formatEntries(text) {
    const lines = getLines(text);

    if (!lines.length) return "";

    const isBullet = (line) => /^[-•*]\s*/.test(line);

    if (lines.every(isBullet)) {
      return `
        <ul class="cv-list">
          ${lines.map((line) => `
            <li>${escapeHTML(line.replace(/^[-•*]\s*/, ""))}</li>
          `).join("")}
        </ul>
      `;
    }

    return lines.map((line) => {
      if (isBullet(line)) {
        return `<p class="cv-entry-bullet">${escapeHTML(
          line.replace(/^[-•*]\s*/, "")
        )}</p>`;
      }

      return `<p>${escapeHTML(line)}</p>`;
    }).join("");
  }

  function sectionHTML(title, content, extraClass = "") {
    if (!content) return "";

    return `
      <section class="cv-section ${extraClass}">
        <h2>${escapeHTML(title)}</h2>
        <div class="cv-section-content">
          ${formatEntries(content)}
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
      isLetter() ? "Your application details" : "Your professional details"
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
  // CV CONTENT
  // --------------------------------------------------

  function getCVData() {
    return {
      name: value("full-name", "Your Full Name"),
      job: value("job-title", "Professional Title"),
      contact: contactDetails(),
      summary: value("summary"),
      education: value("education"),
      experience: value("experience"),
      skills: value("skills"),
      certificates: value("certificates")
    };
  }

  function renderCVSections(data) {
    return `
      ${sectionHTML("Professional Profile", data.summary, "profile-section")}
      ${sectionHTML("Employment History", data.experience, "experience-section")}
      ${sectionHTML("Education & Qualifications", data.education, "education-section")}
      ${sectionHTML("Key Skills", data.skills, "skills-section")}
      ${sectionHTML("Certifications & Additional Information", data.certificates, "certificates-section")}
    `;
  }

  // --------------------------------------------------
  // FOUR DISTINCT CV DESIGNS
  // --------------------------------------------------

  function britishProfessional(data) {
    return `
      <article class="cv-document cv-british">
        <header class="cv-header british-header">
          <h1>${escapeHTML(data.name)}</h1>
          <p class="cv-job-title">${escapeHTML(data.job)}</p>
          <p class="cv-contact">${escapeHTML(data.contact)}</p>
        </header>

        <div class="british-body">
          ${renderCVSections(data)}
        </div>
      </article>
    `;
  }

  function modernUK(data) {
    return `
      <article class="cv-document cv-modern">
        <header class="modern-header">
          <div>
            <p class="modern-label">CURRICULUM VITAE</p>
            <h1>${escapeHTML(data.name)}</h1>
            <p class="cv-job-title">${escapeHTML(data.job)}</p>
          </div>
          <div class="modern-contact">
            ${escapeHTML(data.contact)}
          </div>
        </header>

        <div class="modern-body">
          ${renderCVSections(data)}
        </div>
      </article>
    `;
  }

  function executiveUK(data) {
    return `
      <article class="cv-document cv-executive">
        <header class="executive-header">
          <p class="executive-label">PROFESSIONAL PROFILE</p>
          <h1>${escapeHTML(data.name)}</h1>
          <p class="cv-job-title">${escapeHTML(data.job)}</p>
          <p class="cv-contact">${escapeHTML(data.contact)}</p>
        </header>

        <div class="executive-body">
          <div class="executive-main">
            ${sectionHTML("Executive Profile", data.summary)}
            ${sectionHTML("Career History", data.experience)}
            ${sectionHTML("Education & Qualifications", data.education)}
          </div>

          <aside class="executive-sidebar">
            ${sectionHTML("Core Competencies", data.skills)}
            ${sectionHTML("Professional Development", data.certificates)}
          </aside>
        </div>
      </article>
    `;
  }

  function graduateUK(data) {
    return `
      <article class="cv-document cv-graduate">
        <header class="graduate-header">
          <div class="graduate-monogram">
            ${escapeHTML(
              data.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")
            )}
          </div>

          <div>
            <p class="graduate-label">GRADUATE CV</p>
            <h1>${escapeHTML(data.name)}</h1>
            <p class="cv-job-title">${escapeHTML(data.job)}</p>
            <p class="cv-contact">${escapeHTML(data.contact)}</p>
          </div>
        </header>

        <div class="graduate-body">
          ${sectionHTML("Career Objective / Profile", data.summary)}
          ${sectionHTML("Education & Academic Background", data.education)}
          ${sectionHTML("Projects & Experience", data.experience)}
          ${sectionHTML("Technical & Professional Skills", data.skills)}
          ${sectionHTML("Certifications, Training & Activities", data.certificates)}
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
    const job = value("job-title", "the advertised position");
    const employer = value("employer", "the organisation");
    const recipient = value("recipient", "Hiring Manager");
    const body = value(
      "letter-body",
      "Use this space to explain your suitability for the role."
    );

    const description = value("job-description");

    return `
      <article class="cv-document letter-document">
        <header class="letter-header">
          <h1>${escapeHTML(name)}</h1>
          <p class="cv-contact">${escapeHTML(contactDetails())}</p>
        </header>

        <div class="letter-body">
          <p class="letter-date">${escapeHTML(
            new Intl.DateTimeFormat("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric"
            }).format(new Date())
          )}</p>

          <p><strong>${escapeHTML(recipient)}</strong></p>
          <p>${escapeHTML(employer)}</p>

          <p><strong>Re: Application for ${escapeHTML(job)}</strong></p>

          <p>Dear ${escapeHTML(recipient)},</p>

          <p>
            I am writing to express my interest in the
            ${escapeHTML(job)} position at ${escapeHTML(employer)}.
          </p>

          ${description ? `
            <section class="cv-section">
              <h2>Role Requirements</h2>
              ${formatEntries(description)}
            </section>
          ` : ""}

          ${formatEntries(body)}

          <p>
            Thank you for considering my application.
            I would welcome the opportunity to discuss my suitability
            for this position.
          </p>

          <p>Yours sincerely,</p>
          <p><strong>${escapeHTML(name)}</strong></p>
        </div>
      </article>
    `;
  }

  // --------------------------------------------------
  // TEMPLATE STYLES
  // --------------------------------------------------

  const designStyles = `
    .cv-document {
      width: 100%;
      background: #fff;
      color: #26332d;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10pt;
      line-height: 1.55;
      padding: 30px;
      overflow-wrap: anywhere;
    }

    .cv-document * {
      box-sizing: border-box;
    }

    .cv-document h1 {
      font-size: 25pt;
      line-height: 1.15;
      margin: 0 0 7px;
      color: #173d2c;
      font-weight: 700;
    }

    .cv-document h2 {
      font-size: 10.5pt;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin: 20px 0 8px;
      padding-bottom: 5px;
      color: #075b3b;
      border-bottom: 1px solid #d9e1dc;
    }

    .cv-document p {
      margin: 0 0 7px;
    }

    .cv-document .cv-job-title {
      font-size: 12pt;
      color: #a9822d;
      font-weight: 600;
      margin: 4px 0;
    }

    .cv-contact {
      color: #68766e;
      font-size: 9pt;
      margin-top: 7px !important;
    }

    .cv-header {
      margin-bottom: 20px;
    }

    .cv-section {
      margin-bottom: 15px;
      break-inside: avoid;
    }

    .cv-list {
      padding-left: 19px;
      margin: 5px 0 10px;
    }

    .cv-list li {
      margin-bottom: 5px;
      padding-left: 3px;
    }

    .cv-entry-bullet {
      padding-left: 15px;
      position: relative;
    }

    .cv-entry-bullet::before {
      content: "•";
      position: absolute;
      left: 2px;
      color: #a9822d;
    }

    /* BRITISH PROFESSIONAL */

    .cv-british {
      font-family: Arial, Helvetica, sans-serif;
      padding: 34px;
    }

    .british-header {
      border-bottom: 2px solid #173d2c;
      padding-bottom: 15px;
    }

    .cv-british h1 {
      font-size: 27pt;
      letter-spacing: -.5px;
    }

    .cv-british h2 {
      color: #173d2c;
      border-bottom: 1px solid #b8c5bc;
      letter-spacing: 1.2px;
    }

    .british-body {
      max-width: 100%;
    }

    /* MODERN UK */

    .cv-modern {
      padding: 0;
    }

    .modern-header {
      background: #f0f4f1;
      border-left: 7px solid #075b3b;
      padding: 27px 30px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .modern-label,
    .executive-label,
    .graduate-label {
      font-size: 8pt;
      font-weight: 700;
      letter-spacing: 2px;
      color: #a9822d;
      margin-bottom: 7px !important;
    }

    .modern-contact {
      color: #59685f;
      font-size: 9pt;
    }

    .modern-body {
      padding: 10px 30px 30px;
    }

    .cv-modern h2 {
      color: #075b3b;
      border-bottom: 2px solid #e5eae6;
    }

    /* EXECUTIVE UK */

    .cv-executive {
      padding: 0;
    }

    .executive-header {
      background: #173d2c;
      color: #fff;
      padding: 32px;
      border-bottom: 5px solid #c6a24a;
    }

    .cv-executive .executive-header h1 {
      color: #fff;
      font-size: 27pt;
    }

    .cv-executive .executive-header .cv-job-title {
      color: #e8cf91;
    }

    .cv-executive .executive-header .cv-contact {
      color: #e0e9e3;
    }

    .executive-body {
      display: grid;
      grid-template-columns: 1.7fr 1fr;
      gap: 22px;
      padding: 12px 30px 30px;
    }

    .cv-executive h2 {
      color: #765812;
      border-bottom: 2px solid #d8c18a;
    }

    .executive-sidebar {
      background: #f7f5ef;
      padding: 12px;
      align-self: start;
    }

    /* GRADUATE UK */

    .cv-graduate {
      padding: 0;
    }

    .graduate-header {
      background: #f5f3ed;
      padding: 28px;
      display: flex;
      align-items: center;
      gap: 18px;
      border-bottom: 3px solid #c6a24a;
    }

    .graduate-monogram {
      width: 58px;
      height: 58px;
      min-width: 58px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: #075b3b;
      color: #fff;
      font-size: 18pt;
      font-weight: 700;
    }

    .cv-graduate h1 {
      font-size: 23pt;
    }

    .graduate-body {
      padding: 12px 30px 30px;
    }

    .cv-graduate h2 {
      color: #8b6a22;
      border-bottom: 1px solid #e3d7b6;
    }

    /* COVER LETTER */

    .letter-document {
      padding: 38px;
      min-height: 700px;
    }

    .letter-header {
      border-bottom: 2px solid #173d2c;
      padding-bottom: 14px;
      margin-bottom: 25px;
    }

    .letter-body {
      line-height: 1.8;
    }

    .letter-body p {
      margin-bottom: 15px;
    }

    .letter-date {
      text-align: right;
      margin-bottom: 25px !important;
    }

    @media (max-width: 650px) {
      .cv-document {
        padding: 18px;
      }

      .executive-body {
        grid-template-columns: 1fr;
      }

      .graduate-header {
        align-items: flex-start;
      }

      .modern-header {
        padding: 20px;
      }

      .modern-body,
      .graduate-body {
        padding: 10px 20px 20px;
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
  // DIRECT PDF DOWNLOAD
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
          reject(new Error("The PDF library could not be loaded."));
        }
      };

      script.onerror = () => {
        pdfLibraryPromise = null;
        reject(new Error("Unable to load the PDF download service. Check your internet connection."));
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

  async function downloadDocument() {
    const button = $("download-button");

    if (!button) return;

    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = "Preparing PDF...";

    let pdfContainer = null;

    try {
      updatePreview();

      const html2pdf = await loadPDFLibrary();

      pdfContainer = document.createElement("div");
      pdfContainer.id = "noh-pdf-export";

      pdfContainer.style.cssText = [
  "position:absolute",
  `top:${document.documentElement.scrollHeight + 500}px`,
  "left:0",
  "width:794px",
  "min-height:100px",
  "background:#ffffff",
  "color:#26332d",
  "z-index:1",
  "display:block",
  "visibility:visible",
  "opacity:1",
  "overflow:visible",
  "pointer-events:none"
].join(";");
      pdfContainer.innerHTML = getPDFContent();

      document.body.appendChild(pdfContainer);

if (document.fonts && document.fonts.ready) {
  await document.fonts.ready;
}

await new Promise((resolve) => {
  requestAnimationFrame(() => {
    requestAnimationFrame(resolve);
  });
});

const options = {
        margin: [12, 12, 12, 12],

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
          before: [".page-break"],
          avoid: [".cv-section", ".letter-header"]
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
      if (pdfContainer && pdfContainer.parentNode) {
        pdfContainer.parentNode.removeChild(pdfContainer);
      }

      button.disabled = false;
      button.textContent = originalText;
    }
    }

  // --------------------------------------------------
  // AI CAREER ASSISTANT
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
      window.alert("Enter some CV information before requesting improvements.");
      return;
    }

    if (
      action === "summary" &&
      !value("job-title") &&
      !value("education") &&
      !value("experience") &&
      !value("skills")
    ) {
      window.alert("Enter your target role, education, experience or skills first.");
      return;
    }

    if (
      action === "letter" &&
      !value("job-title") &&
      !value("job-description")
    ) {
      window.alert("Enter the job title or job description first.");
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
        throw new Error("The server returned an unexpected response.");
      }

      if (!response.ok) {
        throw new Error(
          data.error || `The AI request failed (${response.status}).`
        );
      }

      if (!data.result || typeof data.result !== "string") {
        throw new Error("The AI returned no usable text. Please try again.");
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
          window.alert("Copy failed. Please select and copy the result manually.");
        }
      });

      resultBox.append(resultHeading, resultText, copyButton);

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
      errorMessage.textContent = error.message || "Something went wrong.";

      resultBox.append(errorHeading, errorMessage);

    } finally {
      buttons.forEach((button) => {
        button.disabled = false;
      });

      if (selected.button) {
        selected.button.textContent = originalText;
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
    setTimeout(updatePreview, 0);
  });

  const aiCVButton = $("ai-improve-cv");
  const aiLetterButton = $("ai-write-letter");
  const aiSummaryButton = $("ai-improve-summary");

  if (aiCVButton) {
    aiCVButton.addEventListener("click", () => handleAI("cv"));
  }

  if (aiLetterButton) {
    aiLetterButton.addEventListener("click", () => handleAI("letter"));
  }

  if (aiSummaryButton) {
    aiSummaryButton.addEventListener("click", () => handleAI("summary"));
  }

  // --------------------------------------------------
  // INITIALISE
  // --------------------------------------------------

  configureTool();
  installDesignStyles();
  updatePreview();

})();
