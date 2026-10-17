// A teaching arithmetic model, not a measurement or a serving benchmark.
(() => {
  "use strict";
  const bounds = {
    inputTokens: [1, 1000000, true], outputTokens: [1, 10000, true],
    prefillRate: [0.1, 1000000, false], decodeRate: [0.1, 1000000, false],
    queueSeconds: [0, 3600, false], loadSeconds: [0, 3600, false]
  };
  const presets = {
    warm: {inputTokens: 4000, outputTokens: 200, prefillRate: 2000, decodeRate: 40, queueSeconds: 0.5, loadSeconds: 0},
    long: {inputTokens: 16000, outputTokens: 200, prefillRate: 2000, decodeRate: 40, queueSeconds: 0.5, loadSeconds: 0},
    cold: {inputTokens: 4000, outputTokens: 200, prefillRate: 2000, decodeRate: 40, queueSeconds: 3, loadSeconds: 8}
  };
  function estimate(settings) {
    for (const [key, [min, max, integer]] of Object.entries(bounds)) {
      const value = settings[key];
      if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
        throw new RangeError(`Invalid ${key}`);
      }
    }
    const load = settings.loadSeconds, queue = settings.queueSeconds;
    const prefill = settings.inputTokens / settings.prefillRate;
    const decode = settings.outputTokens / settings.decodeRate;
    return {load, queue, prefill, decode, total: load + queue + prefill + decode,
      firstToken: load + queue + prefill + 1 / settings.decodeRate};
  }
  if (typeof module !== "undefined" && module.exports) module.exports = {estimate, presets};
  if (typeof document === "undefined") return;
  const lab = document.getElementById("inference-lab");
  if (!lab) return;
  const form = lab.querySelector("form");
  const inputs = [...form.querySelectorAll("input[name]")];
  const results = lab.querySelector("[data-results]");
  const error = lab.querySelector("[data-error]");
  const time = value => value > 0 && value < 0.001 ? "<0.001 s" : `${value.toLocaleString("en-US", {maximumFractionDigits: 3})} s`;
  function render() {
    const settings = Object.fromEntries(inputs.map(input => [input.name, input.valueAsNumber]));
    inputs.forEach(input => input.setAttribute("aria-invalid", String(!input.validity.valid)));
    try {
      if (!form.checkValidity()) throw new RangeError("Invalid field");
      const values = estimate(settings);
      lab.querySelectorAll("[data-value]").forEach(output => { output.textContent = time(values[output.dataset.value]); });
      lab.querySelectorAll("[data-stage]").forEach(stage => { stage.style.width = `${100 * values[stage.dataset.stage] / values.total}%`; });
      lab.querySelector("[data-summary]").textContent = `Estimated total ${time(values.total)}; first token ${time(values.firstToken)}.`;
      results.hidden = false;
      error.hidden = true;
    } catch (failure) {
      if (!(failure instanceof RangeError)) throw failure;
      results.hidden = true;
      error.hidden = false;
    }
  }
  inputs.forEach(input => input.addEventListener("input", render));
  form.addEventListener("submit", event => { event.preventDefault(); render(); });
  form.querySelectorAll("[data-preset]").forEach(button => button.addEventListener("click", () => {
    const settings = presets[button.dataset.preset];
    inputs.forEach(input => { input.value = settings[input.name]; });
    render();
  }));
  render();
  form.hidden = false;
})();
