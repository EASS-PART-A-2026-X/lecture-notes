// Progressive enhancement: wide tables remain usable without a mouse.
(() => {
  const regions = document.querySelectorAll(".main-content .table-wrapper");

  function update(region) {
    if (region.scrollWidth > region.clientWidth) {
      let heading = region.previousElementSibling;
      while (heading && !heading.matches("h1, h2, h3, h4, h5, h6")) {
        heading = heading.previousElementSibling;
      }
      const label = heading ? heading.textContent.trim() : "Course";
      region.tabIndex = 0;
      region.setAttribute("role", "region");
      region.setAttribute("aria-label", `${label} table, scroll horizontally`);
    } else {
      region.removeAttribute("tabindex");
      region.removeAttribute("role");
      region.removeAttribute("aria-label");
    }
  }

  regions.forEach(update);
  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(entries => {
      entries.forEach(entry => update(entry.target));
    });
    regions.forEach(region => observer.observe(region));
  } else {
    window.addEventListener("resize", () => regions.forEach(update));
  }
})();
