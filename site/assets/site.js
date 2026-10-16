(() => {
  const menu = document.querySelector(".menu-toggle");
  const nav = document.querySelector("#main-nav");
  if (menu && nav) {
    const closeMenu = () => {
      nav.removeAttribute("data-open");
      menu.setAttribute("aria-expanded", "false");
      menu.setAttribute("aria-label", "Open navigation");
    };
    menu.addEventListener("click", () => {
      const open = menu.getAttribute("aria-expanded") !== "true";
      nav.toggleAttribute("data-open", open);
      menu.setAttribute("aria-expanded", String(open));
      menu.setAttribute(
        "aria-label",
        open ? "Close navigation" : "Open navigation",
      );
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && nav.hasAttribute("data-open")) {
        closeMenu();
        menu.focus();
      }
    });
    nav.addEventListener("click", (event) => {
      if (event.target.closest("a")) closeMenu();
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".header-inner")) closeMenu();
    });
    matchMedia("(min-width: 481px)").addEventListener("change", closeMenu);
  }

  const search = document.querySelector("[data-search-input]");
  const year = document.querySelector("[data-year-select]");
  if (search && year) {
    const rows = [...document.querySelectorAll(".talk-row")];
    const count = document.querySelector("[data-result-count]");
    const empty = document.querySelector("[data-empty]");
    const normalize = (value) =>
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    const filter = () => {
      const terms = normalize(search.value).trim().split(/\s+/).filter(Boolean);
      let matches = 0;
      for (const row of rows) {
        const visible =
          (!year.value || row.dataset.year === year.value) &&
          terms.every((term) => normalize(row.dataset.search).includes(term));
        row.hidden = !visible;
        matches += Number(visible);
      }
      count.textContent = matches;
      empty.hidden = matches > 0;
    };
    search.addEventListener("input", filter);
    year.addEventListener("change", filter);
    document
      .querySelector("[data-clear-filters]")
      .addEventListener("click", () => {
        search.value = "";
        year.value = "";
        filter();
        search.focus();
      });
    // Browsers can restore form values when returning from a talk detail page.
    window.addEventListener("pageshow", filter);
    filter();
  }

  // Types banner labels out once; the full text stays available to assistive
  // technology and is shown immediately when motion is reduced.
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  for (const label of document.querySelectorAll("[data-typing]")) {
    if (reduced) continue;
    const text = label.textContent;
    label.setAttribute("aria-label", text);
    label.textContent = "";
    const typed = document.createElement("span");
    typed.setAttribute("aria-hidden", "true");
    const cursor = document.createElement("span");
    cursor.className = "typing-cursor";
    cursor.setAttribute("aria-hidden", "true");
    label.append(typed, cursor);
    let index = 0;
    const step = () => {
      typed.textContent = text.slice(0, ++index);
      if (index < text.length) setTimeout(step, 45 + Math.random() * 55);
    };
    setTimeout(step, 400);
  }

  // Seminar cards open a preview over the blurred page; without JavaScript
  // they remain ordinary links to the talk page.
  for (const card of document.querySelectorAll("[data-dialog]")) {
    const dialog = document.getElementById(card.dataset.dialog);
    if (!dialog?.showModal) continue;
    card.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey) return;
      event.preventDefault();
      dialog.showModal();
    });
  }
  for (const dialog of document.querySelectorAll(".talk-dialog")) {
    dialog.addEventListener("click", (event) => {
      const box = dialog.getBoundingClientRect();
      const outside =
        event.clientX < box.left ||
        event.clientX > box.right ||
        event.clientY < box.top ||
        event.clientY > box.bottom;
      // Keyboard activation reports no pointer position.
      if ((event.detail && outside) || event.target.closest("[data-close]"))
        dialog.close();
    });
  }

  // The homepage banner settles to a shorter height once the visitor scrolls.
  const landing = document.querySelector(".landing");
  if (landing) {
    let queued = false;
    const collapse = () => {
      queued = false;
      const progress = Math.min(1, Math.max(0, scrollY / 320));
      landing.style.setProperty("--collapse", progress.toFixed(3));
    };
    addEventListener(
      "scroll",
      () => {
        if (!queued) requestAnimationFrame(collapse);
        queued = true;
      },
      { passive: true },
    );
    collapse();
  }

  // A soft light follows the pointer around each card's frame.
  for (const card of document.querySelectorAll(".deck-card")) {
    card.addEventListener("pointermove", (event) => {
      const box = card.getBoundingClientRect();
      card.style.setProperty("--x", event.clientX - box.left + "px");
      card.style.setProperty("--y", event.clientY - box.top + "px");
    });
  }

  // Featured publications rotate every few seconds, pausing while a visitor
  // points at or focuses the panel.
  for (const carousel of document.querySelectorAll("[data-carousel]")) {
    const slides = [...carousel.querySelectorAll(".feature-slide")];
    const tabs = [...carousel.querySelectorAll('[role="tab"]')];
    let current = 0;
    let timer = 0;
    const show = (index) => {
      current = (index + slides.length) % slides.length;
      slides.forEach((slide, i) => (slide.hidden = i !== current));
      tabs.forEach((tab, i) => tab.setAttribute("aria-selected", String(i === current)));
    };
    const stop = () => {
      clearInterval(timer);
      carousel.removeAttribute("data-playing");
    };
    const play = () => {
      stop();
      if (reduced || slides.length < 2) return;
      // Restart the progress animation on the active tab.
      carousel.offsetWidth;
      carousel.setAttribute("data-playing", "");
      timer = setInterval(() => show(current + 1), 7000);
    };
    tabs.forEach((tab, index) =>
      tab.addEventListener("click", () => {
        show(index);
        stop();
      }),
    );
    carousel.addEventListener("pointerenter", stop);
    carousel.addEventListener("pointerleave", play);
    carousel.addEventListener("focusin", stop);
    play();
  }

  // Highlighted projects: three cards at a time, the highlighted one in the
  // middle. Each turn the middle card steps left and the next moves in from
  // the right; cards out of view wait off-stage on the side they will enter.
  for (const queue of document.querySelectorAll("[data-queue]")) {
    const cards = [...queue.querySelectorAll(".queue-card")];
    const counter = queue.querySelector("[data-queue-current]");
    let current = 0;
    const slotFor = (index) => {
      const offset = (index - current + cards.length) % cards.length;
      if (offset === 0) return "centre";
      if (offset === 1) return "right";
      if (offset === cards.length - 1) return "left";
      return null;
    };
    // The progress bar is the timer: when its fill reaches the end, the queue
    // advances. Hovering or focusing pauses the fill where it is.
    const bar = queue.querySelector(".queue-progress > span");
    const restartProgress = () => {
      queue.removeAttribute("data-playing");
      queue.offsetWidth;
      if (!reduced && cards.length > 1) queue.setAttribute("data-playing", "");
    };
    bar.addEventListener("animationend", () => move(1));
    const move = (step) => {
      current = (current + step + cards.length) % cards.length;
      const entering = step > 0 ? "right" : "left";
      cards.forEach((card, index) => {
        const slot = slotFor(index);
        if (slot === entering && card.dataset.slot.startsWith("off")) {
          // Jump to the side it enters from before animating in.
          card.classList.add("is-resetting");
          card.dataset.slot = "off-" + entering;
          card.offsetWidth;
          card.classList.remove("is-resetting");
        }
        card.dataset.slot = slot || (step > 0 ? "off-left" : "off-right");
        card.inert = slot !== "centre";
      });
      counter.textContent = String(current + 1).padStart(2, "0");
      restartProgress();
    };
    const pause = () => queue.setAttribute("data-paused", "");
    const resume = () => queue.removeAttribute("data-paused");
    cards.forEach((card, index) => {
      card.dataset.slot = slotFor(index) || "off-right";
      card.inert = index !== 0;
    });
    queue.querySelector("[data-queue-next]").addEventListener("click", () => move(1));
    queue.querySelector("[data-queue-prev]").addEventListener("click", () => move(-1));
    queue.addEventListener("pointerenter", pause);
    queue.addEventListener("pointerleave", resume);
    queue.addEventListener("focusin", pause);
    queue.addEventListener("focusout", (event) => {
      if (!queue.contains(event.relatedTarget)) resume();
    });
    restartProgress();
  }
})();
