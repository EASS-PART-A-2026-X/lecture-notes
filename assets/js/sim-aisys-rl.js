// Fixed-receipt RL rollout, staleness, and GRPO group scoring labs. No model or training job runs here.
(() => {
  "use strict";

  const ACTIONS = [
    ["accept", "Accept into training batch"],
    ["reject_stale", "Reject as stale"],
    ["exclude_infra", "Exclude infra failure & retry"],
    ["flush_kv", "Flush KV or recompute logits"],
    ["checkpoint", "Checkpoint & resume on new policy"],
    ["wait_group", "Hold for GRPO group completion"]
  ];

  const CASES = [
    {
      id: "fresh",
      title: "1. Fresh verified trajectory (lag 1 ≤ max 2, KV matches)",
      policyLag: 1, maxStaleness: 2, outcome: "correct",
      kvConsistent: true, status: "completed", groupComplete: true
    },
    {
      id: "stale",
      title: "2. Stale trajectory (lag 5 > max 2)",
      policyLag: 5, maxStaleness: 2, outcome: "correct",
      kvConsistent: true, status: "completed", groupComplete: true
    },
    {
      id: "infra",
      title: "3. Sandbox crashed mid-run (infrastructure failure)",
      policyLag: 1, maxStaleness: 2, outcome: "infra_failure",
      kvConsistent: true, status: "failed_infra", groupComplete: true
    },
    {
      id: "kv-drift",
      title: "4. Weight update or translated KV without parity check",
      policyLag: 1, maxStaleness: 2, outcome: "correct",
      kvConsistent: false, status: "completed", groupComplete: true
    },
    {
      id: "checkpoint",
      title: "5. Active tool rollout crossing staleness limit",
      policyLag: 3, maxStaleness: 2, outcome: "pending",
      kvConsistent: true, status: "running", groupComplete: true
    },
    {
      id: "straggler",
      title: "6. GRPO candidate finished, group waiting on 1 slow run",
      policyLag: 1, maxStaleness: 2, outcome: "correct",
      kvConsistent: true, status: "completed", groupComplete: false
    }
  ];

  const VALID_OUTCOMES = new Set(["correct", "incorrect", "partial", "invalid_action", "infra_failure", "verifier_failure", "pending"]);
  const VALID_STATUS = new Set(["completed", "running", "failed_infra"]);
  const GRPO_OUTCOMES = new Set(["pass", "fail", "crash"]);

  function nextDecision(receipt) {
    if (!Number.isInteger(receipt.policyLag) || receipt.policyLag < 0 ||
        !Number.isInteger(receipt.maxStaleness) || receipt.maxStaleness < 0 ||
        !VALID_OUTCOMES.has(receipt.outcome) || !VALID_STATUS.has(receipt.status) ||
        typeof receipt.kvConsistent !== "boolean" || typeof receipt.groupComplete !== "boolean") {
      throw new RangeError("Invalid rollout receipt fields.");
    }
    if (receipt.status === "failed_infra" || receipt.outcome === "infra_failure" || receipt.outcome === "verifier_failure") {
      return {
        action: "exclude_infra",
        reason: "Infrastructure or verifier failures are not agent errors. Exclude this trajectory from RL updates and retry in a healthy sandbox instead of assigning reward 0."
      };
    }
    if (receipt.status === "running" && receipt.policyLag > receipt.maxStaleness) {
      return {
        action: "checkpoint",
        reason: "The active trajectory exceeded the staleness budget while running a tool. Checkpoint environment state E_t, refresh weights (and flush/recompute KV), then resume."
      };
    }
    if (!receipt.kvConsistent) {
      return {
        action: "flush_kv",
        reason: "KV state from an older policy or an unverified cross-model translation shifts behavior logprobs (ρ_t drift). Flush KV or recompute under the active policy."
      };
    }
    if (receipt.policyLag > receipt.maxStaleness) {
      return {
        action: "reject_stale",
        reason: "Policy lag exceeds the bounded off-policy limit; updating on overly stale trajectories can destabilize training."
      };
    }
    if (!receipt.groupComplete) {
      return {
        action: "wait_group",
        reason: "GRPO normalizes advantages across the whole group. Silently dropping slow candidates introduces selection bias toward short answers."
      };
    }
    return {
      action: "accept",
      reason: "Policy lag is within bounds, KV matches the behavior policy, the verifier succeeded, and the group is ready: admit to the learner batch."
    };
  }

  /**
   * Compute GRPO group mean, population std, and normalized advantages across valid tries.
   * Sandbox crashes ("crash") are excluded cleanly instead of receiving reward 0.
   */
  function evaluateGrpoGroup(outcomes) {
    if (!Array.isArray(outcomes) || outcomes.length < 2 || outcomes.length > 8) {
      throw new RangeError("GRPO group requires 2 to 8 outcomes.");
    }
    for (const outcome of outcomes) {
      if (!GRPO_OUTCOMES.has(outcome)) {
        throw new RangeError(`Invalid GRPO outcome: ${String(outcome)}`);
      }
    }

    const validRewards = [];
    for (const outcome of outcomes) {
      if (outcome !== "crash") {
        validRewards.push(outcome === "pass" ? 1 : 0);
      }
    }

    const validCount = validRewards.length;
    const excludedCount = outcomes.length - validCount;
    const mean = validCount > 0
      ? validRewards.reduce((acc, r) => acc + r, 0) / validCount
      : 0;
    const variance = validCount >= 2
      ? validRewards.reduce((acc, r) => acc + (r - mean) ** 2, 0) / validCount
      : 0;
    const std = Math.sqrt(variance);
    const zeroVariance = validCount < 2 || std === 0;
    const zeroSignal = zeroVariance;

    const tries = outcomes.map((outcome, idx) => {
      if (outcome === "crash") {
        return { index: idx + 1, outcome, reward: null, excluded: true, advantage: null };
      }
      const reward = outcome === "pass" ? 1 : 0;
      const advantage = zeroVariance ? 0 : Number(((reward - mean) / std).toFixed(3));
      return { index: idx + 1, outcome, reward, excluded: false, advantage };
    });

    return {
      validCount,
      excludedCount,
      mean: Number(mean.toFixed(3)),
      std: Number(std.toFixed(3)),
      zeroVariance,
      zeroSignal,
      tries
    };
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { ACTIONS, CASES, nextDecision, evaluateGrpoGroup };
  }
  if (typeof document === "undefined") return;

  const el = (tag, props = {}, ...kids) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...kids);
    return node;
  };

  document.body.classList.add("aisys-page");

  function initGlossaryFilter() {
    const detailsList = Array.from(document.querySelectorAll("details"));
    const glossary = detailsList.find(d => {
      const summary = d.querySelector(":scope > summary");
      return summary && summary.textContent.includes("Terms used on this page");
    });
    if (!glossary) return;
    const list = glossary.querySelector("ul");
    if (!list) return;

    list.classList.add("aisys-glossary-list");
    const items = Array.from(list.querySelectorAll(":scope > li"));
    const input = el("input", {
      type: "search",
      className: "aisys-glossary-input",
      placeholder: "Filter terms (e.g., GRPO, KV, staleness)…",
      "aria-label": "Filter glossary terms"
    });
    input.setAttribute("aria-label", "Filter glossary terms");
    const count = el("span", { className: "aisys-glossary-count" });
    count.setAttribute("aria-live", "polite");
    const clearBtn = el("button", {
      type: "button",
      className: "aisys-glossary-clear",
      textContent: "Clear",
      hidden: true
    });

    const bar = el("div", { className: "aisys-glossary-bar" }, input, count, clearBtn);
    list.before(bar);

    function applyFilter() {
      const q = input.value.trim().toLowerCase();
      let visible = 0;
      for (const item of items) {
        const match = !q || item.textContent.toLowerCase().includes(q);
        item.classList.toggle("is-hidden", !match);
        if (match) visible += 1;
      }
      count.textContent = `${visible} of ${items.length} terms`;
      clearBtn.hidden = q.length === 0;
    }

    input.addEventListener("input", applyFilter);
    clearBtn.addEventListener("click", () => {
      input.value = "";
      applyFilter();
      input.focus();
    });
    applyFilter();
  }

  function initDiagramLightbox() {
    const figures = Array.from(document.querySelectorAll(".course-diagram"))
      .map(figure => {
        const img = figure.querySelector("img");
        const figcaption = figure.querySelector("figcaption");
        return img ? { figure, img, figcaption } : null;
      })
      .filter(Boolean);
    if (figures.length === 0) return;

    const dialog = el("dialog", { className: "aisys-lightbox", id: "aisys-lightbox" });
    dialog.setAttribute("aria-label", "Diagram inspector");

    const counter = el("span", { className: "aisys-lightbox-count" });
    const titleEl = el("strong", { className: "aisys-lightbox-title" });
    const prevBtn = el("button", { type: "button", className: "sim-button sim-quiet", textContent: "← Prev" });
    const nextBtn = el("button", { type: "button", className: "sim-button sim-quiet", textContent: "Next →" });
    const zoomBtn = el("button", { type: "button", className: "sim-button sim-quiet", textContent: "Zoom 140%" });
    zoomBtn.setAttribute("aria-pressed", "false");
    const closeBtn = el("button", { type: "button", className: "sim-button", textContent: "Close ✕" });
    closeBtn.setAttribute("aria-label", "Close diagram inspector");

    const controls = el("div", { className: "aisys-badge-row" }, prevBtn, nextBtn, zoomBtn, closeBtn);
    const header = el("div", { className: "aisys-lb-bar" },
      el("div", { className: "aisys-badge-row" }, counter, titleEl),
      controls
    );
    const stageImg = el("img", { className: "aisys-lb-img", alt: "" });
    const stage = el("div", { className: "aisys-lb-stage" }, stageImg);
    const captionEl = el("p", { className: "aisys-lb-caption" });
    dialog.append(header, stage, captionEl);
    document.body.append(dialog);

    let activeIdx = 0;
    let zoomed = false;
    let opener = null;

    function setZoom(nextZoom) {
      zoomed = nextZoom;
      stage.classList.toggle("is-zoomed", zoomed);
      zoomBtn.setAttribute("aria-pressed", String(zoomed));
      zoomBtn.textContent = zoomed ? "Reset 100%" : "Zoom 140%";
    }

    function renderDiagram(idx) {
      activeIdx = (idx + figures.length) % figures.length;
      const entry = figures[activeIdx];
      stageImg.src = entry.img.currentSrc || entry.img.getAttribute("src") || "";
      stageImg.alt = entry.img.alt || "";
      counter.textContent = `Diagram ${activeIdx + 1} of ${figures.length}`;
      const strong = entry.figcaption ? entry.figcaption.querySelector("strong") : null;
      titleEl.textContent = strong ? strong.textContent : `Diagram ${activeIdx + 1}`;
      captionEl.textContent = entry.figcaption ? entry.figcaption.textContent.replace(/\s+/g, " ").trim() : "";
      setZoom(false);
    }

    function openLightbox(idx, triggerEl) {
      opener = triggerEl || document.activeElement;
      renderDiagram(idx);
      if (typeof dialog.showModal === "function") {
        if (!dialog.open) dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
      closeBtn.focus();
    }

    function closeLightbox() {
      if (typeof dialog.close === "function" && dialog.open) {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
      if (opener && typeof opener.focus === "function") {
        opener.focus();
      }
    }

    prevBtn.addEventListener("click", () => renderDiagram(activeIdx - 1));
    nextBtn.addEventListener("click", () => renderDiagram(activeIdx + 1));
    zoomBtn.addEventListener("click", () => setZoom(!zoomed));
    closeBtn.addEventListener("click", closeLightbox);
    dialog.addEventListener("click", e => {
      if (e.target === dialog) closeLightbox();
    });
    dialog.addEventListener("keydown", e => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        renderDiagram(activeIdx - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        renderDiagram(activeIdx + 1);
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeLightbox();
      }
    });

    figures.forEach((entry, idx) => {
      const btn = el("button", {
        type: "button",
        className: "aisys-zoom-btn",
        textContent: "Inspect ⤢"
      });
      btn.setAttribute("aria-label", `Inspect diagram ${idx + 1} at full size`);
      btn.addEventListener("click", () => openLightbox(idx, btn));
      entry.img.style.cursor = "zoom-in";
      entry.img.addEventListener("click", () => openLightbox(idx, btn));
      entry.figure.append(btn);
    });
  }

  function mountGrpoLab() {
    const grpoRoot = document.getElementById("sim-aisys-grpo");
    if (!grpoRoot) return;

    const PRESETS = [
      { id: "balanced", label: "2 Pass / 2 Fail", outcomes: ["pass", "fail", "pass", "fail"] },
      { id: "all-pass", label: "All 4 Pass (σ_r = 0)", outcomes: ["pass", "pass", "pass", "pass"] },
      { id: "rare-win", label: "1 Pass / 3 Fail (rare win!)", outcomes: ["pass", "fail", "fail", "fail"] },
      { id: "crash-excluded", label: "1 Sandbox Crash Excluded", outcomes: ["pass", "fail", "crash", "pass"] }
    ];
    const CYCLE = { pass: "fail", fail: "crash", crash: "pass" };

    let outcomes = PRESETS[0].outcomes.slice();

    const signalPill = el("span", { className: "aisys-pill" });
    const head = el("div", { className: "aisys-sim-head" },
      el("span", { className: "aisys-pill aisys-pill--teal", textContent: "GRPO Group Signal Lab" }),
      signalPill
    );

    const presetWrap = el("div", { className: "aisys-pills" });
    presetWrap.setAttribute("role", "group");
    presetWrap.setAttribute("aria-label", "GRPO outcome presets");

    const presetBtns = PRESETS.map(preset => {
      const btn = el("button", {
        type: "button",
        className: "aisys-pill-btn",
        textContent: preset.label
      });
      btn.addEventListener("click", () => {
        outcomes = preset.outcomes.slice();
        render();
      });
      presetWrap.append(btn);
      return { preset, btn };
    });

    const tryGrid = el("div", { className: "aisys-grpo-grid" });
    const kpis = el("div", { className: "aisys-kpis" });
    const status = el("p", { className: "sim-status" });
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    function buildKpi(label, value, toneClass = "") {
      const card = el("div", { className: `aisys-kpi ${toneClass}`.trim() },
        el("span", { className: "aisys-kpi-label", textContent: label }),
        el("strong", { className: "aisys-kpi-val", textContent: value })
      );
      return card;
    }

    function formatAdvantage(adv, excluded) {
      if (excluded || adv === null) return "excluded";
      if (adv === 0) return "0.00";
      return `${adv > 0 ? "+" : ""}${adv.toFixed(2)}`;
    }

    function outcomeBadge(outcome) {
      if (outcome === "pass") return "PASS · 1.0";
      if (outcome === "fail") return "FAIL · 0.0";
      return "INFRA CRASH · excluded";
    }

    function explainGroup(res) {
      if (res.validCount < 2) {
        return `Only ${res.validCount} valid try remains after excluding ${res.excludedCount} crashed sandbox(es). GRPO needs at least 2 valid tries to compare, so advantage is zeroed until crashed runs retry.`;
      }
      if (res.zeroVariance) {
        const kind = res.mean === 1 ? "passed" : "failed";
        return `All ${res.validCount} valid tries ${kind}: group spread σ_r = 0.00, so every advantage is 0.00 (zero gradient—nothing distinguishes the tries).`;
      }
      if (res.excludedCount > 0) {
        return `Excluded ${res.excludedCount} crashed sandbox(es) first, then scored ${res.validCount} valid tries around mean r̄ = ${res.mean.toFixed(2)} and spread σ_r = ${res.std.toFixed(2)} without blaming the model for infra faults.`;
      }
      const hasRareWin = res.tries.filter(t => t.outcome === "pass").length === 1;
      if (hasRareWin) {
        const win = res.tries.find(t => t.outcome === "pass");
        return `Rare win! One passing patch stands out against ${res.validCount - 1} failures (r̄ = ${res.mean.toFixed(2)}, σ_r = ${res.std.toFixed(2)}), earning a strong +${win.advantage.toFixed(2)} advantage push.`;
      }
      return `Active update: mixed passes and failures give mean r̄ = ${res.mean.toFixed(2)} and spread σ_r = ${res.std.toFixed(2)}, reinforcing passing patches (+) and discouraging failing ones (−).`;
    }

    function render() {
      const res = evaluateGrpoGroup(outcomes);

      signalPill.className = `aisys-pill ${res.zeroSignal ? "aisys-pill--ochre" : "aisys-pill--green"}`;
      signalPill.textContent = res.zeroSignal ? "Zero gradient" : "Active update";

      for (const { preset, btn } of presetBtns) {
        const match = preset.outcomes.every((v, i) => v === outcomes[i]);
        btn.classList.toggle("is-active", match);
        btn.setAttribute("aria-pressed", String(match));
      }

      const cards = res.tries.map((t, idx) => {
        const card = el("button", {
          type: "button",
          className: `aisys-grpo-try aisys-grpo-try--${t.outcome}`
        });
        card.setAttribute("aria-label", `Try ${t.index}: ${outcomeBadge(t.outcome)}, advantage ${formatAdvantage(t.advantage, t.excluded)}. Click to cycle outcome.`);

        const top = el("div", { className: "aisys-grpo-axis" },
          el("strong", { textContent: `Try ${t.index}` }),
          el("span", { className: "aisys-grpo-badge", textContent: outcomeBadge(t.outcome) })
        );

        const barWrap = el("div", { className: "aisys-grpo-bar-wrap" });
        barWrap.setAttribute("aria-hidden", "true");
        const bar = el("span", { className: "aisys-grpo-bar" });
        if (t.excluded || t.advantage === 0) {
          bar.classList.add("aisys-grpo-bar--zero");
        } else {
          const halfPct = Math.min(50, (Math.abs(t.advantage) / 2) * 50);
          if (t.advantage > 0) {
            bar.classList.add("aisys-grpo-bar--pos");
            bar.style.width = `${halfPct.toFixed(1)}%`;
          } else {
            bar.classList.add("aisys-grpo-bar--neg");
            bar.style.width = `${halfPct.toFixed(1)}%`;
          }
        }
        barWrap.append(bar);

        const score = el("div", {
          className: "aisys-grpo-axis",
          textContent: `Advantage: ${formatAdvantage(t.advantage, t.excluded)}`
        });
        const hint = el("small", {
          className: "aisys-grpo-hint",
          textContent: "Click to cycle Pass -> Fail -> Crash"
        });

        card.append(top, barWrap, score, hint);
        card.addEventListener("click", () => {
          outcomes[idx] = CYCLE[outcomes[idx]];
          render();
        });
        return card;
      });
      tryGrid.replaceChildren(...cards);

      const meanText = res.validCount === 0 ? "—" : res.mean.toFixed(2);
      const validSub = res.excludedCount > 0 ? `${res.validCount} / ${outcomes.length} (${res.excludedCount} crash)` : `${res.validCount} / ${outcomes.length}`;
      kpis.replaceChildren(
        buildKpi("Group Mean (r̄)", meanText),
        buildKpi("Spread (σ_r)", res.std.toFixed(2)),
        buildKpi("Valid Graded Tries", validSub),
        buildKpi(
          "Training Signal",
          res.zeroSignal ? "Zero gradient" : "Active update",
          res.zeroSignal ? "aisys-kpi--warn" : "aisys-kpi--ok"
        )
      );

      status.textContent = explainGroup(res);
    }

    grpoRoot.querySelector(".sim-fallback").before(
      el("div", { className: "sim-app" }, head, presetWrap, tryGrid, kpis, status)
    );
    grpoRoot.classList.add("is-live");
    render();
  }

  function mountRolloutConsole() {
    const root = document.getElementById("sim-aisys-rl");
    if (!root) return;

    const solved = new Set();

    const masteryPill = el("span", {
      className: "aisys-pill aisys-pill--green",
      textContent: `Diagnosed: 0 / ${CASES.length}`
    });
    const head = el("div", { className: "aisys-sim-head" },
      el("span", { className: "aisys-pill aisys-pill--navy", textContent: "Rollout Telemetry Console" }),
      masteryPill
    );

    const inboxPills = el("div", { className: "aisys-pills" });
    inboxPills.setAttribute("role", "group");
    inboxPills.setAttribute("aria-label", "Rollout receipt inbox");

    const select = el("select", { id: "aisys-rl-case" });
    select.append(...CASES.map(c => el("option", { value: c.id, textContent: c.title })));
    const fields = el("div", { className: "sim-fields" },
      el("label", { htmlFor: select.id }, "Choose a rollout receipt", select)
    );

    const fsm = el("div", { className: "aisys-fsm", role: "region" });
    fsm.setAttribute("aria-label", "Rollout safety state machine progress");

    const receipt = el("dl", { className: "aisys-receipt" });
    const choices = el("div", { className: "sim-controls" });
    const feedback = el("p", { className: "sim-status" });
    const explain = el("p", { className: "sim-note" });
    const announcement = el("div", {}, feedback, explain);
    announcement.setAttribute("role", "status");
    announcement.setAttribute("aria-atomic", "true");
    const reveal = el("button", { type: "button", className: "sim-button sim-quiet", textContent: "Explain the decision" });

    let current = CASES[0];

    const pillButtons = CASES.map((c, idx) => {
      const btn = el("button", { type: "button", className: "aisys-pill-btn" });
      btn.addEventListener("click", () => {
        select.value = c.id;
        pick();
      });
      inboxPills.append(btn);
      return { c, idx, btn };
    });

    function syncInboxAndMastery() {
      masteryPill.textContent = `Diagnosed: ${solved.size} / ${CASES.length}`;
      for (const { c, idx, btn } of pillButtons) {
        const isSelected = c.id === current.id;
        const isSolved = solved.has(c.id);
        btn.textContent = `${isSolved ? "✓ " : ""}#${idx + 1} ${c.id}`;
        btn.classList.toggle("is-active", isSelected);
        btn.classList.toggle("is-solved", isSolved);
        btn.setAttribute("aria-pressed", String(isSelected));
        btn.setAttribute("aria-label", `${c.title}${isSolved ? " (diagnosed)" : ""}`);
      }
    }

    function renderFsm(receiptObj) {
      const decision = nextDecision(receiptObj);
      const nodes = [
        { label: "1. Created", sub: "Queued", state: "is-done" },
        { label: "2. Running", sub: "Tool loop", state: "is-done" },
        { label: "3. Verifying", sub: "Tests & sandbox", state: "is-done" },
        { label: "4. Safety Gate", sub: "Lag, KV & group", state: "" },
        { label: "5. Batch / Action", sub: "Trainer queue", state: "" }
      ];

      if (decision.action === "exclude_infra") {
        nodes[2].state = "is-active is-bad";
        nodes[2].sub = "Sandbox crashed";
        nodes[4].sub = "Retry healthy box";
      } else if (decision.action === "checkpoint") {
        nodes[1].sub = "Paused at limit";
        nodes[3].state = "is-active is-warn";
        nodes[3].sub = "Stale while running";
        nodes[4].sub = "Checkpoint & resume";
      } else if (decision.action === "reject_stale") {
        nodes[3].state = "is-active is-warn";
        nodes[3].sub = `Lag ${receiptObj.policyLag} > ${receiptObj.maxStaleness}`;
        nodes[4].sub = "Reject as stale";
      } else if (decision.action === "flush_kv") {
        nodes[3].state = "is-active is-plum";
        nodes[3].sub = "KV parity mismatch";
        nodes[4].sub = "Flush / recompute KV";
      } else if (decision.action === "wait_group") {
        nodes[3].state = "is-active";
        nodes[3].sub = "Wait on straggler";
        nodes[4].sub = "Hold for GRPO group";
      } else {
        nodes[3].state = "is-done";
        nodes[3].sub = "All checks passed";
        nodes[4].state = "is-active is-ok";
        nodes[4].sub = "Admit to batch";
      }

      const fsmNodes = [];
      nodes.forEach((n, idx) => {
        if (idx > 0) {
          const arrow = el("span", { className: "aisys-fsm-arrow", textContent: "→" });
          arrow.setAttribute("aria-hidden", "true");
          fsmNodes.push(arrow);
        }
        const span = el("div", { className: `aisys-fsm-node ${n.state}`.trim() },
          el("div", { textContent: n.label }),
          el("small", { textContent: n.sub })
        );
        if (n.state.includes("is-active")) span.setAttribute("aria-current", "step");
        fsmNodes.push(span);
      });
      fsm.replaceChildren(...fsmNodes);
    }

    for (const [action, label] of ACTIONS) {
      const btn = el("button", { type: "button", className: "sim-button", textContent: label });
      btn.addEventListener("click", () => {
        const answer = nextDecision(current);
        const ok = action === answer.action;
        if (ok) {
          solved.add(current.id);
          syncInboxAndMastery();
        }
        feedback.textContent = ok ? `Correct. ${label}.` : `${label} does not fit this receipt. Check infra health, KV parity, and staleness bounds.`;
        feedback.classList.toggle("sim-error", !ok);
        explain.textContent = ok ? answer.reason : "Hint: isolate infra errors first, then check active checkpoints, KV parity, policy lag, and GRPO group completeness.";
      });
      choices.append(btn);
    }

    function pick() {
      current = CASES.find(c => c.id === select.value) || CASES[0];
      const facts = [
        ["Rollout status", current.status],
        ["Verifier outcome", current.outcome],
        ["Policy lag / max", `${current.policyLag} steps (max ${current.maxStaleness})`],
        ["KV parity", current.kvConsistent ? "Verified match" : "Mismatch / unverified translation"],
        ["GRPO group", current.groupComplete ? "Complete" : "Waiting on straggler"]
      ];
      receipt.replaceChildren(...facts.map(([k, v]) => el("div", {}, el("dt", { textContent: k }), el("dd", { textContent: v }))));
      renderFsm(current);
      syncInboxAndMastery();
      feedback.classList.remove("sim-error");
      feedback.textContent = `Receipt ${CASES.indexOf(current) + 1} of ${CASES.length}. Choose the right scheduler action.`;
      explain.textContent = "Synthetic rollout telemetry only; no RL job or GPU runs in your browser.";
    }

    select.addEventListener("change", pick);
    reveal.addEventListener("click", () => {
      const answer = nextDecision(current);
      feedback.classList.remove("sim-error");
      feedback.textContent = `Decision: ${ACTIONS.find(([id]) => id === answer.action)[1]}.`;
      explain.textContent = answer.reason;
    });

    root.querySelector(".sim-fallback").before(
      el("div", { className: "sim-app" }, head, inboxPills, fields, fsm, receipt,
        el("p", { className: "sim-box-title", textContent: "Choose the next RL scheduler action" }),
        choices, reveal, announcement)
    );
    root.classList.add("is-live");
    pick();
  }

  initGlossaryFilter();
  initDiagramLightbox();
  mountGrpoLab();
  mountRolloutConsole();
})();
