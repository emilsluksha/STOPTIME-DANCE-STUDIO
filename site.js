(() => {
  "use strict";

  const config = window.STOPTIME_CONFIG || {};
  const contactEmail = config.contactEmail || "stop_time@inbox.lv";
  const applicationEmail = config.applicationEmail || "gribudejot_stoptime@inbox.lv";
  const useFormSubmit = config.deliveryMode === "formsubmit";
  const subject = "STOPTIME — pieteikums izmēģinājuma nodarbībai";
  const emailLink = `mailto:${applicationEmail}?subject=${encodeURIComponent(subject)}`;
  let endpoint = null;
  try {
    const url = new URL(useFormSubmit ? `https://formsubmit.co/${applicationEmail}` : config.formEndpoint);
    if (url.protocol === "https:" && !url.username && !url.password) endpoint = url.href;
  } catch { /* No configured endpoint: use the explicit email-draft flow. */ }

  const nav = document.querySelector("nav");
  const menuToggle = document.querySelector(".menu-toggle");
  const closeMenu = () => {
    nav.dataset.menuOpen = "false";
    menuToggle.setAttribute("aria-expanded", "false");
  };
  nav.dataset.menuReady = "true";
  menuToggle.hidden = false;
  menuToggle.addEventListener("click", () => {
    const open = menuToggle.getAttribute("aria-expanded") !== "true";
    menuToggle.setAttribute("aria-expanded", String(open));
    nav.dataset.menuOpen = String(open);
  });
  nav.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { closeMenu(); menuToggle.focus(); }
  });
  nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));

  const aboutToggle = document.querySelector(".about-toggle");
  const aboutContent = document.querySelector("#studija");
  let aboutAnimation = null;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const setAboutOpen = (open, animate = true) => {
    // Capture the visible position before cancelling, so a second click reverses smoothly.
    const wasHidden = aboutContent.hidden;
    const startHeight = wasHidden ? 0 : aboutContent.getBoundingClientRect().height;
    const startMargin = wasHidden ? "0px" : getComputedStyle(aboutContent).marginTop;
    const startOpacity = wasHidden ? "0" : getComputedStyle(aboutContent).opacity;
    aboutAnimation?.cancel();
    aboutAnimation = null;
    aboutToggle.setAttribute("aria-expanded", String(open));
    aboutToggle.textContent = open ? "Rādīt mazāk" : "Skatīt vairāk";
    aboutContent.inert = !open;
    if (!animate || reducedMotion.matches || typeof aboutContent.animate !== "function") {
      aboutContent.hidden = !open;
      aboutContent.style.overflow = "";
      return;
    }
    aboutContent.hidden = false;
    const endHeight = open ? aboutContent.getBoundingClientRect().height : 0;
    aboutContent.style.overflow = "hidden";
    const animation = aboutContent.animate([
      { height: `${startHeight}px`, marginTop: startMargin, opacity: startOpacity },
      { height: `${endHeight}px`, marginTop: open ? "36px" : "0px", opacity: open ? 1 : 0 }
    ], { duration: 520, easing: "cubic-bezier(.22, 1, .36, 1)", fill: "both" });
    aboutAnimation = animation;
    animation.onfinish = () => {
      if (aboutAnimation !== animation) return;
      aboutContent.hidden = !open;
      aboutContent.style.overflow = "";
      animation.cancel();
      aboutAnimation = null;
    };
  };
  setAboutOpen(false, false);
  aboutToggle.setAttribute("role", "button");
  aboutToggle.addEventListener("click", (event) => {
    event.preventDefault();
    setAboutOpen(aboutToggle.getAttribute("aria-expanded") !== "true");
  });
  aboutToggle.addEventListener("keydown", (event) => {
    if (event.key === " ") { event.preventDefault(); aboutToggle.click(); }
  });
  const revealAnchor = (hash) => {
    if (!["#studija", "#virzieni", "#filiales"].includes(hash)) return;
    // Anchor navigation needs the final layout before scrolling to its destination.
    setAboutOpen(true, false);
    requestAnimationFrame(() => document.querySelector(hash).scrollIntoView());
  };
  document.querySelectorAll('a[href="#virzieni"], a[href="#filiales"]').forEach((link) => {
    link.addEventListener("click", () => revealAnchor(link.hash));
  });
  window.addEventListener("hashchange", () => revealAnchor(location.hash));
  revealAnchor(location.hash);

  const mapLink = document.querySelector(".mapfb .btn");
  mapLink.textContent = "Ielādēt karti";
  mapLink.addEventListener("click", (event) => {
    event.preventDefault();
    const map = document.createElement("iframe");
    map.title = "STOPTIME Dance Studio — 18. novembra iela 18A, Daugavpils";
    map.src = "https://www.google.com/maps?q=18.+novembra+iela+18A,+Daugavpils&output=embed";
    map.referrerPolicy = "no-referrer-when-downgrade";
    map.allowFullscreen = true;
    document.querySelector(".mapbox").replaceChildren(map);
  });

  document.querySelectorAll("[data-contact-email]").forEach((link) => {
    link.href = `mailto:${contactEmail}`;
    link.textContent = contactEmail;
  });
  document.querySelectorAll("[data-application-email]").forEach((link) => {
    link.href = `mailto:${applicationEmail}`;
    link.textContent = applicationEmail;
  });

  const dialog = document.querySelector("#application-dialog");
  const form = document.querySelector("#application-form");
  const status = document.querySelector("#form-status");
  const submitButton = form.querySelector('[type="submit"]');
  const deliveryNote = document.querySelector("#delivery-note");
  const defaultLabel = endpoint ? "Nosūtīt pieteikumu" : "Sagatavot e-pastu";
  let opener = null;
  let submitting = false;
  let submitted = false;

  if (endpoint) {
    form.action = endpoint;
    submitButton.textContent = defaultLabel;
    deliveryNote.textContent = "Pieteikums tiks nosūtīts studijai. Sazināsimies ar tevi, lai vienotos par nodarbības laiku.";
    if (useFormSubmit) {
      deliveryNote.textContent = "Pieteikumu uz " + applicationEmail + " nosūtām ar FormSubmit. Nākamajā solī, ja nepieciešams, apstiprini, ka neesi robots.";
      form.elements.namedItem("subject").name = "_subject";
      form.elements.namedItem("_gotcha").name = "_honey";
    }
  }
  const showStatus = (message, state) => {
    status.textContent = message;
    status.dataset.state = state;
    status.hidden = false;
  };
  document.querySelectorAll("[data-open-application]").forEach((link) => {
    link.href = emailLink;
    if (typeof dialog.showModal !== "function") return;
    link.setAttribute("aria-haspopup", "dialog");
    link.setAttribute("aria-controls", "application-dialog");
    link.addEventListener("click", (event) => {
      event.preventDefault();
      opener = link;
      dialog.showModal();
      document.body.classList.add("dialog-open");
    });
  });
  dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    document.body.classList.remove("dialog-open");
    if (opener?.isConnected) opener.focus();
  });
  form.addEventListener("input", () => {
    if (submitting) return;
    status.hidden = true;
    submitted = false;
    submitButton.disabled = false;
    submitButton.textContent = defaultLabel;
  });
  window.addEventListener("pageshow", () => {
    // Restore the button if the visitor returns from the external verification page.
    if (!useFormSubmit) return;
    submitting = false;
    submitButton.disabled = false;
    submitButton.textContent = defaultLabel;
    status.hidden = true;
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitting || submitted || !form.reportValidity()) return;
    const name = form.elements.namedItem("name");
    name.setCustomValidity(name.value.trim() ? "" : "Lūdzu, norādi savu vārdu un uzvārdu.");
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    if (String(data.get(useFormSubmit ? "_honey" : "_gotcha") || "").trim()) return;
    data.set("name", name.value.trim());

    if (useFormSubmit && endpoint) {
      // Native POST preserves FormSubmit's CAPTCHA and first-use email activation.
      // A redirect is not treated as proof that the email reached the inbox.
      name.value = name.value.trim();
      submitting = true;
      submitButton.disabled = true;
      submitButton.textContent = "Nosūta…";
      HTMLFormElement.prototype.submit.call(form);
      return;
    }

    if (!endpoint) {
      const body = [
        "Pieteikums izmēģinājuma nodarbībai", "",
        `Vārds un uzvārds: ${data.get("name")}`,
        `E-pasts: ${data.get("email")}`,
        `Tālrunis: ${data.get("phone") || "Nav norādīts"}`,
        `Pilsēta: ${data.get("city")}`,
        `Deju virziens: ${data.get("style")}`, "",
        `Ziņa: ${data.get("message") || "Nav norādīta"}`, "",
        "Piekrītu, ka STOPTIME sazinās ar mani par šo pieteikumu."
      ].join("\n");
      showStatus("Vēstule ir sagatavota. Nosūti to savā e-pasta lietotnē. Ja lietotne neatveras, raksti uz " + applicationEmail + ". Pieteikums no šīs lapas vēl nav nosūtīts.", "info");
      window.location.href = emailLink + "&body=" + encodeURIComponent(body);
      return;
    }

    submitting = true;
    Array.from(form.elements).forEach((control) => { control.disabled = true; });
    submitButton.textContent = "Nosūta…";
    form.setAttribute("aria-busy", "true");
    showStatus("Nosūta pieteikumu…", "info");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(endpoint, {
        method: "POST", body: data, headers: { Accept: "application/json" }, signal: controller.signal
      });
      if (!response.ok) throw new Error("Submission failed");
      submitted = true;
      form.reset();
      showStatus("Paldies! Tavs pieteikums ir nosūtīts. Sazināsimies ar tevi par nodarbības laiku.", "success");
    } catch {
      showStatus("Neizdevās apstiprināt pieteikuma nosūtīšanu. Tavi ievadītie dati ir saglabāti anketā. Mēģini vēlreiz vai raksti uz " + applicationEmail + ".", "error");
    } finally {
      clearTimeout(timeout);
      submitting = false;
      form.removeAttribute("aria-busy");
      Array.from(form.elements).forEach((control) => { control.disabled = false; });
      submitButton.disabled = submitted;
      submitButton.textContent = submitted ? "Pieteikums nosūtīts" : defaultLabel;
    }
  });
  form.elements.namedItem("name").addEventListener("input", (event) => event.target.setCustomValidity(""));
})();
