(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const form = $("career-form");

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

  $("page-title").textContent = titles[tool];
  $("page-description").textContent = descriptions[tool];
  $("current-year").textContent = new Date().getFullYear();

  document.querySelectorAll("[data-tool]").forEach((link) => {
    if (link.dataset.tool === tool) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
  });

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

  function setHidden(id, hidden) {
    const element = $(id);
    if (element) element.hidden = hidden;
  }

  function configureTool() {
    const isCoverLetter = tool === "cover-letter";
    const isBundle = tool === "bundle";
    const isLetter = isCoverLetter || isBundle;

    $("form-heading").textContent = isLetter
      ? "Your application details"
      : "Your professional details";

    coverLetterFields.forEach((id) => {
      setHidden(id, !isLetter);
    });

    cvFields.forEach((id) => {
      setHidden(id, isCoverLetter);
    });

    setHidden("job-title-field", false);
    setHidden("template-field", false);

    if (isCoverLetter) {
      $("job-title").previousElementSibling.textContent = "Job title";
      $("job-title").placeholder = "e.g. Graduate Trainee";

      $("preview-summary-heading").textContent = "Application";
      $("preview-education-heading").textContent = "Employer";
      $("preview-experience-heading").textContent = "Dear Hiring Manager";
      $("preview-skills-heading").textContent = "Why I Am Applying";
      $("preview-certificates-heading").textContent = "Closing";

      $("template").options[0].textContent = "Formal Letter";
      $("template").options[1].textContent = "Modern Letter";
    } else {
      $("job-title").previousElementSibling.textContent =
        "Professional title / Target role";
      $("job-title").placeholder =
        "e.g. Graduate Trainee or Data Analyst";

      $("preview-summary-heading").textContent = "Professional Summary";
      $("preview-education-heading").textContent = "Education";
      $("preview-experience-heading").textContent = "Experience";
      $("preview-skills-heading").textContent = "Skills";
      $("preview-certificates-heading").textContent =
        "Certifications & Additional Information";

      $("template").options[0].textContent = "Classic Professional";
      $("template").options[1].textContent = "Modern Clean";
    }

    if (isBundle) {
      $("page-description").textContent =
        "Build your CV and cover letter together. Your information can be reused across both documents.";
    }

    $("download-button").textContent = isBundle
      ? "Print / Save Current Document as PDF"
      : "Print / Save as PDF";
  }

  function value(id, fallback = "") {
    const element = $(id);
    if (!element) return fallback;

    return element.value.trim() || fallback;
  }

  function setText(id, text) {
    const element = $(id);
    if (element) element.textContent = text;
  }

  function setSection(id, text) {
    const section = $(id);
    if (!section) return;

    const content = section.querySelector("p");
    const heading = section.querySelector("h3");

    const empty =
      !text ||
      text.startsWith("Your ") ||
      text === "Not provided";

    section.hidden = empty;

    if (content) content.textContent = text;
    if (heading) heading.hidden = empty;
  }

  function updatePreview() {
    const isLetter = tool === "cover-letter";
    const isBundle = tool === "bundle";
    const name = value("full-name", "Your Full Name");
    const job = value("job-title", "Your Professional Title");

    setText("preview-name", name);

    const title = $("preview-title");
    title.hidden = isLetter;

    if (isLetter) {
      title.textContent = "";
      setText("preview-contact", [
        value("email"),
        value("phone"),
        value("location")
      ].filter(Boolean).join(" · "));

      setSection(
        "preview-summary-section",
        "Application for: " + job
      );

      setSection(
        "preview-education-section",
        "Organisation: " + value("employer", "Not provided")
      );

      const recipient = value("recipient", "Hiring Manager");

      setSection(
        "preview-experience-section",
        "Dear " + recipient + ",\n\n" +
        "I am writing to express my interest in the " + job +
        " position at " + value("employer", "your organisation") + "."
      );

      setSection(
        "preview-skills-section",
        value(
          "letterBody",
          "Add your reasons for applying and explain how your qualifications, experience and skills relate to the role."
        )
      );

      setSection(
        "preview-certificates-section",
        "Yours sincerely,\n" + name
      );
    } else {
      title.textContent = job;

      setText("preview-contact", [
        value("email"),
        value("phone"),
        value("location")
      ].filter(Boolean).join(" · ") || "Add your contact details");

      setSection(
        "preview-summary-section",
        value("summary", "Your professional summary will appear here.")
      );

      setSection(
        "preview-education-section",
        value("education", "Your educational background will appear here.")
      );

      setSection(
        "preview-experience-section",
        value("experience", "Your work experience will appear here.")
      );

      setSection(
        "preview-skills-section",
        value("skills", "Your skills will appear here.")
      );

      setSection(
        "preview-certificates-section",
        value(
          "certificates",
          "Your additional information will appear here."
        )
      );
    }

    $("document-preview").classList.toggle(
      "modern",
      value("template") === "modern"
    );

    setText(
      "preview-status",
      isBundle ? "Bundle workspace" : "Preview updated"
    );
  }

  function buildLetterForPrint() {
    const name = value("full-name", "Your Name");
    const contact = [
      value("email"),
      value("phone"),
      value("location")
    ].filter(Boolean).join(" | ");

    const recipient = value("recipient", "Hiring Manager");
    const job = value("job-title", "the advertised position");
    const employer = value("employer", "your organisation");
    const description = value("job-description");
    const body = value(
      "letter-body",
      "I believe my qualifications, skills and experience would enable me to contribute positively to your organisation. I would welcome the opportunity to discuss my application."
    );

    const safe = (text) => String(text).replace(
      /[&<>"']/g,
      (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[char]
    );

    return `
      <div class="letter">
        <h1>${safe(name)}</h1>
        <p>${safe(contact)}</p>
        <hr>
        <p>${safe(value("location"))}</p>
        <p>Dear ${safe(recipient)},</p>
        <p>
          I am writing to apply for the ${safe(job)} position at
          ${safe(employer)}.
        </p>
        ${description ? `<h3>Role requirements</h3><p>${safe(description)}</p>` : ""}
        <p>${safe(body).replace(/\n/g, "<br>")}</p>
        <p>
          Thank you for considering my application. I look forward to the
          opportunity to discuss my suitability for this role.
        </p>
        <p>Yours sincerely,<br>${safe(name)}</p>
      </div>
    `;
  }

  function printDocument() {
    updatePreview();

    const isLetter = tool === "cover-letter";

    if (isLetter) {
      const printable = window.open("", "_blank");

      if (!printable) {
        alert("Please allow pop-ups for this site, then try printing again.");
        return;
      }

      printable.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Cover Letter</title>
          <style>
            @page { size: A4; margin: 22mm; }
            body {
              font-family: Arial, sans-serif;
              color: #222;
              line-height: 1.8;
              font-size: 12pt;
            }
            h1 { color: #075b36; font-size: 22pt; }
            h3 { font-size: 12pt; }
            p { white-space: normal; }
            hr { border: 0; border-top: 2px solid #087443; }
          </style>
        </head>
        <body>${buildLetterForPrint()}</body>
        </html>
      `);

      printable.document.close();
      printable.focus();

      setTimeout(() => {
        printable.print();
      }, 400);

      return;
    }

    window.print();
  }

  $("preview-button").addEventListener("click", updatePreview);

  $("download-button").addEventListener("click", printDocument);

  form.addEventListener("input", updatePreview);

  form.addEventListener("change", updatePreview);

  form.addEventListener("reset", () => {
    setTimeout(updatePreview, 0);
  });

  configureTool();
  updatePreview();
})();
