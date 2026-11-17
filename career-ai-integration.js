
(() => {
  "use strict";

  if (window.NOH_CAREER_AI_INTEGRATION) return;

  const $ = (id) => document.getElementById(id);
  const form = $("career-form");

  if (!form) {
    console.error("[NOH Career AI] Career form was not found.");
    return;
  }

  window.NOH_CAREER_AI_INTEGRATION = true;

  const SUPABASE_URL =
    "https://djxornmwvkauhkcuhgxc.supabase.co";

  const SUPABASE_KEY =
    "sb_publishable_EDReCY3JcN4vMuypVfqcMQ_GcTEVuBq";

  const AI_ENDPOINT =
    SUPABASE_URL + "/functions/v1/career-assistant";

  const MIN_CV_CHARACTERS = 80;
  const MAX_CV_CHARACTERS = 12000;
  const REQUEST_TIMEOUT = 75000;
  const AUTH_TIMEOUT = 10000;

  const AI_SELECTOR = [
    "#ai-improve-cv",
    "#ai-improve-summary",
    "#ai-write-letter",
    "#ai-review-cv",
    "#ai-extract-cv",
    "#ai-write-bundle"
  ].join(",");

  let client = null;
  let processing = false;
  const scriptPromises = {};

  /* =========================================
     SUPABASE AUTHENTICATION
  ========================================= */

  function getClient() {
    if (window.NOH_SUPABASE_CLIENT) {
      return window.NOH_SUPABASE_CLIENT;
    }

    if (client) return client;

    if (
      window.supabase &&
      typeof window.supabase.createClient === "function"
    ) {
      client = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
      );

      window.NOH_SUPABASE_CLIENT = client;
      return client;
    }

    throw new Error(
      "Authentication could not be loaded. Refresh the page and try again."
    );
  }

  async function getToken() {
    const supabaseClient = getClient();

    let timeoutId;

    try {
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(
            new Error(
              "Checking your sign-in session took too long. Please refresh and try again."
            )
          );
        }, AUTH_TIMEOUT);
      });

      const result = await Promise.race([
        supabaseClient.auth.getSession(),
        timeoutPromise
      ]);

      if (result.error) throw result.error;

      return result.data?.session?.access_token || null;

    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
    }
  }

  /* =========================================
     BUTTON STATE
  ========================================= */

  function getButtons() {
    return Array.from(
      document.querySelectorAll(AI_SELECTOR)
    );
  }

  function setButtonsBusy(busy) {
    getButtons().forEach((button) => {
      button.disabled = Boolean(busy);

      button.setAttribute(
        "aria-disabled",
        String(Boolean(busy))
      );
    });
  }

  /*
   * Keep the AI controls available when the
   * older Career Kit script changes their state.
   * Authentication is checked when an AI action
   * is actually requested.
   */

  if (window.MutationObserver) {
    const observer = new MutationObserver(() => {
      if (processing) return;

      getButtons().forEach((button) => {
        if (button.disabled) {
          button.disabled = false;
          button.setAttribute("aria-disabled", "false");
        }
      });
    });

    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled"]
    });
  }

  /* =========================================
     FORM HELPERS
  ========================================= */

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
    form.dispatchEvent(
      new Event("input", { bubbles: true })
    );

    form.dispatchEvent(
      new Event("change", { bubbles: true })
    );

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

  function getCVText() {
    const uploaded = getValue("cv-upload-text");

    if (uploaded.length >= MIN_CV_CHARACTERS) {
      return uploaded.slice(0, MAX_CV_CHARACTERS);
    }

    const data = getCandidateData();

    const parts = [
      data.fullName,
      data.jobTitle,
      data.summary,
      "Education:\n" + data.education,
      "Experience:\n" + data.experience,
      "Skills:\n" + data.skills,
      "Certificates:\n" + data.certificates
    ];

    return parts
      .filter(Boolean)
      .join("\n\n")
      .slice(0, MAX_CV_CHARACTERS);
  }

  /* =========================================
     SIGN-IN MESSAGE
  ========================================= */

  function showSignInMessage() {
    const box = $("ai-result");

    if (!box) return;

    const returnTo = encodeURIComponent(
      window.location.pathname +
      window.location.search +
      "#ai-assistant"
    );

    box.hidden = false;
    box.replaceChildren();

    const heading = document.createElement("h4");
    heading.textContent =
      "Sign in to use the AI Career Assistant";

    const message = document.createElement("p");

    message.textContent =
      "Please sign in to your Naija Opportunity Hub account before using the AI tools.";

    const link = document.createElement("a");

    link.href =
      "/auth.html?mode=login&redirect=" + returnTo;

    link.className = "button button-primary";
    link.textContent = "Sign in or create an account";

    box.append(heading, message, link);
  }

  /* =========================================
     RESULT DISPLAY
  ========================================= */

  function showResult(title, message) {
    let box = $("ai-result");

    if (!box) {
      const section = $("ai-assistant");

      if (!section) return;

      box = document.createElement("div");
      box.id = "ai-result";
      box.className = "ai-result";

      section.appendChild(box);
    }

    box.hidden = false;
    box.replaceChildren();

    const heading = document.createElement("h4");
    heading.textContent = title;

    const content = document.createElement("div");

    content.textContent = String(message || "");
    content.style.whiteSpace = "pre-wrap";
    content.style.lineHeight = "1.7";
    content.style.overflowWrap = "anywhere";

    const copy = document.createElement("button");

    copy.type = "button";
    copy.className = "button button-secondary";
    copy.textContent = "Copy Result";

    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(
          String(message || "")
        );

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

  function showWorking(title, message) {
    const box = $("ai-result");

    if (!box) return;

    box.hidden = false;
    box.replaceChildren();

    const heading = document.createElement("h4");
    heading.textContent = title;

    const content = document.createElement("p");

    content.textContent =
      message ||
      "Your request is being processed. Please keep this page open. This may take a little while on a slow connection.";

    box.append(heading, content);
  }

  /* =========================================
     AI REQUEST
  ========================================= */

  async function requestAI(action, extra = {}) {
    const accessToken = await getToken();

    if (!accessToken) {
      const error = new Error(
        "Please sign in to use the AI Career Assistant."
      );

      error.name = "AuthenticationRequired";
      throw error;
    }

    const controller = new AbortController();

    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT);

    try {
      const response = await fetch(AI_ENDPOINT, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": "Bearer " + accessToken
        },

        body: JSON.stringify({
          action,
          ...getCandidateData(),
          ...extra
        }),

        signal: controller.signal
      });

      const raw = await response.text();

      let data;

      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(
          "The AI server returned an invalid response. Please try again."
        );
      }

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        const error = new Error(
          "Your sign-in session has expired. Please sign in again."
        );

        error.name = "AuthenticationRequired";
        throw error;
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
          data.message ||
          "The AI request could not be completed. Please try again."
        );
      }

      if (
        typeof data.result !== "string" ||
        !data.result.trim()
      ) {
        throw new Error(
          "The AI returned an empty result. Please try again."
        );
      }

      return data.result;

    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error(
          "The AI request timed out. Please try again."
        );
      }

      if (
        error instanceof TypeError ||
        /failed to fetch|networkerror|network request failed/i.test(
          error.message || ""
        )
      ) {
        throw new Error(
          "We could not connect to the AI service. Check your internet connection and try again."
        );
      }

      throw error;

    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  /* =========================================
     AI RESPONSE PARSING
  ========================================= */

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
        "The AI returned an invalid structured result. Please try again."
      );
    }

    return JSON.parse(
      text.substring(start, end + 1)
    );
  }

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

    let count = 0;

    Object.entries(mapping).forEach(([key, id]) => {
      if (
        typeof data[key] === "string" &&
        data[key].trim()
      ) {
        setValue(id, data[key]);
        count++;
      }
    });

    refreshPreview();

    return count;
  }

  /* =========================================
     EXTERNAL SCRIPT LOADER
  ========================================= */

  function loadScript(url, ready) {
    if (ready()) return Promise.resolve();

    if (scriptPromises[url]) {
      return scriptPromises[url];
    }

    scriptPromises[url] = new Promise((resolve, reject) => {
      const script = document.createElement("script");

      script.src = url;
      script.async = true;

      const timeout = window.setTimeout(() => {
        reject(
          new Error(
            "The document reader took too long to load. Please try again."
          )
        );
      }, 20000);

      script.onload = () => {
        window.clearTimeout(timeout);

        if (ready()) {
          resolve();
        } else {
          reject(
            new Error(
              "The document reader could not initialise."
            )
          );
        }
      };

      script.onerror = () => {
        window.clearTimeout(timeout);

        reject(
          new Error(
            "Unable to load the document reader. Check your internet connection."
          )
        );
      };

      document.head.appendChild(script);
    }).catch((error) => {
      delete scriptPromises[url];
      throw error;
    });

    return scriptPromises[url];
  }

  /* =========================================
     OCR ENGINE
  ========================================= */

  async function loadTesseract() {
    await loadScript(
      "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js",
      () => Boolean(window.Tesseract)
    );

    return window.Tesseract;
  }

  async function extractPDFWithOCR(file) {
    await loadScript(
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
      () => Boolean(window.pdfjsLib)
    );

    const pdfjs = window.pdfjsLib;

    pdfjs.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

    const pdf = await pdfjs.getDocument({
      data: await file.arrayBuffer()
    }).promise;

    const pages = [];

    /*
     * First attempt: extract selectable PDF text.
     */

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();

      const pageText = content.items
        .map(item => item.str || "")
        .join(" ");

      pages.push(pageText);
    }

    let extracted = pages.join("\n\n").trim();

    if (
      extracted.replace(/\s/g, "").length >=
      MIN_CV_CHARACTERS
    ) {
      return extracted;
    }

    /*
     * Second attempt: OCR scanned/image PDFs.
     */

    const Tesseract = await loadTesseract();

    let worker;

    try {
      worker = await Tesseract.createWorker("eng");

      const ocrPages = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);

        const viewport = page.getViewport({
          scale: 2
        });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error(
            "Your browser could not prepare the scanned PDF for OCR."
          );
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: context,
          viewport
        }).promise;

        const result = await worker.recognize(canvas);

        ocrPages.push(result.data.text || "");

        canvas.width = 0;
        canvas.height = 0;
      }

      extracted = ocrPages.join("\n\n").trim();

    } finally {
      if (worker) {
        await worker.terminate();
      }
    }

    return extracted;
  }

  /* =========================================
     CV FILE EXTRACTION
  ========================================= */

  async function extractCVFile(file) {
    if (!file) {
      throw new Error("Please select a CV file.");
    }

    if (file.size > 12 * 1024 * 1024) {
      throw new Error(
        "Your CV must be smaller than 12 MB."
      );
    }

    const extension = file.name
      .split(".")
      .pop()
      .toLowerCase();

    let text = "";

    if (extension === "txt") {
      text = await file.text();

    } else if (extension === "docx") {
      await loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js",
        () => Boolean(window.mammoth)
      );

      const result = await window.mammoth.extractRawText({
        arrayBuffer: await file.arrayBuffer()
      });

      text = result.value || "";

    } else if (extension === "pdf") {
      text = await extractPDFWithOCR(file);

    } else {
      throw new Error(
        "Unsupported file. Upload a PDF, DOCX or TXT CV."
      );
    }

    text = String(text)
      .replace(/\u0000/g, "")
      .replace(/[ \t]+/g, " ")
      .trim()
      .slice(0, MAX_CV_CHARACTERS);

    if (
      text.replace(/\s/g, "").length <
      MIN_CV_CHARACTERS
    ) {
      throw new Error(
        "We could not recognise enough text in this document. Try a clearer PDF, DOCX file, or paste your CV text manually."
      );
    }

    const textarea = $("cv-upload-text");

    if (textarea) {
      textarea.value = text;

      textarea.dispatchEvent(
        new Event("input", { bubbles: true })
      );

      textarea.dispatchEvent(
        new Event("change", { bubbles: true })
      );
    }

    const status = $("cv-upload-status");

    if (status) {
      status.classList.remove("is-error");

      status.textContent =
        "CV read successfully. Your information is ready for AI review and extraction.";
    }

    return text;
  }

  /* =========================================
     AI ACTIONS
  ========================================= */

  async function improveCV() {
    const cvText = getCVText();

    if (cvText.length < MIN_CV_CHARACTERS) {
      throw new Error(
        "Enter your CV information or upload an existing CV first."
      );
    }

    const result = await requestAI(
      "improve-cv",
      { cvText }
    );

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
    const data = getCandidateData();

    if (
      !data.jobTitle &&
      !data.education &&
      !data.experience &&
      !data.skills
    ) {
      throw new Error(
        "Enter your target role, education, experience or skills first."
      );
    }

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
    const data = getCandidateData();

    if (!data.jobTitle && !data.jobDescription) {
      throw new Error(
        "Enter the job title or job description before writing your cover letter."
      );
    }

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
        "Upload your CV or paste at least 80 characters of CV text first."
      );
    }

    const result = await requestAI(
      "review-cv",
      { cvText }
    );

    showResult("AI CV Review", result);
  }

  async function extractCV() {
    const cvText = getValue("cv-upload-text");

    if (cvText.length < MIN_CV_CHARACTERS) {
      throw new Error(
        "Upload your CV or paste at least 80 characters of CV text first."
      );
    }

    const result = await requestAI(
      "extract-cv",
      { cvText }
    );

    const data = parseJSON(result);
    const count = applyCV(data);

    showResult(
      "CV Information Extracted",
      "Your CV information has been added to " +
      count +
      " form fields.\n\nReview the information carefully before downloading."
    );
  }

  async function writeBundle() {
    const data = getCandidateData();

    if (
      !data.jobTitle &&
      !data.jobDescription &&
      !data.experience &&
      !data.education
    ) {
      throw new Error(
        "Add your career details and target role before generating your Career Bundle."
      );
    }

    const result = await requestAI(
      "write-bundle",
      { cvText: getCVText() }
    );

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
      "Career Bundle Generated",
      "Your CV and cover letter have been added to the form.\n\n" +
      (bundle.notes || "") +
      "\n\nCV fields updated: " +
      count +
      "\n\nPlease review both documents before downloading."
    );
  }

  /* =========================================
     REQUEST CONTROLLER
  ========================================= */

  async function runAction(action, title, button) {
    if (processing) {
      showResult(
        "AI Career Assistant",
        "Another AI request is already running. Please wait for it to finish."
      );

      return;
    }

    processing = true;

    const originalText = button
      ? button.textContent
      : "";

    setButtonsBusy(true);

    if (button) {
      button.textContent = "Working...";
    }

    showWorking(title);

    try {
      await action();

    } catch (error) {
      console.error("[NOH Career AI]", error);

      if (error.name === "AuthenticationRequired") {
        showSignInMessage();

      } else {
        showResult(
          "AI Career Assistant",
          error.message ||
          "Something went wrong. Please try again."
        );
      }

    } finally {
      processing = false;

      if (button) {
        button.textContent = originalText;
      }

      setButtonsBusy(false);
    }
  }

  /* =========================================
     BUTTON REGISTRATION
  ========================================= */

  function bindButton(id, action, title) {
    const button = $(id);

    if (!button || button.dataset.nohAiBound === "true") {
      return;
    }

    button.dataset.nohAiBound = "true";

    button.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();

        runAction(action, title, button);
      },
      true
    );
  }

  bindButton(
    "ai-improve-cv",
    improveCV,
    "Improving Your CV"
  );

  bindButton(
    "ai-improve-summary",
    improveSummary,
    "Writing Your Professional Summary"
  );

  bindButton(
    "ai-write-letter",
    writeLetter,
    "Preparing Your Cover Letter"
  );

  bindButton(
    "ai-review-cv",
    reviewCV,
    "Reviewing Your CV"
  );

  bindButton(
    "ai-extract-cv",
    extractCV,
    "Extracting Your CV Information"
  );

  /* =========================================
     CV UPLOAD
  ========================================= */

  const fileInput = $("cv-file");

  if (fileInput) {
    fileInput.addEventListener("change", async () => {
      const file =
        fileInput.files && fileInput.files[0];

      if (!file) return;

      const status = $("cv-upload-status");

      if (status) {
        status.classList.remove("is-error");
        status.textContent =
          "Reading your CV. Scanned PDFs may take a little longer...";
      }

      try {
        await extractCVFile(file);

      } catch (error) {
        console.error("[NOH CV Upload]", error);

        if (status) {
          status.classList.add("is-error");
          status.textContent = error.message;
        }
      }
    });
  }

  /* =========================================
     CAREER BUNDLE BUTTON
  ========================================= */

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

    actions.appendChild(button);

    bindButton(
      "ai-write-bundle",
      writeBundle,
      "Preparing Your Career Bundle"
    );
  }

  installBundleButton();

  /* =========================================
     INITIALISE
  ========================================= */

  setButtonsBusy(false);

  console.info(
    "[NOH Career AI] Unified AI controls loaded successfully."
  );

})();
