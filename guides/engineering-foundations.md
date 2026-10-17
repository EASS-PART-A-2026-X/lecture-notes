# Engineering foundations: follow one request through the system

<!-- {% raw %} -->

[Course home](../README.md) · [Student setup](student-setup.md) · [Learning map](learning-map.md)

**Use as a bridge, not a second textbook.** The course assumes basic Python. If a readiness question exposes a gap, use the relevant section, try a small example, and return to the lecture. The target is a system you can explain and debug.

Use the [visual system walkthrough](system-walkthrough.md) to connect service boundaries, validation, database commits, deadlines, and failure recovery to one user journey.

<details markdown="1" class="lecture-toc">
<summary>On this page</summary>

- [Files, environments, and processes](#files-environments-and-processes)
- [Python you need to read](#python-you-need-to-read)
- [HTTP, JSON, and contracts](#http-json-and-contracts)
- [State, transactions, and ownership](#state-transactions-and-ownership)
- [Monoliths, services, and microservices](#monoliths-services-and-microservices)
- [Failure, retries, and asynchronous work](#failure-retries-and-asynchronous-work)
- [Security boundaries](#security-boundaries)
- [Tests, evaluations, and observability](#tests-evaluations-and-observability)
- [A release has a data lifecycle](#a-release-has-a-data-lifecycle)

</details>

## Files, environments, and processes

The terminal's **working directory** determines relative paths. `pwd` shows it; `cd backend` changes it; `ls` lists files. A path such as `app/main.py` is relative to where you are. Commands in a lecture are run from the named service folder unless stated otherwise. Do not type a terminal's `$` prompt as part of a command.

A **process** is a running program. The backend and frontend need separate terminals during local development because each server keeps running. Use another terminal to send a request; `Ctrl+C` stops the foreground server. Saving a file does not necessarily update a running process: a development reloader may restart it, while a container often needs rebuilding.

An **environment** supplies an interpreter, dependencies, and configuration. Each course service has its own uv project and lockfile. `uv run` selects that project's environment. A global Python installation, the editor's selected interpreter, and a container's Python can differ. Check the command that actually runs, rather than assuming an editor's green underline proves the service works.

## Python you need to read

Before Lecture 2, be able to explain functions, parameters, return values, imports, lists/dicts, loops, exceptions, and basic classes. The [Python 3.14 tutorial](https://docs.python.org/3.14/tutorial/) is a reference for gaps.

| Syntax in the lectures | Meaning |
|---|---|
| `def health() -> dict[str, str]:` | A function with a return-type annotation |
| `from app.models import RecipeCreate` | Import a named object from a module |
| `value: int \| None = None` | An annotation permitting an integer or `None`, with a default |
| `raise ValueError(...)` | Stop this path by raising an exception |
| `with ...:` | Enter a context that manages setup/cleanup |
| `yield` in a dependency | Supply a resource, then clean it up when control returns |
| `async def` / `await` | A coroutine that can cooperate while awaiting supported operations |

Python type hints alone do not enforce input types at runtime. Pydantic/FastAPI actively perform validation. A `TypedDict` describes a dictionary for static checking; it does not validate an HTTP response at runtime. Choose the appropriate check at each boundary.

`async` does not make blocking work disappear. An ordinary blocking network call in an async path can occupy the event loop. Use the framework's supported async client or execution model. Do not add `async` keywords to code you cannot explain.

Before asking an assistant to repair an import, identify the current directory, module path, and interpreter. Before accepting a generated exception handler, name the failure it catches and the behavior it preserves.

## HTTP, JSON, and contracts

An HTTP request contains a method, target, headers, and sometimes a body. The response contains a status, headers, and sometimes a body. A JSON document is a serialized representation; a Python dict is an in-memory object. `null` in JSON maps to `None` in Python; an absent field is different from a field explicitly set to `null`.

The API contract includes meaning as well as shape: what a field represents, which values are legal, and what happens on failure. A schema cannot by itself explain whether a `minutes` field is preparation time or total time. Document the domain decision.

HTTP is stateless at the protocol level. Applications can still store records, authenticate users, and look up server-side state. A **safe** method does not ask for a business-state mutation; logging can still occur. **Idempotency** concerns the intended effect of repetition, not identical response bytes or status codes. See [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2).

An HTTP call is not a local function call. It can fail after the remote operation completed but before the reply reaches you. That uncertainty matters when repeating a save.

## State, transactions, and ownership

Distinguish three places data can live:

- **Process memory:** a dict disappears when its process restarts.
- **Persistent application storage:** committed database rows survive the documented restart procedure.
- **UI/session state:** information about this interaction, such as an unsent form or success message.

A database **transaction** groups related changes into a commit or rollback. `flush()` and `commit()` are different: sending changes to a database session is not the same as making them durable. Tests need isolated state so their order does not affect results.

In the course architecture, the backend owns the product database. The frontend and AI service call its contract rather than opening SQLite. This keeps validation, business rules, and state changes in one authoritative place. The AI service is stateless for extraction; it does not need its own database merely to qualify as a service.

## Monoliths, services, and microservices

A **modular monolith** keeps well-separated modules within one deployable application. A service boundary adds a process/network/deployment boundary. Microservices organize autonomous services around cohesive responsibilities and explicit contracts. More containers do not automatically produce useful autonomy.

| Choice | What it can simplify | What you must handle |
|---|---|---|
| One modular application | Local calls, transactions, deployment, and debugging | Module boundaries and coupled releases |
| Separate services | Independent changes, scaling, and responsibility boundaries | Network failures, compatibility, observability, and operations |

The course deliberately uses three application services to teach those boundaries. It is a small service-based system, not a requirement to split every function into a microservice. Its domain data has one owner. A larger design with multiple stateful services must define ownership and cross-service consistency; it cannot assume one database transaction covers a network of services. Microsoft's [microservices architecture guide](https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/microservices) details the tradeoffs.

Split a component when you can explain its cohesive responsibility and the benefit of independent operation. If every change needs simultaneous edits and deployment everywhere, investigate coupling before adding more services.

## Failure, retries, and asynchronous work

Three common outcomes are **success**, **definite failure**, and **unknown completion**. A timeout often means the caller stopped waiting; it does not prove the callee did nothing. Retrying may duplicate a mutation or repeat a model charge.

Use a deadline, a selective retry policy, a small attempt limit, and backoff. The status-to-retry policy in Lecture 9 is specific to Recipe Box's contract; another API's 429 may mean a different rate-limit policy. Read its documentation rather than copying the table blindly.

For a write that must tolerate repeats, an optional **idempotency key** needs server-side semantics: bind it to a request, atomically retain the outcome, and return that outcome for a matching retry. Adding a header alone does not implement deduplication.

A queue can decouple a long task from an HTTP request, but then the product needs job identity, status, durable state, cancellation/recovery rules, and duplicate handling. Queues, circuit breakers, and durable workflows are optional extensions after the synchronous flow works. An agent loop is another bounded computation inside this architecture, subject to the same failure questions.

## Security boundaries

**Authentication** identifies a caller. **Authorization** decides which operation that caller may perform on which resource. A validly shaped request can still be forbidden. User accounts are optional in this course, but a product handling real private records needs an access-control design before public exposure.

**CORS** controls particular browser cross-origin access; it does not authenticate clients or stop `curl`. **No published Docker port** reduces host exposure but does not identify the caller. Containers on the same network can communicate with a listening service. See [Docker's port-publishing documentation](https://docs.docker.com/engine/network/port-publishing/).

Keep provider keys in the AI service, validate outside model control, and expose only the tools the task needs. Prompts and repository instructions guide behavior; application code and execution controls enforce permissions. Local classroom HTTP is a development setup; publicly deployed sensitive traffic needs an appropriate HTTPS and identity/access configuration.

For a runnable counterexample, the [industry studio](industry-studio.md#lab-private-records-and-concurrent-edits) checks per-record ownership and uses an atomic version predicate to reject stale saves. Its identity is a trusted test fixture, not a login implementation.

## Tests, evaluations, and observability

Ask what each check can establish:

- **Unit/contract tests:** defined code behavior and interface rules on chosen inputs.
- **Integration/browser tests:** the tested path works across real components.
- **Model evaluations:** observed task quality under a recorded model/configuration and dataset.
- **Failure drills:** the system behaves as intended when a selected dependency or assumption fails.

A mock is a controlled substitute, not proof the external service behaves that way. Add the appropriate integration check for the real boundary. When fixing a bug, first observe a relevant failure, then change the implementation and see the check pass.

Logs describe events; metrics summarize quantities; traces connect work across a request's stages. Correlate requests with an identifier when investigating a multi-service problem. Record useful status, duration, and usage rather than secrets or raw user text. Observability supports diagnosis; it does not replace tests or access control.

## A release has a data lifecycle

A release includes code, dependency/configuration versions, a startup procedure, tests, operational checks, and a way to recover. A successful build is one part of that evidence.

- A migration changes an existing database schema. Creating missing tables is not a migration strategy for populated data.
- A volume is persistence, not a backup. A backup needs a tested restoration procedure appropriate to the database.
- Rolling back code can be incompatible with a newer schema. Plan the two together.
- A health/readiness check reports a defined condition. Compose startup ordering does not continuously repair every dependency failure.
- Image tags can move; lockfiles and image digests solve different parts of reproducibility. Update dependencies deliberately and rerun checks.

Use synthetic data for learning. Preserve real data before a migration or recovery exercise. Lecture 10's runbook and the clinics turn these ideas into a product demonstration you can repeat from a clean checkout.

<!-- {% endraw %} -->
