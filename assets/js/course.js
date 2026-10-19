// Course site enhancements. Progressive only: every page, link, quiz, table, figure and step list
// works without this file, on GitHub and in the PDF. Pure helpers are exported for
// .github/scripts/test_course_js.cjs; the DOM code below them runs only in a browser.
(() => {
  "use strict";

  // ---------------------------------------------------------------------------------------------
  // Pure helpers (no DOM)
  // ---------------------------------------------------------------------------------------------

  const COURSE_TIME_ZONE = "Asia/Jerusalem";
  const DEFAULT_MEETING_TIME = [16, 0]; // README: "Mondays at 16:00 Israel time"
  const DEADLINE_TIME = [23, 59]; // README: "Deadlines are at 23:59 Israel time"
  const DAY_MS = 86400000;
  const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const COURSE_DATE = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2})\s+([A-Z][a-z]{2})\s+(\d{4})(?:,\s*(\d{1,2}):(\d{2}))?$/;

  const pad = value => String(value).padStart(2, "0");

  // Israel's rule since 2013, used only when Intl has no time-zone data: summer time (UTC+3) from
  // 02:00 on the Friday before the last Sunday of March to 02:00 on the last Sunday of October.
  function israelRuleOffsetMinutes(utcMs) {
    const year = new Date(utcMs).getUTCFullYear();
    const lastSunday = month => {
      const last = new Date(Date.UTC(year, month + 1, 0));
      return last.getUTCDate() - last.getUTCDay();
    };
    const start = Date.UTC(year, 2, lastSunday(2) - 2, 2) - 2 * 3600000; // 02:00 IST = 00:00 UTC
    const end = Date.UTC(year, 9, lastSunday(9), 2) - 3 * 3600000; // 02:00 IDT = 23:00 UTC Saturday
    return utcMs >= start && utcMs < end ? 180 : 120;
  }

  // Minutes the course time zone is ahead of UTC at a given instant (120 in winter, 180 in summer).
  function zoneOffsetMinutes(utcMs) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: COURSE_TIME_ZONE, hourCycle: "h23", year: "numeric", month: "numeric",
        day: "numeric", hour: "numeric", minute: "numeric", second: "numeric"
      }).formatToParts(new Date(utcMs));
      const get = type => Number(parts.find(part => part.type === type).value);
      const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
      return Math.round((wall - Math.floor(utcMs / 1000) * 1000) / 60000);
    } catch {
      return israelRuleOffsetMinutes(utcMs);
    }
  }

  // "YYYY-MM-DD" of an instant on the course calendar (Israel time).
  function courseDate(utcMs) {
    return new Date(utcMs + zoneOffsetMinutes(utcMs) * 60000).toISOString().slice(0, 10);
  }

  // Parse a README date cell such as "Mon 19 Oct 2026, 18:00", or "Mon 26 Oct 2026" with
  // `defaultTime` implied, as wall-clock time in Israel. Returns {date: "YYYY-MM-DD", hour, minute,
  // time} with `time` in UTC milliseconds, or null: also when the weekday does not match the date,
  // because a typo in the README must never become a confident wrong date on the page.
  function parseCourseDate(text, defaultTime) {
    const match = COURSE_DATE.exec(String(text || "").replace(/\s+/g, " ").trim());
    if (!match) return null;
    const [, weekdayText, dayText, monthText, yearText, hourText, minuteText] = match;
    const month = MONTHS.indexOf(monthText);
    const day = Number(dayText), year = Number(yearText);
    const hour = hourText === undefined ? defaultTime[0] : Number(hourText);
    const minute = minuteText === undefined ? defaultTime[1] : Number(minuteText);
    if (month < 0 || hour > 23 || minute > 59) return null;
    const check = new Date(Date.UTC(year, month, day));
    if (check.getUTCMonth() !== month || check.getUTCDate() !== day) return null; // e.g. 31 Nov
    if (WEEKDAYS[check.getUTCDay()] !== weekdayText) return null; // e.g. "Tue 19 Oct 2026"
    // Wall-clock time in Israel -> UTC. Two passes settle the offset next to a clock change.
    const wall = Date.UTC(year, month, day, hour, minute);
    let time = wall - zoneOffsetMinutes(wall) * 60000;
    time = wall - zoneOffsetMinutes(time) * 60000;
    return {date: `${year}-${pad(month + 1)}-${pad(day)}`, hour, minute, time};
  }

  // A calendar cell: "Mon 19 Oct 2026, 18:00", or "Mon 26 Oct 2026" for the regular 16:00 meeting.
  function parseScheduleDate(text) {
    return parseCourseDate(text, DEFAULT_MEETING_TIME);
  }

  // A deadline cell: "Mon 9 Nov 2026" means 23:59 Israel time on that day.
  function parseDeadline(text) {
    return parseCourseDate(text, DEADLINE_TIME);
  }

  // Index of the next meeting: the first one on or after today's date in Israel. A meeting stays
  // "next" for its whole calendar day (the course publishes start times, not end times).
  // Entries may be null (unparseable rows); returns -1 when every meeting is over.
  function nextMeetingIndex(meetings, nowMs) {
    const today = courseDate(nowMs);
    for (let i = 0; i < meetings.length; i++) {
      if (meetings[i] && meetings[i].date >= today) return i;
    }
    return -1;
  }

  // Index of the next deadline: the earliest one whose minute has not ended yet, so a 23:59
  // deadline stays next until 23:59:59 Israel time. Returns -1 when every deadline has passed, and
  // also when any entry is null: an unreadable row could be the real next deadline.
  function nextDeadlineIndex(deadlines, nowMs) {
    if (!deadlines.length || deadlines.some(deadline => !deadline)) return -1;
    let next = -1;
    deadlines.forEach((deadline, index) => {
      if (nowMs < deadline.time + 60000 && (next < 0 || deadline.time < deadlines[next].time)) next = index;
    });
    return next;
  }

  // Whole calendar days in Israel from the instant `nowMs` to the date "YYYY-MM-DD": 0 is today,
  // negative is past, NaN when the date is malformed.
  function daysUntil(isoDate, nowMs) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate));
    if (!match) return NaN;
    const target = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Math.round((target - Date.parse(`${courseDate(nowMs)}T00:00:00Z`)) / DAY_MS);
  }

  // "today", "tomorrow" or "in N days"; "" for the past or anything that is not a whole number.
  function dueLabel(days) {
    if (!Number.isInteger(days) || days < 0) return "";
    if (days === 0) return "today";
    return days === 1 ? "tomorrow" : `in ${days} days`;
  }

  // The step to show after moving `delta` steps from `current`, kept within 0..total-1.
  function stepperIndex(current, delta, total) {
    if (!Number.isInteger(total) || total < 1) return 0;
    const target = (Number.isFinite(current) ? Math.trunc(current) : 0) + (Number.isFinite(delta) ? Math.trunc(delta) : 0);
    return Math.min(Math.max(target, 0), total - 1);
  }

  const helpers = {
    courseDate, daysUntil, dueLabel, israelRuleOffsetMinutes, nextDeadlineIndex, nextMeetingIndex, parseDeadline,
    parseScheduleDate, stepperIndex, zoneOffsetMinutes,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = helpers;
  if (typeof document === "undefined") return;

  // ---------------------------------------------------------------------------------------------
  // Page enhancements
  // ---------------------------------------------------------------------------------------------

  const main = document.querySelector(".main-content");

  // Scroll regions (tables, code, diagrams): focusable and named only while they really scroll,
  // so keyboard users can reach hidden content without extra tab stops everywhere else.
  function watchOverflow(elements, update) {
    elements.forEach(update);
    if ("ResizeObserver" in window) {
      const observer = new ResizeObserver(entries => entries.forEach(entry => update(entry.target)));
      elements.forEach(element => observer.observe(element));
    } else {
      window.addEventListener("resize", () => elements.forEach(update));
    }
  }
  const overflows = element => element.scrollWidth > element.clientWidth + 1;

  function nearestHeading(element) {
    let node = element;
    while (node && node !== main) {
      let sibling = node.previousElementSibling;
      while (sibling) {
        if (sibling.matches("h1, h2, h3, h4, h5, h6")) return sibling.textContent.trim();
        sibling = sibling.previousElementSibling;
      }
      node = node.parentElement;
    }
    return "Course";
  }

  if (main) {
    watchOverflow([...main.querySelectorAll(".table-wrapper")], region => {
      if (overflows(region)) {
        region.tabIndex = 0;
        region.setAttribute("role", "region");
        region.setAttribute("aria-label", `${nearestHeading(region)} table, scroll horizontally`);
      } else {
        region.removeAttribute("tabindex");
        region.removeAttribute("role");
        region.removeAttribute("aria-label");
      }
    });

    // Diagrams, tables and code that scroll sideways: fade the clipped edge ("more this way").
    const fade = region => {
      const max = region.scrollWidth - region.clientWidth;
      region.classList.toggle("fade-start", max > 1 && region.scrollLeft > 1);
      region.classList.toggle("fade-end", max > 1 && region.scrollLeft < max - 1);
    };
    const scrollers = [...main.querySelectorAll(".diagram-scroll, .table-wrapper, div.highlighter-rouge > div.highlight")];
    scrollers.forEach(region => region.addEventListener("scroll", () => fade(region), {passive: true}));
    watchOverflow(scrollers, fade);

    // Authors give every diagram region role, label and tabindex; drop the tab stop while the
    // diagram fits.
    const diagrams = [...main.querySelectorAll(".course-diagram .diagram-scroll")];
    diagrams.forEach(region => { if (region.hasAttribute("tabindex")) region.dataset.focusable = ""; });
    watchOverflow(diagrams, region => {
      if (!("focusable" in region.dataset)) return;
      if (overflows(region)) region.tabIndex = 0;
      else region.removeAttribute("tabindex");
    });
  }

  // Printing from the browser shows every answer, as the course PDF does; closed ones close again.
  let openedForPrint = [];
  window.addEventListener("beforeprint", () => {
    openedForPrint = [...document.querySelectorAll(".main-content details:not([open])")];
    openedForPrint.forEach(details => { details.open = true; });
  });
  window.addEventListener("afterprint", () => {
    openedForPrint.forEach(details => { details.open = false; });
    openedForPrint = [];
  });

  // Stepper: <div class="stepper"><ol>…</ol></div> shows one step at a time with Previous/Next.
  // Without this script (and in print) it stays a numbered list.
  function enhanceStepper(stepper, number) {
    const list = stepper.querySelector(":scope > ol");
    const steps = list ? [...list.children].filter(item => item.tagName === "LI") : [];
    if (steps.length < 2) return;
    const start = Number.parseInt(list.getAttribute("start") || "1", 10) || 1;
    steps.forEach((step, index) => { step.dataset.step = String(start + index); });

    const button = (className, text) => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = `stepper-button ${className}`;
      element.textContent = text;
      return element;
    };
    const controls = document.createElement("div");
    controls.className = "stepper-controls";
    const previous = button("stepper-prev", "Previous step");
    const next = button("stepper-next", "Next step");
    const all = button("stepper-all", "Show all steps");
    all.setAttribute("aria-pressed", "false");
    const status = document.createElement("p");
    status.className = "stepper-status";
    status.setAttribute("role", "status");
    if (!list.id) list.id = `course-stepper-${number}`;
    [previous, next].forEach(control => control.setAttribute("aria-controls", list.id));
    controls.append(previous, status, next, all);
    list.after(controls);
    stepper.classList.add("is-enhanced");

    let current = 0;
    const title = step => {
      const label = step.querySelector("strong");
      return label ? label.textContent.trim().replace(/[.:]$/, "") : "";
    };
    function render() {
      const showAll = stepper.classList.contains("is-all");
      steps.forEach((step, index) => step.classList.toggle("is-current", index === current));
      previous.hidden = next.hidden = showAll;
      previous.setAttribute("aria-disabled", String(current === 0));
      next.setAttribute("aria-disabled", String(current === steps.length - 1));
      all.setAttribute("aria-pressed", String(showAll));
      all.textContent = showAll ? "Show one step at a time" : "Show all steps";
      const name = title(steps[current]);
      status.textContent = showAll
        ? `Showing all ${steps.length} steps`
        : `Step ${current + 1} of ${steps.length}${name ? `: ${name}` : ""}`;
    }
    const move = delta => {
      const target = stepperIndex(current, delta, steps.length);
      if (target === current) return;
      current = target;
      render();
    };
    previous.addEventListener("click", () => move(-1));
    next.addEventListener("click", () => move(1));
    all.addEventListener("click", () => {
      stepper.classList.toggle("is-all");
      render();
    });
    render();
  }
  document.querySelectorAll(".main-content .stepper").forEach((stepper, index) => enhanceStepper(stepper, index + 1));

  // Home page: the semester clock. A board directly under the title says which meeting is today
  // or next, what to open for it, and the next deadline, all read from the README's calendar and
  // assignments tables; the calendar row of that meeting is marked too. Without this script (and
  // in print) the tables say the same thing, so nothing is lost.
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  const makeLink = (className, href, text) => {
    const anchor = make("a", className, text);
    anchor.href = href;
    return anchor;
  };
  const headerIndex = table => {
    const headers = [...table.querySelectorAll("thead th")].map(th => th.textContent.trim().toLowerCase());
    return name => headers.indexOf(name);
  };
  const cellText = cell => (cell ? cell.textContent.replace(/\s+/g, " ").trim() : "");
  const withTime = (text, {hour, minute}) => (text.includes(":") ? text : `${text}, ${pad(hour)}:${pad(minute)}`);

  // "Mon, 17:00 GMT+2 where you are", only when the reader's clock differs from Israel's.
  function whereYouAre(time) {
    try {
      const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!local || local === COURSE_TIME_ZONE || zoneOffsetMinutes(time) === -new Date(time).getTimezoneOffset()) return "";
      const format = new Intl.DateTimeFormat(document.documentElement.lang || "en", {
        weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "short",
      });
      return `${format.format(new Date(time))} where you are`;
    } catch {
      return ""; // the Israel time is enough
    }
  }

  // The next deadline line, or null when the table is missing or any of its dates is unreadable.
  function nextDeadline(nowMs) {
    const table = document.querySelector(".main-content table.deadlines");
    if (!table || !table.tBodies.length) return null;
    const column = headerIndex(table);
    const what = column("assignment"), when = column("deadline");
    if (what < 0 || when < 0) return null;
    const rows = [...table.tBodies[0].rows];
    const deadlines = rows.map(row => parseDeadline(cellText(row.cells[when])));
    const index = nextDeadlineIndex(deadlines, nowMs);
    if (index < 0) return null;
    const due = deadlines[index];
    const days = dueLabel(daysUntil(due.date, nowMs));
    // Several hand-ins on one day (EX3 and the open-source evidence) are named together.
    const names = rows.filter((row, i) => deadlines[i].time === due.time).map(row => cellText(row.cells[what]));
    if (!days || names.some(name => !name)) return null;

    const line = make("p", "this-week-deadline");
    line.append(make("span", "this-week-term", names.length > 1 ? "Next deadlines: " : "Next deadline: "));
    names.forEach((name, i) => {
      if (i) line.append(i === names.length - 1 ? " and " : ", ");
      line.append(make("strong", "", name));
    });
    const local = whereYouAre(due.time);
    line.append(` on ${withTime(cellText(rows[index].cells[when]), due)} Israel time (${days}${local ? `; ${local}` : ""})`);
    return line;
  }

  // The board for today's or the next meeting, or null when the calendar is missing, over, or
  // holds a date that does not parse. Also marks that meeting's calendar row.
  function semesterBoard() {
    const table = document.querySelector(".main-content table.schedule");
    if (!table || !table.tBodies.length) return null;
    const now = Date.now();
    const column = headerIndex(table);
    const dateColumn = column("date") >= 0 ? column("date") : 1;
    const rows = [...table.tBodies[0].rows];
    const meetings = rows.map(row => parseScheduleDate(cellText(row.cells[dateColumn])));
    const index = nextMeetingIndex(meetings, now);
    // An unreadable date could hide the real next meeting: then say nothing rather than guess.
    if (index < 0 || meetings.some(meeting => !meeting)) return null;

    const row = rows[index];
    const meeting = meetings[index];
    row.classList.add("is-next");
    const today = meeting.date === courseDate(now);
    const cell = name => (column(name) >= 0 ? row.cells[column(name)] : null);
    const number = cellText(cell("#")) || String(index + 1);

    const board = make("aside", "this-week");
    const deadline = nextDeadline(now);
    board.setAttribute("aria-label", `${today ? "Today's meeting" : "Next meeting"}${deadline ? " and next deadline" : ""}`);
    const when = make("p", "this-week-when", `Meeting ${number} of ${rows.length}: ${withTime(cellText(row.cells[dateColumn]), meeting)} Israel time`);
    const local = whereYouAre(meeting.time);
    if (local) when.append(` (${local})`);
    board.append(make("p", "this-week-label", today ? "Today" : "Next meeting"), when);

    const focusCell = cell("focus");
    if (cellText(focusCell)) board.append(make("p", "this-week-focus", cellText(focusCell)));
    const deliverableCell = cell("deliverable");
    if (cellText(deliverableCell)) {
      const deliverable = make("p", "this-week-deliverable");
      deliverable.append(make("span", "this-week-term", "Deliverable: "),
        ...[...deliverableCell.childNodes].map(node => node.cloneNode(true)));
      board.append(deliverable);
    }

    // One primary action (the meeting's page); Lectures 1-10 also offer their prerequisite check.
    const actions = make("p", "this-week-actions");
    const target = focusCell && focusCell.querySelector("a[href]");
    if (target) {
      const href = target.getAttribute("href");
      const lecture = /(?:^|\/)lectures\/(0[1-9]|10)-[^/#?]+\.html$/.exec(href);
      actions.append(makeLink("this-week-open", href, lecture ? `Open Lecture ${Number(lecture[1])}` : `Open meeting ${number}`));
      if (lecture) actions.append(" ", makeLink("", `${href}#before-you-start`, "Before you start"));
      actions.append(" ");
    }
    actions.append(makeLink("", "#calendar-and-13-meeting-schedule", "Full calendar and notes"));
    board.append(actions);

    if (deadline) board.append(deadline);
    return board;
  }

  // The plugin reserves the board's place under the title (an empty aside.this-week[data-pending]),
  // so the facts and introduction do not jump down when it arrives; with nothing to show, the
  // place is given back.
  function showSemesterBoard() {
    const slot = document.querySelector(".main-content .home-hero > aside.this-week[data-pending]");
    const title = document.querySelector(".main-content .home-hero > h1");
    const board = semesterBoard();
    if (board && slot) slot.replaceWith(board);
    else if (board && title) title.after(board);
    else if (slot) slot.remove();
  }
  showSemesterBoard();

  // Sidebar, header and search. These run after the theme's own ready handler: just-the-docs.js
  // registers its DOMContentLoaded listener first (it loads synchronously in <head>).
  function afterTheme() {
    // Current page: the theme removes the link's href and only styles it. Restore the link and
    // say "current page", so it is announced, reachable and keeps its sidebar group label.
    const active = document.querySelector("#site-nav .nav-list-link.active");
    if (active) {
      if (!active.hasAttribute("href")) active.setAttribute("href", location.pathname);
      active.setAttribute("aria-current", "page");
    }

    // Mobile menu: name what the button controls, and let Escape close it.
    const menuButton = document.getElementById("menu-button");
    const siteNav = document.getElementById("site-nav");
    if (menuButton && siteNav) {
      menuButton.setAttribute("aria-controls", "site-nav");
      document.addEventListener("keydown", event => {
        if (event.key !== "Escape" || !menuButton.classList.contains("nav-open")) return;
        const input = document.getElementById("search-input");
        if (event.target === input && input.value) return; // Escape first clears the search
        menuButton.click();
        menuButton.focus();
      });
    }

    // File content is different from a terminal command: name the actual copy destination.
    if (main) {
      main.querySelectorAll(".file-example").forEach(example => {
        const path = example.querySelector(".file-example-path");
        const button = example.querySelector("button");
        if (path && button) {
          const label = `Copy contents of ${path.textContent.trim()}`;
          button.setAttribute("aria-label", label);
          button.setAttribute("title", label);
        }
      });
      main.querySelectorAll("pre, code, .file-example-path").forEach(element => {
        element.setAttribute("translate", "no");
      });
    }

    enhanceSearch();

    // The theme makes every code block a tab stop; keep only those that actually scroll.
    if (main) {
      watchOverflow([...main.querySelectorAll("div.highlight")], block => {
        const pre = block.querySelector("pre");
        if (overflows(block) || (pre && overflows(pre))) block.tabIndex = 0;
        else block.removeAttribute("tabindex");
      });
    }

    // The theme scrolls the sidebar to the current page, which also moves the browser's keyboard
    // starting point there, so the first Tab skipped "Skip to main content". Put it back at the
    // top, unless the reader arrived at a #section (then the browser's starting point is right).
    setTimeout(() => {
      if (location.hash || (document.activeElement && document.activeElement !== document.body)) return;
      const body = document.body;
      body.setAttribute("tabindex", "-1");
      body.focus({preventScroll: true});
      body.removeAttribute("tabindex");
    }, 0);
  }

  // Search: announce how many results appeared and which one the arrow keys selected.
  function enhanceSearch() {
    const input = document.getElementById("search-input");
    const results = document.getElementById("search-results");
    if (!input || !results) return;
    const status = document.createElement("p");
    status.className = "sr-only search-status";
    status.setAttribute("role", "status");
    results.after(status);
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-controls", "search-results");
    input.setAttribute("aria-expanded", "false");

    let timer = null;
    const sync = () => {
      const links = [...results.querySelectorAll("a.search-result")];
      const list = results.querySelector(".search-results-list");
      if (list) list.setAttribute("role", "listbox");
      if (list) list.setAttribute("aria-label", "Search results");
      links.forEach((link, index) => {
        if (!link.id) link.id = `search-option-${index + 1}`;
        link.setAttribute("role", "option");
        link.setAttribute("aria-selected", String(link.classList.contains("active")));
        if (link.parentElement) link.parentElement.setAttribute("role", "presentation");
      });
      const selected = links.find(link => link.classList.contains("active"));
      if (selected) input.setAttribute("aria-activedescendant", selected.id);
      else input.removeAttribute("aria-activedescendant");
      input.setAttribute("aria-expanded", String(links.length > 0));

      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!input.value.trim()) {
          status.textContent = "";
        } else if (results.querySelector(".search-no-result")) {
          status.textContent = "No results found";
        } else {
          const count = results.querySelectorAll("a.search-result").length;
          status.textContent = `${count} ${count === 1 ? "result" : "results"}; use the arrow keys to choose, Enter to open`;
        }
      }, 400);
    };
    new MutationObserver(sync).observe(results, {childList: true, subtree: true, attributes: true, attributeFilter: ["class"]});
  }

  // Deferred scripts run while readyState is already "interactive" but before DOMContentLoaded,
  // so wait for that event (the theme's handler is registered first and runs first).
  let themeReady = false;
  const once = () => { if (!themeReady) { themeReady = true; afterTheme(); } };
  if (document.readyState === "complete") once();
  else {
    document.addEventListener("DOMContentLoaded", once);
    window.addEventListener("load", once);
  }
})();
