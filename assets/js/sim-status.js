// Lecture 2 simulator: which FastAPI stage answers a request. Bodies were captured from the
// Lecture 2 API (FastAPI 0.143.3, Pydantic 2.14.1); this script only replays them.
(() => {
  "use strict";
  const STAGES = ["Match the path and method", "Parse the JSON body", "Resolve and validate inputs",
    "Run your handler", "Build the response"];
  const POST = body => `curl -i --json '${body}' localhost:8000/recipes`;
  const ROUTE_POST = "POST /recipes matches create_recipe.";
  const JSON_OK = "The body is valid JSON.";
  const NOT_FOUND = '{"detail":"Recipe not found"}';
  // Each step is [state, text]; "stop" means this stage writes the response.
  const REQUESTS = [
    {id: "valid", label: "Valid POST", command: POST('{"title": "Shakshuka", "minutes": 25}'), given: "A fresh server with an empty store.",
      steps: [["pass", ROUTE_POST], ["pass", JSON_OK],
        ["pass", "RecipeCreate accepts it; servings, ingredients and tags get their defaults."],
        ["pass", "create_recipe stores the recipe with id 1."],
        ["pass", "RecipePublic filters the fields, and the route's status is 201."]],
      status: "201 Created", body: '{"title":"Shakshuka","minutes":25,"servings":2,"ingredients":"","tags":"","id":1}'},
    {id: "missing", label: "Missing field", command: POST('{"title": "Soup"}'), given: "Any store.",
      steps: [["pass", ROUTE_POST], ["pass", JSON_OK],
        ["stop", "minutes has no default, so validation reports type missing at [\"body\", \"minutes\"]. Your handler never runs."]],
      status: "422 Unprocessable Content",
      body: '{"detail":[{"type":"missing","loc":["body","minutes"],"msg":"Field required","input":{"title":"Soup"}}]}'},
    {id: "type", label: "Wrong type", command: POST('{"title": "Soup", "minutes": "soon"}'), given: "Any store.",
      steps: [["pass", ROUTE_POST], ["pass", JSON_OK],
        ["stop", "\"soon\" cannot become an int: type int_parsing at [\"body\", \"minutes\"]. Your handler never runs."]],
      status: "422 Unprocessable Content",
      body: '{"detail":[{"type":"int_parsing","loc":["body","minutes"],"msg":"Input should be a valid integer, unable to parse string as an integer","input":"soon"}]}'},
    {id: "unknown-id", label: "Unknown id", command: "curl -i localhost:8000/recipes/999", given: "No recipe 999 exists.",
      steps: [["pass", "GET /recipes/{recipe_id} matches get_recipe."], ["skip", "A GET route takes no body."],
        ["pass", "\"999\" converts to the int 999."],
        ["stop", "get_or_404 finds no recipe 999 and raises HTTPException(404)."]],
      status: "404 Not Found", body: NOT_FOUND},
    {id: "unknown-path", label: "Unknown path", command: "curl -i localhost:8000/recipe/1", given: "Any store.",
      steps: [["stop", "No route has the path /recipe/1 (the routes say /recipes)."]],
      status: "404 Not Found", body: '{"detail":"Not Found"}'},
    {id: "delete-twice", label: "DELETE twice", command: "curl -i -X DELETE localhost:8000/recipes/1",
      given: "Recipe 1 existed, and the first DELETE answered 204 No Content with an empty body. This is the second call.",
      steps: [["pass", "DELETE /recipes/{recipe_id} matches delete_recipe."], ["skip", "A DELETE route takes no body."],
        ["pass", "\"1\" converts to the int 1."],
        ["stop", "The first call removed recipe 1, so get_or_404 raises HTTPException(404)."]],
      status: "404 Not Found", body: NOT_FOUND}
  ];

  function trace(id) {
    const request = REQUESTS.find(item => item.id === id);
    if (!request) throw new RangeError(`Unknown request: ${id}`);
    const steps = STAGES.map((name, index) => {
      const [state, text] = request.steps[index] || ["unreached", "An earlier stage already answered."];
      return {stage: index + 1, name, state, text};
    });
    const stop = steps.find(step => step.state === "stop");
    return {request, steps, answeredBy: stop ? stop.stage : STAGES.length, status: request.status, body: request.body};
  }

  if (typeof module !== "undefined" && module.exports) module.exports = {STAGES, REQUESTS, trace};
  if (typeof document === "undefined") return;
  const root = document.getElementById("sim-status");
  if (!root) return;
  const el = (tag, props = {}, ...kids) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...kids);
    return node;
  };
  const WORDS = {pass: "Passed", skip: "Skipped", stop: "Stopped here", unreached: "Not reached"};
  const TONES = {pass: "ok", skip: "idle", stop: "bad", unreached: "idle"};

  let current = null, shown = 0;
  const picks = el("div", {className: "sim-controls"});
  const command = el("pre", {className: "sim-log"});
  const given = el("p", {className: "sim-note"});
  const stages = el("ol", {className: "sim-stages"});
  const response = el("pre", {className: "sim-log"});
  const status = el("p", {className: "sim-status"});
  status.setAttribute("role", "status");
  const next = el("button", {type: "button", className: "sim-button", textContent: "Next stage"});
  const all = el("button", {type: "button", className: "sim-button sim-quiet", textContent: "Show the answer"});
  for (const request of REQUESTS) {
    const button = el("button", {type: "button", className: "sim-button", textContent: request.label});
    button.dataset.request = request.id;
    button.addEventListener("click", () => pick(request.id));
    picks.append(button);
  }
  const done = () => next.getAttribute("aria-disabled") === "true";
  next.addEventListener("click", () => { if (!done()) step(shown + 1); });
  all.addEventListener("click", () => { if (!done()) step(STAGES.length); });

  function pick(id) {
    current = trace(id);
    picks.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.request === id)));
    command.textContent = current.request.command;
    given.textContent = `Given: ${current.request.given} Predict the status code, then step through the stages.`;
    step(0);
  }
  function step(count) {
    shown = Math.min(count, STAGES.length);
    const answered = shown >= current.answeredBy;
    if (answered) shown = STAGES.length;
    stages.replaceChildren(...current.steps.map((s, index) => {
      const item = el("li", {}, el("strong", {textContent: s.name}));
      if (index < shown) {
        item.append(el("span", {className: "sim-badge", textContent: WORDS[s.state]}), ` ${s.text}`);
        item.dataset.tone = TONES[s.state];
      }
      return item;
    }));
    response.hidden = !answered;
    response.textContent = `HTTP/1.1 ${current.status}\n\n${current.body || "(empty body)"}`;
    [next, all].forEach(button => button.setAttribute("aria-disabled", String(answered)));
    const last = current.steps[Math.max(shown, 1) - 1];
    status.textContent = shown === 0 ? `${current.request.label} selected. Five stages to go.`
      : answered ? `Answered by stage ${current.answeredBy}, ${current.steps[current.answeredBy - 1].name}: ${current.status}.`
        : `Stage ${shown} of 5, ${last.name}: ${WORDS[last.state].toLowerCase()}.`;
  }

  root.querySelector(".sim-fallback").before(el("div", {className: "sim-app"},
    el("p", {className: "sim-note", textContent: "Choose a request:"}), picks, command, given, stages,
    el("div", {className: "sim-controls"}, next, all), status, response));
  root.classList.add("is-live");
  pick("valid");
})();
