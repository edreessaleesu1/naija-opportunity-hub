/* Naija Opportunity Hub: English/French switch + WhatsApp channel.
   Loaded with <script defer src="/noh-extras.js"></script> on public pages.
   Opportunity text itself (titles, descriptions) stays as published. */
(function () {
  "use strict";
  var WA = "https://whatsapp.com/channel/0029VbDzzkeEawdvnHayuc1M";
  var KEY = "noh_lang";
  var FR = {
    "Skip to opportunities":"Aller aux opportunités","Skip to content":"Aller au contenu",
    "Discover Opportunities. Build Your Future.":"Découvrez des opportunités. Construisez votre avenir.",
    "Discover opportunities":"Découvrez des opportunités",
    "Menu":"Menu","Home":"Accueil","Opportunities":"Opportunités","Career Kit":"Kit de carrière",
    "Install App":"Installer l’application","Active":"Actif","Me":"Moi",
    "My Account":"Mon compte","My Saved Opportunities":"Mes opportunités enregistrées",
    "Account Settings":"Paramètres du compte","Sign Out":"Se déconnecter","Log Out":"Se déconnecter",
    "OPPORTUNITIES FOR THE NEXT GENERATION":"DES OPPORTUNITÉS POUR LA NOUVELLE GÉNÉRATION",
    "Your Next Big":"Votre prochaine grande","Opportunity":"Opportunité","Starts Here.":"commence ici.",
    "Discover scholarships, jobs, grants, internships and career opportunities that move your future forward.":"Découvrez des bourses, emplois, subventions, stages et opportunités de carrière qui font avancer votre avenir.",
    "Explore Opportunities":"Explorer les opportunités","Build Your Career":"Construire votre carrière",
    "Scholarships":"Bourses","Jobs":"Emplois","Internships":"Stages","Fellowships":"Programmes de bourses (fellowships)",
    "Grants":"Subventions","Training":"Formations","Volunteering":"Bénévolat",
    "Links to Official Sources":"Liens vers les sources officielles","For Nigerian Students & Graduates":"Pour les étudiants et diplômés nigérians",
    "A Brighter Future Together":"Un avenir plus brillant, ensemble","YOUR NEXT OPPORTUNITY":"VOTRE PROCHAINE OPPORTUNITÉ",
    "Find Your Next Opportunity":"Trouvez votre prochaine opportunité",
    "Explore carefully organised opportunities to learn, grow and advance your career.":"Explorez des opportunités soigneusement classées pour apprendre, progresser et faire avancer votre carrière.",
    "Loading opportunities...":"Chargement des opportunités…","Loading opportunities…":"Chargement des opportunités…",
    "Unable to load opportunities.":"Impossible de charger les opportunités.",
    "No opportunities found. Try another search or category.":"Aucune opportunité trouvée. Essayez une autre recherche ou catégorie.",
    "Filter by category":"Filtrer par catégorie","All categories":"Toutes les catégories","Other":"Autre",
    "Sort opportunities":"Trier les opportunités","Newest first":"Plus récentes d’abord","Closing date":"Date de clôture",
    "Title A–Z":"Titre A–Z","Clear filters":"Effacer les filtres","View More":"Voir plus","Latest opportunities":"Dernières opportunités","‹ Prev":"‹ Préc.","Next ›":"Suiv. ›","View All":"Tout voir",
    "Always confirm eligibility, deadlines and application requirements on the official source before applying.":"Vérifiez toujours les critères d’éligibilité, les dates limites et les conditions de candidature sur la source officielle avant de postuler.",
    "YOUR CAREER TOOLBOX":"VOTRE BOÎTE À OUTILS DE CARRIÈRE","Make Your Next Application Your Best One.":"Faites de votre prochaine candidature la meilleure.",
    "Practical support for your CV, cover letters, scholarship and job applications, and how you present yourself.":"Un soutien pratique pour votre CV, vos lettres de motivation, vos candidatures aux bourses et aux emplois, et votre présentation.",
    "CAREER ESSENTIAL":"L’ESSENTIEL DE LA CARRIÈRE","Professional CV":"CV professionnel",
    "Create a clear, professional CV that highlights your education, skills, experience and achievements.":"Créez un CV clair et professionnel qui met en valeur votre formation, vos compétences, votre expérience et vos réalisations.",
    "Open Career Kit":"Ouvrir le kit de carrière","POPULAR SERVICE":"SERVICE POPULAIRE","MAKE A STRONG IMPRESSION":"FAITES BONNE IMPRESSION",
    "Cover Letters":"Lettres de motivation","Prepare tailored cover letters for jobs, scholarships, internships and other applications.":"Préparez des lettres de motivation adaptées aux emplois, bourses, stages et autres candidatures.",
    "APPLICATION SUPPORT":"AIDE À LA CANDIDATURE","Application Assistance":"Aide à la candidature",
    "Get help understanding application requirements and organising the information you need to apply.":"Obtenez de l’aide pour comprendre les conditions de candidature et organiser les informations nécessaires.",
    "SIMPLE AND TRANSPARENT":"SIMPLE ET TRANSPARENT","Career Kit services":"Services du kit de carrière",
    "Choose support that fits your needs.":"Choisissez l’aide qui correspond à vos besoins.",
    "CV writing and improvement":"Rédaction et amélioration de CV","Request a quote":"Demander un devis",
    "Cover letter preparation":"Préparation de lettres de motivation","Application guidance":"Conseils pour les candidatures",
    "Contact us for service details and pricing. Review all terms before making a payment.":"Contactez-nous pour les détails et les tarifs. Lisez toutes les conditions avant tout paiement.",
    "Your Future Is Full of Possibilities.":"Votre avenir est plein de possibilités.",
    "Take the next step. Discover opportunities that match your ambitions.":"Passez à l’étape suivante. Découvrez des opportunités à la hauteur de vos ambitions.",
    "Start Exploring":"Commencer à explorer",
    "Connecting Nigerian students and graduates with opportunities for learning, career development and growth.":"Nous mettons en relation les étudiants et diplômés nigérians avec des opportunités d’apprentissage, de développement de carrière et de croissance.",
    "Explore":"Explorer","Categories":"Catégories","Information":"Informations","Back to Top":"Haut de page",
    "Sign In / Create Account":"Connexion / Créer un compte","Contact":"Contact","Privacy Policy":"Politique de confidentialité",
    "Privacy":"Confidentialité","Terms":"Conditions","Terms of Use":"Conditions d’utilisation","Cookie settings":"Paramètres des cookies",
    "Built to help you discover your next opportunity.":"Conçu pour vous aider à découvrir votre prochaine opportunité.",
    "YOUR PERSONAL SPACE":"VOTRE ESPACE PERSONNEL","Overview":"Aperçu","Saved Opportunities":"Opportunités enregistrées","Settings":"Paramètres",
    "ACCOUNT OVERVIEW":"APERÇU DU COMPTE","Welcome to your account":"Bienvenue dans votre compte",
    "Your personal space to manage your account and follow your career opportunities.":"Votre espace personnel pour gérer votre compte et suivre vos opportunités.",
    "Track the opportunities you have saved.":"Suivez les opportunités que vous avez enregistrées.","Update your account password.":"Modifiez le mot de passe de votre compte.",
    "STAY ORGANISED":"RESTEZ ORGANISÉ","Your saved opportunities":"Vos opportunités enregistrées",
    "Keep track of the opportunities you want to pursue and update your progress as you apply.":"Gardez la trace des opportunités visées et mettez à jour votre progression.",
    "Export CSV":"Exporter en CSV","Clear all":"Tout effacer","SECURITY & PRIVACY":"SÉCURITÉ ET CONFIDENTIALITÉ",
    "Change your password":"Changer votre mot de passe","Choose a strong password that you do not use on other websites.":"Choisissez un mot de passe solide que vous n’utilisez pas ailleurs.",
    "New password":"Nouveau mot de passe","Confirm new password":"Confirmer le nouveau mot de passe","Update Password":"Mettre à jour le mot de passe",
    "Application status":"Statut de la candidature","View opportunity":"Voir l’opportunité","Open application":"Ouvrir la candidature","Remove":"Retirer",
    "Reset your password":"Réinitialiser votre mot de passe","Your NOH account":"Votre compte NOH",
    "Browse by category":"Parcourir par catégorie","Search scholarships, jobs, grants...":"Rechercher bourses, emplois, subventions…","Search opportunities":"Rechercher des opportunités",
    "Open navigation menu":"Ouvrir le menu de navigation","Main navigation":"Navigation principale","Open your account menu":"Ouvrir votre menu de compte",
    "Enter your new password":"Saisissez votre nouveau mot de passe","Confirm your new password":"Confirmez votre nouveau mot de passe",
    "Please complete all the required fields.":"Veuillez remplir tous les champs obligatoires.","Your passwords do not match.":"Vos mots de passe ne correspondent pas.",
    "Enter your email address and password.":"Saisissez votre adresse e-mail et votre mot de passe.","Enter your email address first.":"Saisissez d’abord votre adresse e-mail.",
    "Please complete both password fields.":"Veuillez remplir les deux champs de mot de passe.","Your new passwords do not match.":"Vos nouveaux mots de passe ne correspondent pas.",
    "We could not sign you out. Please try again.":"Nous n’avons pas pu vous déconnecter. Veuillez réessayer.",
    "You have no saved opportunities to clear.":"Vous n’avez aucune opportunité enregistrée à effacer.","You have no saved opportunities to export yet.":"Vous n’avez encore aucune opportunité enregistrée à exporter.",
    "← Home":"← Accueil","Loading…":"Chargement…","Closing soonest":"Clôture la plus proche","Show more":"Afficher plus",
    "Search this category":"Rechercher dans cette catégorie","Sort":"Trier","Opportunities by Category | Naija Opportunity Hub":"Opportunités par catégorie | Naija Opportunity Hub",
    "✓ Verified":"✓ Vérifiée","How we check":"Comment nous vérifions",
    "Not verified yet. Please confirm the details on the official website before you apply.":"Pas encore vérifiée. Veuillez confirmer les détails sur le site officiel avant de postuler.",
    "Account":"Compte","My Account | Naija Opportunity Hub":"Mon compte | Naija Opportunity Hub",
    "YOUR CAREER. YOUR FUTURE.":"VOTRE CARRIÈRE. VOTRE AVENIR.","Build your future, one opportunity at a time.":"Construisez votre avenir, une opportunité à la fois.",
    "Create your account to get started with your Career Kit and prepare for your next career opportunity.":"Créez votre compte pour commencer avec votre kit de carrière et préparer votre prochaine opportunité.",
    "CV and résumé assistance":"Aide pour le CV","Cover letter support":"Aide pour les lettres de motivation","Job application guidance":"Conseils pour les candidatures",
    "Interview preparation":"Préparation aux entretiens","Create your account":"Créez votre compte",
    "Join Naija Opportunity Hub and take the next step.":"Rejoignez Naija Opportunity Hub et passez à l’étape suivante.",
    "Email address":"Adresse e-mail","Password":"Mot de passe","Confirm password":"Confirmer le mot de passe","Create Free Account":"Créer un compte gratuit",
    "Already have an account?":"Vous avez déjà un compte ?","Log in":"Se connecter","Welcome back":"Bon retour","Log in to continue to your Career Kit.":"Connectez-vous pour accéder à votre kit de carrière.",
    "Log In":"Se connecter","Forgot password?":"Mot de passe oublié ?","Don't have an account?":"Pas encore de compte ?","Create one":"Créer un compte",
    "Set a new password":"Définir un nouveau mot de passe","Enter a new password for your account.":"Saisissez un nouveau mot de passe pour votre compte.",
    "Save New Password":"Enregistrer le nouveau mot de passe","Welcome to your Career Kit!":"Bienvenue dans votre kit de carrière !","Signed in as":"Connecté en tant que",
    "Explore Career Kit":"Explorer le kit de carrière","Browse Opportunities":"Parcourir les opportunités",
    "At least 8 characters":"Au moins 8 caractères","Enter your password again":"Saisissez à nouveau votre mot de passe","Your password":"Votre mot de passe","Enter your new password again":"Saisissez à nouveau votre nouveau mot de passe",
    "← Back to Opportunities":"← Retour aux opportunités","Details":"Détails","Loading opportunity...":"Chargement de l’opportunité…",
    "Please wait while we retrieve the opportunity details.":"Veuillez patienter pendant le chargement des détails.",
    "Opportunity unavailable":"Opportunité indisponible","We could not retrieve this opportunity.":"Nous n’avons pas pu charger cette opportunité.",
    "Return to Opportunities":"Retour aux opportunités","About This Opportunity":"À propos de cette opportunité","Eligibility Requirements":"Conditions d’éligibilité",
    "Opportunity Information":"Informations sur l’opportunité","Location":"Lieu","Application deadline":"Date limite de candidature","Published":"Publiée","Last verified":"Dernière vérification",
    "Application Information":"Informations de candidature","Not specified":"Non précisé","Apply Now →":"Postuler maintenant →",
    "Preparing saved opportunities...":"Préparation des opportunités enregistrées…","Share Opportunity":"Partager l’opportunité","← Browse More Opportunities":"← Voir plus d’opportunités",
    "Report a problem with this listing":"Signaler un problème avec cette annonce","View Original Source →":"Voir la source d’origine →","Quick Overview":"Aperçu rapide",
    "Category":"Catégorie","Organisation":"Organisation","Status":"Statut",
    "Contact us":"Contactez-nous","Report a listing, ask about career services or send us a question. We reply by email.":"Signalez une annonce, renseignez-vous sur nos services de carrière ou posez-nous une question. Nous répondons par e-mail.",
    "Send us a message":"Envoyez-nous un message","Your name":"Votre nom","What is this about?":"Quel est l’objet ?","General enquiry":"Demande générale",
    "Report an incorrect or suspicious opportunity":"Signaler une opportunité erronée ou suspecte","Career services request (CV, cover letter, guidance)":"Demande de services de carrière (CV, lettre, conseils)",
    "Partnership or listing an opportunity":"Partenariat ou publication d’une opportunité","Privacy request":"Demande relative à la vie privée","Technical problem with the site":"Problème technique avec le site",
    "Link to the opportunity or page":"Lien vers l’opportunité ou la page","(optional)":"(facultatif)","Your message":"Votre message","Send message":"Envoyer le message","Message sent":"Message envoyé",
    "Thank you. We have received your message and will reply to the email address you gave us.":"Merci. Nous avons bien reçu votre message et répondrons à l’adresse e-mail indiquée.",
    "Back to opportunities":"Retour aux opportunités","Before you write":"Avant d’écrire","Found a wrong deadline or link?":"Une date limite ou un lien erroné ?",
    "Choose “Report an incorrect or suspicious opportunity” and paste the link. It helps us fix it faster.":"Choisissez « Signaler une opportunité erronée ou suspecte » et collez le lien. Cela nous aide à corriger plus vite.",
    "Need help with your CV?":"Besoin d’aide pour votre CV ?","Your privacy":"Votre vie privée","Stay safe":"Restez prudent",
    "We will never ask you for a password. Genuine opportunities do not charge you to apply.":"Nous ne vous demanderons jamais votre mot de passe. Les vraies opportunités ne font pas payer la candidature.",
    "Tell us how we can help. Please do not include passwords or ID numbers.":"Dites-nous comment nous pouvons aider. N’indiquez ni mots de passe ni numéros d’identité.",
    "How we check opportunities":"Comment nous vérifions les opportunités","What the Verified label means, and how to protect yourself from scams.":"Ce que signifie l’étiquette « Vérifiée » et comment vous protéger des arnaques.",
    "What \"Verified\" means":"Ce que signifie « Vérifiée »","What we check":"Ce que nous vérifions","What it does not mean":"Ce que cela ne signifie pas","Staying safe":"Rester en sécurité","Found a problem?":"Un problème ?",
    "Join our WhatsApp channel":"Rejoignez notre chaîne WhatsApp","WhatsApp channel":"Chaîne WhatsApp","Language":"Langue","Nigeria-first, global opportunities":"Priorité au Nigeria, opportunités mondiales","Discover scholarships, jobs, grants, internships and fellowships in Nigeria and around the world, and the tools to apply with confidence.":"Découvrez des bourses, emplois, subventions, stages et fellowships au Nigeria et dans le monde, et les outils pour postuler avec confiance.","Connecting Nigerian students and graduates with scholarships, jobs and fellowships in Nigeria and around the world.":"Nous mettons en relation les étudiants et diplômés nigérians avec des bourses, emplois et fellowships au Nigeria et dans le monde.","Featuring opportunities from":"Opportunités proposées par","Listed to show where opportunities come from. No partnership is implied.":"Indiqué pour montrer l’origine des opportunités. Aucun partenariat n’est sous-entendu.","⏰ Remind me before the deadline":"⏰ Me rappeler avant la date limite","Add to Google Calendar":"Ajouter à Google Agenda","All opportunities":"Toutes les opportunités","Opportunity Details":"Détails de l’opportunité","Contact Us":"Contactez-nous","How We Check Opportunities":"Comment nous vérifions les opportunités","Invalid opportunity link":"Lien d’opportunité invalide","Naija Opportunity Hub":"Naija Opportunity Hub"
  };
  var MONTHS = {January:"janvier",February:"février",March:"mars",April:"avril",May:"mai",June:"juin",July:"juillet",August:"août",September:"septembre",October:"octobre",November:"novembre",December:"décembre"};
  var PATTERNS = [
    [/^on (\d{1,2}) (\w+) (\d{4})$/, function (m) { return "le " + m[1] + " " + (MONTHS[m[2]] || m[2]) + " " + m[3]; }],
    [/^Verified on (\d{1,2}) (\w+) (\d{4})$/, function (m) { return "Vérifiée le " + m[1] + " " + (MONTHS[m[2]] || m[2]) + " " + m[3]; }],
    [/^(\d+) opportunit(?:y|ies) found$/i, function (m) { return m[1] + " opportunité" + (m[1] === "1" ? "" : "s") + " trouvée" + (m[1] === "1" ? "" : "s"); }],
    [/^Showing (\d+) of (\d+)$/i, function (m) { return "Affichage de " + m[1] + " sur " + m[2]; }]
  ];
  var lang = "en";
  try { lang = localStorage.getItem(KEY) || ""; } catch (e) {}
  if (!lang) lang = /^fr/i.test(navigator.language || "") ? "fr" : "en";
  if (lang !== "fr") lang = "en";

  var origText = new WeakMap(), origAttr = new WeakMap(), busy = false;
  var ATTRS = ["placeholder", "aria-label", "title", "alt"];

  function tr(s) {
    var core = s.replace(/\s+/g, " ").trim();
    if (!core) return null;
    if (Object.prototype.hasOwnProperty.call(FR, core)) return FR[core];
    for (var i = 0; i < PATTERNS.length; i++) { var m = core.match(PATTERNS[i][0]); if (m) return PATTERNS[i][1](m); }
    return null;
  }
  function doText(n) {
    var cur = n.nodeValue, rec = origText.get(n);
    if (lang === "fr") {
      if (rec && rec.out === cur) return;
      var t = tr(cur);
      if (t === null) { if (rec) origText.delete(n); return; }
      var lead = (cur.match(/^\s*/) || [""])[0], trail = (cur.match(/\s*$/) || [""])[0];
      var out = lead + t + trail;
      origText.set(n, { orig: cur, out: out });
      n.nodeValue = out;
    } else if (rec) { if (n.nodeValue === rec.out) n.nodeValue = rec.orig; origText.delete(n); }
  }
  function doAttrs(el) {
    var store = origAttr.get(el) || {};
    ATTRS.forEach(function (a) {
      if (!el.hasAttribute(a)) return;
      var cur = el.getAttribute(a);
      if (lang === "fr") { var t = tr(store[a] !== undefined ? store[a] : cur); if (t !== null) { if (store[a] === undefined) store[a] = cur; if (cur !== t) el.setAttribute(a, t); } }
      else if (store[a] !== undefined) { el.setAttribute(a, store[a]); delete store[a]; }
    });
    origAttr.set(el, store);
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1) return;
    var tag = root.tagName;
    if (tag === "SCRIPT" || tag === "STYLE" || root.hasAttribute("data-no-translate")) return;
    doAttrs(root);
    for (var c = root.firstChild; c; c = c.nextSibling) walk(c);
  }
  function title() {
    var t = document.title, o = document.documentElement.getAttribute("data-noh-title");
    if (lang === "fr") {
      var base = o || t, x = tr(base);
      if (x === null) { var any = false; x = base.split(" | ").map(function (q) { var z = tr(q); if (z !== null) any = true; return z === null ? q : z; }).join(" | "); if (!any) x = null; }
      if (x !== null) { document.documentElement.setAttribute("data-noh-title", base); document.title = x; }
    } else if (o) { document.title = o; document.documentElement.removeAttribute("data-noh-title"); }
  }
  function apply() {
    busy = true;
    document.documentElement.lang = lang;
    walk(document.body); title(); markButtons();
    busy = false;
  }
  var obs = new MutationObserver(function (list) {
    if (busy) return;
    busy = true;
    list.forEach(function (m) {
      if (m.type === "childList") m.addedNodes.forEach(function (n) { walk(n); });
      else if (m.type === "characterData") doText(m.target);
      else if (m.type === "attributes") doAttrs(m.target);
    });
    busy = false;
  });

  function setLang(l) {
    lang = l === "fr" ? "fr" : "en";
    try { localStorage.setItem(KEY, lang); } catch (e) {}
    apply();
  }
  function markButtons() {
    document.querySelectorAll(".noh-lang button").forEach(function (b) {
      var on = b.getAttribute("data-l") === lang;
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  var CSS = ".noh-lang{display:inline-flex;align-items:center;gap:0;border:1px solid #c6a24a;border-radius:999px;overflow:hidden;background:#fffdf6;flex:0 0 auto;margin:0 6px}" +
    ".noh-lang button{font-weight:700;font-size:12px;line-height:1;font-family:inherit;border:0;background:transparent;color:#075b3b;padding:0 11px;min-height:34px;min-width:38px;cursor:pointer;letter-spacing:.04em}" +
    ".noh-lang button[aria-pressed=true]{background:#075b3b;color:#fffdf6}" +
    ".noh-lang button:focus-visible{outline:2px solid #c6a24a;outline-offset:-2px}" +
    ".noh-wa{position:fixed;left:14px;bottom:14px;z-index:900;display:inline-flex;align-items:center;gap:8px;background:#25d366;color:#053b1e;font-weight:700;font-size:14px;line-height:1;font-family:inherit;text-decoration:none;padding:0 16px 0 12px;min-height:46px;border-radius:999px;box-shadow:0 6px 18px rgba(3,60,41,.28)}" +
    ".noh-wa:hover{filter:brightness(1.05)}.noh-wa:focus-visible{outline:3px solid #075b3b;outline-offset:2px}" +
    ".noh-wa svg{width:24px;height:24px;fill:currentColor;flex:0 0 auto}" +
    "@media(max-width:640px){.noh-wa{padding:0;width:48px;min-height:48px;justify-content:center;left:12px;bottom:12px}.noh-wa span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}}" +
    ".noh-wa-link svg{width:1em;height:1em;vertical-align:-.12em;margin-right:6px;fill:currentColor}" +
    "@media print{.noh-wa,.noh-lang{display:none!important}}";
  var WA_PATH = "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z";
  function svg() { return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + WA_PATH + '"/></svg>'; }

  function build() {
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);

    /* language switch */
    var box = document.createElement("div");
    box.className = "noh-lang"; box.setAttribute("role", "group"); box.setAttribute("aria-label", "Language / Langue");
    box.setAttribute("data-no-translate", "");
    box.innerHTML = '<button type="button" data-l="en" lang="en" aria-label="English">EN</button><button type="button" data-l="fr" lang="fr" aria-label="Français">FR</button>';
    box.addEventListener("click", function (e) { var b = e.target.closest("button[data-l]"); if (b) setLang(b.getAttribute("data-l")); });
    var host = document.querySelector("#navLinks .nav-auth") || document.querySelector("header nav") || document.querySelector("header .wrap") || document.querySelector("header");
    if (host === document.querySelector("#navLinks .nav-auth")) host.insertBefore(box, host.firstChild); else if (host) host.appendChild(box); else { box.style.cssText = "position:fixed;top:8px;right:8px;z-index:900"; document.body.appendChild(box); }

    /* WhatsApp floating button */
    if (!document.querySelector(".noh-wa")) {
      var a = document.createElement("a");
      a.className = "noh-wa"; a.href = WA; a.target = "_blank"; a.rel = "noopener noreferrer";
      a.setAttribute("aria-label", "Join our WhatsApp channel");
      a.innerHTML = svg() + "<span>Join our WhatsApp channel</span>";
      document.body.appendChild(a);
    }
    /* footer link */
    var groups = document.querySelectorAll(".footer-links"), last = groups.length ? groups[groups.length - 1] : null;
    var fl = document.createElement("a");
    fl.className = "noh-wa-link"; fl.href = WA; fl.target = "_blank"; fl.rel = "noopener noreferrer";
    fl.innerHTML = svg() + "WhatsApp channel";
    if (last) last.appendChild(fl);
    else { var f = document.querySelector("footer .links") || document.querySelector("footer .wrap") || document.querySelector("footer"); if (f) f.appendChild(fl); }
  }

  function start() {
    build();
    apply();
    obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
