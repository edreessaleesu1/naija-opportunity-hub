
(() => {
  "use strict";

  if (window.NOH_CV_UPLOAD_LOADED) return;

  const SUPABASE_URL =
    "https://djxornmwvkauhkcuhgxc.supabase.co";

  const SUPABASE_KEY =
    "sb_publishable_EDReCY3JcN4vMuypVfqcMQ_GcTEVuBq";

  const AI_ENDPOINT =
    `${SUPABASE_URL}/functions/v1/career-assistant`;

  const MAX_FILE_SIZE = 8 * 1024 * 1024;
  const MAX_CV_TEXT = 8000;

  const PDF_JS =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";

  const MAMMOTH_JS =
    "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js";

  const $ = (id) => document.getElementById(id);

  let selectedFile = null;
  let extractedText = "";
  let improvedCV = "";
  let processing = false;

  const scriptPromises = {};

  function loadScript(src, ready) {
    if (ready()) return Promise.resolve();

    if (scriptPromises[src]) return scriptPromises[src];

    scriptPromises[src] = new Promise((resolve, reject) => {
      const script = document.createElement("script");

      script.src = src;
      script.async = true;

      script.onload = () => {
        if (ready()) {
          resolve();
        } else {
          delete scriptPromises[src];
          reject(new Error("A document-reading library could not start."));
        }
      };

      script.onerror = () => {
        delete scriptPromises[src];
        reject(new Error("Unable to load the document-reading service."));
      };

      document.head.appendChild(script);
    });

    return scriptPromises[src];
  }

  function installStyles() {
    if ($("noh-cv-upload-styles")) return;

    const style = document.createElement("style");
    style.id = "noh-cv-upload-styles";

    style.textContent = `
      #noh-cv-upload-panel {
        margin: 20px 0;
        padding: 20px;
        border: 1px solid #d8c99f;
        border-radius: 12px;
        background: #fffdf7;
        color: #26332d;
      }

      #noh-cv-upload-panel h3 {
        margin: 0 0 8px;
        color: #075b3b;
        font-size: 19px;
      }

      #noh-cv-upload-panel p {
        line-height: 1.6;
      }

      #noh-cv-upload-panel .noh-upload-help {
        color: #626b65;
        font-size: 13px;
      }

      #noh-cv-file {
        display: block;
        width: 100%;
        margin: 14px 0;
        padding: 12px;
        border: 1px dashed #b89b55;
        border-radius: 8px;
        background: #ffffff;
      }

      #noh-cv-upload-status {
        margin: 10px 0;
        font-size: 14px;
        overflow-wrap: anywhere;
      }

      #noh-cv-text-preview {
        max-height: 180px;
        overflow: auto;
        margin: 12px 0;
        padding: 12px;
        border: 1px solid #e5e1d7;
        border-radius: 8px;
        background: #ffffff;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        font-size: 13px;
        line-height: 1.5;
      }

      #noh-cv-upload-panel .noh-upload-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 9px;
        margin-top: 14px;
      }

      #noh-cv-upload-panel button {
        cursor: pointer;
      }

      #noh-cv-upload-panel button:disabled {
        cursor: not-allowed;
        opacity: .55;
      }

      #noh-cv-review-result {
        margin-top: 18px;
        padding: 16px;
        border: 1px solid #e5e1d7;
        border-radius: 9px;
        background: #ffffff;
      }

      #noh-cv-review-result h4 {
        margin: 0 0 12px;
        color: #075b3b;
      }

      #noh-cv-improved-text {
        max-height: 520px;
        overflow: auto;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        line-height: 1.65;
        font-size: 14px;
      }

      #noh-cv-upload-panel .noh-upload-warning {
        color: #755a20;
        font-size: 13px;
      }

      @media (max-width: 600px) {
        #noh-cv-upload-panel {
          padding: 14px;
        }

        #noh-cv-upload-panel .noh-upload-actions button {
          width: 100%;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function createButton(label, className = "button button-secondary") {
    const button = document.createElement("button");

    button.type = "button";
    button.className = className;
    button.textContent = label;

    return button;
  }

  function createPanel() {
    const section = $("ai-assistant");

    if (!section || $("noh-cv-upload-panel")) return;

    installStyles();

    const panel = document.createElement("div");
    panel.id = "noh-cv-upload-panel";

    const heading = document.createElement("h3");
    heading.textContent = "Upload Your Existing CV";

    const description = document.createElement("p");
    description.textContent =
      "Already have a CV? Upload it for an AI review and professional improvement. You can review the result before applying changes to your CV Builder.";

    const help = document.createElement("p");
    help.className = "noh-upload-help";
    help.textContent =
      "Supported formats: PDF, DOCX and TXT. Maximum file size: 8 MB. Your original file is processed in your browser and is not uploaded or permanently stored.";

    const fileInput = document.createElement("input");
    fileInput.id = "noh-cv-file";
    fileInput.type = "file";
    fileInput.accept = ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";
    fileInput.setAttribute("aria-label", "Choose your existing CV");

    const status = document.createElement("p");
    status.id = "noh-cv-upload-status";
    status.setAttribute("role", "status");
    status.textContent = "No CV selected.";

    const preview = document.createElement("pre");
    preview.id = "noh-cv-text-preview";
    preview.hidden = true;

    const actions = document.createElement("div");
    actions.className = "noh-upload-actions";

    const reviewButton = createButton(
      "Review and Improve My CV",
      "button button-primary"
    );
    reviewButton.id = "noh-cv-review-button";
    reviewButton.disabled = true;

    const clearButton = createButton("Remove Selected CV");
    clearButton.id = "noh-cv-clear-button";
    clearButton.disabled = true;

    actions.append(reviewButton, clearButton);

    const result = document.createElement("div");
    result.id = "noh-cv-review-result";
    result.hidden = true;

    const warning = document.createElement("p");
    warning.className = "noh-upload-warning";
    warning.textContent =
      "Review the improved CV carefully. AI must not invent qualifications, dates, employers or achievements.";

    panel.append(
      heading,
      description,
      help,
      fileInput,
      status,
      preview,
      actions,
      result,
      warning
    );

    const existingActions = section.querySelector(".ai-actions");

    if (existingActions && existingActions.parentNode) {
  existingActions.parentNode.insertBefore(panel, existingActions);
} else {
  section.appendChild(panel);
}
    fileInput.addEventListener("change", handleFileSelection);
    reviewButton.addEventListener("click", reviewUploadedCV);
    clearButton.addEventListener("click", clearUpload);
  }

  async function extractPDF(file) {
    await loadScript(PDF_JS, () => Boolean(window.pdfjsLib));

    const pdfjs = window.pdfjsLib;

    pdfjs.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

    const buffer = await file.arrayBuffer();

    const pdf = await pdfjs.getDocument({
      data: new Uint8Array(buffer)
    }).promise;

    const pages = [];
    let characterCount = 0;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();

      const pageText = content.items
        .map((item) => item.str || "")
        .join(" ");

      pages.push(pageText);
      characterCount += pageText.length;

      if (characterCount >= MAX_CV_TEXT * 2) break;
    }

    return pages.join("\n\n");
  }

  async function extractDOCX(file) {
    await loadScript(
      MAMMOTH_JS,
      () => Boolean(window.mammoth)
    );

    const buffer = await file.arrayBuffer();

    const result = await window.mammoth.extractRawText({
      arrayBuffer: buffer
    });

    return result.value || "";
  }

  async function extractTXT(file) {
    return await file.text();
  }

  function normaliseText(text) {
    return String(text || "")
      .replace(/\r/g, "\n")
      .replace(/\u0000/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  async function handleFileSelection(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    const status = $("noh-cv-upload-status");
    const preview = $("noh-cv-text-preview");
    const reviewButton = $("noh-cv-review-button");
    const clearButton = $("noh-cv-clear-button");
    const result = $("noh-cv-review-result");

    selectedFile = null;
    extractedText = "";
    improvedCV = "";

    preview.hidden = true;
    preview.textContent = "";
    result.hidden = true;
    result.replaceChildren();

    reviewButton.disabled = true;
    clearButton.disabled = true;

    if (file.size > MAX_FILE_SIZE) {
      status.textContent =
        "This file is larger than 8 MB. Please choose a smaller CV.";
      event.target.value = "";
      return;
    }

    const extension = file.name.split(".").pop().toLowerCase();

    if (!["pdf", "docx", "txt"].includes(extension)) {
      status.textContent =
        "Unsupported file. Please select a PDF, DOCX or TXT document.";
      event.target.value = "";
      return;
    }

    status.textContent = "Reading your CV...";

    try {
      let text;

      if (extension === "pdf") {
        text = await extractPDF(file);
      } else if (extension === "docx") {
        text = await extractDOCX(file);
      } else {
        text = await extractTXT(file);
      }

      text = normaliseText(text);

      if (text.length < 80) {
        throw new Error(
          "Very little readable text was found. If your PDF is a scanned image, please use a text-based PDF or DOCX file."
        );
      }

      extractedText = text.slice(0, MAX_CV_TEXT);
      selectedFile = file;

      status.textContent =
        `${file.name} is ready. ${text.length > MAX_CV_TEXT
          ? "The extracted text was shortened to the 8,000-character processing limit."
          : "Your CV text was extracted successfully."}`;

      preview.textContent =
        extractedText.slice(0, 1800) +
        (extractedText.length > 1800
          ? "\n\n[Preview shortened. The full extracted text will be used for the review.]"
          : "");

      preview.hidden = false;
      reviewButton.disabled = false;
      clearButton.disabled = false;

    } catch (error) {
      console.error("[NOH CV Upload] Extraction error:", error);

      status.textContent =
        error.message || "Unable to read this CV. Please try another file.";
    }
  }

  function getSupabaseClient() {
    if (window.NOH_SUPABASE_CLIENT) {
      return window.NOH_SUPABASE_CLIENT;
    }

    if (
      window.supabase &&
      typeof window.supabase.createClient === "function"
    ) {
      window.NOH_SUPABASE_CLIENT =
        window.supabase.createClient(
          SUPABASE_URL,
          SUPABASE_KEY
        );

      return window.NOH_SUPABASE_CLIENT;
    }

    return null;
  }

  async function getAccessToken() {
    const client = getSupabaseClient();

    if (!client) return null;

    try {
      const { data, error } = await client.auth.getSession();

      if (error) return null;

      return data?.session?.access_token || null;

    } catch (error) {
      console.warn("[NOH CV Upload] Session check failed:", error);
      return null;
    }
  }

  function fieldValue(id) {
    const element = $(id);
    return element ? String(element.value || "").trim() : "";
  }

  function getCandidateData() {
    return {
      fullName: fieldValue("full-name"),
      email: fieldValue("email"),
      phone: fieldValue("phone"),
      location: [
        fieldValue("location"),
        fieldValue("country")
      ].filter(Boolean).join(", "),
      jobTitle: fieldValue("job-title"),
      summary: fieldValue("summary"),
      education: fieldValue("education"),
      experience: fieldValue("experience"),
      skills: fieldValue("skills"),
      certificates: fieldValue("certificates"),
      cvText: extractedText
    };
  }

  function showSignInMessage() {
    const status = $("noh-cv-upload-status");

    if (status) {
      status.textContent =
        "Please sign in to your Naija Opportunity Hub account before using CV review.";
    }

    const returnTo = encodeURIComponent(
      `${window.location.pathname}${window.location.search}#ai-assistant`
    );

    const link = document.createElement("a");
    link.href = `auth.html?mode=login&redirect=${returnTo}`;
    link.className = "button button-primary";
    link.textContent = "Sign in or create a free account";

    const panel = $("noh-cv-upload-panel");
    panel.appendChild(link);
  }

  async function reviewUploadedCV() {
    if (processing || !extractedText) return;

    const status = $("noh-cv-upload-status");
    const reviewButton = $("noh-cv-review-button");
    const resultBox = $("noh-cv-review-result");

    const token = await getAccessToken();

    if (!token) {
      showSignInMessage();
      return;
    }

    processing = true;
    reviewButton.disabled = true;
    reviewButton.textContent = "Reviewing Your CV...";

    status.textContent =
      "Your CV is being reviewed. This may take a little time.";

    resultBox.hidden = true;
    resultBox.replaceChildren();

    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      105000
    );

    try {
      const response = await fetch(AI_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          action: "improve-cv",
          ...getCandidateData()
        }),
        signal: controller.signal
      });

      let data;

      try {
        data = await response.json();
      } catch {
        throw new Error("The AI service returned an unreadable response.");
      }

      if (response.status === 401 || response.status === 403) {
        showSignInMessage();
        return;
      }

      if (!response.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : `CV review failed (${response.status}). Please try again.`
        );
      }

      if (typeof data.result !== "string" || !data.result.trim()) {
        throw new Error("The AI did not return an improved CV.");
      }

      improvedCV = data.result.trim();

      renderImprovedCV();

      status.textContent =
        "Your CV review is complete. Read the result before applying any changes.";

    } catch (error) {
      console.error("[NOH CV Upload] Review error:", error);

      status.textContent =
        error.name === "AbortError"
          ? "The CV review took too long. Please try again."
          : error.message || "Unable to review your CV. Please try again.";

    } finally {
      window.clearTimeout(timeout);
      controller.abort();

      processing = false;
      reviewButton.disabled = !extractedText;
      reviewButton.textContent = "Review and Improve My CV";
    }
  }

  function renderImprovedCV() {
    const resultBox = $("noh-cv-review-result");

    resultBox.replaceChildren();
    resultBox.hidden = false;

    const heading = document.createElement("h4");
    heading.textContent = "Your Improved CV — Review Before Applying";

    const text = document.createElement("div");
    text.id = "noh-cv-improved-text";
    text.textContent = improvedCV;

    const actions = document.createElement("div");
    actions.className = "noh-upload-actions";

    const copyButton = createButton("Copy Improved CV");
    const applyButton = createButton(
      "Apply Reviewed Sections to CV Builder",
      "button button-primary"
    );

    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(improvedCV);
        copyButton.textContent = "Copied Successfully";
      } catch {
        window.alert("Please select and copy the improved CV manually.");
      }
    });

    applyButton.addEventListener("click", applyImprovedCV);

    actions.append(copyButton, applyButton);
    resultBox.append(heading, text, actions);

    resultBox.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }

  function classifyHeading(line) {
    const heading = line
      .replace(/^#+\s*/, "")
      .replace(/[*_`]/g, "")
      .replace(/:$/, "")
      .trim()
      .toLowerCase();

    if (/^(professional summary|professional profile|profile|summary|personal profile|research profile)$/.test(heading)) {
      return "summary";
    }

    if (/^(work experience|professional experience|employment history|career history|experience|research and professional experience|experience and projects)$/.test(heading)) {
      return "experience";
    }

    if (/^(education|educational background|academic qualifications)$/.test(heading)) {
      return "education";
    }

    if (/^(skills|key skills|core skills|technical skills|competencies)$/.test(heading)) {
      return "skills";
    }

    if (/^(certifications|certificates|certifications and training|training|professional development|awards grants and training)$/.test(heading)) {
      return "certificates";
    }

    return null;
  }

  function extractImprovedSections(text) {
    const sections = {
      summary: "",
      experience: "",
      education: "",
      skills: "",
      certificates: ""
    };

    let current = null;

    const lines = String(text || "").split(/\r?\n/);

    for (const originalLine of lines) {
      const line = originalLine.trim();

      if (!line) {
        if (current && sections[current]) {
          sections[current] += "\n";
        }
        continue;
      }

      const heading = classifyHeading(line);

      if (heading) {
        current = heading;
        continue;
      }

      // Ignore non-section headings rather than accidentally
      // inserting the candidate's name or contact details into a field.
      if (/^#{1,3}\s+/.test(line)) {
        current = null;
        continue;
      }

      if (current) {
        sections[current] +=
          (sections[current] ? "\n" : "") + line;
      }
    }

    Object.keys(sections).forEach((key) => {
      sections[key] = sections[key].trim();
    });

    return sections;
  }

  function applyImprovedCV() {
    const sections = extractImprovedSections(improvedCV);

    const fieldMap = {
      summary: "summary",
      experience: "experience",
      education: "education",
      skills: "skills",
      certificates: "certificates"
    };

    const available = Object.entries(fieldMap).filter(
      ([key]) => sections[key]
    );

    if (!available.length) {
      window.alert(
        "The AI result did not contain recognisable CV sections. You can still copy the improved CV and paste it into your builder manually."
      );
      return;
    }

    const names = available.map(([key]) => ({
      summary: "Professional Summary",
      experience: "Work Experience",
      education: "Education",
      skills: "Skills",
      certificates: "Certifications and Training"
    })[key]);

    const confirmed = window.confirm(
      "Apply these improved sections to your CV Builder?\n\n" +
      names.map((name) => "• " + name).join("\n") +
      "\n\nExisting text in these sections will be replaced. Your name, contact details, template, theme and other settings will remain unchanged."
    );

    if (!confirmed) return;

    available.forEach(([key, id]) => {
      const field = $(id);

      if (!field) return;

      field.value = sections[key];
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const preview = $("document-preview");

    if (preview) {
      preview.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }

    const status = $("noh-cv-upload-status");

    if (status) {
      status.textContent =
        "Approved sections have been added to your CV Builder. Check the preview and make any final corrections.";
    }
  }

  function clearUpload() {
    if (processing) return;

    selectedFile = null;
    extractedText = "";
    improvedCV = "";

    const input = $("noh-cv-file");
    const status = $("noh-cv-upload-status");
    const preview = $("noh-cv-text-preview");
    const result = $("noh-cv-review-result");

    if (input) input.value = "";

    if (status) status.textContent = "No CV selected.";

    if (preview) {
      preview.textContent = "";
      preview.hidden = true;
    }

    if (result) {
      result.replaceChildren();
      result.hidden = true;
    }

    const reviewButton = $("noh-cv-review-button");
    const clearButton = $("noh-cv-clear-button");

    if (reviewButton) reviewButton.disabled = true;
    if (clearButton) clearButton.disabled = true;
  }

  function initialise() {
    if (!$("career-form") || !$("ai-assistant")) return;

    window.NOH_CV_UPLOAD_LOADED = true;
    createPanel();

    console.info(
      "[NOH Career Kit] CV upload and AI review module loaded."
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialise);
  } else {
    initialise();
  }
})();
