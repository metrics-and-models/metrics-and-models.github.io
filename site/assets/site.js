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
    matchMedia("(min-width: 421px)").addEventListener("change", closeMenu);
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
})();
