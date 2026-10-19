// Lecture 1 simulator: one file's edits moving through Git's four places. A teaching model, not Git.
(() => {
  "use strict";
  const BRANCH = "add-product-sketch";
  const HASHES = ["3f2a9c1", "8b41d07", "c95e2a4", "1d7f3b8", "e60a5c2", "47c9e1f"];
  const hash = n => HASHES[(n - 1) % HASHES.length];
  // Each place holds a version of README.md: 0 is the original, n is "edit n".
  const initial = () => ({edits: 0, work: 0, staged: 0, commits: [], pushed: 0});
  const head = state => state.commits.length ? state.commits[state.commits.length - 1] : 0;
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

  function apply(previous, command) {
    const s = {...previous, commits: [...previous.commits]};
    const out = (message, output = "") => ({state: s, message, output});
    switch (command) {
      case "edit":
        s.edits += 1;
        s.work = s.edits;
        return out(`You saved edit ${s.edits} in README.md. Only the working tree changed.`);
      case "add":
        if (s.work === s.staged) return out("git add did nothing: the staging area already matches your file.");
        s.staged = s.work;
        return out(`Edit ${s.staged} is staged: it is what the next commit will record.`);
      case "commit": {
        if (s.staged === head(s)) {
          return out("Nothing was committed: the staging area matches the last commit.",
            s.work !== s.staged ? 'no changes added to commit (use "git add" and/or "git commit -a")' : "nothing to commit, working tree clean");
        }
        s.commits.push(s.staged);
        const n = s.commits.length;
        return out(`Commit ${hash(n)} records edit ${s.staged} on your laptop only.`,
          `[${BRANCH} ${hash(n)}] Update README (edit ${s.staged})\n 1 file changed, 1 insertion(+)`);
      }
      case "push": {
        if (s.pushed === s.commits.length) return out("Nothing to upload: GitHub already has every local commit.", "Everything up-to-date");
        const from = s.pushed ? hash(s.pushed) : "a0c4e7d";
        s.pushed = s.commits.length;
        return out(`GitHub now has ${plural(s.pushed, "commit")} on ${BRANCH}.`,
          `To github.com:EASS-PART-A-2026-X/recipe-box.git\n   ${from}..${hash(s.pushed)}  ${BRANCH} -> ${BRANCH}`);
      }
      case "unstage":
        if (s.staged === head(s)) return out("git restore --staged did nothing: nothing was staged.");
        s.staged = head(s);
        return out("Unstaged. The staging area matches the last commit again; your edit is still in the file.");
      case "restore": {
        if (s.work === s.staged) return out("git restore did nothing: the file already matches the staging area.");
        const lost = s.work;
        s.work = s.staged;
        return out(`Edit ${lost} is gone. git restore overwrote the file, and Git never saved that edit.`);
      }
      default:
        throw new RangeError(`Unknown command: ${command}`);
    }
  }

  const version = n => n ? `edit ${n}` : "the original";
  // What each place holds and what its inspection command prints.
  function view(s) {
    const latest = s.edits;
    const pushedHead = s.pushed ? s.commits[s.pushed - 1] : 0;
    const ahead = s.commits.length - s.pushed;
    const log = list => list.length ? list.map((v, i) => `${hash(i + 1)} Update README (edit ${v})`).reverse().join("\n") : "(no commits yet)";
    const status = [`On branch ${BRANCH}`,
      ahead ? `Your branch is ahead of 'origin/${BRANCH}' by ${plural(ahead, "commit")}.` : `Your branch is up to date with 'origin/${BRANCH}'.`];
    if (s.staged !== head(s)) status.push("Changes to be committed:\n\tmodified:   README.md");
    if (s.work !== s.staged) status.push("Changes not staged for commit:\n\tmodified:   README.md");
    if (s.work === s.staged && s.staged === head(s)) status.push("nothing to commit, working tree clean");
    return {
      latest,
      lost: latest > 0 && s.work !== latest && s.staged !== latest && !s.commits.includes(latest),
      areas: [
        {name: "Working tree", holds: version(s.work), has: latest > 0 && s.work === latest,
          command: "git diff", output: s.work !== s.staged ? `+ ${version(s.work)} (not staged yet)` : "(no output)"},
        {name: "Staging area", holds: version(s.staged), has: latest > 0 && s.staged === latest,
          command: "git diff --staged", output: s.staged !== head(s) ? `+ ${version(s.staged)} (will be committed)` : "(no output)"},
        {name: "Local commits", holds: version(head(s)), has: latest > 0 && s.commits.includes(latest),
          command: "git log --oneline", output: log(s.commits)},
        {name: `GitHub (origin/${BRANCH})`, holds: version(pushedHead), has: latest > 0 && s.commits.slice(0, s.pushed).includes(latest),
          command: "git status", output: ahead ? `ahead of origin by ${plural(ahead, "commit")}` : "up to date with origin"}
      ],
      status: status.join("\n")
    };
  }

  if (typeof module !== "undefined" && module.exports) module.exports = {initial, apply, view};
  if (typeof document === "undefined") return;
  const root = document.getElementById("sim-git");
  if (!root) return;
  const el = (tag, props = {}, ...kids) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...kids);
    return node;
  };

  const COMMANDS = [["edit", "Edit and save README.md"], ["add", "git add README.md"], ["commit", "git commit"],
    ["push", "git push"], ["unstage", "git restore --staged README.md"], ["restore", "git restore README.md"]];
  let state = initial();
  const status = el("p", {className: "sim-status"});
  status.setAttribute("role", "status");
  const grid = el("div", {className: "sim-grid"});
  const output = el("pre", {className: "sim-log"});
  const gitStatus = el("pre", {className: "sim-log"});
  const controls = el("div", {className: "sim-controls"});
  for (const [command, label] of COMMANDS) {
    const button = el("button", {type: "button", className: "sim-button"}, command === "edit" ? label : el("code", {textContent: label}));
    button.addEventListener("click", () => run(command));
    controls.append(button);
  }
  const reset = el("button", {type: "button", className: "sim-button sim-quiet", textContent: "Start again"});
  reset.addEventListener("click", () => { state = initial(); render("Started again: README.md is unchanged everywhere.", ""); });
  controls.append(reset);

  function render(message, commandOutput) {
    const v = view(state);
    grid.replaceChildren(...v.areas.map(area => {
      const box = el("div", {className: "sim-box"},
        el("span", {className: "sim-box-title", textContent: area.name}),
        el("span", {className: "sim-badge", textContent: area.has ? `Has edit ${v.latest}` : `Holds ${area.holds}`}),
        el("p", {}, el("code", {textContent: area.command})),
        el("pre", {className: "sim-log", textContent: area.output}));
      box.dataset.tone = area.has ? "flow" : "idle";
      return box;
    }));
    output.textContent = commandOutput || "(this command prints nothing)";
    gitStatus.textContent = v.status;
    status.textContent = v.lost ? `${message} Edit ${v.latest} is in no area.` : message;
  }
  function run(command) {
    const result = apply(state, command);
    state = result.state;
    render(result.message, result.output);
  }

  root.querySelector(".sim-fallback").before(el("div", {className: "sim-app"},
    el("p", {className: "sim-note", textContent: "Press the commands in any order. The highlighted boxes hold your latest edit."}),
    controls, status, grid,
    el("p", {className: "sim-box-title", textContent: "Last command printed"}), output,
    el("p", {}, el("code", {textContent: "git status"}), " now prints"), gitStatus));
  root.classList.add("is-live");
  render("README.md is unchanged everywhere. Start with an edit.", "");
})();
