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

  const titles = {
    cv: "Professional CV Builder",
    "cover-letter": "Cover Letter Studio",
    bundle: "Career Bundle"
  };

  const descriptions = {
    cv: "Build a professional CV that presents your qualifications, experience and skills.",
    "cover-letter": "Create a tailored cover letter for your next career opportunity.",
    bundle: "Prepare your CV and cover letter together for a complete application."
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

  const templates = [
    { value: "classic", label: "Classic Professional" },
    { value: "modern", label: "Modern Clean" },
    { value: "executive", label: "Executive Gold" },
    { value: "graduate", label: "Graduate Starter" }
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

  function formatText(text) {
    if (!text) return "";

    return escapeHTML(text)
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `<p>${line}</p>`)
      .join("");
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

  // --------------------------------------------------
  // TEMPLATE SETUP
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
    ) ? previousValue : "modern";
  }

  // --------------------------------------------------
  // PAGE CONFIGURATION
  // --------------------------------------------------

  function configureTool() {
    const coverOnly = tool === "cover-letter";
    const bundle = tool === "bundle";

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
      "preview-summary-heading",
      coverOnly ? "Application" : "Professional Summary"
    );

    setText(
      "preview-education-heading",
      coverOnly ? "Employer" : "Education"
    );

    setText(
      "preview-experience-heading",
      coverOnly ? "Cover Letter" : "Experience"
    );

    setText(
      "preview-skills-heading",
      coverOnly ? "Why I Am Applying" : "Skills"
    );

    setText(
      "preview-certificates-heading",
      coverOnly ? "Closing" : "Certifications & Additional Information"
    );

    setText(
      "download-button",
      bundle
        ? "Print / Save CV and Cover Letter as PDF"
        : "Print / Save as PDF"
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
  // PREVIEW SECTIONS
  // --------------------------------------------------

  function setSection(id, heading, content) {
    const section = $(id);
    if (!section) return;

    const headingElement = section.querySelector("h3");
    const paragraph = section.querySelector("p");

    if (headingElement) headingElement.textContent = heading;

    if (paragraph) {
      paragraph.innerHTML = formatText(content);
    }

    section.hidden = !content;
  }

  function renderCVPreview() {
    const name = value("full-name", "Your Full Name");
    const job = value("job-title", "Your Professional Title");

    setText("preview-name", name);
    setText("preview-title", job);
    setHidden("preview-title", false);

    setSection(
      "preview-summary-section",
      "Professional Summary",
      value("summary")
    );

    setSection(
      "preview-education-section",
      "Education",
      value("education")
    );

    setSection(
      "preview-experience-section",
      "Experience",
      value("experience")
    );

    setSection(
      "preview-skills-section",
      "Skills",
      value("skills")
    );

    setSection(
      "preview-certificates-section",
      "Certifications & Additional Information",
      value("certificates")
    );
  }

  function renderLetterPreview() {
    const name = value("full-name", "Your Full Name");
    const job = value("job-title", "the advertised position");
    const employer = value("employer", "your organisation");
    const recipient = value("recipient", "Hiring Manager");

    setText("preview-name", name);
    setHidden("preview-title", true);

    setSection(
      "preview-summary-section",
      "Application",
      `Application for: ${job}`
    );

    setSection(
      "preview-education-section",
      "Employer",
      employer
    );

    setSection(
      "preview-experience-section",
      "Cover Letter",
      `Dear ${recipient},

I am writing to express my interest in the ${job} position at ${employer}.`
    );

    setSection(
      "preview-skills-section",
      "Why I Am Applying",
      value(
        "letter-body",
        "Explain your qualifications, relevant skills and motivation for applying."
      )
    );

    setSection(
      "preview-certificates-section",
      "Closing",
      `Yours sincerely,\n${name}`
    );
  }

  // A separate letter preview is added for Career Bundle.
  function updateBundlePreview() {
    const preview = $("document-preview");
    if (!preview) return;

    let bundleLetter = $("bundle-letter-preview");

    if (!bundleLetter) {
      bundleLetter = document.createElement("article");
      bundleLetter.id = "bundle-letter-preview";
      bundleLetter.className = "bundle-letter-preview";
      preview.appendChild(bundleLetter);
    }

    const name = value("full-name", "Your Full Name");
    const job = value("job-title", "the advertised position");
    const employer = value("employer", "your organisation");
    const recipient = value("recipient", "Hiring Manager");
    const body = value(
      "letter-body",
      "I believe my qualifications, skills and experience would enable me to contribute positively to your organisation."
    );

    bundleLetter.innerHTML = `
      <div class="bundle-preview-divider"></div>
      <h2>Cover Letter</h2>
      <p><strong>${escapeHTML(name)}</strong></p>
      <p>${escapeHTML(contactDetails())}</p>
      <p>Dear ${escapeHTML(recipient)},</p>
      <p>I am writing to apply for the ${escapeHTML(job)} position at ${escapeHTML(employer)}.</p>
      ${formatText(value("job-description"))}
      ${formatText(body)}
      <p>Thank you for considering my application. I look forward to discussing my suitability for this role.</p>
      <p>Yours sincerely,<br>${escapeHTML(name)}</p>
    `;
  }

  function updatePreview() {
    if (tool === "cover-letter") {
      renderLetterPreview();
    } else {
      renderCVPreview();
    }

    if (tool === "bundle") {
      updateBundlePreview();
    } else {
      const oldBundlePreview = $("bundle-letter-preview");
      if (oldBundlePreview) oldBundlePreview.remove();
    }

    setText(
      "preview-contact",
      contactDetails() || "Add your contact details"
    );

    const preview = $("document-preview");

    if (preview) {
      const selectedTemplate = value("template", "modern");

      preview.classList.remove(
        "classic",
        "modern",
        "executive",
        "graduate"
      );

      preview.classList.add(selectedTemplate);
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
  // PRINT CONTENT
  // --------------------------------------------------

  function buildCVForPrint() {
    const name = value("full-name", "Your Name");
    const job = value("job-title", "Professional Title");

    const sections = [
      ["PROFESSIONAL SUMMARY", value("summary")],
      ["EDUCATION", value("education")],
      ["WORK EXPERIENCE", value("experience")],
      ["SKILLS", value("skills")],
      ["CERTIFICATIONS & TRAINING", value("certificates")]
    ];

    return `
      <article class="document">
        <header>
          <h1>${escapeHTML(name)}</h1>
          <p class="job-title">${escapeHTML(job)}</p>
          <p class="contact">${escapeHTML(contactDetails())}</p>
        </header>

        ${sections.filter(([, content]) => content).map(([heading, content]) => `
          <section>
            <h2>${escapeHTML(heading)}</h2>
            ${formatText(content)}
          </section>
        `).join("")}
      </article>
    `;
  }

  function buildLetterForPrint() {
    const name = value("full-name", "Your Name");
    const job = value("job-title", "the advertised position");
    const employer = value("employer", "your organisation");
    const recipient = value("recipient", "Hiring Manager");

    const body = value(
      "letter-body",
      "I believe my qualifications, skills and experience would enable me to contribute positively to your organisation. I would welcome the opportunity to discuss my application."
    );

    const description = value("job-description");

    return `
      <article class="document letter-document">
        <header>
          <h1>${escapeHTML(name)}</h1>
          <p class="contact">${escapeHTML(contactDetails())}</p>
        </header>

        <p>Dear ${escapeHTML(recipient)},</p>

        <p>
          I am writing to apply for the
          ${escapeHTML(job)} position at
          ${escapeHTML(employer)}.
        </p>

        ${description ? `
          <section>
            <h2>Role Requirements</h2>
            ${formatText(description)}
          </section>
        ` : ""}

        ${formatText(body)}

        <p>
          Thank you for considering my application. I look forward
          to the opportunity to discuss my suitability for this role.
        </p>

        <p>
          Yours sincerely,<br>
          ${escapeHTML(name)}
        </p>
      </article>
    `;
  }

  // --------------------------------------------------
  // PRINT / SAVE AS PDF
  // --------------------------------------------------

  function printDocument() {
    updatePreview();

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      window.alert(
        "Your browser blocked the print window. Allow pop-ups for this website and try again."
      );
      return;
    }

    let content = "";

    if (tool === "cover-letter") {
      content = buildLetterForPrint();
    } else if (tool === "bundle") {
      content = `
        ${buildCVForPrint()}
        <div class="page-break"></div>
        ${buildLetterForPrint()}
      `;
    } else {
      content = buildCVForPrint();
    }

    const selectedTemplate = value("template", "modern");

    printWindow.document.open();

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${escapeHTML(titles[tool])}</title>

        <style>
          @page {
            size: A4;
            margin: 18mm;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            color: #25332b;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 10.5pt;
            line-height: 1.65;
          }

          .document {
            width: 100%;
          }

          header {
            border-bottom: 3px solid #c6a24a;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }

          h1 {
            color: #075b3b;
            font-size: 24pt;
            margin: 0 0 5px;
            overflow-wrap: anywhere;
          }

          .job-title {
            color: #a9822d;
            font-size: 12pt;
            margin: 5px 0;
          }

          .contact {
            color: #647168;
            font-size: 9pt;
            overflow-wrap: anywhere;
          }

          h2 {
            color: #075b3b;
            font-size: 11pt;
            border-bottom: 1px solid #e8dfc9;
            padding-bottom: 5px;
            margin-top: 18px;
          }

          section {
            margin-bottom: 18px;
          }

          p {
            overflow-wrap: anywhere;
          }

          .executive header {
            border-bottom-color: #a9822d;
            border-bottom-width: 5px;
          }

          .executive h1,
          .executive h2 {
            color: #765812;
          }

          .graduate h1 {
            color: #075b3b;
          }

          .graduate h2 {
            color: #a9822d;
          }

          .page-break {
            break-before: page;
            page-break-before: always;
          }

          @media screen {
            body {
              padding: 24px;
              max-width: 800px;
              margin: 0 auto;
            }
          }
        </style>
      </head>

      <body class="${escapeHTML(selectedTemplate)}">
        ${content}
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    // Allow the new document to render before opening the print dialog.
    setTimeout(() => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch (error) {
        console.error("Print error:", error);
        window.alert("Unable to open the print dialog. Please try again.");
      }
    }, 700);
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
  }

  // --------------------------------------------------
  // EVENT LISTENERS
  // --------------------------------------------------

  const previewButton = $("preview-button");
  const downloadButton = $("download-button");
  const resetButton = $("reset-button");

  if (previewButton) {
    previewButton.addEventListener("click", previewDocument);
  }

  if (downloadButton) {
    downloadButton.addEventListener("click", printDocument);
  }

  if (resetButton) {
    resetButton.addEventListener("click", () => {
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
  updatePreview();

})();
