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
          solution: "Trained one shared 2.35B MoE translator, served through vLLM, that turns hidden states into KV caches across 7 models from 4 families (all 42 directions).",
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
          solution: "DeepSeek paired compressed MLA, NSA research, and V3.2's DSA top-2,048 token selection with FlashMLA, DeepEP, DeepGEMM, 3FS, and DualPipe; Moonshot added Kimi k1.5 partial rollouts and K2 MuonClip (QK-Clip).",
          milestone: "Kimi K2 trained 1T weights (32B active) on 15.5T tokens with zero loss spikes reported; DualPipe overlapped forward/backward passes.",
          status: "Mature architecture pillars across 2025-2026 open-weight reasoning and coding models."
        },
        {
          era: "3. Today's status & open gap",
          concept: "Engram O(1) memory, Kimi Linear (KDA), & 100-agent swarms",
          broken: "Transformers still wasted MoE math memorizing static facts, linear models lagged on recall, and multi-agent swarms multiplied KV + sandbox demand.",
          solution: "DeepSeek Engram offloaded static N-gram lookups to host RAM; Kimi Linear (KDA) cut KV cache up to 75% reported; Kimi K2.5 scaled multimodal 100-agent swarms alongside cross-model KV transfer.",
          milestone: "Kimi Linear reported up to 75% less KV cache and up to 6× faster decoding at 1M tokens; Kimi K2.5 reported swarms of up to 100 sub-agents.",
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

  function buildDecayCurvePoints(baseAcc, maxHops = 8) {
    if (!Number.isFinite(baseAcc) || baseAcc <= 0 || baseAcc > 1) {
      throw new RangeError("baseAcc must be a positive finite number <= 1.");
    }
    if (!Number.isInteger(maxHops) || maxHops < 0 || maxHops > 16) {
      throw new RangeError("maxHops must be an integer between 0 and 16.");
    }
    const points = [];
    for (let hops = 0; hops <= maxHops; hops += 1) {
      const acc = Number((baseAcc * Math.pow(0.969, hops)).toFixed(4));
      points.push({ hops, acc, safe: acc >= 0.85 });
    }
    return points;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      CASES,
      PROGRESS_TRACKS,
      evaluateCapacity,
      evaluateSpeculativeEncoding,
      getProgressStep,
      buildDecayCurvePoints
    };
  }
  if (typeof document === "undefined") return;

  if (document.body) {
    document.body.classList.add("aisys-page");
  }

  const SVG_NS = "http://www.w3.org/2000/svg";

  function el(tag, props = {}, ...kids) {
    const node = document.createElement(tag);
    for (const [key, val] of Object.entries(props)) {
      if (val === undefined || val === null) continue;
      if (key.startsWith("aria-") || key.startsWith("data-") || key === "role" || key === "for") {
        node.setAttribute(key, String(val));
      } else {
        node[key] = val;
      }
    }
    node.append(...kids);
    return node;
  }

  function svgEl(tag, attrs = {}, ...kids) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, val] of Object.entries(attrs)) {
      if (val !== undefined && val !== null) {
        node.setAttribute(key, String(val));
      }
    }
    node.append(...kids);
    return node;
  }

  // --- Shared UX 1: Live Glossary Filter ---
  function initGlossaryFilter() {
    const details = Array.from(document.querySelectorAll("details"))
      .find(d => d.querySelector("summary")?.textContent?.includes("Terms used on this page"));
    if (!details) return;
    const list = details.querySelector("ul");
    if (!list) return;

    list.classList.add("aisys-glossary-list");
    const items = Array.from(list.children);
    const input = el("input", {
      type: "search",
      className: "aisys-glossary-input",
      placeholder: "Filter glossary terms (e.g. MLA, MoE, kv)...",
      "aria-label": "Filter glossary terms"
    });
    const count = el("span", {
      className: "aisys-glossary-count",
      "aria-live": "polite",
      textContent: `${items.length} terms`
    });
    const clearBtn = el("button", {
      type: "button",
      className: "sim-button sim-quiet aisys-glossary-clear",
      textContent: "Clear",
      disabled: true,
      "aria-disabled": "true"
    });
    const emptyNote = el("p", {
      className: "aisys-glossary-empty sim-note",
      textContent: "No glossary terms match that filter.",
      hidden: true
    });
    const bar = el("div", { className: "aisys-glossary-bar" }, input, count, clearBtn);

    function applyFilter() {
      const q = input.value.trim().toLowerCase();
      if (q) details.open = true;
      let visible = 0;
      for (const li of items) {
        const match = !q || li.textContent.toLowerCase().includes(q);
        li.classList.toggle("is-hidden", !match);
        if (match) visible += 1;
      }
      count.textContent = q ? `${visible} of ${items.length} shown` : `${items.length} terms`;
      emptyNote.hidden = visible > 0;
      const hasQuery = input.value.length > 0;
      clearBtn.disabled = !hasQuery;
      clearBtn.setAttribute("aria-disabled", String(!hasQuery));
    }

    input.addEventListener("input", applyFilter);
    clearBtn.addEventListener("click", () => {
      input.value = "";
      applyFilter();
      input.focus();
    });

    list.before(bar);
    list.after(emptyNote);
  }

  // --- Shared UX 2: Native <dialog> Diagram Lightbox ---
  function extractCaptionText(caption, fallbackAlt) {
    if (!caption) return fallbackAlt || "";
    const clone = caption.cloneNode(true);
    for (const junk of clone.querySelectorAll(".screen-only, a[href$='.svg']")) {
      junk.remove();
    }
    return clone.textContent.replace(/\s+/g, " ").trim().replace(/\.\s*\./g, ".").replace(/\s+\.$/, ".") || fallbackAlt || "";
  }

  function initDiagramLightbox() {
    const entries = Array.from(document.querySelectorAll(".course-diagram"))
      .map(fig => {
        const img = fig.querySelector(".diagram-scroll img");
        if (!img) return null;
        const caption = fig.querySelector("figcaption");
        const rawLink = fig.querySelector("figcaption a[href$='.svg']");
        return {
          fig,
          img,
          src: rawLink ? rawLink.getAttribute("href") : img.getAttribute("src"),
          alt: img.getAttribute("alt") || "",
          captionText: extractCaptionText(caption, img.getAttribute("alt"))
        };
      })
      .filter(Boolean);
    if (entries.length === 0) return;

    let dialog = document.getElementById("aisys-lightbox");
    if (!dialog) {
      const countEl = el("span", { className: "aisys-lb-count aisys-pill aisys-pill--muted" });
      const prevBtn = el("button", {
        type: "button",
        className: "aisys-lb-prev",
        textContent: "← Previous",
        "aria-label": "Previous diagram"
      });
      const nextBtn = el("button", {
        type: "button",
        className: "aisys-lb-next",
        textContent: "Next →",
        "aria-label": "Next diagram"
      });
      const zoomBtn = el("button", {
        type: "button",
        className: "aisys-lb-zoom",
        textContent: "Zoom 140%",
        "aria-pressed": "false"
      });
      const closeBtn = el("button", {
        type: "button",
        className: "aisys-lb-close",
        textContent: "Close (Esc)",
        "aria-label": "Close diagram viewer"
      });
      const stageImg = el("img", { className: "aisys-lb-img", alt: "" });
      const stage = el("div", { className: "aisys-lb-stage" }, stageImg);
      const captionTextEl = el("span", { className: "aisys-lb-caption-text" });
      const rawLink = el("a", {
        className: "aisys-lb-raw",
        target: "_blank",
        rel: "noopener",
        textContent: "Open raw SVG ↗"
      });
      const captionEl = el("div", { className: "aisys-lb-caption" }, captionTextEl, rawLink);

      const bar = el("div", { className: "aisys-lb-bar" },
        el("div", { className: "aisys-badge-row" },
          el("span", { className: "aisys-pill aisys-pill--navy", textContent: "Diagram Inspector" }),
          countEl
        ),
        el("div", { className: "aisys-badge-row" }, prevBtn, nextBtn, zoomBtn, closeBtn)
      );

      dialog = el("dialog", {
        className: "aisys-lightbox",
        id: "aisys-lightbox",
        "aria-label": "Diagram viewer"
      }, bar, stage, captionEl);
      document.body.append(dialog);

      let currentIndex = 0;
      let zoomed = false;
      let lastTrigger = null;

      function syncView(idx) {
        currentIndex = (idx + entries.length) % entries.length;
        const item = entries[currentIndex];
        stageImg.src = item.img.currentSrc || item.src;
        stageImg.alt = item.alt;
        countEl.textContent = `${currentIndex + 1} / ${entries.length}`;
        captionTextEl.textContent = item.captionText;
        rawLink.href = item.src;
        stage.classList.toggle("is-zoomed", zoomed);
        zoomBtn.setAttribute("aria-pressed", String(zoomed));
        zoomBtn.textContent = zoomed ? "Reset 100%" : "Zoom 140%";
        stage.scrollTop = 0;
        stage.scrollLeft = 0;
      }

      function openAt(idx, trigger) {
        lastTrigger = trigger || document.activeElement;
        zoomed = false;
        syncView(idx);
        if (typeof dialog.showModal === "function") {
          if (!dialog.open) dialog.showModal();
        } else {
          dialog.setAttribute("open", "");
        }
        closeBtn.focus();
      }

      function closeModal() {
        if (typeof dialog.close === "function" && dialog.open) {
          dialog.close();
        } else {
          dialog.removeAttribute("open");
          if (lastTrigger && typeof lastTrigger.focus === "function") lastTrigger.focus();
        }
      }

      prevBtn.addEventListener("click", () => syncView(currentIndex - 1));
      nextBtn.addEventListener("click", () => syncView(currentIndex + 1));
      zoomBtn.addEventListener("click", () => {
        zoomed = !zoomed;
        syncView(currentIndex);
      });
      closeBtn.addEventListener("click", closeModal);
      dialog.addEventListener("click", evt => {
        if (evt.target === dialog) closeModal();
      });
      dialog.addEventListener("close", () => {
        if (lastTrigger && typeof lastTrigger.focus === "function") {
          lastTrigger.focus();
        }
      });
      dialog.addEventListener("keydown", evt => {
        if (evt.key === "ArrowLeft") {
          evt.preventDefault();
          syncView(currentIndex - 1);
        } else if (evt.key === "ArrowRight") {
          evt.preventDefault();
          syncView(currentIndex + 1);
        }
      });

      entries.forEach((entry, idx) => {
        const inspectBtn = el("button", {
          type: "button",
          className: "aisys-zoom-btn",
          textContent: "Inspect ⤢",
          "aria-label": `Inspect diagram ${idx + 1} in full view`
        });
        inspectBtn.addEventListener("click", () => openAt(idx, inspectBtn));
        entry.img.addEventListener("click", () => openAt(idx, inspectBtn));
        entry.fig.prepend(inspectBtn);
      });
    }
  }

  // --- Mount 1: #sim-aisys-progress (Visual Era Explorer & Semantic Bento Grid) ---
  function mountProgressExplorer() {
    const progRoot = document.getElementById("sim-aisys-progress");
    if (!progRoot) return;
    const fallback = progRoot.querySelector(".sim-fallback");
    if (!fallback) return;

    const SHORT_TOPICS = {
      "training-scale": "1. Training scale",
      "fast-serving": "2. Fast serving",
      "cross-model": "3. Cross-model KV",
      "rl-learning": "4. Learning from action",
      "safe-exec": "5. Safe execution",
      "frontier-2026": "6. DeepSeek & Kimi"
    };

    const select = el("select", { id: "aisys-prog-track", className: "sr-only" });
    select.append(...PROGRESS_TRACKS.map(t => el("option", { value: t.id, textContent: t.title })));
    const srLabel = el("label", { htmlFor: select.id, className: "sr-only", textContent: "Choose an AI systems topic to trace over time" });

    const eraBadge = el("span", { className: "aisys-pill aisys-pill--teal" });
    const head = el("div", { className: "aisys-sim-head" },
      el("span", { className: "aisys-pill aisys-pill--navy", textContent: "Field Evolution Explorer" }),
      eraBadge
    );

    const pillsWrap = el("div", { className: "aisys-pills", role: "group", "aria-label": "AI systems topics" });
    const pillButtons = new Map();
    const timelineWrap = el("div", { className: "aisys-timeline", role: "group", "aria-label": "Evolution stages" });
    const timelineNodes = [];
    const bento = el("div", { className: "aisys-bento" });
    const controls = el("div", { className: "sim-controls" });
    const status = el("p", { className: "sim-status" });
    const live = el("div", { role: "status", "aria-atomic": "true" }, status);

    let trackId = PROGRESS_TRACKS[0].id;
    let eraIndex = 0;

    function bentoCard(modClass, label, body) {
      return el("article", { className: `aisys-card ${modClass}` },
        el("h4", { className: "aisys-card-label", textContent: label }),
        el("p", { className: "aisys-card-body", textContent: body })
      );
    }

    function renderProgress() {
      const step = getProgressStep(trackId, eraIndex);
      select.value = trackId;
      eraBadge.textContent = step.era;

      for (const [id, btn] of pillButtons.entries()) {
        btn.setAttribute("aria-pressed", String(id === trackId));
      }

      timelineNodes.forEach((node, idx) => {
        const active = idx === eraIndex;
        const done = idx < eraIndex;
        node.classList.toggle("is-active", active);
        node.classList.toggle("is-done", done);
        node.setAttribute("aria-pressed", String(active));
        if (active) node.setAttribute("aria-current", "step");
        else node.removeAttribute("aria-current");
      });

      bento.replaceChildren(
        bentoCard("aisys-card--hero", "Core concept / term", step.concept),
        bentoCard("aisys-card--red", "What broke", step.broken),
        bentoCard("aisys-card--green", "How the field solved it", step.solution),
        bentoCard("aisys-card--teal", "Milestone / result", step.milestone),
        bentoCard("aisys-card--ochre", "Today's status & open gap", step.status)
      );
      status.textContent = `${step.trackTitle} — ${step.era}: ${step.concept}.`;
    }

    for (const track of PROGRESS_TRACKS) {
      const btn = el("button", {
        type: "button",
        className: "aisys-pill-btn",
        textContent: SHORT_TOPICS[track.id] || track.title,
        title: track.title,
        "aria-pressed": String(track.id === trackId)
      });
      btn.addEventListener("click", () => {
        trackId = track.id;
        eraIndex = 0;
        renderProgress();
      });
      pillButtons.set(track.id, btn);
      pillsWrap.append(btn);
    }

    const eraLabels = ["1. Early problem", "2. Breakthrough", "3. Today's status"];
    eraLabels.forEach((label, idx) => {
      const stepBtn = el("button", {
        type: "button",
        className: "aisys-timeline-step",
        "aria-pressed": String(idx === eraIndex)
      },
        el("span", { className: "aisys-timeline-dot", "aria-hidden": "true", textContent: String(idx + 1) }),
        el("span", { className: "aisys-timeline-label", textContent: label })
      );
      stepBtn.addEventListener("click", () => {
        eraIndex = idx;
        renderProgress();
      });
      timelineNodes.push(stepBtn);
      timelineWrap.append(stepBtn);
    });

    const prevEraBtn = el("button", { type: "button", className: "sim-button sim-quiet", textContent: "← Previous era" });
    const nextEraBtn = el("button", { type: "button", className: "sim-button", textContent: "Next era →" });
    prevEraBtn.addEventListener("click", () => { eraIndex = (eraIndex + 2) % 3; renderProgress(); });
    nextEraBtn.addEventListener("click", () => { eraIndex = (eraIndex + 1) % 3; renderProgress(); });
    controls.append(prevEraBtn, nextEraBtn);

    select.addEventListener("change", () => {
      trackId = select.value;
      eraIndex = 0;
      renderProgress();
    });

    fallback.before(
      el("div", { className: "sim-app" }, head, srLabel, select, pillsWrap, timelineWrap, bento, controls, live)
    );
    progRoot.classList.add("is-live");
    renderProgress();
  }

  // --- Mount 2: #sim-aisys-capacity (Interactive Sliders, KPI Tiles & SVG Decay Sparkline) ---
  function mountCapacityLab() {
    const root = document.getElementById("sim-aisys-capacity");
    if (!root) return;
    const fallback = root.querySelector(".sim-fallback");
    if (!fallback) return;

    const PRESET_SHORT = {
      "env-bound": "1. Slow sandboxes",
      "learner-bound": "2. Slow learner",
      "verifier-bound": "3. Slow graders",
      "swarm-sweet-spot": "4. 5-model team (64k)",
      "multihop-drift": "5. 6-hop drift"
    };

    const SLIDER_SPECS = [
      { key: "inference", label: "Inference GPUs", min: 5, max: 120, step: 1, fmt: v => `${v}/min` },
      { key: "environments", label: "Sandboxes", min: 5, max: 120, step: 1, fmt: v => `${v}/min` },
      { key: "verification", label: "Trusted Graders", min: 5, max: 120, step: 1, fmt: v => `${v}/min` },
      { key: "learner", label: "Training Learner", min: 5, max: 120, step: 1, fmt: v => `${v}/min` },
      { key: "contextK", label: "Context length (K tokens)", min: 8, max: 128, step: 8, fmt: v => `${v}K` },
      { key: "hops", label: "Cross-model hops", min: 0, max: 8, step: 1, fmt: v => `${v} ${v === 1 ? "hop" : "hops"}` }
    ];

    const select = el("select", { id: "aisys-cap-case", className: "sr-only" });
    select.append(...CASES.map(c => el("option", { value: c.id, textContent: c.title })));
    const srLabel = el("label", { htmlFor: select.id, className: "sr-only", textContent: "Choose a synthetic cluster scenario" });

    const modeBadge = el("span", { className: "aisys-pill aisys-pill--teal" });
    const head = el("div", { className: "aisys-sim-head" },
      el("span", { className: "aisys-pill aisys-pill--navy", textContent: "Cluster & Cross-Model Lab" }),
      modeBadge
    );

    const pillsWrap = el("div", { className: "aisys-pills", role: "group", "aria-label": "Cluster presets" });
    const pillButtons = new Map();
    const slidersWrap = el("div", { className: "aisys-sliders" });
    const kpisWrap = el("div", { className: "aisys-kpis" });
    const fleetBars = el("div", { className: "aisys-bars" });
    const chartBox = el("div", { className: "aisys-chart-box" });
    const controls = el("div", { className: "sim-controls" });
    const status = el("p", { className: "sim-status" });
    const note = el("p", { className: "sim-note" });
    const live = el("div", { role: "status", "aria-atomic": "true" }, status, note);

    let activePresetId = CASES[0].id;
    let state = { ...CASES[0] };
    const sliderControls = new Map();

    for (const preset of CASES) {
      const btn = el("button", {
        type: "button",
        className: "aisys-pill-btn",
        textContent: PRESET_SHORT[preset.id] || preset.title,
        title: preset.title,
        "aria-pressed": String(preset.id === activePresetId)
      });
      btn.addEventListener("click", () => {
        activePresetId = preset.id;
        select.value = preset.id;
        state = { ...preset };
        render("Loaded preset scenario.");
      });
      pillButtons.set(preset.id, btn);
      pillsWrap.append(btn);
    }

    for (const spec of SLIDER_SPECS) {
      const inputId = `aisys-slider-${spec.key}`;
      const output = el("output", { className: "aisys-slider-val", for: inputId, textContent: spec.fmt(state[spec.key]) });
      const range = el("input", {
        id: inputId,
        type: "range",
        className: "aisys-range",
        min: String(spec.min),
        max: String(spec.max),
        step: String(spec.step),
        value: String(state[spec.key])
      });
      range.addEventListener("input", () => {
        state[spec.key] = Number(range.value);
        render(`Adjusted ${spec.label}.`);
      });
      sliderControls.set(spec.key, { range, output, spec });
      slidersWrap.append(
        el("div", { className: "aisys-slider-row" },
          el("div", { className: "aisys-slider-head" },
            el("label", { htmlFor: inputId, className: "aisys-slider-label", textContent: spec.label }),
            output
          ),
          range
        )
      );
    }

    function kpiTile(label, value, sub, tone) {
      return el("div", { className: `aisys-kpi aisys-kpi--${tone}`, "data-tone": tone },
        el("span", { className: "aisys-kpi-label", textContent: label }),
        el("strong", { className: "aisys-kpi-val", textContent: value }),
        el("span", { className: "aisys-kpi-sub", textContent: sub })
      );
    }

    function barRow(label, valueText, pct, fillClass, badgeText) {
      const headLeft = badgeText
        ? el("span", { className: "aisys-bar-title" },
            label,
            " ",
            el("span", { className: "aisys-badge aisys-badge--bottle", textContent: badgeText })
          )
        : el("span", { className: "aisys-bar-title", textContent: label });
      return el("div", { className: "aisys-bar-row" },
        el("div", { className: "aisys-bar-head" },
          headLeft,
          el("strong", { textContent: valueText })
        ),
        el("div", { className: "aisys-bar-track" },
          el("div", { className: `aisys-bar-fill ${fillClass}`.trim(), style: `width:${Math.max(4, Math.min(100, pct))}%` })
        )
      );
    }

    function renderSparkline(baseAcc, currentHops, currentAcc) {
      const points = buildDecayCurvePoints(baseAcc, 8);
      const W = 560;
      const H = 150;
      const left = 46;
      const right = 22;
      const top = 22;
      const bottom = 28;
      const plotW = W - left - right;
      const plotH = H - top - bottom;
      const minY = Math.min(0.65, Math.floor(points[points.length - 1].acc * 20) / 20 - 0.05);
      const maxY = 1.0;

      const xFor = h => left + (h / 8) * plotW;
      const yFor = acc => top + ((maxY - acc) / (maxY - minY)) * plotH;
      const y85 = yFor(0.85);
      const yBottom = top + plotH;

      const svg = svgEl("svg", {
        class: "aisys-sparkline",
        viewBox: `0 0 ${W} ${H}`,
        role: "img",
        "aria-label": `Multi-hop accuracy decay curve from ${(baseAcc * 100).toFixed(0)}% across 0 to 8 hops`
      });

      // Danger zone below 85%
      svg.append(
        svgEl("rect", {
          x: left,
          y: y85,
          width: plotW,
          height: Math.max(0, yBottom - y85),
          fill: "rgba(155, 44, 44, 0.08)"
        }),
        svgEl("text", {
          x: left + 6,
          y: yBottom - 5,
          "font-size": "10",
          fill: "#9b2c2c"
        }, "Danger zone (< 85% floor)")
      );

      // Horizontal reference ticks
      for (const tick of [1.0, 0.9, 0.85, 0.7]) {
        if (tick < minY) continue;
        const y = yFor(tick);
        const isFloor = tick === 0.85;
        svg.append(
          svgEl("line", {
            x1: left,
            y1: y,
            x2: W - right,
            y2: y,
            stroke: isFloor ? "#9b2c2c" : "#dce3eb",
            "stroke-width": isFloor ? "1.5" : "1",
            ...(isFloor ? { "stroke-dasharray": "5 4" } : {})
          }),
          svgEl("text", {
            x: left - 6,
            y: y + 3.5,
            "text-anchor": "end",
            "font-size": "10",
            "font-weight": isFloor ? "700" : "500",
            fill: isFloor ? "#9b2c2c" : "#5a6778"
          }, `${Math.round(tick * 100)}%`)
        );
      }

      // Vertical grid & X-axis labels (0..8 hops)
      for (const pt of points) {
        const x = xFor(pt.hops);
        svg.append(
          svgEl("line", {
            x1: x,
            y1: top,
            x2: x,
            y2: yBottom,
            stroke: pt.hops === currentHops ? "#cbd5e1" : "#eef2f6",
            "stroke-width": pt.hops === currentHops ? "1.5" : "1"
          }),
          svgEl("text", {
            x,
            y: H - 8,
            "text-anchor": "middle",
            "font-size": "10.5",
            "font-weight": pt.hops === currentHops ? "700" : "500",
            fill: pt.hops === currentHops ? "#102a43" : "#5a6778"
          }, pt.hops === 0 ? "0" : `${pt.hops}`)
        );
      }

      // Decay curve polyline
      const polyPts = points.map(p => `${xFor(p.hops).toFixed(1)},${yFor(p.acc).toFixed(1)}`).join(" ");
      svg.append(
        svgEl("polyline", {
          points: polyPts,
          fill: "none",
          stroke: "#0f766e",
          "stroke-width": "2.5",
          "stroke-linecap": "round",
          "stroke-linejoin": "round"
        })
      );

      // Hollow dots for every hop 0..8
      for (const pt of points) {
        svg.append(
          svgEl("circle", {
            cx: xFor(pt.hops).toFixed(1),
            cy: yFor(pt.acc).toFixed(1),
            r: "4",
            fill: "#ffffff",
            stroke: pt.safe ? "#0f766e" : "#9b2c2c",
            "stroke-width": "2"
          })
        );
      }

      // Highlighted active dot + callout badge
      const activePt = points[Math.min(points.length - 1, Math.max(0, currentHops))];
      const ax = xFor(activePt.hops);
      const ay = yFor(activePt.acc);
      const badgeColor = activePt.safe ? "#0f766e" : "#9b2c2c";
      const badgeText = `${currentHops} ${currentHops === 1 ? "hop" : "hops"}: ${(currentAcc * 100).toFixed(1)}%`;
      const badgeW = 96;
      const badgeH = 20;
      const bx = Math.min(W - right - badgeW, Math.max(left + 2, currentHops >= 6 ? ax - badgeW - 10 : ax + 10));
      const by = activePt.safe
        ? Math.max(4, ay - badgeH - 10)
        : Math.min(yBottom - badgeH - 4, ay + 12);

      svg.append(
        svgEl("circle", { cx: ax.toFixed(1), cy: ay.toFixed(1), r: "8.5", fill: badgeColor, "fill-opacity": "0.18" }),
        svgEl("circle", { cx: ax.toFixed(1), cy: ay.toFixed(1), r: "5.5", fill: badgeColor, stroke: "#ffffff", "stroke-width": "2" }),
        svgEl("rect", { x: bx.toFixed(1), y: by.toFixed(1), width: badgeW, height: badgeH, rx: "4", fill: badgeColor }),
        svgEl("text", {
          x: (bx + badgeW / 2).toFixed(1),
          y: (by + 13.5).toFixed(1),
          "text-anchor": "middle",
          "font-size": "10.5",
          "font-weight": "700",
          fill: "#ffffff"
        }, badgeText)
      );

      chartBox.replaceChildren(
        el("div", { className: "aisys-chart-title" },
          `Multi-hop accuracy decay (0.969^k × ${(baseAcc * 100).toFixed(0)}% native) · `,
          el("span", { textContent: "Dashed line: 85% floor" })
        ),
        svg
      );
    }

    function matchesPreset(preset) {
      return SLIDER_SPECS.every(spec => state[spec.key] === preset[spec.key]);
    }

    function render(actionMsg) {
      const cap = evaluateCapacity(state);
      const se = evaluateSpeculativeEncoding(state);

      // Sync preset pills & sliders
      const matched = CASES.find(matchesPreset);
      activePresetId = matched ? matched.id : "";
      if (matched) select.value = matched.id;
      for (const [id, btn] of pillButtons.entries()) {
        btn.setAttribute("aria-pressed", String(id === activePresetId));
      }
      for (const { range, output, spec } of sliderControls.values()) {
        range.value = String(state[spec.key]);
        output.textContent = spec.fmt(state[spec.key]);
      }

      const accSafe = se.effectiveAcc >= 0.85;
      modeBadge.textContent = accSafe ? "Accuracy ≥ 85% floor" : "Drift warning (< 85%)";
      modeBadge.className = `aisys-pill ${accSafe ? "aisys-pill--teal" : "aisys-pill--red"}`;

      const goodputTone = cap.goodput >= 40 || cap.bottlenecks.length === 4 ? "ok" : "warn";
      kpisWrap.replaceChildren(
        kpiTile("Steady-State Goodput", `${cap.goodput}/min`, `Bottleneck: ${cap.bottlenecks.join(", ")}`, goodputTone),
        kpiTile("Cross-Model Speedup", `${se.speedup}×`, `${se.rawTotalMs} ms → ${se.translatedMs} ms`, "info"),
        kpiTile(
          "Multi-Hop Accuracy",
          `${(se.effectiveAcc * 100).toFixed(1)}%`,
          `Floor ≥ 85.0% · 0.969^${state.hops}`,
          accSafe ? "ok" : "bad"
        )
      );

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
          title,
          `${val}/min`,
          (val / maxRate) * 100,
          isBottle ? "aisys-bar-fill--bottle" : "",
          isBottle ? "BOTTLENECK" : ""
        );
      });
      rows.push(
        barRow("Raw N× text reading", `${se.rawTotalMs} ms`, 100, "aisys-bar-fill--bottle", ""),
        barRow(
          `Speculative Encoding (${state.hops}-hop, ${(se.effectiveAcc * 100).toFixed(1)}% acc)`,
          `${se.translatedMs} ms (${se.speedup}× faster)`,
          (se.translatedMs / se.rawTotalMs) * 100,
          accSafe ? "aisys-bar-fill--spec" : "aisys-bar-fill--bottle",
          ""
        )
      );
      fleetBars.replaceChildren(...rows);

      renderSparkline(state.baseAcc, state.hops, se.effectiveAcc);

      status.textContent = `${actionMsg} Goodput is ${cap.goodput}/min (${cap.bottlenecks.join(", ")}).`;
      status.classList.toggle("sim-error", !accSafe);
      note.textContent = !accSafe
        ? `Warning: ${state.hops} chained latent translations drop synthetic accuracy to ${(se.effectiveAcc * 100).toFixed(1)}%; re-read raw text at a checkpoint before grading.`
        : `Synthetic model only (not a hardware benchmark): steady-state rollouts cannot exceed the slowest fleet (${cap.bottlenecks.join(", ")}).`;
    }

    const actions = [
      ["+20 GPUs", () => { state.inference = Math.min(120, state.inference + 20); return "Added +20/min inference capacity."; }, "sim-button"],
      ["+20 Sandboxes", () => { state.environments = Math.min(120, state.environments + 20); return "Added +20/min sandbox capacity."; }, "sim-button"],
      ["+20 Verifiers", () => { state.verification = Math.min(120, state.verification + 20); return "Added +20/min grader capacity."; }, "sim-button"],
      ["Reset", () => { state = { ...(CASES.find(c => c.id === select.value) || CASES[0]) }; return "Reset scenario to baseline."; }, "sim-button sim-quiet"]
    ];

    for (const [label, fn, cls] of actions) {
      const btn = el("button", { type: "button", className: cls, textContent: label });
      btn.addEventListener("click", () => render(fn()));
      controls.append(btn);
    }

    select.addEventListener("change", () => {
      const chosen = CASES.find(c => c.id === select.value);
      if (!chosen) return;
      state = { ...chosen };
      render("Loaded scenario.");
    });

    fallback.before(
      el("div", { className: "sim-app" },
        head, srLabel, select, pillsWrap, slidersWrap, kpisWrap, fleetBars, chartBox,
        el("p", { className: "sim-box-title", textContent: "Quick capacity actions" }),
        controls, live
      )
    );
    root.classList.add("is-live");
    render("Loaded baseline scenario.");
  }

  initGlossaryFilter();
  initDiagramLightbox();
  mountProgressExplorer();
  mountCapacityLab();
})();
