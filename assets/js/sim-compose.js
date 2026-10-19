// Lecture 8 simulator: startup of the course's compose.yaml (frontend -> backend -> ai-service, each
// gate service_healthy, no restart policy). "Unhealthy" means the check never passes while the
// process keeps running, as in break-it drill 2. A teaching model, not Compose itself.
(() => {
  "use strict";
  const CHOICES = {ai: ["healthy", "unhealthy", "crash"], backend: ["healthy", "unhealthy"],
    frontend: ["healthy", "unhealthy"], condition: ["service_healthy", "service_started"]};
  const DEFAULTS = {ai: "healthy", backend: "healthy", frontend: "healthy", condition: "service_healthy"};
  const container = name => `recipe-box-${name}-1`;

  function simulate(settings) {
    for (const [key, allowed] of Object.entries(CHOICES)) {
      if (!allowed.includes(settings[key])) throw new RangeError(`Invalid ${key}`);
    }
    const {ai, backend, frontend, condition} = settings;
    const aiGate = ai !== "unhealthy"; // a crash happens later, after the check passed
    const backendRuns = condition === "service_started" || aiGate;
    const frontendRuns = backendRuns && backend === "healthy";
    const state = (runs, health) => !runs ? "Created (never started)" : `running (${health})`;
    const services = {
      "ai-service": ai === "crash" ? "Exited (1), after it was healthy" : `running (${ai})`,
      backend: state(backendRuns, backend),
      frontend: state(frontendRuns, frontend)
    };
    const events = [ai === "unhealthy" ? "ai-service starts; its check keeps failing after start_period, so it is marked unhealthy."
      : "ai-service starts and its check passes: healthy."];
    if (!backendRuns) events.push("backend waits for service_healthy and is never started; frontend waits for backend.");
    else {
      events.push(`backend starts (${condition === "service_started" ? "service_started is met as soon as ai-service runs" : "ai-service is healthy"}) and becomes ${backend}.`);
      events.push(frontendRuns ? `frontend starts and becomes ${frontend}.` : "frontend waits for a healthy backend and is never started.");
    }
    let wait = "up --wait succeeds: all three services are healthy.";
    if (!backendRuns) wait = `dependency failed to start: container ${container("ai-service")} is unhealthy`;
    else if (backend === "unhealthy") wait = `dependency failed to start: container ${container("backend")} is unhealthy`;
    else if (ai === "unhealthy") wait = `container ${container("ai-service")} is unhealthy`;
    else if (frontend === "unhealthy") wait = `container ${container("frontend")} is unhealthy`;
    if (ai === "crash") events.push("up --wait has returned. Later the ai-service process exits, and nothing restarts it (no restart: policy).");
    const browser = frontendRuns;
    return {
      services, events, wait, waitOk: wait.startsWith("up --wait succeeds"),
      curl: backendRuns ? "curl localhost:8000/recipes answers 200." : "curl localhost:8000/recipes prints curl: (7) Failed to connect to localhost port 8000.",
      crud: browser ? "CRUD works in the browser at localhost:8501." : "CRUD is unavailable: nothing listens on localhost:8501.",
      paste: !browser ? "Paste is unavailable too." : ai === "crash" ? "Paste returns 503: the backend reaches no ai-service."
        : ai === "unhealthy" ? "Paste works: only the check is broken, not the AI process." : "Paste works.",
      crudWorks: browser
    };
  }

  if (typeof module !== "undefined" && module.exports) module.exports = {CHOICES, DEFAULTS, simulate};
  if (typeof document === "undefined") return;
  const root = document.getElementById("sim-compose");
  if (!root) return;
  const el = (tag, props = {}, ...kids) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...kids);
    return node;
  };
  const LEGENDS = {ai: "ai-service health check", backend: "backend health check", frontend: "frontend health check",
    condition: "backend depends_on ai-service with condition"};
  const LABELS = {healthy: "passes", unhealthy: "never passes", crash: "passes, then the process crashes",
    service_healthy: "service_healthy (course default)", service_started: "service_started, required: false (stretch variant)"};
  const form = el("form", {className: "sim-form"});
  form.setAttribute("aria-label", "Compose startup settings");
  for (const [key, options] of Object.entries(CHOICES)) {
    const choices = el("div", {className: "sim-choices"});
    for (const value of options) {
      const input = el("input", {type: "radio", name: key, value, checked: value === DEFAULTS[key]});
      choices.append(el("label", {}, input, el("span", {textContent: LABELS[value]})));
    }
    form.append(el("fieldset", {}, el("legend", {textContent: LEGENDS[key]}), choices));
  }
  const status = el("p", {className: "sim-status"});
  status.setAttribute("role", "status");
  const grid = el("div", {className: "sim-grid"});
  const events = el("ol", {className: "sim-stages"});
  const results = el("ul");

  function render() {
    const settings = Object.fromEntries(Object.keys(CHOICES).map(key => [key, form.elements[key].value]));
    const r = simulate(settings);
    grid.replaceChildren(...Object.entries(r.services).map(([name, text]) => {
      const box = el("div", {className: "sim-box"}, el("span", {className: "sim-box-title", textContent: name}), el("span", {className: "sim-badge", textContent: text}));
      box.dataset.tone = text.includes("(healthy)") ? "ok" : text.startsWith("Created") ? "idle" : text.includes("unhealthy") ? "wait" : "bad";
      return box;
    }));
    events.replaceChildren(...r.events.map(text => el("li", {textContent: text})));
    const waitLine = el("li", {}, el("code", {textContent: "docker compose up -d --wait"}), ": ", r.waitOk ? r.wait : el("code", {textContent: r.wait}));
    results.replaceChildren(waitLine, ...[r.curl, r.crud, r.paste].map(text => el("li", {textContent: text})));
    status.textContent = `${r.waitOk ? "up --wait succeeds" : "up --wait fails"}. ${r.crud} ${r.paste}`;
  }
  form.addEventListener("change", render);
  form.addEventListener("submit", event => event.preventDefault());

  root.querySelector(".sim-fallback").before(el("div", {className: "sim-app"},
    el("p", {className: "sim-note", textContent: "frontend depends on backend with service_healthy, as in the course's compose.yaml. Change one setting at a time and predict the result first."}),
    form, status, grid, el("p", {className: "sim-box-title", textContent: "Startup, in order"}), events,
    el("p", {className: "sim-box-title", textContent: "What you observe"}), results));
  root.classList.add("is-live");
  render();
})();
