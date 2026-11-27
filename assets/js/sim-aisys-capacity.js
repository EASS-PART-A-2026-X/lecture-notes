// Synthetic teaching model for 4-fleet pipeline capacity and cross-model KV sharing.
// No real cluster, GPU, or model endpoint runs here.
(() => {
  "use strict";

  const CASES = [
    {
      id: "env-bound",
      title: "1. Environment-bound RL cluster (40 inf / 15 env / 50 ver / 35 learn)",
      inference: 40, environments: 15, verification: 50, learner: 35,
      contextK: 32, swarmSize: 3, baseAcc: 0.94, hops: 1
    },
    {
      id: "learner-bound",
      title: "2. Learner-bound queue (60 inf / 50 env / 55 ver / 15 learn)",
      inference: 60, environments: 50, verification: 55, learner: 15,
      contextK: 32, swarmSize: 3, baseAcc: 0.94, hops: 1
    },
    {
      id: "verifier-bound",
      title: "3. Verifier-bound backlog (45 inf / 40 env / 18 ver / 35 learn)",
      inference: 45, environments: 40, verification: 18, learner: 35,
      contextK: 64, swarmSize: 4, baseAcc: 0.94, hops: 2
    },
    {
      id: "swarm-sweet-spot",
      title: "4. Long-doc swarm (64k tokens, 5 models, 2 translation hops)",
      inference: 45, environments: 45, verification: 45, learner: 40,
      contextK: 64, swarmSize: 5, baseAcc: 0.94, hops: 2
    },
    {
      id: "multihop-drift",
      title: "5. Deep multi-hop swarm (64k tokens, 6 models, 6 hops — drift risk)",
      inference: 50, environments: 50, verification: 50, learner: 40,
      contextK: 64, swarmSize: 6, baseAcc: 0.94, hops: 6
    }
  ];

  function evaluateCapacity(rates) {
    const keys = ["inference", "environments", "verification", "learner"];
    for (const k of keys) {
      if (!Number.isFinite(rates[k]) || rates[k] <= 0) {
        throw new RangeError(`Fleet rate "${k}" must be a positive finite number.`);
      }
    }
    const goodput = Math.min(rates.inference, rates.environments, rates.verification, rates.learner);
    const bottlenecks = keys.filter(k => rates[k] === goodput);
    return { goodput, bottlenecks };
  }

  function evaluateSpeculativeEncoding(params) {
    const { contextK, swarmSize, baseAcc, hops } = params;
    if (!Number.isFinite(contextK) || contextK <= 0 || !Number.isInteger(swarmSize) || swarmSize < 1 ||
        !Number.isFinite(baseAcc) || baseAcc <= 0 || baseAcc > 1 || !Number.isInteger(hops) || hops < 0) {
      throw new RangeError("Invalid Speculative Encoding synthetic parameters.");
    }
    const perModelPrefillMs = Math.round(contextK * 18);
    const rawTotalMs = perModelPrefillMs * swarmSize;
    const speedup = Math.min(7.5, Math.max(1.5, (contextK / 16) * 1.4 + (swarmSize - 1) * 0.6));
    const translatedMs = Math.round(rawTotalMs / speedup);
    const compoundRetention = Math.pow(0.969, hops);
    const effectiveAcc = Number((baseAcc * compoundRetention).toFixed(4));
    return {
      rawTotalMs,
      translatedMs,
      speedup: Number((rawTotalMs / translatedMs).toFixed(2)),
      compoundRetention: Number(compoundRetention.toFixed(4)),
      effectiveAcc
    };
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { CASES, evaluateCapacity, evaluateSpeculativeEncoding };
  }
  if (typeof document === "undefined") return;

  const root = document.getElementById("sim-aisys-capacity");
  if (!root) return;

  const el = (tag, props = {}, ...kids) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...kids);
    return node;
  };

  const select = el("select", { id: "aisys-cap-case" });
  select.append(...CASES.map(c => el("option", { value: c.id, textContent: c.title })));

  const fields = el("div", { className: "sim-fields" },
    el("label", { htmlFor: select.id }, "Choose a synthetic cluster scenario", select)
  );
  const receipt = el("dl", { className: "aisys-receipt" });
  const controls = el("div", { className: "sim-controls" });
  const status = el("p", { className: "sim-status" });
  const note = el("p", { className: "sim-note" });
  const live = el("div", {}, status, note);
  live.setAttribute("role", "status");
  live.setAttribute("aria-atomic", "true");

  let state = { ...CASES[0] };

  const actions = [
    ["Add +20/min Inference GPUs", () => { state.inference += 20; return "Added +20/min inference capacity."; }],
    ["Add +20/min Sandboxes", () => { state.environments += 20; return "Added +20/min environment sandbox capacity."; }],
    ["Add +20/min Verifiers", () => { state.verification += 20; return "Added +20/min verifier capacity."; }],
    ["Reset scenario", () => { state = { ...CASES.find(c => c.id === select.value) }; return "Reset scenario to baseline."; }]
  ];

  function render(actionMsg) {
    const cap = evaluateCapacity(state);
    const se = evaluateSpeculativeEncoding(state);
    const facts = [
      ["Inference / Envs", `${state.inference}/min · ${state.environments}/min`],
      ["Verifiers / Learner", `${state.verification}/min · ${state.learner}/min`],
      ["Steady-state goodput", `${cap.goodput}/min (bottleneck: ${cap.bottlenecks.join(", ")})`],
      ["Raw N× prefill (synthetic)", `${se.rawTotalMs} ms (${state.swarmSize} models × ${state.contextK}k tok)`],
      ["Speculative Encoding", `${se.translatedMs} ms (${se.speedup}× faster; ${state.hops}-hop)`],
      ["Synthetic accuracy", `${(se.effectiveAcc * 100).toFixed(1)}% (0.969^${state.hops} × ${(state.baseAcc * 100).toFixed(0)}%)`]
    ];
    receipt.replaceChildren(...facts.map(([k, v]) => el("div", {}, el("dt", { textContent: k }), el("dd", { textContent: v }))));
    status.textContent = `${actionMsg} Goodput is ${cap.goodput}/min (${cap.bottlenecks.join(", ")}).`;
    status.classList.toggle("sim-error", se.effectiveAcc < 0.85);
    note.textContent = se.effectiveAcc < 0.85
      ? `Warning: ${state.hops} chained latent translations drop synthetic accuracy to ${(se.effectiveAcc * 100).toFixed(1)}%; re-prefill a checkpoint or verify before committing.`
      : `Synthetic model only (not a hardware benchmark): steady-state rollouts cannot exceed the slowest fleet (${cap.bottlenecks.join(", ")}).`;
  }

  for (const [label, fn] of actions) {
    const btn = el("button", { type: "button", className: "sim-button", textContent: label });
    btn.addEventListener("click", () => render(fn()));
    controls.append(btn);
  }

  select.addEventListener("change", () => {
    state = { ...CASES.find(c => c.id === select.value) };
    render("Loaded scenario.");
  });

  root.querySelector(".sim-fallback").before(
    el("div", { className: "sim-app" }, fields, receipt,
      el("p", { className: "sim-box-title", textContent: "Test an infrastructure change" }),
      controls, live)
  );
  root.classList.add("is-live");
  render("Loaded baseline scenario.");
})();
