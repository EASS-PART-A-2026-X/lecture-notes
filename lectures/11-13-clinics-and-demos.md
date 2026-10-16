# Meetings 11–13 · Clinics, rehearsal and final demos

<!-- {% raw %} -->
[← Course home](../README.md) · [← Previous: Lecture 10](10-ci-security-release.md)

**Dates:** Mondays 28 December 2026, 4 January 2027 and 11 January 2027, 16:00 Israel time, on Zoom · **You leave with:** a rehearsed demo and verified PR evidence

No new material: you work on your own product and PRs; the instructor may reorder agenda items. Rules and deadlines live in the [course README](../README.md). Commands use Recipe Box names; substitute yours.

<details markdown="1" class="lecture-toc">
<summary>On this page</summary>

- [Meeting 11 · Integration and upstream-review clinic](#meeting-11--integration-and-upstream-review-clinic)
- [Meeting 12 · Demo rehearsal, troubleshooting and evidence review](#meeting-12--demo-rehearsal-troubleshooting-and-evidence-review)
- [Meeting 13 · Final demos and individual technical discussion](#meeting-13--final-demos-and-individual-technical-discussion)
- [Individual technical discussion · question bank](#individual-technical-discussion--question-bank)
- [Read more](#read-more)

</details>

## Meeting 11 · Integration and upstream-review clinic

**Purpose (Monday 28 December 2026):** a stack that starts from a clean clone, and a written next step for every open upstream PR.

### What you bring

- Your [Lecture 10](10-ci-security-release.md) release candidate, running.
- Your open PRs: `gh search prs --author=@me --state=open --json url,updatedAt,commentsCount`.
- One unanswered review comment or one quiet PR.

### Suggested agenda

1. Checklist stand-up: each student answers one [self-check](#grader-style-self-check) bullet about their own project.
2. Integration triage in pairs, using the path below.
3. Ownership swap: explain your PR to a partner as if they were the maintainer; they explain it back. If they struggle, improve the PR description.
4. Review-reply workshop (playbook below): you draft replies; peers comment on tone.
5. Stalled-PR rescue: the group suggests next steps for one quiet PR.
6. Write a status, next action and date for each PR.

### Integration triage path

```text
Symptom: the app shows an error, or nothing
1. docker compose ps        all healthy?       no  -> docker compose logs <service>
2. backend GET /health      {"status":"ok"}?   no  -> backend logs, DATABASE_URL
3. POST /recipes/from-text  201?               503 -> ai down, slow, over budget
                                               502 -> bad model output/contract
4. frontend BACKEND_URL     http://backend:8000 inside Compose?
```

### Upstream-review clinic playbook

**Answering review comments.** Read the whole review and restate each request in your own words; ask if unclear. Make one change per request, run the project's tests, push to the same branch. Reply in each thread with what changed and how you verified it, or disagree politely with evidence. Write replies yourself, within the project's AI policy.

**Nudging a stalled PR.** First fix what is yours: failing CI, conflicts, an unsigned contributor license agreement (CLA), a missing template item. Wait as long as the project asks, or at least a week after the last activity. Then post one short comment: what is ready, what you checked, one easy question. No mass tagging, no repeated pings, no deadline pressure such as "I need this merged for a course".

**When to pivot.** Start another viable contribution in parallel when a maintainer declines the change, the issue is fixed elsewhere, or a nudge goes unanswered close to the deadline. Keep the original PR open unless asked to close it. Pivoting adds attempts; it never lowers the bar: only [merged PRs count](../README.md#what-counts-as-merged), and the [etiquette rules](../README.md#contribution-etiquette) still apply.

## Meeting 12 · Demo rehearsal, troubleshooting and evidence review

**Purpose (Monday 4 January 2027):** demo from a fresh clone, survive one failure on purpose, and prove every merged PR.

### What you bring

- Your repository URL, and a partner to clone it. If your repo is private, invite your partner beforehand with `gh api --method PUT repos/YOU/REPO/collaborators/PARTNER` (they accept the invite; on a personal repo this grants write access, so remove them afterwards), or share your screen while they dictate the steps.
- A short demo script, plus your filled-in evidence table and AI-use note.

### Suggested agenda

1. Clean-clone dry run: your partner follows only your README.
2. Demo rehearsal, following the checklist below.
3. Break it on purpose: a peer picks a [Lecture 9](09-failures-evals-costs.md) drill; you show the graceful path live.
4. Peer feedback on clarity, resilience and ease of use, in words, not scores.
5. Explain one design decision and its trade-off, then answer two [question bank](#individual-technical-discussion--question-bank) questions.
6. Evidence review with the instructor, then a troubleshooting queue.

### Demo rehearsal checklist

1. **Clean checkout**, with no `.env` and no `.venv`:

   ```bash
   git clone <your-repo-url> fresh-check
   cd fresh-check
   export COMPOSE_PROJECT_NAME=fresh-check
   docker compose config --quiet
   docker compose up --build --wait
   ```

   `COMPOSE_PROJECT_NAME` overrides `name:` in `compose.yaml`, so the clone gets its own containers and an empty volume instead of joining your dev stack. Stop the dev stack first (`docker compose stop` in your working copy), so ports 8000 and 8501 are free.

2. **Happy path** at <http://localhost:8501>: list, add, edit, delete, then the AI flow. Check the API too:

   ```bash
   curl http://localhost:8000/health
   curl -i -X POST http://localhost:8000/recipes/from-text \
     -H "Content-Type: application/json" \
     -d '{"text": "Hummus: chickpeas, tahini. 15 min."}'
   ```

   With `AI_MODEL=test`, expect `201` with placeholder values such as `"title":"a"`: that is TestModel, not a bug.

3. **One failure drill:** `docker compose stop ai-service`, then repeat the request: expect `503 {"detail":"AI service unavailable"}` and a friendly UI message. Restore with `docker compose up --wait`.
4. **Tests:** `uv run pytest` in each service, exactly as your README says.
5. **Evals:** `uv run python -m evals.run_evals` in `ai-service/`, then show the dated results table.
6. **Evidence:** open your README's evidence table.
7. **Clean up:** `docker compose down -v` in `fresh-check`, with the same `COMPOSE_PROJECT_NAME`.

Ports 8000 or 8501 busy? Set `BACKEND_PORT` and `FRONTEND_PORT` before `up`.

### Grader-style self-check

A grader follows the path in the [README](../README.md#working-method-ai-use-assessment-and-reproducibility). Walk it yourself first:

- [ ] `.env.example` lists every setting without real values; `git check-ignore -v .env` names your ignore rule.
- [ ] `docker compose up --build` starts all three services; `docker compose ps` shows them healthy.
- [ ] Core flows work in the browser, with loading, empty and error states.
- [ ] The README's test commands pass with no key and no model calls.
- [ ] Failures read clearly: ai-service down, backend down, invalid input.
- [ ] Data survives `down` then `up`, and the README warns that `down -v` wipes it.
- [ ] Real-model instructions are separate and optional.
- [ ] `git status` is still clean afterwards.

### Evidence review

For each PR in your [evidence table](../README.md#evidence-table):

```bash
gh repo view OWNER/REPO --json stargazerCount,licenseInfo,isFork,defaultBranchRef
gh pr view PR_URL --json state,mergedAt,baseRefName,mergeCommit
gh api repos/OWNER/REPO/compare/MERGE_SHA...DEFAULT_BRANCH --jq .status
```

A PR passes when `state` is `MERGED` and `baseRefName` equals the `defaultBranchRef` name (sometimes `master`, as in FastAPI). After a merge into another branch, the third command must print `ahead` or `identical`; `behind` or `diverged` means not on the main branch yet. Stars change: your evidence is the dated snapshot taken when you opened the PR ([qualifying repositories](../README.md#qualifying-repositories)).

## Meeting 13 · Final demos and individual technical discussion

**Purpose (Monday 11 January 2027):** show it working and explain it in your own words.

### What you bring

- The commit or tag you will demo, already started from a clean clone.
- Your README, open at the runbook and the evidence table.

### Suggested agenda

1. Final demonstrations in the announced order, following the rehearsal checklist.
2. Individual technical discussion: questions from several topics below, including your PRs. Partners answer separately.
3. Close: EX3 and open-source evidence are due at 23:59 Israel time today ([deadlines](../README.md#assignments-and-deadlines)), via the submission channel provided by the instructor.

## Individual technical discussion · question bank

For the instructor; students may practice with it. "Listen for" lists what a good answer mentions; "show me where" in the student's code is the best follow-up. No scores or weights: assessment criteria are in the README.

### HTTP and FastAPI

<details markdown="1">
<summary>Q1. Which status codes do create, delete, a missing item and bad input return?</summary>

**Listen for:** 201 with the resource; 204, no body; 404 for any missing id, DELETE included; 422 from validation.

</details>

<details markdown="1">
<summary>Q2. What happens when a client sends <code>GET /recipes?limit=101</code>?</summary>

**Listen for:** `Query(ge=1, le=100)` rejects it before the handler runs: 422, `loc` names `limit`.

</details>

<details markdown="1">
<summary>Q3. What runs when your backend starts and stops?</summary>

**Listen for:** The lifespan creates tables and seeds, yields, then disposes the engine; `TestClient` runs it only inside `with`.

</details>

### Pydantic

<details markdown="1">
<summary>Q4. Why separate Create, Update and Public models?</summary>

**Listen for:** Clients cannot set `id`; PATCH applies only sent fields; responses always include `id`.

</details>

<details markdown="1">
<summary>Q5. A client sends <code>PATCH /recipes/1</code> with <code>{"titel": "Soup"}</code>. What happens?</summary>

**Listen for:** `extra="forbid"` gives 422 `extra_forbidden`; otherwise the typo is ignored and a 200 changes nothing.

</details>

### Persistence

<details markdown="1">
<summary>Q6. Prove your data survives a restart. What would delete it?</summary>

**Listen for:** A named volume survives `down`; `down -v` deletes it and the idempotent seed reruns; a restart test proves it.

</details>

<details markdown="1">
<summary>Q7. How do your tests avoid touching your real database?</summary>

**Listen for:** A fresh database per test via `app.dependency_overrides`; engine disposed; any test order passes.

</details>

### Frontend states

<details markdown="1">
<summary>Q8. Show the loading, empty and error states. Where is each in the code?</summary>

**Listen for:** A spinner while loading, an info message when empty, and one module that turns errors into messages with a next step, never a traceback.

</details>

<details markdown="1">
<summary>Q9. How does your UI test run without a backend? What does the browser test add?</summary>

**Listen for:** `AppTest` (or equivalent) runs in-process with HTTP mocked; Playwright drives a real browser with role-based locators.

</details>

### Pydantic AI

<details markdown="1">
<summary>Q10. What does <code>output_type</code> give you, and what if the answer does not fit?</summary>

**Listen for:** Validated, typed `result.output`; failures go back to the model as retries; then `UnexpectedModelBehavior` becomes a 502.

</details>

<details markdown="1">
<summary>Q11. What are your agent's tools and dependencies for?</summary>

**Listen for:** Tools supply facts the model should not guess; `@agent.tool` gets `ctx.deps`, `tool_plain` does not; tests swap deps.

</details>

<details markdown="1">
<summary>Q12. How do you guarantee tests and CI never call a paid model?</summary>

**Listen for:** `models.ALLOW_MODEL_REQUESTS = False`; `agent.override` with `TestModel` or `FunctionModel`; `AI_MODEL` defaults to `test`.

</details>

### Service contracts

<details markdown="1">
<summary>Q13. Why is the AI a separate service? Would a Redis container count instead?</summary>

**Listen for:** Own process, contract and tests, called over HTTP; an in-backend agent class or Redis does not count ([requirements](../README.md#three-service-product-requirements)).

</details>

<details markdown="1">
<summary>Q14. Walk through your timeout values. Why that order?</summary>

**Listen for:** Explicit timeouts; the AI limit below the backend's read timeout (Recipe Box: 25 s inside 30 s); the frontend outlasting the backend's retries.

</details>

<details markdown="1">
<summary>Q15. Why does the backend answer 503 for one AI failure and 502 for another?</summary>

**Listen for:** 503: the AI service is unreachable, slow, crashed (500) or over its budget (429); 502: it answered, but its output stayed invalid after the agent's retries or broke the contract, so the fix is in the AI service, not in waiting.

</details>

### Docker Compose

<details markdown="1">
<summary>Q16. Why can the backend reach the ai-service by name when your laptop cannot reach it at all?</summary>

**Listen for:** `localhost` is the container itself; Compose DNS resolves service names; no `ports:`, so nothing bypasses the backend.

</details>

<details markdown="1">
<summary>Q17. What do <code>healthcheck</code> and <code>condition: service_healthy</code> do in your stack?</summary>

**Listen for:** A `/health` probe inside the container; dependents wait for it, because started is not ready; `up --wait` blocks until healthy.

</details>

### Failures and evaluations

<details markdown="1">
<summary>Q18. Which failures do you retry, how often, and which never?</summary>

**Listen for:** Retry at one layer only: the backend retries transport failures (timeouts, connect errors) and ai-service 503/504, at most 3 attempts with backoff; never 429 (budget spent), 502 (the agent already retried the model), 500 or other 4xx. Every retry costs money. `POST /extract` stores nothing, so repeating it is safe; the frontend never retries `POST /recipes/from-text`.

</details>

<details markdown="1">
<summary>Q19. What is in your evaluation dataset, and what did it tell you?</summary>

**Listen for:** Messy real inputs, including prompt injection; deterministic evaluators; dated results with the model; a drop is a regression.

</details>

<details markdown="1">
<summary>Q20. How do you stop one request from running up a model bill?</summary>

**Listen for:** `UsageLimits` on requests, tool calls and tokens; a wall-clock timeout (504); an exceeded budget makes the ai-service answer 429, which the backend never retries and reports as 503.

</details>

### CI and security

<details markdown="1">
<summary>Q21. What does your CI run, and why <code>uv sync --locked</code>?</summary>

**Listen for:** Lint and tests with `AI_MODEL=test`, a Compose smoke test; `--locked` fails on a stale `uv.lock`; SHA-pinned actions.

</details>

<details markdown="1">
<summary>Q22. An API key was committed and pushed. What do you do, in order?</summary>

**Listen for:** Rotate it at the provider first; then remove it and use a git-ignored `.env`; rewriting history alone is not enough.

</details>

### Open-source contributions

<details markdown="1">
<summary>Q23. Walk me through one merged PR and how you verified it.</summary>

**Listen for:** Reproduction; why that scope; which project tests ran; what the reviewer asked. Follow up: "explain one line of the diff".

</details>

<details markdown="1">
<summary>Q24. How did you check eligibility, and that the change reached the main branch?</summary>

**Listen for:** A dated star snapshot above 10,000; license; not a fork; `MERGED` into the default branch, or its merge commit shown there.

</details>

<details markdown="1">
<summary>Q25. A review you disagreed with, or a PR that stalled: what did you do?</summary>

**Listen for:** Answered with evidence, in their own words; for a stall: fixed CI, nudged once, started another contribution in parallel.

</details>

## Read more

- [Contributing to a project](https://docs.github.com/en/get-started/exploring-projects-on-github/contributing-to-a-project) (GitHub Docs)
- [gh pr view](https://cli.github.com/manual/gh_pr_view) and [gh search prs](https://cli.github.com/manual/gh_search_prs) (GitHub CLI manual)
- [Compare two commits](https://docs.github.com/en/rest/commits/commits#compare-two-commits) (GitHub REST API)

---

[← Course home](../README.md) · [← Previous: Lecture 10](10-ci-security-release.md)

<!-- {% endraw %} -->
