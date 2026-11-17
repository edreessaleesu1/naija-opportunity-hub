
/* ============================================================
   NAIJA OPPORTUNITY HUB
   CAREER KIT — AI INTEGRATION
   ------------------------------------------------------------
   Supports:
   1. Improve My CV
   2. Improve My Professional Summary
   3. Write My Cover Letter
   4. Review Uploaded CV
   5. Extract Uploaded CV into Form
   6. Generate Career Bundle

   Existing templates, PDF generator and CV matching are
   intentionally left untouched.
   ============================================================ */

(() => {
  "use strict";

  if (window.NOH_CAREER_AI_INTEGRATION) return;
  window.NOH_CAREER_AI_INTEGRATION = true;

  const SUPABASE_URL =
    "https://djxornmwvkauhkcuhgxc.supabase.co";

  const SUPABASE_KEY =
    "sb_publishable_EDReCY3JcN4vMuypVfqcMQ_GcTEVuBq";

  const AI_ENDPOINT =
    SUPABASE_URL + "/functions/v1/career-assistant";

  const MAX_CV_CHARACTERS = 12000;
  const MIN_CV_CHARACTERS = 80;
  const REQUEST_TIMEOUT = 105000;

  const $ = (id) => document.getElementById(id);

  const form = $("career-form");

  if (!form) return;

  let supabaseClient = null;
  let processing = false;

  /* ----------------------------------------------------------
     SUPABASE AUTHENTICATION
  ---------------------------------------------------------- */

  function getClient() {
    if (window.NOH_SUPABASE_CLIENT) {
      return window.NOH_SUPABASE_CLIENT;
    }

    if (supabaseClient) return supabaseClient;

    if (
      window.supabase &&
      typeof window.supabase.createClient === "function"
    ) {
      supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
      );

      return supabaseClient;
    }

    throw new Error(
      "Authentication service is unavailable. Please refresh the page."
    );
  }

  async function getToken() {
    const client = getClient();

    const { data, error } =
      await client.auth.getSession();

    if (error) throw error;

    return data?.session?.access_token || null;
  }

  /* ----------------------------------------------------------
     FORM HELPERS
  ---------------------------------------------------------- */

  function getValue(id) {
    const field = $(id);

    return field
      ? String(field.value || "").trim()
      : "";
  }

  function setValue(id, value) {
    const field = $(id);

    if (
      !field ||
      typeof value !== "string" ||
      !value.trim()
    ) return;

    field.value = value.trim();

    field.dispatchEvent(
      new Event("input", { bubbles: true })
    );

    field.dispatchEvent(
      new Event("change", { bubbles: true })
    );
  }

  function refreshPreview() {
    const formElement = $("career-form");

    if (formElement) {
      formElement.dispatchEvent(
        new Event("input", { bubbles: true })
      );
    }

    const preview = $("document-preview");

    if (preview) {
      preview.setAttribute(
        "data-ai-updated",
        String(Date.now())
      );
    }
  }

  function getCandidateData() {
    return {
      fullName: getValue("full-name"),
      email: getValue("email"),
      phone: getValue("phone"),
      location: getValue("location"),
      country: getValue("country"),
      linkedin: getValue("linkedin"),

      applicantAddress: getValue("applicant-address"),
      applicationDate: getValue("application-date"),

      jobTitle: getValue("job-title"),
      summary: getValue("summary"),
      education: getValue("education"),
      experience: getValue("experience"),
      skills: getValue("skills"),
      certificates: getValue("certificates"),

      employer: getValue("employer"),
      recipient: getValue("recipient"),
      employerAddress: getValue("employer-address"),
      vacancySource: getValue("vacancy-source"),
      jobDescription: getValue("job-description"),
      letterBody: getValue("letter-body")
    };
  }

  /* ----------------------------------------------------------
     CV FIELD MAPPING
  ---------------------------------------------------------- */

  function applyCV(data) {
    if (!data || typeof data !== "object") {
      throw new Error(
        "The AI returned an invalid CV result."
      );
    }

    const mapping = {
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

    let applied = 0;

    Object.entries(mapping).forEach(([key, id]) => {
      if (
        typeof data[key] === "string" &&
        data[key].trim()
      ) {
        setValue(id, data[key]);
        applied++;
      }
    });

    refreshPreview();

    return applied;
  }

  /* ----------------------------------------------------------
     AI RESPONSE PARSING
  ---------------------------------------------------------- */

  function parseJSON(raw) {
    if (raw && typeof raw === "object") {
      return raw;
    }

    let text = String(raw || "").trim();

    text = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "");

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");

    if (start === -1 || end <= start) {
      throw new Error(
        "The AI returned an invalid structured response. Please try again."
      );
    }

    return JSON.parse(
      text.substring(start, end + 1)
    );
  }

  /* ----------------------------------------------------------
     LOCAL CV FILE EXTRACTION
  ---------------------------------------------------------- */

  function loadScript(url, ready) {
    if (ready()) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const existing = Array.from(
        document.scripts
      ).find((script) => script.src === url);

      if (existing) {
        existing.addEventListener(
          "load",
          resolve,
          { once: true }
        );

        existing.addEventListener(
          "error",
          () => reject(
            new Error("Unable to load the document reader.")
          ),
          { once: true }
        );

        return;
      }

      const script = document.createElement("script");

      script.src = url;

      script.onload = resolve;

      script.onerror = () => reject(
        new Error(
          "Unable to load the document reader. Check your connection."
        )
      );

      document.head.appendChild(script);
    });
  }

  async function extractCVFile(file) {
    if (!file) {
      throw new Error("Please select a CV file.");
    }

    if (file.size > 12 * 1024 * 1024) {
      throw new Error(
        "Your CV must be smaller than 12 MB."
      );
    }

    const extension =
      file.name.split(".").pop().toLowerCase();

    let text = "";

    if (extension === "txt") {
      text = await file.text();
    }

    else if (extension === "docx") {
      await loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js",
        () => Boolean(window.mammoth)
      );

      const result =
        await window.mammoth.extractRawText({
          arrayBuffer: await file.arrayBuffer()
        });

      text = result.value || "";
    }

    else if (extension === "pdf") {
      await loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
        () => Boolean(window.pdfjsLib)
      );

      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

      const pdf = await window.pdfjsLib
        .getDocument({
          data: await file.arrayBuffer()
        })
        .promise;

      const pages = [];

      for (
        let pageNumber = 1;
        pageNumber <= pdf.numPages;
        pageNumber++
      ) {
        const page = await pdf.getPage(pageNumber);

        const content = await page.getTextContent();

        pages.push(
          content.items
            .map((item) => item.str || "")
            .join(" ")
        );
      }

      text = pages.join("\n\n");
    }

    else {
      throw new Error(
        "Unsupported file. Upload PDF, DOCX or TXT."
      );
    }

    text = String(text)
      .replace(/\u0000/g, "")
      .trim()
      .slice(0, MAX_CV_CHARACTERS);

    if (text.length < MIN_CV_CHARACTERS) {
      throw new Error(
        "Not enough readable CV text was found. Try another file or paste the CV text."
      );
    }

    const textarea = $("cv-upload-text");

    if (textarea) {
      textarea.value = text;

      textarea.dispatchEvent(
        new Event("input", { bubbles: true })
      );
    }

    const status = $("cv-upload-status");

    if (status) {
      status.classList.remove("is-error");

      status.textContent =
        "CV extracted successfully. You can now review it or fill your form.";
    }

    return text;
  }

  /* ----------------------------------------------------------
     RESULT DISPLAY
  ---------------------------------------------------------- */

  function showResult(title, message) {
    const box = $("ai-result");

    if (!box) return;

    box.hidden = false;
    box.replaceChildren();

    const heading = document.createElement("h4");

    heading.textContent = title;

    const content = document.createElement("div");

    content.textContent = message;
    content.style.whiteSpace = "pre-wrap";
    content.style.lineHeight = "1.7";
    content.style.overflowWrap = "anywhere";

    const copy = document.createElement("button");

    copy.type = "button";
    copy.className = "button button-secondary";
    copy.textContent = "Copy Result";

    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(message);
        copy.textContent = "Copied Successfully!";
      } catch {
        window.alert(
          "Please select and copy the result manually."
        );
      }
    });

    box.append(heading, content, copy);

    box.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }

  /* ----------------------------------------------------------
     AI REQUEST
  ---------------------------------------------------------- */

  async function requestAI(action, extra = {}) {
    if (processing) return;

    const box = $("ai-result");

    try {
      processing = true;

      const token = await getToken();

      if (!token) {
        throw new Error(
          "Please sign in before using the AI Career Assistant."
        );
      }

      if (box) {
        box.hidden = false;
        box.textContent = "Preparing your AI result. Please wait…";
      }

      const controller = new AbortController();

      const timeout = setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT
      );

      let response;

      try {
        response = await fetch(AI_ENDPOINT, {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_KEY,
            "Authorization": "Bearer " + token
          },

          body: JSON.stringify({
            action,
            ...getCandidateData(),
            ...extra
          }),

          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }

      let data;

      try {
        data = await response.json();
      } catch {
        throw new Error(
          "The AI server returned an invalid response."
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
          data.message ||
          "The AI request failed. Please try again."
        );
      }

      if (
        typeof data.result !== "string" ||
        !data.result.trim()
      ) {
        throw new Error(
          "The AI returned an empty result."
        );
      }

      return data.result;

    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error(
          "The AI request took too long. Please try again."
        );
      }

      throw error;

    } finally {
      processing = false;
    }
  }

  /* ----------------------------------------------------------
     AI ACTIONS
  ---------------------------------------------------------- */

  async function improveCV() {
    const result = await requestAI("improve-cv");

    const data = parseJSON(result);

    const count = applyCV(data);

    showResult(
      "AI CV Improvement",
      "Your CV has been improved and applied to " +
      count +
      " form fields.\n\n" +
      (data.improvements || "") +
      (data.missing
        ? "\n\nInformation to add:\n" + data.missing
        : "")
    );
  }

  async function improveSummary() {
    const result = await requestAI("write-summary");

    setValue("summary", result);

    refreshPreview();

    showResult(
      "Professional Summary",
      "Your professional summary has been added to your CV.\n\n" +
      result
    );
  }

  async function writeLetter() {
    const result = await requestAI("write-letter");

    setValue("letter-body", result);

    refreshPreview();

    showResult(
      "AI Cover Letter",
      "Your cover letter has been added to the application form.\n\n" +
      result
    );
  }

  async function reviewCV() {
    const cvText = getValue("cv-upload-text");

    if (cvText.length < MIN_CV_CHARACTERS) {
      throw new Error(
        "Upload your CV or paste its text first."
      );
    }

    const result = await requestAI(
      "review-cv",
      { cvText }
    );

    showResult("CV Review", result);
  }

  async function extractCV() {
    const cvText = getValue("cv-upload-text");

    if (cvText.length < MIN_CV_CHARACTERS) {
      throw new Error(
        "Upload your CV or paste its text first."
      );
    }

    const result = await requestAI(
      "extract-cv",
      { cvText }
    );

    const data = parseJSON(result);

    const count = applyCV(data);

    showResult(
      "CV Extraction",
      "Your CV information has been extracted into " +
      count +
      " form fields.\n\nPlease review the information before downloading."
    );
  }

  async function writeBundle() {
    const result = await requestAI("write-bundle");

    const bundle = parseJSON(result);

    const count = applyCV(bundle.cv || {});

    if (
      typeof bundle.letterBody === "string" &&
      bundle.letterBody.trim()
    ) {
      setValue("letter-body", bundle.letterBody);
    }

    refreshPreview();

    showResult(
      "Career Bundle",
      "Your CV and cover letter have been generated and added to the form.\n\n" +
      (bundle.notes || "") +
      "\n\nCV fields updated: " +
      count +
      "\n\nReview both documents before downloading."
    );
  }

  /* ----------------------------------------------------------
     BUTTON HANDLERS
  ---------------------------------------------------------- */

  function run(action) {
    action().catch((error) => {
      console.error(
        "[NOH Career AI]",
        error
      );

      showResult(
        "AI Career Assistant",
        error.message ||
        "Something went wrong. Please try again."
      );
    });
  }

  function interceptButton(id, callback) {
    const button = $(id);

    if (!button) return;

    button.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();

        run(callback);
      },
      true
    );
  }

  interceptButton(
    "ai-improve-cv",
    improveCV
  );

  interceptButton(
    "ai-improve-summary",
    improveSummary
  );

  interceptButton(
    "ai-write-letter",
    writeLetter
  );

  interceptButton(
    "ai-review-cv",
    reviewCV
  );

  interceptButton(
    "ai-extract-cv",
    extractCV
  );

  /* ----------------------------------------------------------
     CV UPLOAD BUTTON
  ---------------------------------------------------------- */

  const fileInput = $("cv-file");

  if (fileInput) {
    fileInput.addEventListener(
      "change",
      async () => {
        const file =
          fileInput.files && fileInput.files[0];

        if (!file) return;

        const status = $("cv-upload-status");

        try {
          await extractCVFile(file);
        } catch (error) {
          if (status) {
            status.classList.add("is-error");
            status.textContent = error.message;
          }
        }
      }
    );
  }

  /* ----------------------------------------------------------
     CAREER BUNDLE BUTTON
  ---------------------------------------------------------- */

  function installBundleButton() {
    const params = new URLSearchParams(
      window.location.search
    );

    if (params.get("tool") !== "bundle") return;

    const actions = document.querySelector(
      "#ai-assistant .ai-actions"
    );

    if (!actions || $("ai-write-bundle")) return;

    const button = document.createElement("button");

    button.type = "button";
    button.id = "ai-write-bundle";
    button.className = "button button-primary";
    button.textContent = "Write My Career Bundle with AI";

    button.addEventListener("click", () => {
      run(writeBundle);
    });

    actions.appendChild(button);
  }

  installBundleButton();

  console.info(
    "[NOH Career Kit] AI integration loaded."
  );

})();
