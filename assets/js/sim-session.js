// Lecture 3 simulator: one SQLModel session on a SQLite file that starts empty. The SQL and the
// rollback behaviour (the object keeps id 1, but no row exists) match a SQLModel run; it is a model.
(() => {
  "use strict";
  const INSERT = ["INSERT INTO recipe (title, minutes, servings, ingredients, tags) VALUES (?, ?, ?, ?, ?)",
    "('Falafel', 60, 2, '', '')"];
  // obj: null or {id, state}; state is pending, flushed, committed, discarded, rolled-back.
  const initial = () => ({obj: null, txOpen: false, uncommitted: 0, committed: 0});
  const open = state => state.obj && (state.obj.state === "pending" || state.obj.state === "flushed");

  function apply(previous, action) {
    const s = {...previous, obj: previous.obj && {...previous.obj}};
    const out = (message, sql = []) => ({state: s, sql, message});
    const flush = () => {
      const sql = s.txOpen ? [] : ["BEGIN (implicit)"];
      s.txOpen = true;
      s.uncommitted += 1;
      s.obj = {id: s.committed + s.uncommitted, state: "flushed"};
      return [...sql, ...INSERT];
    };
    switch (action) {
      case "add":
        if (open(s)) return out("This simulator follows one recipe: commit or roll back the current one first.");
        s.obj = {id: null, state: "pending"};
        return out("session.add(recipe): pending in Python only. recipe.id is None and no SQL was sent.");
      case "flush": {
        if (!s.obj || s.obj.state !== "pending") return out("session.flush(): nothing pending, so no SQL was sent.");
        const sql = flush();
        return out(`session.flush(): the INSERT ran inside an open transaction and recipe.id is ${s.obj.id}. Another connection still cannot see the row.`, sql);
      }
      case "commit": {
        const sql = s.obj && s.obj.state === "pending" ? flush() : [];
        if (!s.txOpen) return out("session.commit(): no transaction is open, so no SQL was sent.");
        s.committed += s.uncommitted;
        s.uncommitted = 0;
        s.txOpen = false;
        s.obj.state = "committed";
        return out(`session.commit(): COMMIT. The row is in the file, so another connection and a restart both see ${s.committed}.`, [...sql, "COMMIT"]);
      }
      case "rollback":
        if (!open(s)) return out("session.rollback(): nothing to undo, so no SQL was sent.");
        if (!s.txOpen) {
          s.obj.state = "discarded";
          return out("session.rollback(): the pending object leaves the session. No SQL had been sent, so none is undone.");
        }
        s.obj.state = "rolled-back";
        s.uncommitted = 0;
        s.txOpen = false;
        return out(`session.rollback(): ROLLBACK undid the INSERT. recipe.id still says ${s.obj.id}, but that row does not exist.`, ["ROLLBACK"]);
      case "restart": {
        const lost = s.uncommitted + (s.obj && s.obj.state === "pending" ? 1 : 0);
        Object.assign(s, {obj: null, txOpen: false, uncommitted: 0});
        return out(`Restarted: Python objects and the open transaction are gone${lost ? ", and so is the uncommitted recipe" : ""}. ${s.committed} committed ${s.committed === 1 ? "row remains" : "rows remain"}.`);
      }
      default:
        throw new RangeError(`Unknown action: ${action}`);
    }
  }

  // The four places the explorer shows: [text, tone].
  function view(s) {
    const obj = !s.obj ? ["No recipe object in this process.", "idle"] : {
      pending: ["Recipe(title='Falafel'), pending. recipe.id is None.", "wait"],
      flushed: [`Flushed. recipe.id is ${s.obj.id}, but the row exists only inside the open transaction.`, "wait"],
      committed: [`Committed. recipe.id is ${s.obj.id} (expired: the next read reloads it from the row).`, "ok"],
      discarded: ["Left the session. recipe.id is None; nothing was ever sent.", "idle"],
      "rolled-back": [`Not in the session. recipe.id still says ${s.obj.id}, but no row ${s.obj.id} exists.`, "bad"]
    }[s.obj.state];
    const survive = n => n === 1 ? "1 row survives" : `${n} rows survive`;
    return {
      object: obj,
      transaction: s.txOpen ? [`Open: BEGIN, then ${s.uncommitted} uncommitted INSERT.`, "wait"] : ["None open.", "idle"],
      other: [`SELECT count(*) FROM recipe returns ${s.committed}.`, s.committed ? "ok" : "idle"],
      restart: [`${survive(s.committed)}. Uncommitted work and Python objects do not.`, s.committed ? "ok" : "idle"]
    };
  }

  if (typeof module !== "undefined" && module.exports) module.exports = {initial, apply, view};
  if (typeof document === "undefined") return;
  const root = document.getElementById("sim-session");
  if (!root) return;
  const el = (tag, props = {}, ...kids) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...kids);
    return node;
  };
  const ACTIONS = [["add", "session.add(recipe)"], ["flush", "session.flush()"], ["commit", "session.commit()"],
    ["rollback", "session.rollback()"], ["restart", "Restart the process"]];
  const PLACES = [["object", "Python object recipe"], ["transaction", "Open transaction"],
    ["other", "Another connection sees"], ["restart", "After a restart"]];
  let state = initial();
  const controls = el("div", {className: "sim-controls"});
  for (const [action, label] of ACTIONS) {
    const button = el("button", {type: "button", className: "sim-button"}, action === "restart" ? label : el("code", {textContent: label}));
    button.addEventListener("click", () => {
      const result = apply(state, action);
      state = result.state;
      render(result.message, result.sql);
    });
    controls.append(button);
  }
  const reset = el("button", {type: "button", className: "sim-button sim-quiet", textContent: "Empty the file and start again"});
  reset.addEventListener("click", () => { state = initial(); render("Started again with an empty trace.db.", []); });
  controls.append(reset);
  const status = el("p", {className: "sim-status"});
  status.setAttribute("role", "status");
  const grid = el("div", {className: "sim-grid"});
  const log = el("pre", {className: "sim-log"});

  function render(message, sql) {
    const v = view(state);
    grid.replaceChildren(...PLACES.map(([key, title]) => {
      const box = el("div", {className: "sim-box"}, el("span", {className: "sim-box-title", textContent: title}), el("p", {textContent: v[key][0]}));
      box.dataset.tone = v[key][1];
      return box;
    }));
    log.textContent = sql.length ? sql.join("\n") : "(no SQL sent)";
    status.textContent = message;
  }

  root.querySelector(".sim-fallback").before(el("div", {className: "sim-app"},
    el("p", {className: "sim-note", textContent: "One Falafel recipe, one session, a trace.db file that starts empty. Predict each box before you press."}),
    controls, status, grid, el("p", {className: "sim-box-title", textContent: "SQL the engine sent (echo=True)"}), log));
  root.classList.add("is-live");
  render("Nothing has happened yet: no object, no transaction, 0 rows.", []);
})();
