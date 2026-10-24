(() => {
  "use strict";

  // Prevent accidental duplicate initialisation.
  if (window.__NOH_CAREER_KIT_LOADED__) return;
  window.__NOH_CAREER_KIT_LOADED__ = true;

  const $ = (id) => document.getElementById(id);

  const form = $("career-form");

  // This script is intended for career-kit.html.
  if (!form) return;

  const params = new URLSearchParams(window.location.search);

  let tool = params.get("tool") || "cv";

  if (!["cv", "cover-letter", "bundle"].includes(tool)) {
    tool = "cv";
  }

  const titles = {
    cv: "Professional CV Builder",
    "cover-letter": "Cover Letter Builder",
    bundle: "Career Bundle"
  };

  const descriptions = {
    cv: "Create a clear, professional CV to showcase your skills and experience.",
    "cover-letter": "Prepare a tailored cover letter for the job you want.",
    bundle: "Prepare your CV and cover letter for your next application."
  };

  const coverLetterFields = [
    "employer-field",
    "recipient-field",
    "job-description-field",
    "letter-body-field"
  ];

  const cvFields = [
    "summary-field",
    "education-field",
    "experience-field",
    "skills-field",
    "certificates-field"
  ];

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

    return element.value.trim() || fallback;
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

  function configureTool() {
    const isCoverLetter = tool === "cover-letter";
    const isBundle = tool === "bundle";
    const isLetter = isCoverLetter || isBundle;

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
      isLetter ? "Your application details" : "Your professional details"
    );

    coverLetterFields.forEach((id) => {
      setHidden(id, !isLetter);
    });

    cvFields.forEach((id) => {
      setHidden(id, isCoverLetter);
    });

    setHidden("job-title-field", false);
    setHidden("template-field", false);

    const jobTitle = $("job-title");

    if (jobTitle && jobTitle.previousElementSibling) {
      jobTitle.previousElementSibling.textContent = isCoverLetter
        ? "Job title"
        : "Professional title / Target role";
    }

    if (jobTitle) {
      jobTitle.placeholder = isCoverLetter
        ? "e.g. Graduate Trainee"
        : "e.g. Graduate Trainee or Data Analyst";
    }

    setText(
      "preview-summary-heading",
      isCoverLetter ? "Application" : "Professional Summary"
    );

    setText(
      "preview-education-heading",
      isCoverLetter ? "Employer" : "Education"
    );

    setText(
      "preview-experience-heading",
      isCoverLetter ? "Cover Letter" : "Experience"
    );

    setText(
      "preview-skills-heading",
      isCoverLetter ? "Why I Am Applying" : "Skills"
    );

    setText(
      "preview-certificates-heading",
      isCoverLetter ? "Closing" : "Certifications & Additional Information"
    );

    const template = $("template");

    if (template && template.options.length >= 2) {
      template.options[0].textContent = isCoverLetter
        ? "Formal Letter"
        : "Classic Professional";

      template.options[1].textContent = isCoverLetter
        ? "Modern Letter"
        : "Modern Clean";
    }

    setText(
      "download-button",
      isBundle
        ? "Print / Save Current Document as PDF"
        : "Print / Save as PDF"
    );

    // AI actions are displayed as an interface placeholder.
    // Actual AI generation requires a secure backend.
    setText("ai-assistant-title", "AI Career Assistant");
    setText(
      "ai-assistant-description",
      "Get help improving your CV or preparing a tailored cover letter."
    );

    setText("ai-improve-cv", "Improve My CV with AI");
    setText("ai-write-letter", "Write My Cover Letter with AI");
    setText("ai-improve-summary", "Improve My Professional Summary");
  }

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

  function updatePreview() {
    const isCoverLetter = tool === "cover-letter";
    const isBundle = tool === "bundle";

    const name = value("full-name", "Your Full Name");
    const job = value("job-title", "Your Professional Title");

    setText("preview-name", name);

    const title = $("preview-title");

    if (title) {
      title.hidden = isCoverLetter;
      title.textContent = isCoverLetter ? "" : job;
    }

    setText(
      "preview-contact",
      [
        value("email"),
        value("phone"),
        value("location")
      ].filter(Boolean).join(" · ") || "Add your contact details"
    );

    if (isCoverLetter) {
      setSection(
        "preview-summary-section",
        "Application",
        `Application for: ${job}`
      );

      setSection(
        "preview-education-section",
        "Employer",
        value("employer", "Organisation not provided")
      );

      setSection(
        "preview-experience-section",
        "Cover Letter",
        `Dear ${value("recipient", "Hiring Manager")},\n\nI am writing to express my interest in the ${job} position at ${value("employer", "your organisation")}.`
      );

      setSection(
        "preview-skills-section",
        "Why I Am Applying",
        value(
          "letter-body",
          "Explain your qualifications, relevant skills, and motivation for applying."
        )
      );

      setSection(
        "preview-certificates-section",
        "Closing",
        `Yours sincerely,\n${name}`
      );
    } else {
      setSection(
        "preview-summary-section",
        "Professional Summary",
        value("summary", "")
      );

      setSection(
        "preview-education-section",
        "Education",
        value("education", "")
      );

      setSection(
        "preview-experience-section",
        "Experience",
        value("experience", "")
      );

      setSection(
        "preview-skills-section",
        "Skills",
        value("skills", "")
      );

      setSection(
        "preview-certificates-section",
        "Certifications & Additional Information",
        value("certificates", "")
      );
    }

    const preview = $("document-preview");

    if (preview) {
      preview.classList.toggle(
        "modern",
        value("template") === "modern"
      );
    }

    setText(
      "preview-status",
      isBundle ? "Career Bundle workspace" : "Preview updated"
    );
  }

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
      <header>
        <h1>${escapeHTML(name)}</h1>
        <p class="job-title">${escapeHTML(job)}</p>
        <p class="contact">${escapeHTML([
          value("email"),
          value("phone"),
          value("location")
        ].filter(Boolean).join(" | "))}</p>
      </header>

      ${sections
        .filter(([, content]) => content)
        .map(([heading, content]) => `
          <section>
            <h2>${escapeHTML(heading)}</h2>
            ${formatText(content)}
          </section>
        `)
        .join("")}
    `;
  }

  function buildLetterForPrint() {
    const name = value("full-name", "Your Name");
    const job = value("job-title", "the advertised position");
    const employer = value("employer", "your organisation");
    const recipient = value("recipient", "Hiring Manager");
    const description = value("job-description");
    const body = value(
      "letter-body",
      "I believe my qualifications, skills and experience would enable me to contribute positively to your organisation. I would welcome the opportunity to discuss my application."
    );

    return `
      <header>
        <h1>${escapeHTML(name)}</h1>
        <p class="contact">${escapeHTML([
          value("email"),
          value("phone"),
          value("location")
        ].filter(Boolean).join(" | "))}</p>
      </header>

      <p>Dear ${escapeHTML(recipient)},</p>

      <p>
        I am writing to apply for the ${escapeHTML(job)} position at
        ${escapeHTML(employer)}.
      </p>

      ${description ? `
        <section>
          <h2>Role requirements</h2>
          ${formatText(description)}
        </section>
      ` : ""}

      ${formatText(body)}

      <p>
        Thank you for considering my application. I look forward to the
        opportunity to discuss my suitability for this role.
      </p>

      <p>Yours sincerely,<br>${escapeHTML(name)}</p>
    `;
  }

  function printDocument() {
    updatePreview();

    const isCoverLetter = tool === "cover-letter";

    const content = isCoverLetter
      ? buildLetterForPrint()
      : buildCVForPrint();

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      window.alert(
        "Please allow pop-ups for this website, then try again."
      );
      return;
    }

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
              color: #17251e;
              font-family: Arial, Helvetica, sans-serif;
              font-size: 10.5pt;
              line-height: 1.65;
            }

            header {
              border-bottom: 3px solid #086b45;
              padding-bottom: 12px;
              margin-bottom: 20px;
            }

            h1 {
              color: #06452f;
              font-size: 24pt;
              margin: 0 0 5px;
              overflow-wrap: anywhere;
            }

            .job-title {
              color: #086b45;
              font-size: 12pt;
            }

            .contact {
              color: #536359;
              font-size: 9pt;
              overflow-wrap: anywhere;
            }

            h2 {
              color: #086b45;
              font-size: 11pt;
              border-bottom: 1px solid #dce5de;
              padding-bottom: 5px;
            }

            section {
              margin-bottom: 18px;
              break-inside: avoid;
            }

            p {
              overflow-wrap: anywhere;
            }

            .modern header {
              border-bottom-color: #b58a20;
            }

            .modern h2 {
              color: #765812;
            }
          </style>
        </head>

        <body class="${value("template") === "modern" ? "modern" : ""}">
          ${content}
        </body>
      </html>
    `);

    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.focus();

      setTimeout(() => {
        printWindow.print();
      }, 300);
    };
  }

  function handleAI(action) {
    const messages = {
      cv: "AI CV improvement is not connected yet. The next step is to connect this button to a secure AI backend.",
      letter: "AI cover letter generation is not connected yet. The next step is to connect this button to a secure AI backend.",
      summary: "AI professional summary generation is not connected yet. The next step is to connect this button to a secure AI backend."
    };

    window.alert(messages[action] || "AI functionality is not connected yet.");
  }

  const previewButton = $("preview-button");
  const downloadButton = $("download-button");

  if (previewButton) {
    previewButton.addEventListener("click", updatePreview);
  }

  if (downloadButton) {
    downloadButton.addEventListener("click", printDocument);
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

  // Configure and render the page.
  configureTool();
  updatePreview();
})();
