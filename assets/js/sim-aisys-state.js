// Interactive Rewind Wall, Trusted Verifier, Multi-Hop KV, and Trajectory Tape labs for Part 3.
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

  /**
   * Pure evaluator for a Versioned Trajectory token tape and bounded policy staleness.
   * @param {Array<{text: string, isModel: boolean}>} tokens
   * @param {number} policyLag
   * @param {number} [maxStaleness=2]
   */
  function evaluateTrajectoryTape(tokens, policyLag, maxStaleness = 2) {
    if (!Array.isArray(tokens) || tokens.length < 2) {
      throw new RangeError("tokens must be an array with at least 2 entries.");
    }
    for (let i = 0; i < tokens.length; i += 1) {
      const t = tokens[i];
      if (!t || typeof t !== "object" || typeof t.text !== "string" || t.text.trim().length === 0 || typeof t.isModel !== "boolean") {
        throw new RangeError(`Invalid token entry at index ${i}: expected non-empty text and boolean isModel.`);
      }
    }
    if (!Number.isInteger(policyLag) || policyLag < 0) {
      throw new RangeError("policyLag must be a non-negative integer.");
    }
    if (!Number.isInteger(maxStaleness) || maxStaleness < 0) {
      throw new RangeError("maxStaleness must be a non-negative integer.");
    }

    const totalTokens = tokens.length;
    const trainedTokens = tokens.filter(t => t.isModel).length;
    const maskedTokens = totalTokens - trainedTokens;
    const trainedPct = Math.round((trainedTokens / totalTokens) * 100);
    const isStale = policyLag > maxStaleness;
    const parityStatus = isStale ? "stale_drift" : "parity_ok";
    const receiptJson = JSON.stringify({
      policy_version: policyLag === 0 ? "v12" : "v" + (12 - policyLag),
      max_staleness: maxStaleness,
      token_count: totalTokens,
      trained_tokens: trainedTokens,
      action_mask: tokens.map(t => (t.isModel ? 1 : 0)),
      behavior_logprobs: tokens.map((t, i) => (t.isModel ? Number((-0.12 - (i % 4) * 0.05).toFixed(2)) : null))
    }, null, 2);

    return {
      totalTokens,
      trainedTokens,
      maskedTokens,
      trainedPct,
      policyLag,
      maxStaleness,
      isStale,
      parityStatus,
      receiptJson
    };
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { SCENARIOS, simulateScenario, evaluateTrajectoryTape };
  }
  if (typeof document === "undefined") return;

  if (document.body) {
    document.body.classList.add("aisys-page");
  }

  const SVG_NS = "http://www.w3.org/2000/svg";

  function el(tag, props = {}, ...kids) {
    const node = document.createElement(tag);
    for (const [key, val] of Object.entries(props)) {
      if (key === "attrs" && val && typeof val === "object") {
        for (const [ak, av] of Object.entries(val)) {
          node.setAttribute(ak, String(av));
        }
      } else {
        node[key] = val;
      }
    }
    node.append(...kids);
    return node;
  }

  function svgEl(tag, attrs = {}, ...kids) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      node.setAttribute(k, String(v));
    }
    node.append(...kids);
    return node;
  }

  function initGlossaryFilter() {
    const detailsList = Array.from(document.querySelectorAll("details"));
    const glossary = detailsList.find(d => {
      const summary = d.querySelector("summary");
      return summary && summary.textContent.includes("Terms used on this page");
    });
    if (!glossary) return;
    const ul = glossary.querySelector("ul");
    if (!ul) return;

    ul.classList.add("aisys-glossary-list");
    const items = Array.from(ul.children).filter(node => node.tagName === "LI");
    const input = el("input", {
      type: "search",
      className: "aisys-glossary-input",
      placeholder: "Filter terms (e.g. CoW, GRPO, logprob)...",
      attrs: { "aria-label": "Filter terms used on this page" }
    });
    const count = el("span", {
      className: "aisys-glossary-count",
      attrs: { "aria-live": "polite" }
    });
    const clearBtn = el("button", {
      type: "button",
      className: "aisys-glossary-clear",
      textContent: "Clear",
      hidden: true,
      disabled: true
    });

    function applyFilter() {
      const query = input.value.trim().toLowerCase();
      let shown = 0;
      for (const li of items) {
        const matches = !query || li.textContent.toLowerCase().includes(query);
        li.classList.toggle("is-hidden", !matches);
        if (matches) shown += 1;
      }
      count.textContent = query ? `${shown} of ${items.length} terms` : `${items.length} terms`;
      clearBtn.hidden = query.length === 0;
      clearBtn.disabled = query.length === 0;
    }

    input.addEventListener("input", applyFilter);
    clearBtn.addEventListener("click", () => {
      input.value = "";
      applyFilter();
      input.focus();
    });

    const bar = el("div", { className: "aisys-glossary-bar" }, input, count, clearBtn);
    ul.before(bar);
    applyFilter();
  }

  function initDiagramLightbox() {
    const figures = Array.from(document.querySelectorAll(".course-diagram"))
      .map(fig => ({ fig, img: fig.querySelector("img"), cap: fig.querySelector("figcaption") }))
      .filter(entry => Boolean(entry.img));
    if (figures.length === 0) return;

    const titleEl = el("strong", { id: "aisys-lightbox-title", className: "aisys-lightbox-title" });
    const counterEl = el("span", { className: "aisys-pill aisys-pill--muted" });
    const prevBtn = el("button", { type: "button", textContent: "← Prev", attrs: { "aria-label": "Previous diagram" } });
    const nextBtn = el("button", { type: "button", textContent: "Next →", attrs: { "aria-label": "Next diagram" } });
    const zoomBtn = el("button", { type: "button", textContent: "Zoom 140%", attrs: { "aria-pressed": "false" } });
    const closeBtn = el("button", { type: "button", textContent: "Close", attrs: { "aria-label": "Close diagram inspector" } });

    const imgEl = el("img", { className: "aisys-lb-img", alt: "" });
    const capEl = el("p", { className: "aisys-lb-caption" });
    const stage = el("div", { className: "aisys-lb-stage", attrs: { tabindex: "0" } }, imgEl);

    const dialog = el("dialog", {
      id: "aisys-lightbox",
      className: "aisys-lightbox",
      attrs: { "aria-labelledby": "aisys-lightbox-title" }
    },
      el("div", { className: "aisys-lb-bar" },
        el("div", { className: "aisys-badge-row" }, titleEl, counterEl),
        el("div", { className: "aisys-badge-row" }, prevBtn, nextBtn, zoomBtn, closeBtn)
      ),
      stage,
      capEl
    );
    document.body.append(dialog);

    let activeIdx = 0;
    let zoomed = false;
    let lastTrigger = null;

    function syncZoom() {
      stage.classList.toggle("is-zoomed", zoomed);
      imgEl.classList.toggle("is-zoomed", zoomed);
      imgEl.style.width = zoomed ? "140%" : "";
      imgEl.style.maxWidth = zoomed ? "none" : "";
      zoomBtn.setAttribute("aria-pressed", String(zoomed));
      zoomBtn.textContent = zoomed ? "Zoom 100%" : "Zoom 140%";
    }

    function showSlide(idx) {
      activeIdx = (idx + figures.length) % figures.length;
      const entry = figures[activeIdx];
      imgEl.src = entry.img.currentSrc || entry.img.src;
      imgEl.alt = entry.img.alt || "Course diagram";
      const strong = entry.cap ? entry.cap.querySelector("strong") : null;
      titleEl.textContent = strong ? strong.textContent : `Diagram ${activeIdx + 1}`;
      capEl.textContent = entry.cap ? entry.cap.textContent.replace(/On a narrow screen, scroll sideways\.\s*/i, "").replace(/Open the diagram at full size\.?\s*$/i, "").trim() : "";
      counterEl.textContent = `${activeIdx + 1} / ${figures.length}`;
      syncZoom();
    }

    function openAt(idx, trigger) {
      lastTrigger = trigger || document.activeElement;
      zoomed = false;
      showSlide(idx);
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
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
      }
    }

    prevBtn.addEventListener("click", () => showSlide(activeIdx - 1));
    nextBtn.addEventListener("click", () => showSlide(activeIdx + 1));
    zoomBtn.addEventListener("click", () => {
      zoomed = !zoomed;
      syncZoom();
    });
    closeBtn.addEventListener("click", closeModal);
    dialog.addEventListener("click", e => {
      if (e.target === dialog) closeModal();
    });
    dialog.addEventListener("keydown", e => {
      if (!dialog.open) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        showSlide(activeIdx - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        showSlide(activeIdx + 1);
      }
    });
    dialog.addEventListener("close", () => {
      if (lastTrigger && typeof lastTrigger.focus === "function" && lastTrigger.isConnected) {
        lastTrigger.focus();
      }
    });

    figures.forEach(({ fig, img }, idx) => {
      img.style.cursor = "zoom-in";
      img.addEventListener("click", () => openAt(idx, img));
      const zoomTrigger = el("button", {
        type: "button",
        className: "aisys-zoom-btn",
        textContent: "Inspect ⤢",
        attrs: { "aria-label": `Inspect diagram ${idx + 1} in lightbox` }
      });
      zoomTrigger.addEventListener("click", () => openAt(idx, zoomTrigger));
      const scrollWrap = fig.querySelector(".diagram-scroll");
      if (scrollWrap) {
        scrollWrap.after(zoomTrigger);
      } else {
        fig.append(zoomTrigger);
      }
    });
  }

  function buildMultiHopSparkline(activeHops, passesAccFloor) {
    const width = 560;
    const height = 120;
    const padL = 64;
    const padR = 26;
    const padT = 16;
    const padB = 26;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;
    const minAcc = 0.70;
    const maxAcc = 1.00;
    const xFor = k => padL + (k / 8) * plotW;
    const yFor = acc => padT + ((maxAcc - acc) / (maxAcc - minAcc)) * plotH;

    const svg = svgEl("svg", {
      class: "aisys-sparkline",
      viewBox: `0 0 ${width} ${height}`,
      role: "img",
      "aria-label": `Multi-hop Speculative Encoding accuracy curve for k = 0 to 8 hops; current trace is at ${activeHops} hops`
    });

    // Reference grid lines (95%, 85% floor, 75%)
    for (const ref of [0.95, 0.85, 0.75]) {
      const y = yFor(ref).toFixed(1);
      const isFloor = ref === 0.85;
      svg.append(
        svgEl("line", {
          x1: padL,
          y1: y,
          x2: width - padR,
          y2: y,
          stroke: isFloor ? "#b42318" : "#d0d7de",
          "stroke-width": isFloor ? "1.6" : "1",
          "stroke-dasharray": isFloor ? "5 4" : "2 3"
        }),
        svgEl("text", {
          x: padL - 6,
          y: (Number(y) + 3.5).toFixed(1),
          "text-anchor": "end",
          "font-size": "10",
          "font-weight": isFloor ? "700" : "500",
          fill: isFloor ? "#b42318" : "#57606a"
        }, isFloor ? "85% floor" : `${Math.round(ref * 100)}%`)
      );
    }

    const points = [];
    for (let k = 0; k <= 8; k += 1) {
      const acc = 0.94 * Math.pow(0.969, k);
      points.push({ k, acc, x: xFor(k), y: yFor(acc) });
    }

    svg.append(
      svgEl("polyline", {
        fill: "none",
        stroke: "#0f766e",
        "stroke-width": "2.25",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        points: points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
      })
    );

    for (const p of points) {
      const isActive = p.k === activeHops;
      const pointPasses = p.acc >= 0.85;
      if (isActive) {
        svg.append(
          svgEl("circle", {
            cx: p.x.toFixed(1),
            cy: p.y.toFixed(1),
            r: "9",
            fill: passesAccFloor ? "rgba(15, 118, 110, 0.16)" : "rgba(180, 35, 24, 0.18)"
          })
        );
      }
      svg.append(
        svgEl("circle", {
          cx: p.x.toFixed(1),
          cy: p.y.toFixed(1),
          r: isActive ? "5" : "3",
          fill: isActive ? (passesAccFloor ? "#0f766e" : "#b42318") : (pointPasses ? "#0f766e" : "#b42318"),
          stroke: "#ffffff",
          "stroke-width": isActive ? "2" : "1"
        }),
        svgEl("text", {
          x: p.x.toFixed(1),
          y: height - 6,
          "text-anchor": "middle",
          "font-size": "10",
          "font-weight": isActive ? "700" : "500",
          fill: isActive ? "#1f2328" : "#57606a"
        }, `k=${p.k}`)
      );
      if (isActive) {
        const labelX = p.k >= 6 ? p.x - 8 : p.x + 8;
        const anchor = p.k >= 6 ? "end" : "start";
        svg.append(
          svgEl("text", {
            x: labelX.toFixed(1),
            y: Math.max(12, p.y - 10).toFixed(1),
            "text-anchor": anchor,
            "font-size": "11",
            "font-weight": "700",
            fill: passesAccFloor ? "#0f766e" : "#b42318"
          }, `k=${p.k}: ${(p.acc * 100).toFixed(1)}%`)
        );
      }
    }

    return svg;
  }

  function mountStateStudio() {
    const root = document.getElementById("sim-aisys-state");
    if (!root) return;

    const pillShortLabels = {
      "local-only": "1. Local edit",
      "slack-webhook": "2. Slack leak",
      "tamper-test": "3. Tamper test",
      "sandbox-oom": "4. Sandbox OOM",
      "two-hop-kv": "5. 2-hop KV",
      "six-hop-kv": "6. 6-hop drift"
    };

    const statePill = el("span", { className: "aisys-pill" });
    const head = el("div", { className: "aisys-sim-head" },
      el("span", { className: "aisys-pill aisys-pill--navy", textContent: "Rewind Wall & Verifier Studio" }),
      statePill
    );

    const select = el("select", { id: "aisys-state-select" });
    select.append(...SCENARIOS.map(s => el("option", { value: s.id, textContent: s.title })));

    const pillRow = el("div", {
      className: "aisys-pills",
      attrs: { role: "group", "aria-label": "Scenario presets" }
    });
    const pillButtons = new Map();

    const fields = el("div", { className: "sim-fields" },
      el("label", { htmlFor: select.id }, "Choose an execution trace to inspect & rewind", select)
    );

    const localStatusPill = el("span", { className: "aisys-pill" });
    const localBody = el("p", { className: "aisys-world-body" });
    const localPane = el("div", { className: "aisys-world-pane aisys-world-pane--local" },
      el("div", { className: "aisys-world-head" },
        el("strong", { textContent: "Inside Sandbox E_t (Reversible)" }),
        localStatusPill
      ),
      localBody
    );

    const divider = el("div", { className: "aisys-rewind-divider" },
      el("span", { textContent: "REWIND WALL" })
    );

    const externalAlertPill = el("span", { className: "aisys-pill" });
    const externalBody = el("p", { className: "aisys-world-body" });
    const externalPane = el("div", { className: "aisys-world-pane aisys-world-pane--external" },
      el("div", { className: "aisys-world-head" },
        el("strong", { textContent: "Outside World (CANNOT Rewind)" }),
        externalAlertPill
      ),
      externalBody
    );

    const splitWorld = el("div", { className: "aisys-split-world" }, localPane, divider, externalPane);
    const bars = el("div", { className: "aisys-bars" });
    const chartBox = el("div", { className: "aisys-chart-box" });
    const receipt = el("dl", { className: "aisys-receipt" });
    const controls = el("div", { className: "sim-controls" });
    const status = el("p", { className: "sim-status" });
    const note = el("p", { className: "sim-note" });
    const live = el("div", { attrs: { role: "status", "aria-atomic": "true" } }, status, note);

    let selectedId = SCENARIOS[0].id;
    let rewindOn = false;

    for (const s of SCENARIOS) {
      const pBtn = el("button", {
        type: "button",
        className: "aisys-pill-btn",
        textContent: pillShortLabels[s.id] || s.title,
        attrs: { "aria-pressed": "false" }
      });
      pBtn.addEventListener("click", () => {
        selectedId = s.id;
        select.value = s.id;
        rewindOn = false;
        render();
      });
      pillButtons.set(s.id, pBtn);
      pillRow.append(pBtn);
    }

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
      const leaked = res.appliedRewind && !res.rewindClearsAll;

      for (const [id, pBtn] of pillButtons.entries()) {
        const active = id === selectedId;
        pBtn.classList.toggle("is-active", active);
        pBtn.setAttribute("aria-pressed", String(active));
      }

      if (leaked) {
        statePill.className = "aisys-pill aisys-pill--red";
        statePill.textContent = "External leak";
      } else if (res.appliedRewind) {
        statePill.className = "aisys-pill aisys-pill--green";
        statePill.textContent = "Rewound t=0";
      } else {
        statePill.className = "aisys-pill aisys-pill--teal";
        statePill.textContent = "Pre-rewind";
      }

      localPane.classList.toggle("is-rewound", res.appliedRewind);
      localStatusPill.className = res.appliedRewind ? "aisys-pill aisys-pill--green" : "aisys-pill aisys-pill--navy";
      localStatusPill.textContent = res.appliedRewind ? "Clean snapshot t=0" : "Modified state";
      localBody.textContent = res.localAfter;

      externalPane.classList.toggle("is-leaked", leaked);
      if (leaked) {
        externalAlertPill.className = "aisys-pill aisys-pill--red";
        externalAlertPill.textContent = "STILL PRESENT — IRREVERSIBLE";
      } else if (!res.rewindClearsAll) {
        externalAlertPill.className = "aisys-pill aisys-pill--red";
        externalAlertPill.textContent = "Outbound effect emitted";
      } else {
        externalAlertPill.className = "aisys-pill aisys-pill--teal";
        externalAlertPill.textContent = "Isolated";
      }
      externalBody.textContent = res.externalAfter;

      const barClass = !res.passesAccFloor || leaked
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

      chartBox.replaceChildren(
        el("p", { className: "aisys-chart-title", textContent: `Multi-hop Speculative Encoding decay (0.969^k × 0.94) — active trace: k = ${res.kvHops} hops` }),
        buildMultiHopSparkline(res.kvHops, res.passesAccFloor)
      );

      const facts = [
        ["Local sandbox (E_t)", res.localAfter],
        ["External world", res.externalAfter],
        ["Verifier outcome", res.verifierOutcome],
        ["Recommended action", res.action]
      ];
      receipt.replaceChildren(...facts.map(([k, v]) => el("div", {}, el("dt", { textContent: k }), el("dd", { textContent: v }))));

      const warn = leaked || !res.passesAccFloor || res.verifierOutcome === "infrastructure_failure";
      status.classList.toggle("sim-error", warn);
      status.textContent = leaked
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
      el("div", { className: "sim-app" }, head, pillRow, fields, splitWorld, bars, chartBox, receipt, controls, live)
    );
    root.classList.add("is-live");
    render();
  }

  function mountTrajectoryTape() {
    const tapeRoot = document.getElementById("sim-aisys-tape");
    if (!tapeRoot) return;

    const canonicalTokens = () => [
      { text: "User: Fix failing", isModel: false },
      { text: "pytest in app.py", isModel: false },
      { text: "Thought: inspect add()", isModel: true },
      { text: "patch: return x + 1", isModel: true },
      { text: "call: pytest -q", isModel: true },
      { text: "stdout: 1 passed", isModel: false },
      { text: "exit_code: 0", isModel: false },
      { text: "stderr: (empty)", isModel: false },
      { text: "Reply: Fixed bug", isModel: true },
      { text: "in app.py; tests pass.", isModel: true }
    ];

    let tokens = canonicalTokens();
    let policyLag = 1;
    const maxStaleness = 2;

    const parityPill = el("span", { className: "aisys-pill" });
    const head = el("div", { className: "aisys-sim-head" },
      el("span", { className: "aisys-pill aisys-pill--navy", textContent: "Versioned Trajectory Contract" }),
      parityPill
    );

    const tape = el("div", {
      className: "aisys-tape",
      attrs: { role: "group", "aria-label": "10-chunk trajectory tape — click any chunk to toggle action_mask" }
    });

    const lagFreshBtn = el("button", { type: "button", className: "aisys-pill-btn", textContent: "Policy Lag: 1 (Fresh)" });
    const lagStaleBtn = el("button", { type: "button", className: "aisys-pill-btn", textContent: "Policy Lag: 4 (Stale!)" });
    const resetBtn = el("button", { type: "button", className: "sim-button sim-quiet", textContent: "Reset canonical tape" });
    const controls = el("div", { className: "aisys-pills" }, lagFreshBtn, lagStaleBtn, resetBtn);

    const kpis = el("div", { className: "aisys-kpis" });
    const jsonPreview = el("pre", { className: "aisys-json-preview" });
    const status = el("p", { className: "sim-status" });
    const note = el("p", { className: "sim-note" });
    const live = el("div", { attrs: { role: "status", "aria-atomic": "true" } }, status, note);

    function kpiTile(label, value, toneClass = "") {
      return el("div", { className: `aisys-kpi ${toneClass}`.trim() },
        el("span", { className: "aisys-kpi-label", textContent: label }),
        el("strong", { className: "aisys-kpi-val", textContent: value })
      );
    }

    function render() {
      const res = evaluateTrajectoryTape(tokens, policyLag, maxStaleness);

      lagFreshBtn.classList.toggle("is-active", policyLag === 1);
      lagFreshBtn.setAttribute("aria-pressed", String(policyLag === 1));
      lagStaleBtn.classList.toggle("is-active", policyLag === 4);
      lagStaleBtn.setAttribute("aria-pressed", String(policyLag === 4));

      if (res.isStale) {
        parityPill.className = "aisys-pill aisys-pill--red";
        parityPill.textContent = "Stale Drift";
      } else {
        parityPill.className = "aisys-pill aisys-pill--green";
        parityPill.textContent = "Parity OK";
      }

      tape.replaceChildren(
        ...tokens.map((tok, idx) => {
          const btn = el("button", {
            type: "button",
            className: `aisys-tok ${tok.isModel ? "aisys-tok--model" : "aisys-tok--tool"}`,
            attrs: { "aria-pressed": String(tok.isModel) }
          },
            el("span", { className: "aisys-tok-text", textContent: tok.text }),
            el("span", { className: "aisys-tok-tag", textContent: tok.isModel ? "MODEL · mask=True" : "TOOL · mask=False" })
          );
          btn.addEventListener("click", () => {
            tokens[idx].isModel = !tokens[idx].isModel;
            render();
          });
          return btn;
        })
      );

      kpis.replaceChildren(
        kpiTile("Trained tokens (True)", `${res.trainedTokens} / ${res.totalTokens}`),
        kpiTile("Masked tokens (False)", `${res.maskedTokens} / ${res.totalTokens}`),
        kpiTile("Gradient share", `${res.trainedPct}%`),
        kpiTile("ρ_t Parity Gate", res.isStale ? "Drift risk" : "OK", res.isStale ? "aisys-kpi--bad" : "aisys-kpi--ok")
      );

      jsonPreview.textContent = res.receiptJson;

      const warn = res.isStale || res.trainedTokens === 0;
      status.classList.toggle("sim-error", warn);
      if (res.trainedTokens === 0) {
        status.textContent = "Contract error: 0 tokens have action_mask = True; at least 1 model token is required.";
      } else if (res.isStale) {
        status.textContent = `Staleness warning: policy_lag=${res.policyLag} exceeds max_staleness=${res.maxStaleness} (ρ_t drift risk).`;
      } else {
        status.textContent = `${res.trainedTokens} of ${res.totalTokens} chunks (${res.trainedPct}%) receive RL gradients; policy_lag=${res.policyLag} <= ${res.maxStaleness} (${res.parityStatus}).`;
      }
      note.textContent = "Click any chunk above to flip action_mask between model-generated (True) and pasted prompt/tool text (False).";
    }

    lagFreshBtn.addEventListener("click", () => { policyLag = 1; render(); });
    lagStaleBtn.addEventListener("click", () => { policyLag = 4; render(); });
    resetBtn.addEventListener("click", () => {
      tokens = canonicalTokens();
      policyLag = 1;
      render();
    });

    tapeRoot.querySelector(".sim-fallback").before(
      el("div", { className: "sim-app" }, head, tape, controls, kpis, jsonPreview, live)
    );
    tapeRoot.classList.add("is-live");
    render();
  }

  initGlossaryFilter();
  initDiagramLightbox();
  mountStateStudio();
  mountTrajectoryTape();
})();
