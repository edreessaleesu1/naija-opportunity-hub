(() => {
  "use strict";

  // Prevent duplicate initialisation.
  if (window.__NOH_CAREER_KIT_LOADED__) return;

  const $ = (id) => document.getElementById(id);
  const form = $("career-form");

  // This script is intended for career-kit.html.
  if (!form) return;

  window.__NOH_CAREER_KIT_LOADED__ = true;

  // Supabase Edge Function configuration.
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

  // --------------------------------------------------
  // GENERAL HELPERS
  // --------------------------------------------------

  function setText(id, text) {
    const element = $(id);

    if (element) {
      element.textContent = text;
    }
  }

  function setHidden(id, hidden) {
    const element = $(id);

    if (element) {
      element.hidden = hidden;
    }
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

  function getContactDetails() {
    return [
      value("email"),
      value("phone"),
      value("location")
    ].filter(Boolean).join(" | ");
  }

  // --------------------------------------------------
  // PAGE CONFIGURATION
  // --------------------------------------------------

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
      isLetter
        ? "Your application details"
        : "Your professional details"
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

    if (jobTitle) {
      if (jobTitle.previousElementSibling) {
        jobTitle.previousElementSibling.textContent =
          isCoverLetter
            ? "Job title"
            : "Professional title / Target role";
      }

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
      isCoverLetter
        ? "Closing"
        : "Certifications & Additional Information"
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
        ? "Print / Save CV and Cover Letter as PDF"
        : "Print / Save as PDF"
    );

    setText("ai-assistant-title", "AI Career Assistant");

    setText(
      "ai-assistant-description",
      "Get help improving your CV or preparing a tailored cover letter."
    );

    setText("ai-improve-cv", "Improve My CV with AI");
    setText("ai-write-letter", "Write My Cover Letter with AI");
    setText(
      "ai-improve-summary",
      "Improve My Professional Summary"
    );
  }

  // --------------------------------------------------
  // PREVIEW RENDERING
  // --------------------------------------------------

  function setSection(id, heading, content) {
    const section = $(id);

    if (!section) return;

    const headingElement = section.querySelector("h3");
    const paragraph = section.querySelector("p");

    if (headingElement) {
      headingElement.textContent = heading;
    }

    if (paragraph) {
      paragraph.innerHTML = formatText(content);
    }

    section.hidden = !content;
  }

  function updatePreview() {
    const isCoverLetter = tool === "cover-letter";

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
      getContactDetails() || "Add your contact details"
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
        `Dear ${value("recipient", "Hiring Manager")},

I am writing to express my interest in the ${job} position at ${value("employer", "your organisation")}.`
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

    const preview = $("document-preview");

    if (preview) {
      preview.classList.toggle(
        "modern",
        value("template") === "modern"
      );
    }

    setText(
      "preview-status",
      tool === "bundle"
        ? "Career Bundle workspace"
        : "Preview updated"
    );
  }

  // Called by the Preview button.
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
  // CV CONTENT
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
          <p class="contact">${escapeHTML(getContactDetails())}</p>
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
      </article>
    `;
  }

  // --------------------------------------------------
  // COVER LETTER CONTENT
  // --------------------------------------------------

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
      <article class="document letter-document">
        <header>
          <h1>${escapeHTML(name)}</h1>
          <p class="contact">${escapeHTML(getContactDetails())}</p>
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

    // Open the window directly from the button click to reduce
    // the chance that the browser blocks the pop-up.
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

    const modernClass =
      value("template") === "modern" ? "modern" : "";

    printWindow.document.open();

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">

          <meta
            name="viewport"
            content="width=device-width, initial-scale=1"
          >

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

            .document {
              width: 100%;
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
              margin: 5px 0;
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
              margin-top: 18px;
            }

            section {
              margin-bottom: 18px;
              break-inside: avoid;
            }

            p {
              overflow-wrap: anywhere;
              white-space: normal;
            }

            .modern header {
              border-bottom-color: #b58a20;
            }

            .modern h2 {
              color: #765812;
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

        <body class="${modernClass}">
          ${content}
        </body>
      </html>
    `);

    printWindow.document.close();

    // Do not rely solely on the load event: the document may
    // already be loaded by the time the handler is assigned.
    printWindow.focus();

    setTimeout(() => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch (error) {
        console.error("Print error:", error);

        window.alert(
          "The print dialog could not be opened. Please try again."
        );
      }
    }, 500);
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

    if (!selected) {
      window.alert("Please select a valid AI tool.");
      return;
    }

    // Validate the information required by each AI tool.
    if (
      action === "cv" &&
      !value("full-name") &&
      !value("education") &&
      !value("experience") &&
      !value("skills") &&
      !value("summary")
    ) {
      window.alert(
        "Please enter some CV information before requesting improvements."
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
        "Please enter your target job, education, experience, or skills first."
      );
      return;
    }

    if (
      action === "letter" &&
      !value("job-title") &&
      !value("job-description")
    ) {
      window.alert(
        "Please enter the job title or job description first."
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

    const allButtons = [
      $("ai-improve-cv"),
      $("ai-improve-summary"),
      $("ai-write-letter")
    ].filter(Boolean);

    const originalButtonText = selected.button
      ? selected.button.textContent
      : "";

    allButtons.forEach((button) => {
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
          "The server returned an unexpected response. Please try again."
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error || `The AI request failed (${response.status}).`
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
          // Clipboard access can be unavailable on some browsers.
          window.alert(
            "Automatic copying failed. Please select the result text and copy it manually."
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
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.";

      resultBox.append(errorHeading, errorMessage);

    } finally {
      allButtons.forEach((button) => {
        button.disabled = false;
      });

      if (selected.button) {
        selected.button.textContent = originalButtonText;
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

  // Keep the preview updated while the user edits the form.
  form.addEventListener("input", updatePreview);
  form.addEventListener("change", updatePreview);

  form.addEventListener("reset", () => {
    setTimeout(updatePreview, 0);
  });

  // AI buttons.
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

  // Configure and initialise the page.
  configureTool();
  updatePreview();

})();
