// Synthetic teaching model for 4-fleet pipeline capacity, cross-model KV sharing,
// and the interactive Field Progress & Concept Explorer in Part 1.
// No real cluster, GPU, or model endpoint runs here.
(() => {
  "use strict";

  const CASES = [
    {
      id: "env-bound",
      title: "1. Slow sandboxes bottleneck (40 GPUs / 15 sandboxes / 50 graders / 35 learner)",
      inference: 40, environments: 15, verification: 50, learner: 35,
      contextK: 32, swarmSize: 3, baseAcc: 0.94, hops: 1
    },
    {
      id: "learner-bound",
      title: "2. Slow learner queue (60 GPUs / 50 sandboxes / 55 graders / 15 learner)",
      inference: 60, environments: 50, verification: 55, learner: 15,
      contextK: 32, swarmSize: 3, baseAcc: 0.94, hops: 1
    },
    {
      id: "verifier-bound",
      title: "3. Slow grader backlog (45 GPUs / 40 sandboxes / 18 graders / 35 learner)",
      inference: 45, environments: 40, verification: 18, learner: 35,
      contextK: 64, swarmSize: 4, baseAcc: 0.94, hops: 2
    },
    {
      id: "swarm-sweet-spot",
      title: "4. Multi-model team on 64k doc (5 models, 2 translation hops)",
      inference: 45, environments: 45, verification: 45, learner: 40,
      contextK: 64, swarmSize: 5, baseAcc: 0.94, hops: 2
    },
    {
      id: "multihop-drift",
      title: "5. Long 6-hop chain on 64k doc (drift warning)",
      inference: 50, environments: 50, verification: 50, learner: 40,
      contextK: 64, swarmSize: 6, baseAcc: 0.94, hops: 6
    }
  ];

  const PROGRESS_TRACKS = [
    {
      id: "training-scale",
      title: "1. Training scale (Data -> 6D parallelism -> MoE)",
      steps: [
        {
          era: "1. Early problem",
          concept: "Single-GPU training & raw web dumps",
          broken: "Models grew larger than one GPU's memory, and crashed runs forgot which training rows had already been seen.",
          solution: "Split weights and optimizer state across GPUs (FSDP/ZeRO) and added content-hashed manifests + checkpointable data loaders.",
          milestone: "TorchTitan & Megatron-LM train multi-billion-weight models cleanly across clusters.",
          status: "Dense scaling is mature; silent GPU math errors and MoE expert imbalance remain active engineering areas."
        },
        {
          era: "2. Breakthrough",
          concept: "6D parallelism & Mixture of Experts (MoE)",
          broken: "Sharding every layer identically hit network bottlenecks, while dense models multiplied every weight for every token.",
          solution: "Combined Data, Tensor, Pipeline, Expert, Context, and FSDP parallelism with sparse MoE routing (waking only selected experts).",
          milestone: "Frontier models (like DeepSeek-V3) co-designed model architecture alongside communication collectives.",
          status: "Standard for frontier pretraining; FP8/FP4 mixed precision and long-context scaling are actively refined."
        },
        {
          era: "3. Today's status & open gap",
          concept: "Unified training & generation code",
          broken: "Using separate codebases for training and serving caused subtle tokenization and weight-layout bugs.",
          solution: "Unified model definitions (e.g., TorchTitan + TitanRL) and automated numerical parity checks.",
          status: "Active frontier: fault-tolerant elastic clusters that keep training when GPUs drop mid-run.",
          milestone: "Reproducible data + weights + parity checks across training and serving."
        }
      ]
    },
    {
      id: "fast-serving",
      title: "2. Fast serving (Static batch -> PagedAttention -> Disaggregation)",
      steps: [
        {
          era: "1. Early problem",
          concept: "Static batching & contiguous KV buffers",
          broken: "Short replies waited idle behind long replies, and pre-allocating huge KV scratchpads wasted most GPU memory.",
          solution: "Orca introduced continuous iteration-level batching; FlashAttention cut memory traffic.",
          milestone: "Every finished request slot immediately admits the next waiting user.",
          status: "Continuous batching is now baseline in every production inference engine."
        },
        {
          era: "2. Breakthrough",
          concept: "PagedAttention & radix prefix caching",
          broken: "Each user still wasted memory on unused prompt padding or re-computed identical system prompts from zero.",
          solution: "vLLM paged KV caches into fixed blocks like OS virtual memory; SGLang added radix prefix reuse and chunked prefill.",
          milestone: "Higher concurrent batch sizes and instant reuse of shared instructions across requests.",
          status: "Mature single-model serving; Mooncake and LMCache extend KV tiers across RAM and RDMA."
        },
        {
          era: "3. Today's status & open gap",
          concept: "Prefill/decode disaggregation & orchestration",
          broken: "A single 64k-token prompt still stalls live token streaming for every other user on the same GPU.",
          solution: "DistServe, Splitwise, and Dynamo separate prefill workers from decode workers when transfer overhead pays off.",
          milestone: "Datacenter inference routers (Dynamo, llm-d) schedule around KV cache locality.",
          status: "Open trade-off: disaggregation only wins when saved stall time exceeds KV network transfer cost."
        }
      ]
    },
    {
      id: "cross-model",
      title: "3. Cross-model context (Raw N× text -> Plato's Key -> Speculative Encoding)",
      steps: [
        {
          era: "1. Early problem",
          concept: "Same-model prefix lock-in",
          broken: "Prefix caching fails whenever two agents use different model families—Model B must re-read all 64k raw tokens.",
          solution: "Recognized that the bottleneck in multi-model swarms is repeated prefill compute.",
          milestone: "Baseline: 100% native accuracy, but N× full prefill latency and cost.",
          status: "Still the safe default whenever accuracy cannot tolerate any approximation."
        },
        {
          era: "2. Breakthrough",
          concept: "Plato's Key (Stanford Hazy Research, Nov 2026)",
          broken: "Researchers doubted one LLM could directly read another LLM's internal hidden states without retraining.",
          solution: "Closed-form orthogonal Procrustes rotation + 1 global scale mapped hidden states across 12 LLMs (8 families) with zero gradient descent.",
          milestone: "41% median factual transfer (vs. 55% self-swap) and ~99% relative A->B->C chaining accuracy.",
          status: "Established the geometric foundation, though linear maps still trail native prefill on absolute accuracy."
        },
        {
          era: "3. Today's status & open gap",
          concept: "Speculative Encoding (Ramp Labs, Nov 2026)",
          broken: "Production swarms need near-native accuracy alongside fast cross-model handoffs.",
          solution: "Trained a single 2.35B MoE translator integrated with vLLM to convert hidden states/KV across 7 model families.",
          milestone: "Reported 96.9% baseline retention, up to 7.5× prefill speedup, and up to 128× query compression.",
          status: "Open engineering checks: compounding 0.969^k multi-hop accuracy drift and strict multi-tenant KV isolation."
        }
      ]
    },
    {
      id: "rl-learning",
      title: "4. Learning from action (SFT -> GRPO -> Bounded Async RL)",
      steps: [
        {
          era: "1. Early problem",
          concept: "Imitation-only training (SFT)",
          broken: "Models copied expert demonstrations well, but could not explore new strategies or recover when tools failed.",
          solution: "Introduced reinforcement learning (PPO, DPO) and verifiable graders (RLVR) so models learn from outcomes.",
          milestone: "DeepSeekMath and DeepSeek-R1 popularized critic-free GRPO group scoring.",
          status: "GRPO + RLVR are standard for code, math, and reasoning post-training."
        },
        {
          era: "2. Breakthrough",
          concept: "Asynchronous rollouts & durable state machines",
          broken: "Synchronous GRPO barriers left fast GPUs sitting idle behind one slow sandbox build; crashes became bogus 0 rewards.",
          solution: "Decoupled samplers, sandboxes, and learners with durable Rollout FSMs, staleness bounds (AReaL), and FAILED_INFRASTRUCTURE isolation.",
          milestone: "Higher GPU utilization without letting off-policy staleness destabilize gradients.",
          status: "Open challenge: balancing staleness, scheduler selection bias, and KV consistency across weight updates."
        },
        {
          era: "3. Today's status & open gap",
          concept: "Agentic RL & unified trajectory parity",
          broken: "Reconstructing rollouts from text or mismatched logprobs silently broke importance ratio ρ_t.",
          solution: "Strict Versioned Trajectory contracts storing exact token_ids, behavior_logprobs, policy versions, and action masks.",
          milestone: "Frameworks like verl, slime, Prime-RL, and AReaL standardize multi-turn RL pipelines.",
          status: "Active research: numerical bit-for-bit parity between training and inference kernels."
        }
      ]
    },
    {
      id: "safe-exec",
      title: "5. Safe execution & grading (Plain Docker -> CoW MicroVMs -> Locked Verifiers)",
      steps: [
        {
          era: "1. Early problem",
          concept: "Unsafe plain containers & slow cold starts",
          broken: "Mounting host folders or Docker sockets risked container escapes, while fresh npm/cargo installs made sandboxes bottleneck GPUs.",
          solution: "Hardened boundaries (non-root, --network none, Firecracker/gVisor) plus warm pools and prepared CoW snapshots.",
          milestone: "Sub-second forked workspaces via copy-on-write filesystems and build caches.",
          status: "MicroVM + CoW isolation is now best practice for untrusted agent execution."
        },
        {
          era: "2. Breakthrough",
          concept: "Independent trusted verifiers (Harbor & OpenEnv)",
          broken: "Agents that could edit test files or trigger reward bugs cheated graders; host crashes looked like agent mistakes.",
          solution: "Moved hidden tests outside the agent's writable disk and sorted outcomes into 6 buckets (separating agent errors from infra/verifier faults).",
          milestone: "Standardized reset/step/state contracts and reproducible task manifests.",
          status: "Active frontier: building cheat-proof verifiers and automated curricula."
        },
        {
          era: "3. Today's status & open gap",
          concept: "The Rewind Wall (unified state S_t)",
          broken: "Disk snapshots rewind local files cleanly, yet cannot undo emails, payments, or external API calls.",
          solution: "Explicit trust boundaries combining local CoW forks with idempotency keys, outboxes, and mocked external endpoints.",
          milestone: "Forkable reasoning trees paired with verified receipts for every reward.",
          status: "Open research: end-to-end transactional consistency across external side effects."
        }
      ]
    },
    {
      id: "frontier-2026",
      title: "6. DeepSeek & Kimi frontier (MLA/NSA/Engram & MuonClip/Linear/Swarms)",
      steps: [
        {
          era: "1. Early problem",
          concept: "Quadratic O(T^2) attention, bloated KV, and trillion-scale spikes",
          broken: "Every new token checked every past token, KV scratchpads filled GPU RAM, and 1T-weight runs suffered attention score spikes.",
          solution: "Engineers paired attention math changes with optimizer clipping and full-stack open GPU kernels.",
          milestone: "Recognized attention complexity, KV byte traffic, and training stability as one co-designed problem.",
          status: "Full quadratic attention remains the baseline for small prompts before sparse/latent optimizations take over."
        },
        {
          era: "2. Breakthrough",
          concept: "DeepSeek MLA/NSA/Open Stack & Kimi k1.5 / K2 MuonClip",
          broken: "Dense MoE all-to-all routing stalled GPUs, while long RL rollouts hit sync barriers and dropped hard tasks.",
          solution: "DeepSeek paired compressed MLA + NSA/DSA block selection with FlashMLA, DeepEP, DeepGEMM, 3FS, and DualPipe; Moonshot added Kimi k1.5 partial rollouts and K2 MuonClip (QK-Clip).",
          milestone: "Kimi K2 trained 1T weights (32B active) on 15.5T tokens with zero loss spikes reported; DualPipe overlapped forward/backward passes.",
          status: "Mature architecture pillars across 2025-2026 open-weight reasoning and coding models."
        },
        {
          era: "3. Today's status & open gap",
          concept: "Engram O(1) memory, Kimi Linear (KDA), & 100-agent swarms",
          broken: "Transformers still wasted MoE math memorizing static facts, linear models lagged on recall, and multi-agent swarms multiplied KV + sandbox demand.",
          solution: "DeepSeek Engram offloaded static N-gram lookups to host RAM; Kimi Linear (KDA) cut KV cache up to 75% reported; Kimi K2.5 scaled multimodal 100-agent swarms alongside cross-model KV transfer.",
          milestone: "Reported 75% KV savings (KDA) and sub-linear long-context scaling alongside Plato's Key & Speculative Encoding.",
          status: "Open frontier: exact numerical parity, swarm verifier trust boundaries, and multi-hop cross-model drift control."
        }
      ]
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

  function getProgressStep(trackId, eraIndex) {
    const track = PROGRESS_TRACKS.find(t => t.id === trackId);
    if (!track) throw new RangeError(`Unknown progress track: ${trackId}`);
    if (!Number.isInteger(eraIndex) || eraIndex < 0 || eraIndex >= track.steps.length) {
      throw new RangeError(`Invalid era index ${eraIndex} for track ${trackId}`);
    }
    return { trackTitle: track.title, eraIndex, ...track.steps[eraIndex] };
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { CASES, PROGRESS_TRACKS, evaluateCapacity, evaluateSpeculativeEncoding, getProgressStep };
  }
  if (typeof document === "undefined") return;

  const el = (tag, props = {}, ...kids) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...kids);
    return node;
  };

  // --- Mount 1: #sim-aisys-progress (Field Progress & Concept Explorer) ---
  const progRoot = document.getElementById("sim-aisys-progress");
  if (progRoot) {
    const select = el("select", { id: "aisys-prog-track" });
    select.append(...PROGRESS_TRACKS.map(t => el("option", { value: t.id, textContent: t.title })));
    const fields = el("div", { className: "sim-fields" },
      el("label", { htmlFor: select.id }, "Choose an AI systems topic to trace over time", select)
    );
    const receipt = el("dl", { className: "aisys-receipt" });
    const controls = el("div", { className: "sim-controls" });
    const status = el("p", { className: "sim-status" });
    const live = el("div", {}, status);
    live.setAttribute("role", "status");
    live.setAttribute("aria-atomic", "true");

    let trackId = PROGRESS_TRACKS[0].id;
    let eraIndex = 0;

    const eraButtons = [
      ["1. Early problem", () => { eraIndex = 0; }],
      ["2. Breakthrough", () => { eraIndex = 1; }],
      ["3. Today's status", () => { eraIndex = 2; }],
      ["Next era ->", () => { eraIndex = (eraIndex + 1) % 3; }]
    ];

    function renderProgress() {
      const step = getProgressStep(trackId, eraIndex);
      const facts = [
        ["Core concept / term", step.concept],
        ["What broke", step.broken],
        ["How the field solved it", step.solution],
        ["Milestone / result", step.milestone],
        ["Current status & open gap", step.status]
      ];
      receipt.replaceChildren(...facts.map(([k, v]) => el("div", {}, el("dt", { textContent: k }), el("dd", { textContent: v }))));
      status.textContent = `${step.trackTitle} — ${step.era}: ${step.concept}.`;
    }

    for (const [label, fn] of eraButtons) {
      const btn = el("button", { type: "button", className: "sim-button", textContent: label });
      btn.addEventListener("click", () => { fn(); renderProgress(); });
      controls.append(btn);
    }
    select.addEventListener("change", () => {
      trackId = select.value;
      eraIndex = 0;
      renderProgress();
    });

    progRoot.querySelector(".sim-fallback").before(
      el("div", { className: "sim-app" }, fields, controls, receipt, live)
    );
    progRoot.classList.add("is-live");
    renderProgress();
  }

  // --- Mount 2: #sim-aisys-capacity (Fleet Bottleneck & Speculative Encoding) ---
  const root = document.getElementById("sim-aisys-capacity");
  if (!root) return;

  const select = el("select", { id: "aisys-cap-case" });
  select.append(...CASES.map(c => el("option", { value: c.id, textContent: c.title })));

  const fields = el("div", { className: "sim-fields" },
    el("label", { htmlFor: select.id }, "Choose a synthetic cluster scenario", select)
  );
  const fleetBars = el("div", { className: "aisys-bars" });
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
    ["Add +20/min Sandboxes", () => { state.environments += 20; return "Added +20/min sandbox capacity."; }],
    ["Add +20/min Verifiers", () => { state.verification += 20; return "Added +20/min grader capacity."; }],
    ["Reset scenario", () => { state = { ...CASES.find(c => c.id === select.value) }; return "Reset scenario to baseline."; }]
  ];

  function barRow(label, valueText, pct, fillClass) {
    return el("div", { className: "aisys-bar-row" },
      el("div", { className: "aisys-bar-head" },
        el("span", { textContent: label }),
        el("strong", { textContent: valueText })
      ),
      el("div", { className: "aisys-bar-track" },
        el("div", { className: `aisys-bar-fill ${fillClass}`.trim(), style: `width:${Math.max(4, Math.min(100, pct))}%` })
      )
    );
  }

  function render(actionMsg) {
    const cap = evaluateCapacity(state);
    const se = evaluateSpeculativeEncoding(state);
    const maxRate = Math.max(state.inference, state.environments, state.verification, state.learner, 80);
    const fleets = [
      ["inference", "1. Inference GPUs"],
      ["environments", "2. Sandboxes"],
      ["verification", "3. Trusted Graders"],
      ["learner", "4. Training Learner"]
    ];
    const rows = fleets.map(([k, title]) => {
      const isBottle = cap.bottlenecks.includes(k);
      const val = state[k];
      return barRow(
        isBottle ? `${title} — BOTTLENECK` : title,
        `${val}/min`,
        (val / maxRate) * 100,
        isBottle ? "aisys-bar-fill--bottle" : ""
      );
    });
    rows.push(
      barRow("Raw N× text reading", `${se.rawTotalMs} ms`, 100, "aisys-bar-fill--bottle"),
      barRow(
        `Speculative Encoding (${state.hops}-hop, ${(se.effectiveAcc * 100).toFixed(1)}% acc)`,
        `${se.translatedMs} ms (${se.speedup}× faster)`,
        (se.translatedMs / se.rawTotalMs) * 100,
        se.effectiveAcc < 0.85 ? "aisys-bar-fill--bottle" : "aisys-bar-fill--spec"
      )
    );
    fleetBars.replaceChildren(...rows);

    const facts = [
      ["Steady-state goodput", `${cap.goodput}/min (bottleneck: ${cap.bottlenecks.join(", ")})`],
      ["Cross-model speedup", `${se.speedup}× faster (${se.rawTotalMs} ms → ${se.translatedMs} ms)`],
      ["Synthetic accuracy", `${(se.effectiveAcc * 100).toFixed(1)}% (0.969^${state.hops} × ${(state.baseAcc * 100).toFixed(0)}%)`]
    ];
    receipt.replaceChildren(...facts.map(([k, v]) => el("div", {}, el("dt", { textContent: k }), el("dd", { textContent: v }))));
    status.textContent = `${actionMsg} Goodput is ${cap.goodput}/min (${cap.bottlenecks.join(", ")}).`;
    status.classList.toggle("sim-error", se.effectiveAcc < 0.85);
    note.textContent = se.effectiveAcc < 0.85
      ? `Warning: ${state.hops} chained latent translations drop synthetic accuracy to ${(se.effectiveAcc * 100).toFixed(1)}%; re-read raw text at a checkpoint before grading.`
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
    el("div", { className: "sim-app" }, fields, fleetBars, receipt,
      el("p", { className: "sim-box-title", textContent: "Test an infrastructure change" }),
      controls, live)
  );
  root.classList.add("is-live");
  render("Loaded baseline scenario.");
})();
