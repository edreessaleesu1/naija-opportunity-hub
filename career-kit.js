(() => {
  "use strict";

  function startCareerKit() {
    const section = document.querySelector("#career-kit");

    if (!section || section.dataset.builderLoaded === "true") {
      return;
    }

    section.dataset.builderLoaded = "true";

    const container = section.querySelector(".wrap");

    if (!container) {
      console.error("Career Kit container was not found.");
      return;
    }

    const builder = document.createElement("div");

    builder.className = "cv-builder panel";

    builder.innerHTML = `
      <div class="cv-builder-heading">
        <span class="section-kicker">NAIJA CAREER KIT</span>
        <h3>Build Your Professional CV</h3>
        <p>
          Enter your details below, preview your CV, and prepare a
          professional document for job and internship applications.
        </p>
      </div>

      <div class="cv-builder-grid">

        <form id="noh-cv-form" class="cv-form">

          <h4>Personal Information</h4>

          <label for="noh-name">Full name *</label>
          <input
            id="noh-name"
            name="name"
            type="text"
            placeholder="e.g. Amina Musa"
            required
          >

          <label for="noh-email">Email address</label>
          <input
            id="noh-email"
            name="email"
            type="email"
            placeholder="you@example.com"
          >

          <label for="noh-phone">Phone number</label>
          <input
            id="noh-phone"
            name="phone"
            type="tel"
            placeholder="+234..."
          >

          <label for="noh-location">Location</label>
          <input
            id="noh-location"
            name="location"
            type="text"
            placeholder="e.g. Abuja, Nigeria"
          >

          <label for="noh-title">Professional title</label>
          <input
            id="noh-title"
            name="title"
            type="text"
            placeholder="e.g. Graduate Data Analyst"
          >

          <h4>Professional Profile</h4>

          <label for="noh-summary">
            Short professional summary *
          </label>
          <textarea
            id="noh-summary"
            name="summary"
            rows="4"
            placeholder="Describe your qualifications, experience, and career goals."
            required
          ></textarea>

          <h4>Education</h4>

          <label for="noh-education">
            Qualification and institution *
          </label>
          <textarea
            id="noh-education"
            name="education"
            rows="3"
            placeholder="B.Sc. Geography — University Name (Year)"
            required
          ></textarea>

          <h4>Work Experience</h4>

          <label for="noh-experience">
            Experience, responsibilities and achievements
          </label>
          <textarea
            id="noh-experience"
            name="experience"
            rows="5"
            placeholder="Job title — Organisation — Dates&#10;Describe your responsibilities and achievements."
          ></textarea>

          <h4>Skills and Additional Information</h4>

          <label for="noh-skills">Skills *</label>
          <textarea
            id="noh-skills"
            name="skills"
            rows="3"
            placeholder="Excel, communication, research, Python..."
            required
          ></textarea>

          <label for="noh-certificates">
            Certifications and training
          </label>
          <textarea
            id="noh-certificates"
            name="certificates"
            rows="3"
            placeholder="Relevant courses, certificates or training."
          ></textarea>

          <label for="noh-template">CV style</label>
          <select id="noh-template" name="template">
            <option value="classic">Classic Professional</option>
            <option value="modern">Modern Professional</option>
          </select>

          <div class="cv-form-actions">
            <button
              type="submit"
              class="button button-primary"
            >
              Update CV Preview
            </button>

            <button
              type="button"
              id="noh-cv-clear"
              class="button button-outline"
            >
              Clear Form
            </button>
          </div>

          <p class="cv-privacy-note">
            Privacy tip: use your own device and avoid entering
            sensitive information you do not need on your CV.
          </p>

        </form>

        <div class="cv-preview-area">

          <div class="cv-preview-toolbar">
            <div>
              <h4>Live CV Preview</h4>
              <p>Your document will appear below.</p>
            </div>

            <button
              type="button"
              id="noh-cv-download"
              class="button button-primary"
            >
              Save as PDF
            </button>
          </div>

          <article
            id="noh-cv-preview"
            class="cv-document"
            aria-live="polite"
          >
            <header class="cv-document-header">
              <h1>Your Full Name</h1>
              <p>Professional Title</p>
              <div class="cv-contact">
                Add your contact details using the form.
              </div>
            </header>

            <section>
              <h2>PROFESSIONAL PROFILE</h2>
              <p>
                Your professional summary will appear here.
              </p>
            </section>

            <section>
              <h2>EDUCATION</h2>
              <p>Your educational qualifications will appear here.</p>
            </section>

            <section>
              <h2>WORK EXPERIENCE</h2>
              <p>Your relevant experience will appear here.</p>
            </section>

            <section>
              <h2>SKILLS</h2>
              <p>Your skills will appear here.</p>
            </section>

            <section>
              <h2>CERTIFICATIONS AND TRAINING</h2>
              <p>Your additional training will appear here.</p>
            </section>

          </article>

          <p class="cv-preview-note">
            Review all information carefully before submitting
            your CV to an employer.
          </p>

        </div>

      </div>
    `;

    container.appendChild(builder);

    const form = builder.querySelector("#noh-cv-form");
    const preview = builder.querySelector("#noh-cv-preview");
    const downloadButton = builder.querySelector("#noh-cv-download");
    const clearButton = builder.querySelector("#noh-cv-clear");

    function getValue(name) {
      return form.elements[name].value.trim();
    }

    function escapeHTML(value) {
      return String(value).replace(/[&<>"']/g, character => {
        const entities = {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        };

        return entities[character];
      });
    }

    function formatText(value) {
      if (!value.trim()) {
        return "";
      }

      return value
        .split(/\n+/)
        .map(line => {
          const safeLine = escapeHTML(line.trim());

          return safeLine
            ? `<p>${safeLine}</p>`
            : "";
        })
        .join("");
    }

    function renderCV() {
      const name = getValue("name") || "Your Full Name";
      const email = getValue("email");
      const phone = getValue("phone");
      const location = getValue("location");
      const title = getValue("title") || "Professional Title";
      const summary = getValue("summary");
      const education = getValue("education");
      const experience = getValue("experience");
      const skills = getValue("skills");
      const certificates = getValue("certificates");
      const template = getValue("template");

      const contact = [email, phone, location]
        .filter(Boolean)
        .map(escapeHTML)
        .join(" | ");

      preview.classList.toggle(
        "cv-document-modern",
        template === "modern"
      );

      preview.innerHTML = `
        <header class="cv-document-header">
          <h1>${escapeHTML(name)}</h1>
          <p>${escapeHTML(title)}</p>

          <div class="cv-contact">
            ${contact || "Contact details not provided"}
          </div>
        </header>

        <section>
          <h2>PROFESSIONAL PROFILE</h2>
          ${formatText(summary) || "<p>Not provided.</p>"}
        </section>

        <section>
          <h2>EDUCATION</h2>
          ${formatText(education) || "<p>Not provided.</p>"}
        </section>

        <section>
          <h2>WORK EXPERIENCE</h2>
          ${formatText(experience) || "<p>Not provided.</p>"}
        </section>

        <section>
          <h2>SKILLS</h2>
          ${formatText(skills) || "<p>Not provided.</p>"}
        </section>

        <section>
          <h2>CERTIFICATIONS AND TRAINING</h2>
          ${formatText(certificates) || "<p>Not provided.</p>"}
        </section>
      `;
    }

    form.addEventListener("input", renderCV);
    form.addEventListener("change", renderCV);

    form.addEventListener("submit", event => {
      event.preventDefault();
      renderCV();

      preview.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });

    clearButton.addEventListener("click", () => {
      const confirmed = window.confirm(
        "Clear all the information entered in this CV?"
      );

      if (!confirmed) {
        return;
      }

      form.reset();
      renderCV();
    });

    downloadButton.addEventListener("click", () => {
      if (!getValue("name")) {
        window.alert("Please enter your full name first.");
        form.elements.name.focus();
        return;
      }

      renderCV();

      const printWindow = window.open("", "_blank");

      if (!printWindow) {
        window.alert(
          "Your browser blocked the PDF window. Allow pop-ups for this website and try again."
        );
        return;
      }

      const printStyles = `
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
          font-size: 10pt;
          line-height: 1.55;
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

        header p {
          color: #086b45;
          font-size: 12pt;
          margin: 0 0 8px;
        }

        .cv-contact {
          color: #536359;
          font-size: 9pt;
          overflow-wrap: anywhere;
        }

        section {
          margin: 0 0 18px;
          break-inside: avoid;
        }

        h2 {
          color: #086b45;
          font-size: 11pt;
          border-bottom: 1px solid #dce5de;
          padding-bottom: 5px;
          margin: 0 0 8px;
        }

        section p {
          margin: 0 0 6px;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .cv-document-modern header {
          border-bottom-color: #b58a20;
        }

        .cv-document-modern h2 {
          color: #765812;
        }

        @media screen {
          body {
            max-width: 800px;
            margin: 30px auto;
            padding: 24px;
          }
        }
      `;

      printWindow.document.open();

      printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1.0"
            >
            <title>Professional CV</title>
            <style>${printStyles}</style>
          </head>

          <body>
            ${preview.innerHTML}
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
    });

    renderCV();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startCareerKit);
  } else {
    startCareerKit();
  }
})();
