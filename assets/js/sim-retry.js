// Lecture 9 simulator: one caller retrying a failed call, against the caller's own deadline. Course
// defaults: 30 s read timeout, 3 attempts, backoff 0.5 s then 1 s, frontend deadline 100 s, and the
// ai-service's 25 s cap (504). Teaching arithmetic; real timeouts apply per phase.
(() => {
  "use strict";
  const AI_CAP = 25;
  const DEFAULTS = {failure: "timeout", operation: "extract", timeout: 30, attempts: 3, backoff: 0.5, deadline: 100};
  const BOUNDS = {timeout: [0.1, 300, false], attempts: [1, 10, true], backoff: [0, 60, false], deadline: [1, 900, false]};
  const FAILURES = ["refused", "timeout", "gateway"];
  const OPERATIONS = ["extract", "save", "save-key"];
  const round = value => Math.round(value * 1000) / 1000;

  function plan(settings) {
    for (const [key, [min, max, integer]] of Object.entries(BOUNDS)) {
      const value = settings[key];
      if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
        throw new RangeError(`Invalid ${key}`);
      }
    }
    if (!FAILURES.includes(settings.failure) || !OPERATIONS.includes(settings.operation)) throw new RangeError("Invalid choice");
    const {failure, operation, timeout, attempts, backoff, deadline} = settings;
    // How one attempt ends: refused at once (never sent), the ai-service's 504, or the caller's read timeout.
    const gateway = failure === "gateway" && AI_CAP < timeout;
    const outcome = failure === "refused" ? {seconds: 0, result: "ConnectError", sent: false}
      : gateway ? {seconds: AI_CAP, result: "504 Gateway Timeout", sent: true}
        : {seconds: timeout, result: "ReadTimeout", sent: true};
    const steps = [];
    let t = 0;
    for (let n = 1; n <= attempts; n += 1) {
      steps.push({kind: "attempt", n, start: round(t), end: round(t + outcome.seconds), result: outcome.result, late: t >= deadline});
      t += outcome.seconds;
      if (n < attempts) {
        const wait = backoff * 2 ** (n - 1);
        steps.push({kind: "backoff", n, start: round(t), end: round(t + wait), late: t >= deadline});
        t += wait;
      }
    }
    const total = round(t);
    const givesUp = total > deadline;
    const paid = outcome.sent ? attempts : 0;
    let safety;
    if (attempts === 1) safety = {verdict: "no-retry", short: "No retry.", text: "No retry happens, so nothing can repeat."};
    else if (!outcome.sent) safety = {verdict: "safe", short: "Retry is safe.", text: "Safe to retry: the request never reached the server, so nothing ran and nothing was stored."};
    else if (operation === "extract") safety = {verdict: "paid", short: "Retry is safe but paid.", text: `Safe to repeat, but paid: POST /extract stores nothing, yet each attempt may run the model${outcome.result === "ReadTimeout" ? ", and a timed-out attempt may still be running" : ""}.`};
    else if (operation === "save") safety = {verdict: "unsafe", short: "Retry is not safe.", text: "Not safe: the server got the request, so the recipe may already be saved. A retry can store a duplicate. Do not retry; tell the user the change may have been saved."};
    else safety = {verdict: "keyed", short: "Retry is safe with the key.", text: "Safe with an idempotency key: the server recognises the repeated key and returns the first result instead of saving twice (a stretch goal)."};
    return {steps, total, givesUp, paid, outcome, safety,
      summary: givesUp ? `The caller gives up at ${deadline} s, but attempts continue until ${total} s.`
        : `${attempts} ${attempts === 1 ? "attempt fails" : "attempts fail"}; the caller gets the error after ${total} s, inside its ${deadline} s deadline.`};
  }

  if (typeof module !== "undefined" && module.exports) module.exports = {DEFAULTS, plan};
  if (typeof document === "undefined") return;
  const root = document.getElementById("sim-retry");
  if (!root) return;
  const el = (tag, props = {}, ...kids) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...kids);
    return node;
  };
  const s = value => `${value.toLocaleString("en-US", {maximumFractionDigits: 3})} s`;
  const form = el("form");
  form.setAttribute("aria-label", "Retry and timeout settings");
  const radios = (name, legend, options) => el("fieldset", {}, el("legend", {textContent: legend}), el("div", {className: "sim-choices"},
    ...options.map(([value, text]) => el("label", {}, el("input", {type: "radio", name, value, checked: value === DEFAULTS[name]}), el("span", {textContent: text})))));
  const number = (name, text, step) => el("label", {}, text,
    el("input", {type: "number", name, value: String(DEFAULTS[name]), min: String(BOUNDS[name][0]), max: String(BOUNDS[name][1]), step, required: true, inputMode: "decimal"}));
  form.append(
    radios("failure", "What goes wrong on every attempt", [["refused", "Connection refused (never sent)"], ["timeout", "Silent server: read timeout (sent, outcome unknown)"], ["gateway", "Slow model: ai-service answers 504 at 25 s"]]),
    radios("operation", "What is being retried", [["extract", "POST /extract (stores nothing)"], ["save", "POST /recipes/from-text (saves a recipe)"], ["save-key", "The same save with an idempotency key"]]),
    el("div", {className: "sim-fields"}, number("timeout", "Read timeout per attempt (s)", "0.1"), number("attempts", "Attempts in total", "1"),
      number("backoff", "First backoff (s), doubling", "0.1"), number("deadline", "Caller's deadline (s)", "1")));
  const reset = el("button", {type: "button", className: "sim-button sim-quiet", textContent: "Course defaults"});
  const error = el("p", {className: "sim-error", hidden: true, textContent: "Enter a timeout of 0.1–300 s, 1–10 whole attempts, a backoff of 0–60 s and a deadline of 1–900 s."});
  error.setAttribute("role", "alert");
  const status = el("p", {className: "sim-status"});
  status.setAttribute("role", "status");
  const track = el("div", {className: "sim-track"});
  const axis = el("div", {className: "sim-axis"});
  [track, axis].forEach(node => node.setAttribute("aria-hidden", "true")); // the list below says the same
  const list = el("ol", {className: "sim-stages"});
  const verdict = el("p", {className: "sim-box"});
  const results = el("div", {}, status, track, axis, list, verdict);

  function render() {
    const inputs = [...form.querySelectorAll("input[type=number]")];
    inputs.forEach(input => input.setAttribute("aria-invalid", String(!input.validity.valid)));
    const settings = {failure: form.elements.failure.value, operation: form.elements.operation.value,
      ...Object.fromEntries(inputs.map(input => [input.name, input.valueAsNumber]))};
    let r;
    try { r = plan(settings); } catch (failure) {
      if (!(failure instanceof RangeError)) throw failure;
      error.hidden = false;
      results.hidden = true;
      return;
    }
    error.hidden = true;
    results.hidden = false;
    const scale = Math.max(r.total, settings.deadline) || 1;
    const pct = value => `${(value / scale) * 100}%`;
    const line = el("span", {className: "sim-deadline"});
    line.style.left = pct(settings.deadline);
    track.replaceChildren(...r.steps.filter(step => step.kind === "attempt").map(step => {
      const seg = el("span", {className: `sim-seg${step.late ? " is-late" : ""}`});
      Object.assign(seg.style, {left: pct(step.start), width: pct(step.end - step.start)});
      return seg;
    }), line);
    axis.replaceChildren(el("span", {textContent: "0 s"}), el("span", {textContent: `${s(scale)} (red line: deadline ${s(settings.deadline)})`}));
    list.replaceChildren(...r.steps.map(step => el("li", {textContent: step.kind === "attempt"
      ? `Attempt ${step.n}: ${s(step.start)} to ${s(step.end)}, ${step.result}${step.late ? ", after the caller gave up" : ""}.`
      : `Back off ${s(step.end - step.start)}.`})));
    verdict.replaceChildren(el("strong", {textContent: `${r.safety.short} `}), r.safety.text,
      ` ${r.paid ? `${r.paid} ${r.paid === 1 ? "attempt" : "attempts"} may run the model and bill.` : "No attempt reached the model, so nothing is billed."}`);
    verdict.dataset.tone = r.safety.verdict === "unsafe" ? "bad" : r.safety.verdict === "paid" ? "wait" : "ok";
    status.textContent = `${r.summary} ${r.safety.short}`;
  }
  form.addEventListener("input", render);
  form.addEventListener("change", render);
  form.addEventListener("submit", event => event.preventDefault());
  reset.addEventListener("click", () => {
    for (const [name, value] of Object.entries(DEFAULTS)) {
      const field = form.elements[name];
      if (field instanceof RadioNodeList) field.value = value; else field.value = String(value);
    }
    render();
  });

  root.querySelector(".sim-fallback").before(el("div", {className: "sim-app"},
    el("p", {className: "sim-note", textContent: "Start from the course defaults. Predict the total time and the retry verdict, then change one value."}),
    form, el("div", {className: "sim-controls"}, reset), error, results));
  root.classList.add("is-live");
  render();
})();
