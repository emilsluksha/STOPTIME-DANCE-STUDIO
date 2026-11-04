(() => {
  "use strict";

  const config = window.STOPTIME_CONFIG || {};
  const contactEmail = config.contactEmail || "stop_time@inbox.lv";
  const applicationEmail = config.applicationEmail || "gribudejot_stoptime@inbox.lv";
  const subject = "STOPTIME — pieteikums izmēģinājuma nodarbībai";
  const emailLink = `mailto:${applicationEmail}?subject=${encodeURIComponent(subject)}`;
  let endpoint = null;
  try {
    const url = new URL(config.formEndpoint);
    if (url.origin === "https://script.google.com" && /^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname)) endpoint = url.href;
  } catch { /* Configuration is checked again before submitting. */ }

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
    ], { duration: 2500, easing: "ease-in-out", fill: "both" });
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
  const defaultLabel = "Nosūtīt pieteikumu";
  let opener = null;
  let submitting = false;
  let submitted = false;
  let attempt = null;
  let openedAt = Date.now();
  const fileInput = form.elements.namedItem("document");
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
      openedAt = Date.now();
      dialog.showModal();
      document.body.classList.add("dialog-open");
    });
  });
  dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    document.body.classList.remove("dialog-open");
    if (opener?.isConnected) opener.focus();
  });
  form.addEventListener("input", (event) => {
    event.target.setCustomValidity?.("");
    if (submitting) return;
    status.hidden = true;
    submitted = false;
    attempt = null;
    submitButton.disabled = false;
    submitButton.textContent = defaultLabel;
  });
  function validateFile() {
    const file = fileInput.files[0];
    fileInput.setCustomValidity(!file ? "Pievieno aizpildītu iesniegumu." :
      !/\.(docx|doc|pdf)$/i.test(file.name) ? "Izvēlies DOCX, DOC vai PDF failu." :
      !file.size || file.size > 5 * 1024 * 1024 ? "Fails nedrīkst būt tukšs vai lielāks par 5 MB." : "");
    return fileInput.validity.valid;
  }
  fileInput.addEventListener("change", validateFile);
  const readFile = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Neizdevās nolasīt failu. Pievieno to vēlreiz."));
    reader.readAsDataURL(file);
  });
  // HTML form POST + a correlated acknowledgement avoids cross-origin fetch/CORS
  // issues with Google's redirects. Loading an iframe alone never means success.
  function deliver(payload) {
    return new Promise((resolve, reject) => {
      const frame = document.createElement("iframe");
      frame.name = "stoptime-" + payload.requestId;
      frame.className = "application-transport";
      frame.title = "Pieteikuma nosūtīšana";
      const transport = document.createElement("form");
      transport.method = "post";
      transport.action = endpoint;
      transport.target = frame.name;
      transport.hidden = true;
      const field = document.createElement("input");
      field.type = "hidden";
      field.name = "payload";
      field.value = JSON.stringify(payload);
      transport.append(field);
      let timeout;
      const cleanup = () => {
        clearTimeout(timeout);
        window.removeEventListener("message", receive);
        transport.remove();
        frame.remove();
      };
      const receive = event => {
        if (!/^https:\/\/[a-z0-9-]+\.googleusercontent\.com$/.test(event.origin)) return;
        const result = event.data;
        if (!result || result.type !== "stoptime-result" || result.requestId !== payload.requestId) return;
        cleanup();
        if (result.ok === true) resolve(result);
        else reject(new Error(result.message || "Neizdevās nosūtīt pieteikumu. Mēģini vēlreiz."));
      };
      window.addEventListener("message", receive);
      timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Nosūtīšanas apstiprinājums nav saņemts. Dati paliek anketā. Mēģini vēlreiz; atkārtota nosūtīšana izmanto to pašu pieteikuma numuru."));
      }, 90000);
      document.body.append(frame, transport);
      HTMLFormElement.prototype.submit.call(transport);
    });
  }
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (submitting || submitted) return;
    for (const key of ["firstName", "lastName"]) {
      const input = form.elements.namedItem(key);
      input.value = input.value.trim();
      input.setCustomValidity(input.value ? "" : "Aizpildi šo lauku.");
    }
    validateFile();
    if (!form.reportValidity()) return;
    if (!endpoint) {
      showStatus("Pieteikumu nosūtīšana vēl nav pieslēgta. Lūdzu, nosūti aizpildīto iesniegumu uz " + applicationEmail + ".", "error");
      return;
    }
    if (form.elements.namedItem("website").value) return;
    submitting = true;
    const controls = Array.from(form.elements);
    form.setAttribute("aria-busy", "true");
    submitButton.textContent = "Nosūta…";
    showStatus("Nosūta iesniegumu. Lūdzu, neaizver šo lapu…", "info");
    try {
      const payload = {
        requestId: attempt || crypto.randomUUID(),
        origin: location.origin,
        firstName: form.elements.namedItem("firstName").value,
        lastName: form.elements.namedItem("lastName").value,
        phone: form.elements.namedItem("phone").value.trim(),
        consent: form.elements.namedItem("consent").checked,
        website: "",
        elapsed: Date.now() - openedAt,
        fileName: fileInput.files[0].name,
        fileBase64: await readFile(fileInput.files[0])
      };
      attempt = payload.requestId;
      controls.forEach(control => { control.disabled = true; });
      await deliver(payload);
      submitted = true;
      form.reset();
      showStatus("Paldies! Google pasta pakalpojums ir pieņēmis pieteikumu nosūtīšanai studijai.", "success");
    } catch (error) {
      showStatus(error.message || "Neizdevās nosūtīt. Mēģini vēlreiz vai raksti uz " + applicationEmail + ".", "error");
    } finally {
      submitting = false;
      form.removeAttribute("aria-busy");
      controls.forEach(control => { control.disabled = false; });
      submitButton.disabled = submitted;
      submitButton.textContent = submitted ? "Pieteikums nosūtīts" : defaultLabel;
    }
  });

})();
