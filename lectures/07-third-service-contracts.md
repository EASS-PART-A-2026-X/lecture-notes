# Lecture 7 · The third service and its contract

<!-- {% raw %} -->
[← Course home](../README.md) · [← Previous: Lecture 6](06-pydantic-ai-agents.md) · [Next: Lecture 8 →](08-docker-compose.md)

**Date:** Monday 30 November 2026, 16:00 Israel time, on Zoom · **You leave with:** a working frontend → backend → AI service flow, with tests for its failures · **Due today:** EX2, see [Assignments](../README.md#assignments-and-deadlines)

<details markdown="1" class="lecture-toc">
<summary>On this page</summary>

- [Mission](#mission)
- [Before you start](#before-you-start)
- [Learning checkpoint](#learning-checkpoint)
- [Concepts](#concepts)
- [Live demo](#live-demo)
- [Hands-on lab](#hands-on-lab)
- [Break it on purpose](#break-it-on-purpose)
- [Open-source track](#open-source-track)
- [Working with AI assistants](#working-with-ai-assistants)
- [Completion check](#completion-check)
- [Quick quiz](#quick-quiz)
- [Stretch goals](#stretch-goals)
- [Common pitfalls](#common-pitfalls)
- [Instructor notes](#instructor-notes)
- [Read more](#read-more)

</details>

## Mission

Today your three services start talking. A user pastes messy recipe text into the browser. The frontend sends it to the backend, the backend asks the AI service, checks the answer against a contract and saves a clean recipe. Then you unplug the AI service on purpose. The user should see a calm "try again in a minute", not a stack trace or a spinner that never stops.

## Before you start

- A persistent, tested backend from [Lecture 3](03-persistence-and-first-pr.md).
- A frontend whose HTTP calls all live in `api.py`, from [Lecture 5](05-frontend-reliability-testing.md).
- An `ai-service/` with `POST /extract` and `TestModel` tests, from [Lecture 6](06-pydantic-ai-agents.md).
- Your EX2 work committed. Today builds on it; EX2 itself does not need the AI flow.

## Learning checkpoint

By the end, you should be able to:

- Explain why this service boundary is useful and which network/operational costs it introduces.
- Validate the request and response contract, including compatibility and documented failures.
- Follow the timeout budget across callers and demonstrate that an AI outage leaves ordinary CRUD usable.

**Predict first:** If the caller times out, do you know whether the remote operation completed? What evidence would you seek?

**Bridge if needed:** [Service architecture](../guides/engineering-foundations.md#monoliths-services-and-microservices). These questions are formative practice; the existing completion check and assignment requirements remain the target.

## Concepts

### Why a separate process

Lecture 6 put the agent in its own project; today the backend calls it over HTTP. The process boundary buys you:

- **Independent deploys:** change prompts or providers without redeploying the backend.
- **Independent scaling:** run more copies of the slow part only.
- **A separate failure domain:** bounded calls let the backend report an AI outage while ordinary CRUD remains usable. Resource exhaustion can still propagate, so separation alone is not a resilience guarantee.
- **Contained secrets:** only the AI service holds provider keys.

The backend is a reception desk. Visitors (the frontend) talk only to reception, which checks the request, calls the specialist in the back office (the AI service), checks the answer, and files the result.

This is a small service-based architecture for learning microservice boundaries. A separate service adds network, compatibility, testing, and operational work; a modular monolith can be appropriate outside this assignment. Read the [architecture tradeoffs](../guides/engineering-foundations.md#monoliths-services-and-microservices) and justify a boundary by responsibility and independent operation, rather than container count.

```text
browser -> frontend :8501 --HTTP--> backend :8000 --HTTP--> ai-service :8001
backend -> SQLite   (only the backend touches it)
```

### HTTP contracts

A contract is everything a caller relies on: method, path, request body, response body, status codes and error shape.

| Part | Recipe Box |
|---|---|
| Request | `POST /extract` with `{"text": "..."}`: 1–5000 characters, no other fields |
| Success | `200` with `title`, `minutes`, `servings`, `ingredients` (a list), `tags` (a list) |
| Bad request | `422` with FastAPI's `{"detail": [...]}` |

**Both sides hold a Pydantic model of it.** The AI service owns `RecipeExtraction` in `app/schemas.py`; the backend keeps its *own copy* in `app/ai_client.py`, because the projects deploy separately. The backend uses its copy to **validate the response**: never assume another service's JSON is right.

**Versioning mindset.** Adding an optional response field is safe, because the backend's copy of `RecipeExtraction` has no `extra="forbid"`, so it ignores fields it does not know. Renaming, removing or retyping a field is a *breaking* change. Either update every consumer first, or serve the new shape at a new path (`/v2/extract`) while the old one keeps working.

**Contract tests** catch drift: *consumer tests* fake the AI service with `httpx.MockTransport`, and a *schema check* compares the backend's model with the AI service's `/openapi.json`.

### Explicit timeouts

Lecture 4 gave the frontend timeouts. Every outbound call needs one, and httpx has four phases:

| Phase | What it limits | Recipe Box |
|---|---|---|
| `connect` | Opening the connection | 2 s: a local service that takes longer is down |
| `write` | Sending each chunk of the request | 5 s |
| `read` | Waiting for each chunk of the response | 30 s: models think slowly |
| `pool` | Waiting for a free connection in the client's pool | 2 s |

Two traps: httpx's default (5 s per phase) is too short for a model, and `timeout=None` waits forever. Also, `read` limits the gap *between* chunks, not the total; [Lecture 9](09-failures-evals-costs.md) adds a total deadline inside the AI service. Plan a **budget across hops**: the frontend waits longer than the backend does, so the backend reports the error first.

### Service errors without leaking internals

| What happened | Backend answers |
|---|---|
| Refused, DNS failure, timeout, or a 5xx from the AI service | `503 {"detail": "AI service unavailable"}` |
| A 4xx from the AI service, or a `200` whose body breaks the contract | `502 {"detail": "AI service returned invalid output"}` |
| The user's text is empty, too long or has extra fields | `422`; the AI service is never called |

`503 Service Unavailable` means "a dependency isn't available; try later". `502 Bad Gateway` means "the server behind me answered with garbage". A 4xx is a 502 too: the backend already validated the user's text, so a rejected request means the two services disagree about the contract. The contract folds timeouts into 503 instead of `504 Gateway Timeout`, because the user's next step is the same.

Keep `detail` fixed. Never send `str(exc)` to the client: it can reveal internal hostnames and URLs. Details belong in *your* log instead. `raise ... from exc` keeps the original error attached, but FastAPI doesn't log a handled `HTTPException`; add `logger.warning("AI call failed: %r", exc)` before the `raise` if you want the cause in the log. **No retries today;** Lecture 9 adds them and refines two rows once the AI service maps its own failures: its 502 (output still invalid after the agent's retries) becomes a backend 502 instead of 503, and its 429 (budget spent) becomes a backend 503 instead of 502.

## Live demo

The AI service from Lecture 6 stays as it is. All changes are in the backend and the frontend.

**1. The request model.** Append to `backend/app/models.py`:

```python
# backend/app/models.py (append)
class FromTextRequest(SQLModel):
    """POST /recipes/from-text body: free text for the AI service to read."""

    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=1, max_length=5000)
```

**2. The client.** One class, two exceptions, a timeout per phase, and a transport that tests can replace:

```python
# backend/app/ai_client.py
"""Backend -> ai-service client: explicit timeouts and typed errors (no retries yet)."""

import os
from collections.abc import Iterator
from typing import Annotated

import httpx
from fastapi import Depends
from pydantic import BaseModel, Field, ValidationError

from app.models import RecipeCreate

AI_SERVICE_URL = os.getenv("AI_SERVICE_URL", "http://localhost:8001")

# Every outbound call gets a timeout per phase. Connect fast; let the model think.
TIMEOUT = httpx.Timeout(connect=2.0, read=30.0, write=5.0, pool=2.0)


class RecipeExtraction(BaseModel):
    """The ai-service contract: what POST /extract must return."""

    title: str = Field(min_length=1, max_length=200)
    minutes: int = Field(ge=1, le=24 * 60)
    servings: int = Field(default=2, ge=1, le=50)
    ingredients: list[str] = Field(min_length=1)
    tags: list[str] = Field(default_factory=list)


class AIServiceUnavailable(Exception):
    """ai-service unreachable, timing out, or failing with a 5xx."""


class AIServiceBadOutput(Exception):
    """ai-service answered, but not with something we can use."""


class AIClient:
    def __init__(
        self,
        base_url: str = AI_SERVICE_URL,
        transport: httpx.BaseTransport | None = None,  # tests pass MockTransport
    ) -> None:
        self._http = httpx.Client(
            base_url=base_url, timeout=TIMEOUT, transport=transport
        )

    def close(self) -> None:
        self._http.close()

    def extract_recipe(self, text: str) -> RecipeCreate:
        try:
            response = self._http.post("/extract", json={"text": text})
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:  # it answered, with an error status
            code = exc.response.status_code
            if code < 500:  # 4xx: it rejected our request, so the contract broke
                raise AIServiceBadOutput(f"ai-service returned {code}") from exc
            raise AIServiceUnavailable(f"ai-service returned {code}") from exc
        except httpx.HTTPError as exc:  # timeouts, refused connections, DNS
            raise AIServiceUnavailable(f"ai-service unreachable: {exc!r}") from exc
        try:
            extraction = RecipeExtraction.model_validate_json(response.content)
            # Translate their contract into our model (and validate it again).
            return RecipeCreate(
                title=extraction.title,
                minutes=extraction.minutes,
                servings=extraction.servings,
                ingredients="\n".join(extraction.ingredients),
                tags=",".join(extraction.tags),
            )
        except ValidationError as exc:
            raise AIServiceBadOutput("ai-service response broke the contract") from exc


def get_ai_client() -> Iterator[AIClient]:
    client = AIClient()
    try:
        yield client
    finally:
        client.close()


AIClientDep = Annotated[AIClient, Depends(get_ai_client)]
```

Point out the **adapter** at the end: the AI service speaks lists, the backend stores newline- and comma-separated strings, and the result is validated again as a `RecipeCreate`. `get_ai_client` is a dependency, like `get_session` in Lecture 3, so tests can swap it.

**3. The route.** Add it to `backend/app/main.py`, importing `FromTextRequest` and the three names from `app.ai_client`:

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

**4. Tests without a network.** `httpx.MockTransport` passes each request to your function, so the "AI service" is a lambda. The fixture records every call:

```python
# backend/tests/test_from_text.py
"""POST /recipes/from-text with the ai-service faked by httpx.MockTransport."""

import httpx
import pytest

from app.ai_client import TIMEOUT, AIClient, get_ai_client
from app.main import app


# ...


@pytest.fixture
def fake_ai(client):
    """fake_ai(handler) routes the backend's ai-service calls to handler(request)."""
    calls: list[httpx.Request] = []

    def install(handler):
        def recording(request: httpx.Request) -> httpx.Response:
            calls.append(request)
            return handler(request)

        ai = AIClient("http://ai-service", transport=httpx.MockTransport(recording))
        app.dependency_overrides[get_ai_client] = lambda: ai
        return calls

    return install


def post_text(client, text="Hummus: chickpeas, tahini. 15 min."):
    return client.post("/recipes/from-text", json={"text": text})


# ...


def test_ai_down_is_503(client, fake_ai):
    def refuse(request):
        raise httpx.ConnectError("connection refused", request=request)

    calls = fake_ai(refuse)
    r = post_text(client)
    assert r.status_code == 503
    assert r.json() == {"detail": "AI service unavailable"}
    assert len(calls) == 1  # no retries yet (Lecture 9)
    assert client.get("/recipes").json() == []  # nothing half-saved


# ...


def test_broken_contract_is_502(client, fake_ai):
    fake_ai(lambda request: httpx.Response(200, json={"name": "Hummus"}))
    r = post_text(client)
    assert r.status_code == 502
    assert r.json() == {"detail": "AI service returned invalid output"}


@pytest.mark.parametrize(
    ("ai_status", "expected"),
    [
        pytest.param(500, 503, id="crash-500"),  # its failure: unavailable
        pytest.param(422, 502, id="our-bug-422"),  # a 4xx: we broke the contract
    ],
)
def test_ai_error_status(client, fake_ai, ai_status, expected):
    fake_ai(lambda request: httpx.Response(ai_status))
    assert post_text(client).status_code == expected


def test_timeouts_are_explicit():
    phases = (TIMEOUT.connect, TIMEOUT.read, TIMEOUT.write, TIMEOUT.pool)
    assert phases == (2.0, 30.0, 5.0, 2.0)
    ai = AIClient()
    assert ai._http.timeout == TIMEOUT
    ai.close()
```

The full file also tests success (stored, exact request bytes), a read timeout, and invalid input with zero calls.

**5. The frontend flow.** In `frontend/api.py`:

```python
# frontend/api.py
# from-text waits for the AI: allow more than the backend's own 30 s read
# timeout, so the backend (not the browser) reports a slow AI service.
AI_TIMEOUT = httpx.Timeout(100.0, connect=2.0)
# ...
        case 503:
            return "AI service is unavailable, try again in a minute."
        case 502:
            return "AI returned something unusable. Try rewording the recipe text."
# ...
def create_from_text(text: str) -> Recipe:
    return _request(
        "POST", "/recipes/from-text", json={"text": text}, timeout=AI_TIMEOUT
    ).json()
```

In `frontend/streamlit_app.py`, add a third tab, `"Paste a recipe"`, to the `st.tabs(...)` line, and append:

```python
# frontend/streamlit_app.py
with paste, st.form("paste"):
    text = st.text_area("Recipe text", height=200, max_chars=5000, key="paste-text")
    if st.form_submit_button("Extract with AI", key="paste-submit", width="stretch"):
        try:
            with st.spinner("Asking the AI service..."):
                created = api.create_from_text(text)
        except api.BackendError as exc:
            st.error(str(exc))
        else:
            notify(f"Added {created['title']} from your text.")
```

Lecture 5's `AppTest` pattern covers the new tab. The demo's `frontend/tests/test_app.py` adds `test_paste_success`, which checks the exact JSON sent, and `test_paste_shows_ai_errors`, parametrized over 503 and 502.

**6. Run all three**, one terminal each, starting from the repo root:

```bash
cd ai-service
uv run fastapi dev --port 8001
```

```bash
cd backend
uv run fastapi dev
```

```bash
cd frontend
uv run streamlit run streamlit_app.py
```

Paste a recipe. With `AI_MODEL` unset, `TestModel` returns placeholder data, such as a recipe titled `a`. Stop the AI service with Ctrl+C and paste again: the UI says "AI service is unavailable, try again in a minute.", and the Recipes tab still works.

## Hands-on lab

Apply this to **your** domain: your names, the same shape.

1. **Write the contract** in your README as a three-row table. *Checkpoint:* a classmate could call your AI service from it alone.
2. **Add the request model**, with length limits and `extra="forbid"`.
3. **Create `backend/app/ai_client.py`** with your response model, a four-phase `httpx.Timeout`, two exceptions and an injectable `transport`. *Checkpoint:* `uv run python -c "from app.ai_client import TIMEOUT; print(TIMEOUT)"` prints all four phases.
4. **Add the route**, mapping the exceptions to 503 and 502 with fixed `detail` text.
5. **Write MockTransport tests:** success (the row is stored), refused → 503, read timeout → 503, a 4xx or a broken body → 502, invalid input → 422 with zero calls. *Checkpoint:* `uv run pytest` passes with Wi-Fi off.
6. **Add the schema check.** With the AI service running, save its published contract next to the tests:

   ```bash
   cd backend
   curl -s localhost:8001/openapi.json > tests/ai_openapi.json
   ```

   ```python
   # backend/tests/test_contract.py
   """The backend's copy of the contract must match what the ai-service publishes."""

   import json
   from pathlib import Path

   from app.ai_client import RecipeExtraction

   # Refresh after every ai-service change (ai-service running on port 8001):
   #   curl -s localhost:8001/openapi.json > tests/ai_openapi.json
   PUBLISHED = json.loads((Path(__file__).parent / "ai_openapi.json").read_text())


   def fields(schema: dict) -> dict:
       """Field names, types and limits. Titles and descriptions do not matter."""
       return {
           name: {k: v for k, v in rules.items() if k not in ("title", "description")}
           for name, rules in schema["properties"].items()
       }


   def test_backend_expects_what_the_ai_service_returns():
       ours = fields(RecipeExtraction.model_json_schema())
       theirs = fields(PUBLISHED["components"]["schemas"]["RecipeExtraction"])
       # Each field we read must exist on their side with the same type and limits.
       # Extra fields on their side are fine: our model ignores unknown fields.
       assert {name: theirs.get(name) for name in ours} == ours
   ```

   It checks *compatibility*: a new optional field passes; a renamed, removed or retyped one fails.
7. **Wire the frontend:** the `api.py` function with a longer timeout, a form with a spinner, plain-word 503/502 messages.
8. **Run all three**, finish the flow, then stop the AI service and retry.
9. **README:** data-flow diagram, start commands, error table.

## Break it on purpose

The loop: make it fail, read the exact error, explain it, fix it, keep a test that catches it.

**Drill 1: the silent service.** Save this and run it with `python3 silent_service.py`:

```python
# silent_service.py (a scratch file, outside your repo)
import socket
import time

server = socket.create_server(("127.0.0.1", 8009))
conn, _ = server.accept()  # keep the connection open (and never answer)
time.sleep(600)
```

Restart the backend with `AI_SERVICE_URL=http://localhost:8009 uv run fastapi dev` and paste a recipe. Predict first: a 503 arrives about 30 seconds later, when the read timeout fires. Now set `TIMEOUT = httpx.Timeout(None)` and paste again: it hangs until you kill the silent service. `test_timeouts_are_explicit` fails with `assert (None, None, None, None) == (2.0, 30.0, 5.0, 2.0)`. Restore the timeout.

**Drill 2: the quiet rename.** In `ai-service/app/schemas.py`, rename `minutes` to `total_minutes`; `fastapi dev` reloads. Pasting now returns `502 AI service returned invalid output`. Your MockTransport tests **still pass**, because they fake the old shape. Refresh `tests/ai_openapi.json` and run `uv run pytest`. The contract test fails, and the diff shows `{'minutes': None} != {'minutes': {'maximum': 1440, 'minimum': 1, 'type': 'integer'}}`. Rename the field back and refresh `tests/ai_openapi.json` again.

**Drill 3: no error mapping.** Replace the route's `try`/`except` with a direct `ai.extract_recipe(body.text)`, stop the AI service and paste. The UI says "The backend failed (500). Check its logs.", curl gets `Internal Server Error`, and the backend log ends in `AIServiceUnavailable: ai-service unreachable: ConnectError('[Errno 61] Connection refused')` (errno 111 on Linux). `test_ai_down_is_503` and its neighbors fail. Put the mapping back.

## Open-source track

This week is **review follow-up** on PRs #1 and #2. List them with `gh search prs --author=@me --state=open`, as in [Lecture 5](05-frontend-reliability-testing.md). Then, for each one:

```bash
gh pr checks https://github.com/OWNER/REPO/pull/NUMBER
gh pr view https://github.com/OWNER/REPO/pull/NUMBER --comments
```

1. Fix failing checks first; maintainers often skip a PR whose CI is red.
2. Answer every review comment yourself: push the change, or politely explain your alternative.
3. Silent for a week or more (or what CONTRIBUTING says), and you haven't pinged yet? One short ping, or the channel CONTRIBUTING names.
4. Pick the issue for PR #3, which you open next week, and reproduce it now.
5. Update your [evidence table](../README.md#evidence-table). Only [merged PRs count](../README.md#what-counts-as-merged).

## Working with AI assistants

**Pattern 1: client from a contract.** "Here are my two Pydantic models. Write a sync `httpx.Client` wrapper for `POST /extract` with a four-phase `httpx.Timeout`, an injectable `transport`, and exceptions for 'unavailable' and 'invalid output'. No retries." *Verify:* run your MockTransport tests, then search for `timeout=None`, bare `except Exception`, and `str(exc)` in a response.

**Pattern 2: failure modes first.** "List every way this call can fail, from DNS to a malformed body. For each, give the status my backend should return and one MockTransport test." *Verify:* compare the list with the [error table](#service-errors-without-leaking-internals), then break the code once per test to prove each test can fail.

**Spot the outdated suggestion:**

- `requests.post(url, json=...)` with no timeout. requests waits forever by default.
- `httpx.AsyncClient(app=app)`. The `app=` argument was removed in httpx 0.28; use `transport=httpx.ASGITransport(app=app)`.
- "Just import the agent in the backend." It runs, but it is not a third service.

Note the tools and checks in your [AI-use note](../README.md#working-method-ai-use-assessment-and-reproducibility).

## Completion check

From `backend/`, run `uv run pytest`. Recipe Box shows `21 passed` (10 CRUD, 2 restart, 8 from-text, 1 contract); your count differs, but nothing fails or is skipped. With all three services running:

```bash
curl -s localhost:8000/recipes/from-text \
  -H "Content-Type: application/json" \
  -d '{"text": "Hummus: chickpeas, tahini. 15 min."}'
```

Expected: a JSON recipe with an `id`. Stop the AI service and repeat. Expected: `{"detail":"AI service unavailable"}` at once, not after 30 seconds.

- [ ] Paste, spinner, then the new recipe in the list.
- [ ] AI service stopped: a friendly message; the Recipes tab still works.
- [ ] Tests cover success, 503 (refused, timeout, 5xx), 502 (4xx, broken body) and 422, with no network.
- [ ] `test_contract.py` passes against a fresh `ai_openapi.json`.
- [ ] Your README has the contract table, the data flow and the run commands.
- [ ] EX2 is submitted through the submission channel provided by the instructor.

## Quick quiz

<details markdown="1">
<summary>Q1. Which counts as your third service: an imported agent class, Redis, a separate FastAPI app called over HTTP, or SQLite?</summary>

The FastAPI app. An imported agent class runs inside the backend's process, so it deploys, scales and fails with the backend. Redis and SQLite are infrastructure: they store data but do no application work.

</details>

<details markdown="1">
<summary>Q2. The AI service answers 200 with {"name": "Hummus"}. What does the backend return?</summary>

**502** `{"detail": "AI service returned invalid output"}`. The service was reachable, so 503 would be wrong. Its body broke the contract: `model_validate_json` raised `ValidationError`, the client raised `AIServiceBadOutput`, and nothing was saved.

</details>

<details markdown="1">
<summary>Q3. Your read timeout is 30 s. The AI service sends one byte every 10 seconds for five minutes. When does the request fail?</summary>

It doesn't. The read timeout limits the wait for *each chunk*, and a byte arrives every 10 seconds. Capping the total time needs a separate deadline around the whole call. Lecture 9 adds one inside the AI service (25 s around the agent run); a deadline around the backend's own call is a stretch goal.

</details>

<details markdown="1">
<summary>Q4. (Lecture 2) A user submits {"text": ""}. What status comes back, and does the AI service see it?</summary>

**422**, and no. `FromTextRequest` has `min_length=1`, and FastAPI validates the body before your function runs. Rejecting at the edge is cheaper than a model call; `test_invalid_text_never_reaches_ai` asserts `calls == []`.

</details>

<details markdown="1">
<summary>Q5. (Lecture 3) Why do backend tests override get_ai_client instead of starting the real AI service?</summary>

For the same reason they override `get_session`: tests must be fast, deterministic and free of other processes. Each service tests its own side. The AI service uses `TestModel` and `FunctionModel`, the backend uses `MockTransport`, and the schema check ties the two together.

</details>

## Stretch goals

Optional, after the completion check passes.

- **Trace IDs:** generate an `X-Request-ID` in the backend, forward it, and log it in both services.
- **Async client:** `httpx.AsyncClient` and an `async def` route, with the same tests passing.
- **Version the contract:** serve `/v2/extract` with one renamed field, keep `/extract`, then migrate the backend.

## Common pitfalls

- **Every paste returns 503** → the AI service is down or `AI_SERVICE_URL` has the wrong port → start it with `--port 8001`; check with `curl localhost:8001/health`.
- **A from-text test passes only while your AI service runs** → no override was installed, so the test called the real service → use `fake_ai`, and make sure `client` clears `app.dependency_overrides`.
- **`422` "Input should be a valid dictionary"** → you sent a bare string → send `{"text": "..."}`.
- **Every paste returns 502 after an AI-service change** → the contract drifted → refresh `ai_openapi.json`, run the contract test, update one side on purpose.
- **"The backend failed (500)"** → an exception escaped the route → map it to 503 or 502.
- **The browser gives up first** → the frontend's timeout is shorter than the backend's → make `AI_TIMEOUT` longer.

## Instructor notes

Suggested flow:

1. Ask Q1 cold and let students argue. Then the reception-desk analogy and the diagram.
2. The contract table, then both `RecipeExtraction` models side by side: why does the backend keep a copy?
3. Live-code `ai_client.py`. Pause at `TIMEOUT` and let students guess what each phase limits.
4. Write `test_ai_down_is_503` *before* the `except` blocks. Watch it fail, then pass.
5. Add the paste tab, run all three services, and kill the AI service while the class watches.
6. Drill 1 live: the 30-second wait, then the endless hang.
7. OSS follow-up round, and a reminder of the EX2 deadline.

Emphasize that the backend validates the AI service's *response*. Students get stuck on overrides leaking between tests (a missing `.clear()`) and are tempted to put `str(exc)` in `detail`.

## Read more

- [HTTPX: timeouts](https://www.python-httpx.org/advanced/timeouts/) and [transports, including MockTransport](https://www.python-httpx.org/advanced/transports/)
- [FastAPI: handling errors](https://fastapi.tiangolo.com/tutorial/handling-errors/)
- [FastAPI: testing dependencies with overrides](https://fastapi.tiangolo.com/advanced/testing-dependencies/)
- [MDN: 502 Bad Gateway](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/502) and [503 Service Unavailable](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/503)

---

[← Course home](../README.md) · [← Previous: Lecture 6](06-pydantic-ai-agents.md) · [Next: Lecture 8 →](08-docker-compose.md)

<!-- {% endraw %} -->
