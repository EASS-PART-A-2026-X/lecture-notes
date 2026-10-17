# One request, end to end: contracts, containers, and recovery

<!-- {% raw %} -->

[Course home](../README.md) · [Learning map](learning-map.md) · [Lecture 7](../lectures/07-third-service-contracts.md) · [Engineering contracts](engineering-contracts.md)

**A visual review for Lectures 3 and 7–10.** Use this with your existing product; no new framework or assignment is introduced. Follow a successful request, predict failures, and collect evidence at the right boundary. The diagrams describe Recipe Box's Streamlit route; a React browser client has a different first HTTP hop.

<details markdown="1" class="lecture-toc">
<summary>On this page</summary>

- [Specify the user outcome](#specify-the-user-outcome)
- [Read the service map](#read-the-service-map)
- [Follow the commit boundary](#follow-the-commit-boundary)
- [Read code as a sequence of obligations](#read-code-as-a-sequence-of-obligations)
- [Budget time across the whole request](#budget-time-across-the-whole-request)
- [Evolve an API without breaking callers](#evolve-an-api-without-breaking-callers)
- [Diagnose one failure at a time](#diagnose-one-failure-at-a-time)
- [Know when a new pattern earns its complexity](#know-when-a-new-pattern-earns-its-complexity)
- [Run the release rehearsal](#run-the-release-rehearsal)
- [Teaching references](#teaching-references)
- [Quick quiz](#quick-quiz)

</details>

## Specify the user outcome

**User story:** paste recipe text, obtain one accepted recipe, and see it after restarting the application. If extraction fails before saving, show an actionable error and keep existing recipes usable.

Write the contract before asking a coding agent to implement it:

| Obligation | Observable check |
|---|---|
| Invalid input never starts extraction | Empty text → 422; dependency-call count stays zero |
| A candidate satisfies structure and domain rules before storage | Malformed JSON, invalid values, or forbidden tags cannot become an accepted recipe |
| Only the backend changes product state | The AI service has no product database mount or write tool |
| A successful response follows a successful commit | Read the returned ID and restart before reading it again |
| An extraction outage leaves CRUD available | Create/read an ordinary recipe while extraction is unavailable |
| Failure wording does not expose internals | User sees the documented error, without secrets, internal URLs, or tracebacks |

These are separate properties. One green test cannot establish all six. A deterministic `TestModel` proves wiring and selected control behavior; it does not show that a real model understood the pasted recipe.

## Read the service map

<figure class="course-diagram">
<div class="diagram-scroll" role="region" aria-label="Service map, scroll horizontally" tabindex="0">
<img src="../assets/diagrams/service-boundaries.svg" width="640" height="900" alt="Browser to frontend, frontend to backend, backend to AI service. Only backend accesses the database; only AI service calls inference. Services use Compose DNS internally.">
</div>
<figcaption>On a narrow screen, focus the diagram and scroll horizontally. Deployment and ownership. Arrows show dependencies, not permission grants. The model box is logical: TestModel runs inside the AI process. <a href="../assets/diagrams/service-boundaries.svg">Open the diagram at full size</a>.</figcaption>
</figure>

In words: the browser talks to the published frontend. Streamlit's Python calls `http://backend:8000`; the backend calls `http://ai-service:8001`. Only the backend accesses the persistent database volume. The AI service owns model access and bounded domain tools. A local inference server, when used, is another dependency—not another owner of product data.

`localhost` names the process's own network namespace. Container callers use service DNS and **container** ports; the host browser uses the published address. The backend's loopback port 8000 is also available for course `curl` and `/docs` checks, although it is omitted from this user-journey diagram. An unpublished AI port reduces exposure but does not authenticate peers. Compose health ordering handles startup dependencies; application code still handles failures after startup.

**Predict:** replace `AI_SERVICE_URL` with `http://localhost:8001` inside the backend. Which process receives the connection attempt? Which log and health check would distinguish a DNS mistake from an unavailable AI process?

## Follow the commit boundary

<figure class="course-diagram">
<div class="diagram-scroll" role="region" aria-label="Commit sequence, scroll horizontally" tabindex="0">
<img src="../assets/diagrams/commit-boundary.svg" width="640" height="800" alt="Validate request, obtain an AI candidate, validate it, commit in the backend, then return success. A lost response after commit leaves an uncertain outcome for the caller.">
</div>
<figcaption>On a narrow screen, focus the diagram and scroll horizontally. One synchronous create flow. Before the commit, the candidate is not yet a stored recipe. After the commit, a missing response is not proof that the write failed. <a href="../assets/diagrams/commit-boundary.svg">Open the diagram at full size</a>.</figcaption>
</figure>

There is no distributed database transaction across the frontend, backend, and model provider. The backend's local transaction is authoritative for the recipe. Extraction may already have consumed inference resources even if no recipe was committed. Keep a slow remote call outside an active write transaction; otherwise a model delay can hold database locks and hurt unrelated requests. A request-scoped session is not automatically an active write transaction.

If the reply disappears after commit, the caller may not know whether creation succeeded. Refresh/search for the result or use an explicitly designed idempotency protocol. Disabling a button improves UI behavior but does not prevent duplicate requests from a second tab, network retry, or CLI client.

## Read code as a sequence of obligations

This is the **route excerpt from Lecture 7**, after its documented imports and client dependency are in place. It is not a standalone replacement file:

```python
# backend/app/main.py
@app.post(
    "/recipes/from-text",
    response_model=RecipePublic,
    status_code=status.HTTP_201_CREATED,
)
def create_recipe_from_text(
    body: FromTextRequest, session: db.SessionDep, ai: AIClientDep
) -> Recipe:
    try:
        new_recipe = ai.extract_recipe(body.text)
    except AIServiceUnavailable as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI service unavailable"
        ) from exc
    except AIServiceBadOutput as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, detail="AI service returned invalid output"
        ) from exc
    return save(session, Recipe.model_validate(new_recipe))
```

Read the function body in order: the client calls and validates the foreign service; failures return before `save`; the backend converts the accepted candidate into its own record; `save` commits and refreshes. Request validation happens before the route body. The complete [Lecture 3 models and routes](../lectures/03-persistence-and-first-pr.md#live-demo) now show the database helpers and all CRUD operations, with 12 executed contract/restart/seed tests.

The consumer should validate what it uses, not import the provider's database objects. Length, numeric bounds, business rules, authorization, and factual quality are different checks. A valid schema cannot establish that the recipe is accurate or that the caller owns an existing record. Product extraction has read-only tools; it does not receive the coding assistant's shell or release authority.

## Budget time across the whole request

A timeout on each HTTP phase is not necessarily an end-to-end deadline. Queueing, pool waits, retries, backoff, parsing, persistence, and response transmission all use time.

```text
outer request budget
  ≥ local work + Σ(attempt duration) + Σ(backoff) + response margin
```

**Illustrative arithmetic:** three attempts taking at most 2 seconds each, two waits of 0.5 and 1 second, and 1 second reserved for local/response work require up to 8.5 seconds. This is not a configured Recipe Box deadline. Lecture 9's agent timeout applies per extraction attempt and increases the frontend read allowance to 100 seconds for its bounded retry sequence. Keep those settings together: retaining Lecture 7's shorter frontend timeout would cut that sequence short. Phase timeouts still are not a strict whole-request deadline.

The course first teaches phase timeouts, then a model-call deadline and bounded retries. For a production adaptation, enforce a total deadline at the owning boundary, pass a *remaining* budget to supported downstream operations, and skip attempts that cannot fit. Avoid stacked retry loops at several layers; retry only failures the contract permits, with bounded backoff and jitter where synchronized retries would amplify load. A client timeout does not prove remote work stopped; check cancellation support and side effects separately.

**Failure experiment:** allow each extraction attempt to approach its deadline. Predict which caller times out first, then inspect attempts, elapsed time, and any later server completion. Do this only with a controlled fake/delayed dependency, not repeated paid model calls.

## Evolve an API without breaking callers

Independently deployed services must survive mixed versions. Ask what the old consumer does with the new response and what the new consumer does with the old response.

| Proposed change | Question before release |
|---|---|
| Add an optional response field | Does the old consumer ignore extras? Does it remain optional for new consumers? |
| Add a required request field | How will existing callers supply it? Provide a compatible default/transition or version the contract |
| Rename a response field or change its type | Which callers still rely on the old field? Support both during a measured migration or introduce a versioned contract |
| Change a database column | Can running application versions coexist with the migration? Test data, backup/restore, and rollout order |
| Change model/provider/quantization | Do output/tool semantics and held-out quality cases still pass? |

A consumer test with a fake provider establishes the consumer's assumptions; it does not prove the real provider satisfies them. Pair it with a provider schema/example check and a real integration run. Avoid a shared database schema becoming the hidden API between services. A physical database server can host multiple services' private stores; ownership and direct cross-service table access are the important boundaries.

## Diagnose one failure at a time

| Injected condition | Expected user/application behavior | Evidence to collect |
|---|---|---|
| Empty input | 422 before dependency call | Response plus zero call count |
| Wrong internal hostname | Controlled dependency failure; CRUD still works | Configuration, backend error class, AI call count |
| AI returns an invalid candidate | Documented 502; no accepted recipe | Response, validation failure category, database check |
| AI service stops after startup | Extraction fails gracefully | `compose ps`, relevant service logs, CRUD and extraction responses |
| Containers restart with the same volume | Previously stored recipe remains | Returned ID and read-after-restart |
| Reply is lost after a committed create | Caller records uncertain outcome | Stored record and request evidence; no blind repeated create |

For the final Lecture 9 contract, consult its retry/error table: the AI service's budget-exhaustion 429 is deliberately not retried and maps to a backend 503. Status-code policy is application-specific; “retry every 429/5xx” is not a universal rule.

A useful **synthetic log record**, not a claim that the course already emits these fields:

```json
{"request_id":"demo-001","service":"backend","event":"extract_unavailable","status":503,"duration_ms":27}
```

Use a bounded, validated correlation identifier when implementing cross-service logs. Do not trust arbitrary incoming header text as an identity or authorization claim, and do not log keys or full recipe/user text by default. Logs describe events, metrics aggregate behavior, and traces connect spans across calls. An `X-Request-ID` string alone is not a complete distributed trace; optional OpenTelemetry instrumentation supplies propagation and span relationships. Trace data describes observable execution, not private model reasoning.

## Know when a new pattern earns its complexity

| Pattern | Problem it can address | Cost or limit |
|---|---|---|
| Bounded concurrency / admission control | Slow extraction exhausts threads, connections, or memory | Queue limits and rejection policy need measurement; another container alone is not isolation |
| Circuit breaker | Repeated dependency failures waste work | State, recovery probes, and false trips; it does not replace timeouts |
| Background job + durable queue | Work takes longer than an interactive request budget | Job lifecycle, retries, visibility, cancellation, and duplicate delivery |
| Idempotency key | A client safely repeats a state-changing operation | Durable atomic deduplication, request fingerprint, retention, and concurrent-request behavior |
| Outbox + consumer deduplication | A committed change must reliably lead to an event | Store change and outbox entry atomically; relay can deliver duplicates |
| Saga / compensation | A business process spans independent service transactions | Compensations are domain actions, not a magical rollback of every external effect |

These are optional design extensions. The current synchronous course product does not need Kubernetes, Kafka, a service mesh, or every pattern in this table. Begin with the simplest structure meeting measured requirements; outside the three-service assignment, a modular monolith may be the right starting point. Separate by responsibility and ownership, not by every table or function.

## Run the release rehearsal

From a clean checkout of **your product repository**, follow Lecture 8's configuration and use synthetic data. These commands assume the course's `backend`, `frontend`, and `ai-service` names:

<div class="walkthrough-command" markdown="1">

```bash
docker compose config --quiet
docker compose up --build --wait
curl --fail --max-time 5 http://127.0.0.1:8000/health
curl --fail --max-time 110 http://127.0.0.1:8000/recipes/from-text \
  -H 'Content-Type: application/json' \
  --data '{"text":"Hummus: chickpeas and tahini. 15 minutes."}'
docker compose ps
```

</div>

With the offline model, a schema-valid synthetic result is expected. Inspect the browser flow too; a curl request does not establish UI usability. Record the returned ID, read it, then use `docker compose down` and `docker compose up --wait` before reading again. Do not add `-v` when testing persistence.

Next, run `docker compose stop ai-service`, attempt extraction through the UI, and confirm ordinary CRUD remains usable. Restore with `docker compose start ai-service`, then `docker compose up --wait`. Retain the source revision, image identities, commands, actual results, relevant redacted logs, and model configuration. A stopped dependency is a deliberate drill, not a healthy final submission state.

**Explain it individually:** trace one request without an assistant; name the authoritative write, the earliest rejecting boundary, one unproven property, and the evidence that would close that gap. Ask a reviewer to propose one counterexample, reproduce it if valid, and revise the implementation or contract accordingly.

## Teaching references

Reviewed **17 October 2026**. The exercises and diagrams are original course material. [MIT 6.102's specifications reading](https://web.mit.edu/6.102/www/sp26/classes/04-specifications/) supports clear caller/implementer obligations and specification-based tests. [Stanford CS146S, Fall 2026](https://themodernsoftware.dev/) informs the connection between explicit intent, agent context, iterative evaluation, and a runnable product. The course retains its own prerequisites, stack, and assessment policy.

Technical references: Microsoft's [API design](https://learn.microsoft.com/en-us/azure/architecture/microservices/design/api-design) and [data considerations](https://learn.microsoft.com/en-us/azure/architecture/microservices/design/data-considerations), [AWS on timeouts/retries/backoff](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/), [Docker startup order](https://docs.docker.com/compose/how-tos/startup-order/), and [OpenTelemetry traces](https://opentelemetry.io/docs/concepts/signals/traces/). Advanced patterns require their own design and tests; this overview does not implement them.

<div class="walkthrough-quiz" markdown="1">

## Quick quiz

<details markdown="1">
<summary>Q1. The create request times out. Can you safely assume no recipe exists?</summary>

No. The database may have committed before the response was lost. Investigate the outcome or use a designed idempotency protocol before repeating the operation.

</details>

<details markdown="1">
<summary>Q2. Which test distinguishes good startup ordering from later outage recovery?</summary>

Start the healthy stack, stop the AI service afterwards, and exercise extraction plus ordinary CRUD. Startup checks alone do not cover that failure.

</details>

<details markdown="1">
<summary>Q3. Does a passing fake-provider test prove a real model produces accurate recipes?</summary>

No. It checks the tested consumer behavior. Real-model semantic quality needs representative evaluation cases, while the full user flow needs integration/browser checks.

</details>

</div>

<!-- {% endraw %} -->
