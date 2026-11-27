// Fixed-receipt RL rollout and staleness decision lab. No model or training job runs here.
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

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { ACTIONS, CASES, nextDecision };
  }
  if (typeof document === "undefined") return;

  const root = document.getElementById("sim-aisys-rl");
  if (!root) return;

  const el = (tag, props = {}, ...kids) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...kids);
    return node;
  };

  const select = el("select", { id: "aisys-rl-case" });
  select.append(...CASES.map(c => el("option", { value: c.id, textContent: c.title })));
  const fields = el("div", { className: "sim-fields" },
    el("label", { htmlFor: select.id }, "Choose a rollout receipt", select)
  );
  const receipt = el("dl", { className: "aisys-receipt" });
  const choices = el("div", { className: "sim-controls" });
  const feedback = el("p", { className: "sim-status" });
  const explain = el("p", { className: "sim-note" });
  const announcement = el("div", {}, feedback, explain);
  announcement.setAttribute("role", "status");
  announcement.setAttribute("aria-atomic", "true");
  const reveal = el("button", { type: "button", className: "sim-button sim-quiet", textContent: "Explain the decision" });

  let current = CASES[0];

  for (const [action, label] of ACTIONS) {
    const btn = el("button", { type: "button", className: "sim-button", textContent: label });
    btn.addEventListener("click", () => {
      const answer = nextDecision(current);
      const ok = action === answer.action;
      feedback.textContent = ok ? `Correct. ${label}.` : `${label} does not fit this receipt. Check infra health, KV parity, and staleness bounds.`;
      feedback.classList.toggle("sim-error", !ok);
      explain.textContent = ok ? answer.reason : "Hint: isolate infra errors first, then check active checkpoints, KV parity, policy lag, and GRPO group completeness.";
    });
    choices.append(btn);
  }

  function pick() {
    current = CASES.find(c => c.id === select.value);
    const facts = [
      ["Rollout status", current.status],
      ["Verifier outcome", current.outcome],
      ["Policy lag / max", `${current.policyLag} steps (max ${current.maxStaleness})`],
      ["KV parity", current.kvConsistent ? "Verified match" : "Mismatch / unverified translation"],
      ["GRPO group", current.groupComplete ? "Complete" : "Waiting on straggler"]
    ];
    receipt.replaceChildren(...facts.map(([k, v]) => el("div", {}, el("dt", { textContent: k }), el("dd", { textContent: v }))));
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
    el("div", { className: "sim-app" }, fields, receipt,
      el("p", { className: "sim-box-title", textContent: "Choose the next RL scheduler action" }),
      choices, reveal, announcement)
  );
  root.classList.add("is-live");
  pick();
})();
