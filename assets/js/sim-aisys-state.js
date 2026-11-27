// Interactive Rewind Wall, Trusted Verifier, and Multi-Hop KV explorer for Part 3.
// Synthetic teaching simulation only; no container, network, or model runs here.
(() => {
  "use strict";

  const SCENARIOS = [
    {
      id: "local-only",
      title: "1. Local file edit only (app.py fixed)",
      localChange: "Modified app.py inside sandbox",
      externalEffect: "None (network disabled)",
      verifierOutcome: "correct",
      kvHops: 0,
      baseAcc: 0.94,
      rewindClearsAll: true,
      action: "Admit to training batch",
      summary: "Local E_t rewinds cleanly, hidden tests pass, and no external side effects escaped the sandbox."
    },
    {
      id: "slack-webhook",
      title: "2. File edit + Slack webhook sent (external side effect)",
      localChange: "Modified app.py inside sandbox",
      externalEffect: "HTTP POST sent message to Slack",
      verifierOutcome: "correct",
      kvHops: 0,
      baseAcc: 0.94,
      rewindClearsAll: false,
      action: "Cannot rewind external message — mock egress or require idempotency key",
      summary: "Rewinding disk snapshot E_t restores app.py, but the Slack message CANNOT be unsent."
    },
    {
      id: "tamper-test",
      title: "3. Agent tries to edit hidden test script",
      localChange: "Attempted write to /verifier/test_app.py (denied)",
      externalEffect: "None",
      verifierOutcome: "invalid_action",
      kvHops: 0,
      baseAcc: 0.94,
      rewindClearsAll: true,
      action: "Penalize policy & keep grader isolated outside sandbox",
      summary: "Locked verifier boundary blocked test tampering and returned invalid_action."
    },
    {
      id: "sandbox-oom",
      title: "4. Sandbox OOM crash mid-compile",
      localChange: "Partial build artifacts lost on crash",
      externalEffect: "None",
      verifierOutcome: "infrastructure_failure",
      kvHops: 0,
      baseAcc: 0.94,
      rewindClearsAll: true,
      action: "Exclude from RL training & retry (never assign reward 0)",
      summary: "Verifier isolates infrastructure_failure so cluster OOMs never teach bad rewards."
    },
    {
      id: "two-hop-kv",
      title: "5. 2-hop Speculative Encoding handoff across models",
      localChange: "Translated K_t across 2 models (~7x prefill speedup)",
      externalEffect: "None",
      verifierOutcome: "correct",
      kvHops: 2,
      baseAcc: 0.94,
      rewindClearsAll: true,
      action: "Admit with recorded behavior logprobs (above 85% floor)",
      summary: "2 chained latent hops keep 88.3% synthetic accuracy (>= 85% floor); isolate K_t per tenant."
    },
    {
      id: "six-hop-kv",
      title: "6. 6-hop Speculative Encoding chain (accuracy drift alert)",
      localChange: "Translated K_t across 6 models",
      externalEffect: "None",
      verifierOutcome: "correct",
      kvHops: 6,
      baseAcc: 0.94,
      rewindClearsAll: true,
      action: "Force raw-text re-prefill checkpoint before grading",
      summary: "6 chained hops drop synthetic accuracy to 77.8% (< 85% floor); re-prefill from H_t."
    }
  ];

  function simulateScenario(scenarioId, applyRewind) {
    const s = SCENARIOS.find(item => item.id === scenarioId);
    if (!s) throw new RangeError(`Unknown scenario id: ${scenarioId}`);
    if (typeof applyRewind !== "boolean") throw new RangeError("applyRewind must be a boolean.");
    const syntheticAcc = Number((s.baseAcc * Math.pow(0.969, s.kvHops)).toFixed(4));
    const localAfter = applyRewind ? "Rewound to t=0 snapshot" : s.localChange;
    const externalAfter = applyRewind && !s.rewindClearsAll
      ? `STILL PRESENT: ${s.externalEffect}`
      : s.externalEffect;
    return {
      ...s,
      appliedRewind: applyRewind,
      localAfter,
      externalAfter,
      syntheticAcc,
      passesAccFloor: syntheticAcc >= 0.85
    };
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { SCENARIOS, simulateScenario };
  }
  if (typeof document === "undefined") return;

  const root = document.getElementById("sim-aisys-state");
  if (!root) return;

  const el = (tag, props = {}, ...kids) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...kids);
    return node;
  };

  const select = el("select", { id: "aisys-state-select" });
  select.append(...SCENARIOS.map(s => el("option", { value: s.id, textContent: s.title })));
  const fields = el("div", { className: "sim-fields" },
    el("label", { htmlFor: select.id }, "Choose an execution trace to inspect & rewind", select)
  );
  const bars = el("div", { className: "aisys-bars" });
  const receipt = el("dl", { className: "aisys-receipt" });
  const controls = el("div", { className: "sim-controls" });
  const status = el("p", { className: "sim-status" });
  const note = el("p", { className: "sim-note" });
  const live = el("div", {}, status, note);
  live.setAttribute("role", "status");
  live.setAttribute("aria-atomic", "true");

  let selectedId = SCENARIOS[0].id;
  let rewindOn = false;

  const buttons = [
    ["Simulate disk rewind (E_t -> t=0)", () => { rewindOn = true; }],
    ["Show before rewind", () => { rewindOn = false; }],
    ["Next scenario ->", () => {
      const idx = SCENARIOS.findIndex(s => s.id === selectedId);
      selectedId = SCENARIOS[(idx + 1) % SCENARIOS.length].id;
      select.value = selectedId;
      rewindOn = false;
    }]
  ];

  function render() {
    const res = simulateScenario(selectedId, rewindOn);
    const pct = Math.round(res.syntheticAcc * 100);
    const barClass = !res.passesAccFloor || !res.rewindClearsAll && res.appliedRewind
      ? "aisys-bar-fill--bottle"
      : res.kvHops > 0 ? "aisys-bar-fill--spec" : "aisys-bar-fill--ok";

    bars.replaceChildren(
      el("div", { className: "aisys-bar-row" },
        el("div", { className: "aisys-bar-head" },
          el("span", { textContent: res.kvHops > 0 ? `Latent KV accuracy (${res.kvHops} hops vs 85% floor)` : "Native text accuracy (0 hops)" }),
          el("strong", { textContent: `${(res.syntheticAcc * 100).toFixed(1)}%` })
        ),
        el("div", { className: "aisys-bar-track" },
          el("div", { className: `aisys-bar-fill ${barClass}`, style: `width:${pct}%` })
        )
      )
    );

    const facts = [
      ["Local sandbox (E_t)", res.localAfter],
      ["External world", res.externalAfter],
      ["Verifier outcome", res.verifierOutcome],
      ["Recommended action", res.action]
    ];
    receipt.replaceChildren(...facts.map(([k, v]) => el("div", {}, el("dt", { textContent: k }), el("dd", { textContent: v }))));
    const warn = (res.appliedRewind && !res.rewindClearsAll) || !res.passesAccFloor || res.verifierOutcome === "infrastructure_failure";
    status.classList.toggle("sim-error", warn);
    status.textContent = res.appliedRewind && !res.rewindClearsAll
      ? `Rewind warning: ${res.externalAfter} CANNOT be undone by disk snapshot E_t.`
      : `${res.title}: ${res.action}.`;
    note.textContent = res.summary;
  }

  for (const [label, fn] of buttons) {
    const btn = el("button", { type: "button", className: "sim-button", textContent: label });
    btn.addEventListener("click", () => { fn(); render(); });
    controls.append(btn);
  }

  select.addEventListener("change", () => {
    selectedId = select.value;
    rewindOn = false;
    render();
  });

  root.querySelector(".sim-fallback").before(
    el("div", { className: "sim-app" }, fields, bars, receipt, controls, live)
  );
  root.classList.add("is-live");
  render();
})();
