
(() => {
  "use strict";

  const params = new URLSearchParams(window.location.search);

  if ((params.get("tool") || "cv") !== "cv") return;

  const requestedTemplate = params.get("template");

  const validTemplates = new Set([
    "classic",
    "modern",
    "executive",
    "graduate",
    "sidebar",
    "ats",
    "academic",
    "scholarship",
    "nigerian",
    "europass",
    "onepage",
    "creative",
    "signature"
  ]);

  if (!validTemplates.has(requestedTemplate)) return;

  const templateSelect = document.getElementById("template");

  if (!templateSelect) return;

  const matchingOption = Array.from(templateSelect.options).find(
    (option) => option.value === requestedTemplate
  );

  if (!matchingOption) return;

  templateSelect.value = requestedTemplate;
  templateSelect.dataset.nohRequestedTemplate = requestedTemplate;
})();
