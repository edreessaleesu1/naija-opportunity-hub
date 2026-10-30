(() => {
  "use strict";

  const form = document.getElementById("assistance-form");
  const message = document.getElementById("form-message");
  const year = document.getElementById("current-year");

  const WHATSAPP_NUMBER = "2349026473284";

  if (year) {
    year.textContent = new Date().getFullYear();
  }

  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!form.reportValidity()) {
      return;
    }

    const fullName = document
      .getElementById("full-name")
      .value.trim();

    const email = document
      .getElementById("email")
      .value.trim();

    const phone = document
      .getElementById("phone")
      .value.trim();

    const assistanceType = document
      .getElementById("assistance-type")
      .value;

    const opportunityLink = document
      .getElementById("opportunity-link")
      .value.trim();

    const description = document
      .getElementById("description")
      .value.trim();

    const consent = document
      .getElementById("privacy-consent")
      .checked;

    if (!consent) {
      message.textContent =
        "Please agree to share your details before continuing.";
      return;
    }

    const whatsappMessage = [
      "Hello Naija Opportunity Hub!",
      "",
      "I would like to request application assistance.",
      "",
      "MY DETAILS",
      `Full name: ${fullName}`,
      `Email: ${email || "Not provided"}`,
      `WhatsApp number: ${phone}`,
      "",
      "REQUEST DETAILS",
      `Type of assistance: ${assistanceType}`,
      `Opportunity link: ${opportunityLink || "Not provided"}`,
      "",
      "What I need help with:",
      description,
      "",
      "Please let me know the next steps and any applicable service fees.",
      "",
      "Thank you."
    ].join("\n");

    const whatsappURL =
      `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`;

    message.textContent =
      "Opening WhatsApp. Please review your message and send it to our team.";

    window.location.assign(whatsappURL);
  });
})();
