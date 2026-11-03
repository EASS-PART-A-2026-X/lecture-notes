// A fixed-receipt decision exercise. No agent, network call or delivery action runs here.
(() => {
  "use strict";
  const ACTIONS = [
    ["check", "Run current checks"], ["repair", "Repair and recheck"],
    ["stop", "Stop / keep blocked"], ["approve", "Request human decision"],
    ["deliver", "Deliver authorized revision"], ["report", "Report observed release"]
  ];
  const baseline = {candidate: "c2", checked: "c2", result: "pass", review: "clear", repairs: 1, approved: null, deployed: null};
  const CASES = [
    {id: "stale", title: "Green check, different revision", ...baseline, checked: "c1"},
    {id: "failed", title: "A failed acceptance check", ...baseline, result: "fail"},
    {id: "exhausted", title: "The repair budget is exhausted", ...baseline, result: "fail", repairs: 0},
    {id: "review", title: "Review found a missing case", ...baseline, review: "gap"},
    {id: "approval", title: "Matching evidence, no decision", ...baseline},
    {id: "authorized", title: "Approved, deployment not observed", ...baseline, approved: "c2"},
    {id: "released", title: "Delivery observed on this revision", ...baseline, approved: "c2", deployed: "c2"}
  ];

  function nextStep(receipt) {
    if (!receipt.candidate || !["pass", "fail", "not run"].includes(receipt.result) ||
        !["clear", "gap"].includes(receipt.review) || !Number.isInteger(receipt.repairs) || receipt.repairs < 0) {
      throw new RangeError("A receipt needs a candidate, explicit check/review results and a non-negative repair budget.");
    }
    if (receipt.checked !== receipt.candidate || receipt.result === "not run") {
      return {action: "check", reason: "Run checks on the current candidate. A result for another revision cannot verify this change, even if somebody approved it."};
    }
    if (receipt.result === "fail" || receipt.review === "gap") {
      if (receipt.repairs === 0) {
        return {action: "stop", reason: "The candidate still has a failed check or an open review finding, and no repair remains. Keep it blocked, preserve the evidence, and confirm the supervisor stopped the worker."};
      }
      return {action: "repair", reason: "Use a remaining repair attempt to address the failure or finding. Commit a new candidate, then run the acceptance and regression checks again. The old green result does not carry forward."};
    }
    if (receipt.approved !== receipt.candidate) {
      return {action: "approve", reason: "The matching checks and clear review support a human decision. They do not grant merge or release authority. The decision must identify this revision, destination and allowed action."};
    }
    if (receipt.deployed !== receipt.candidate) {
      return {action: "deliver", reason: "The named revision is authorized, but its deployment has not been observed. Use the trusted delivery path, then check the live revision and behavior before reporting it as released."};
    }
    return {action: "report", reason: "This illustrative receipt has matching checks, clear review, matching approval and an observed deployment of the candidate. Report that observed milestone and the checks' limits; do not claim universal correctness."};
  }

  if (typeof module !== "undefined" && module.exports) module.exports = {ACTIONS, CASES, nextStep};
  if (typeof document === "undefined") return;
  const root = document.getElementById("sim-factoryops");
  if (!root) return;
  const el = (tag, props = {}, ...kids) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...kids);
    return node;
  };
  const select = el("select", {id: "factoryops-case"});
  select.append(...CASES.map((item, index) => el("option", {value: item.id, textContent: `${index + 1}. ${item.title}`})));
  const fields = el("div", {className: "sim-fields"}, el("label", {htmlFor: select.id}, "Choose an evidence receipt", select));
  const receipt = el("dl", {className: "factoryops-receipt"});
  const choices = el("div", {className: "sim-controls"});
  const feedback = el("p", {className: "sim-status"});
  const explain = el("p", {className: "sim-note"});
  const announcement = el("div", {}, feedback, explain);
  announcement.setAttribute("role", "status");
  announcement.setAttribute("aria-atomic", "true");
  const reveal = el("button", {type: "button", className: "sim-button sim-quiet", textContent: "Explain the next step"});
  let current = CASES[0];

  for (const [action, label] of ACTIONS) {
    const button = el("button", {type: "button", className: "sim-button", textContent: label});
    button.addEventListener("click", () => {
      const answer = nextStep(current);
      const correct = action === answer.action;
      feedback.textContent = correct ? `Correct. ${label}.` : `${label} is not the next step. Read the receipt again or ask for an explanation.`;
      feedback.classList.toggle("sim-error", !correct);
      explain.textContent = correct ? answer.reason : "Check the revision, failed results, budget, approval and observed delivery, in that order.";
    });
    choices.append(button);
  }

  function pick() {
    current = CASES.find(item => item.id === select.value);
    const facts = [
      ["Current candidate", current.candidate],
      ["Check receipt", `${current.result === "pass" ? "Passed" : "Failed"} on ${current.checked}`],
      ["Review", current.review === "clear" ? "Clear on c2" : "Open finding on c2"],
      ["Repair attempts remaining", String(current.repairs)],
      ["Delivery approval", current.approved ? `${current.approved} to the course demo environment` : "None"],
      ["Observed deployment", current.deployed || "None"]
    ];
    receipt.replaceChildren(...facts.map(([label, value]) => el("div", {}, el("dt", {textContent: label}), el("dd", {textContent: value}))));
    feedback.classList.remove("sim-error");
    feedback.textContent = `Receipt ${CASES.indexOf(current) + 1} of ${CASES.length}. What may happen next?`;
    explain.textContent = "c1 and c2 are illustrative revision labels. These are synthetic facts, not live CI or deployment results.";
  }
  select.addEventListener("change", pick);
  reveal.addEventListener("click", () => {
    const answer = nextStep(current);
    feedback.classList.remove("sim-error");
    feedback.textContent = `Next step: ${ACTIONS.find(([action]) => action === answer.action)[1]}.`;
    explain.textContent = answer.reason;
  });
  root.querySelector(".sim-fallback").before(el("div", {className: "sim-app"}, fields, receipt,
    el("p", {className: "sim-box-title", textContent: "Choose the next step"}), choices, reveal, announcement));
  root.classList.add("is-live");
  pick();
})();
