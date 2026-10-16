# Lecture 2 · HTTP, FastAPI and Pydantic

<!-- {% raw %} -->
[← Course home](../README.md) · [← Previous: Lecture 1](01-environment-git-docker-ai.md) · [Next: Lecture 3 →](03-persistence-and-first-pr.md)

**Date:** Monday 26 October 2026, 16:00 Israel time, on Zoom (clocks changed on 25 October; see the [calendar notes](../README.md#calendar-and-13-meeting-schedule)) · **You leave with:** a tested CRUD API for your own domain

## Mission

Turn last week's `/health` skeleton into a real API: create, list, read, update and delete your records. Bad input bounces off with a precise `422`, and ten tests prove it in under a second. Storage is a Python dict for now; next week it becomes a database, and the tests stay exactly the same.

## Before you start

- From [Lecture 1](01-environment-git-docker-ai.md): the `backend/` uv project with `/health`, running with `uv run fastapi dev`, pushed to GitHub.
- Your product sketch's **data sketch**: it becomes today's Pydantic model.
- Your open-source shortlist.

## Concepts

### HTTP: one request, one response

The **client** (curl, a browser, later your frontend) asks, and the **server** (your FastAPI app) answers, like a kitchen that cooks only when an order arrives. HTTP is **stateless**: every request carries everything the server needs.

```http
POST /recipes HTTP/1.1
Host: localhost:8000
Content-Type: application/json

{"title": "Shakshuka", "minutes": 25}
```

```http
HTTP/1.1 201 Created
content-type: application/json

{"title":"Shakshuka","minutes":25,"servings":2,"ingredients":"","tags":"","id":1}
```

A request has a method, a path (plus an optional query, `?limit=10`), headers and an optional body; a response has a status code, headers and an optional body.

### REST: nouns in paths, verbs in methods

Paths name **things** (`/recipes/42`); methods say what to do with them. `POST /createRecipe` is a warning sign (a "code smell"): hide the methods, and the paths should still look like things, not actions. This is the backend contract for the whole course:

| Request | What it does | Success | Idempotent? |
|---|---|---|---|
| `GET /recipes?offset=0&limit=50` | List a page (limit at most 100) | 200 | Yes, and safe |
| `POST /recipes` | Create one | 201 | No |
| `GET /recipes/{recipe_id}` | Read one | 200, or 404 | Yes, and safe |
| `PATCH /recipes/{recipe_id}` | Change only the fields sent | 200, or 404 | Yes, in this API |
| `DELETE /recipes/{recipe_id}` | Delete one | 204, or 404 | Yes |

**Idempotent** means doing it twice leaves the same end state as doing it once, like `f(x) = |x|`. `POST` behaves like `f(x) = x + 1`: two POSTs create two recipes. **Safe** means nothing changes at all, as with `GET`. `DELETE` is idempotent but not safe.

### Status codes you must own

- **200 OK**, **201 Created** (the new resource in the body), **204 No Content** (empty body).
- **404 Not Found.** `{"detail": "Not Found"}` means no route matched, so check the path. `{"detail": "Recipe not found"}` means your handler ran and the id is missing.
- **405 Method Not Allowed**: the path exists, but not with that method.
- **422 Unprocessable Content**: the request broke the contract, for example a missing field, a value out of range, or (in FastAPI) invalid JSON, which many other APIs answer with 400 Bad Request.
- **500 Internal Server Error**: a bug on your side. Never let a stack trace reach the client.

Two decisions in the Recipe Box contract: every error body uses FastAPI's default `{"detail": ...}` shape, and deleting a missing recipe always returns 404. Some argue for 204 (same end state); either is defensible if documented and tested.

### Pydantic: the contract as code

A Pydantic model declares the shape of your data, and FastAPI validates each request against it before your code runs. Each direction of traffic needs its own shape:

- **`RecipeBase`**: the shared fields and their limits.
- **`RecipeCreate`**: the POST body, with no `id` (the server assigns it).
- **`RecipeUpdate`**: the PATCH body, where every field is optional.
- **`RecipePublic`**: what clients receive, always with an `id`.

`extra="forbid"` turns an unknown field (a typo like `"minuts"`) into a 422 instead of silently dropping it. `str_strip_whitespace=True` trims strings first, so a title of spaces counts as empty. A 422 says exactly what broke: read `loc` (where) and `msg` (what).

```json
{"detail": [{"type": "string_too_short", "loc": ["body", "title"],
  "msg": "String should have at least 1 character", "input": "",
  "ctx": {"min_length": 1}}]}
```

### FastAPI: type hints do the work

A parameter typed as a Pydantic model is read from the JSON body and validated. `recipe_id: int` comes from the path, so `/recipes/abc` is a 422. The **return type** filters what is sent back and documents it at `/docs`. **Dependencies** (`Depends`) hand shared things such as the store to your routes, and tests can swap them.

## Live demo

The instructor grows Recipe Box; all commands run in `backend/`.

**1. Add the dev tools** (`httpx2` keeps `TestClient` warning-free).

```bash
uv add --dev pytest ruff httpx2
```

Append to `backend/pyproject.toml`:

```toml
[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
addopts = "-q"
filterwarnings = ["error"]

[tool.ruff.lint]
extend-select = ["I", "FAST"]
```

`pythonpath` lets tests import `app`; `filterwarnings = ["error"]` turns deprecation warnings into failures.

**2. The contract.**

```python
# backend/app/models.py
from pydantic import BaseModel, ConfigDict, Field


class RecipeBase(BaseModel):
    """Fields shared by every recipe schema."""

    title: str = Field(min_length=1, max_length=200)
    minutes: int = Field(ge=1, le=24 * 60)
    servings: int = Field(default=2, ge=1, le=50)
    ingredients: str = Field(default="", max_length=5000)  # one per line
    tags: str = Field(default="", max_length=500)  # comma-separated


class RecipeCreate(RecipeBase):
    """POST body. Unknown fields -> 422 instead of being silently ignored."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class RecipeUpdate(BaseModel):
    """PATCH body: every field optional; send only what changes."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str | None = Field(default=None, min_length=1, max_length=200)
    minutes: int | None = Field(default=None, ge=1, le=24 * 60)
    servings: int | None = Field(default=None, ge=1, le=50)
    ingredients: str | None = Field(default=None, max_length=5000)
    tags: str | None = Field(default=None, max_length=500)


class RecipePublic(RecipeBase):
    """Response body: what clients see (always has an id)."""

    id: int
```

**3. The routes.** The store is a dict behind a dependency, and the routes never touch it any other way.

```python
# backend/app/main.py
from dataclasses import dataclass, field
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query, status

from app.models import RecipeCreate, RecipePublic, RecipeUpdate


@dataclass
class RecipeStore:
    """A dict standing in for a database. Restart the server: data is gone."""

    rows: dict[int, RecipePublic] = field(default_factory=dict)
    last_id: int = 0


store = RecipeStore()


def get_store() -> RecipeStore:
    return store  # tests swap in a fresh store via app.dependency_overrides


StoreDep = Annotated[RecipeStore, Depends(get_store)]

app = FastAPI(title="Recipe Box API")


def get_or_404(store: RecipeStore, recipe_id: int) -> RecipePublic:
    if recipe_id not in store.rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Recipe not found")
    return store.rows[recipe_id]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/recipes")
def list_recipes(
    store: StoreDep,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[RecipePublic]:
    return list(store.rows.values())[offset : offset + limit]


@app.post("/recipes", status_code=status.HTTP_201_CREATED)
def create_recipe(body: RecipeCreate, store: StoreDep) -> RecipePublic:
    store.last_id += 1
    recipe = RecipePublic(id=store.last_id, **body.model_dump())
    store.rows[recipe.id] = recipe
    return recipe


@app.get("/recipes/{recipe_id}")
def get_recipe(recipe_id: int, store: StoreDep) -> RecipePublic:
    return get_or_404(store, recipe_id)


@app.patch("/recipes/{recipe_id}")
def update_recipe(recipe_id: int, body: RecipeUpdate, store: StoreDep) -> RecipePublic:
    recipe = get_or_404(store, recipe_id)
    # Only fields the client sent; null means "leave unchanged".
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    store.rows[recipe_id] = recipe.model_copy(update=changes)  # already validated
    return store.rows[recipe_id]


@app.delete("/recipes/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recipe(recipe_id: int, store: StoreDep) -> None:
    get_or_404(store, recipe_id)
    del store.rows[recipe_id]
```

In PATCH, `exclude_unset=True` keeps only the fields the client sent. `model_copy(update=...)` does **not** validate; that is safe only because `RecipeUpdate` already did.

**4. Happy and error requests.** Start `uv run fastapi dev`. In a second terminal, predict each status code, then send it (`--json` needs curl 7.82 or newer):

```bash
curl -i --json '{"title": "Shakshuka", "minutes": 25}' localhost:8000/recipes
curl localhost:8000/recipes/1
curl localhost:8000/recipes/999
curl --json '{"title": "", "minutes": 0}' localhost:8000/recipes
curl --json '{"title": "Soup", "minutes": 40, "chef": "me"}' localhost:8000/recipes
curl -X PATCH --json '{"minutes": 30}' localhost:8000/recipes/1
curl -i -X DELETE localhost:8000/recipes/1
curl "localhost:8000/recipes?limit=101"
```

The results: 201; 200; 404 `{"detail":"Recipe not found"}`; 422 with `string_too_short` and `greater_than_equal`; 422 `extra_forbidden`; 200 with `"minutes":30`; 204 with an empty body; 422 `less_than_equal` at `["query","limit"]`. Repeat a few in <http://localhost:8000/docs> with "Try it out".

Now create one more recipe, check that `GET /recipes` lists it, and save any file: the dev server reloads, and `GET /recipes` returns `[]`. The dict lived in memory: next week's problem.

**5. The tests.** `TestClient` calls the app in-process, with no server. The fixture gives every test a fresh store:

```python
# backend/tests/conftest.py
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import RecipeStore, app, get_store


@pytest.fixture
def client() -> Iterator[TestClient]:
    store = RecipeStore()  # a fresh, empty store for every test
    app.dependency_overrides[get_store] = lambda: store
    yield TestClient(app)
    app.dependency_overrides.clear()
```

Three of the ten tests in `backend/tests/test_recipes.py`:

```python
# backend/tests/test_recipes.py (excerpt)
from fastapi import status

SOUP = {"title": "Soup", "minutes": 40}


def test_create_returns_201_with_defaults(client):
    r = client.post("/recipes", json=SOUP)
    assert r.status_code == status.HTTP_201_CREATED
    body = r.json()
    assert body["id"] >= 1
    assert (body["title"], body["minutes"]) == ("Soup", 40)
    assert body["servings"] == 2  # defaults
    assert body["ingredients"] == body["tags"] == ""


def test_unknown_field_is_rejected(client):
    r = client.post("/recipes", json={**SOUP, "chef": "me"})
    assert r.status_code == 422
    assert r.json()["detail"][0]["type"] == "extra_forbidden"


def test_missing_recipe_is_404(client):
    for method in ("GET", "PATCH", "DELETE"):
        r = client.request(method, "/recipes/999", json={})
        assert r.status_code == 404, method
        assert r.json() == {"detail": "Recipe not found"}
```

The other seven cover health, read-after-create, pagination (`limit=101` is a 422), five invalid bodies, PATCH (partial, `null`, invalid), delete-then-404, and isolation. Paste them below the excerpt to get the full file:

<details markdown="1">
<summary>Show the other seven tests</summary>

```python
# backend/tests/test_recipes.py (continued)
def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_get_returns_what_was_created(client):
    created = client.post("/recipes", json=SOUP).json()
    assert client.get(f"/recipes/{created['id']}").json() == created


def test_list_is_paginated(client):
    for n in range(3):
        client.post("/recipes", json={"title": f"R{n}", "minutes": 5})
    assert [r["title"] for r in client.get("/recipes").json()] == ["R0", "R1", "R2"]
    page = client.get("/recipes", params={"offset": 1, "limit": 1}).json()
    assert [r["title"] for r in page] == ["R1"]
    assert client.get("/recipes", params={"limit": 101}).status_code == 422


def test_invalid_bodies_are_422(client):
    bad_bodies = [
        {"title": "", "minutes": 20},  # too short
        {"title": "   ", "minutes": 20},  # whitespace is stripped first
        {"title": "x", "minutes": 0},  # minutes >= 1
        {"title": "x", "minutes": 5, "servings": 51},  # servings <= 50
        {"minutes": 5},  # title missing
    ]
    for body in bad_bodies:
        r = client.post("/recipes", json=body)
        assert r.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT, body


def test_patch_changes_only_sent_fields(client):
    rid = client.post("/recipes", json=SOUP).json()["id"]
    r = client.patch(f"/recipes/{rid}", json={"minutes": 35})
    assert r.status_code == 200
    assert (r.json()["title"], r.json()["minutes"]) == ("Soup", 35)
    # null means "leave unchanged" (would otherwise hit a NOT NULL column -> 500)
    assert client.patch(f"/recipes/{rid}", json={"title": None}).status_code == 200
    assert client.patch(f"/recipes/{rid}", json={"minutes": 0}).status_code == 422


def test_delete_then_404(client):
    rid = client.post("/recipes", json=SOUP).json()["id"]
    r = client.delete(f"/recipes/{rid}")
    assert r.status_code == status.HTTP_204_NO_CONTENT
    assert r.content == b""
    assert client.get(f"/recipes/{rid}").status_code == 404
    assert client.delete(f"/recipes/{rid}").status_code == 404


def test_each_test_starts_empty(client):
    assert client.get("/recipes").json() == []
```

</details>

```bash
uv run pytest
uv run ruff check .
uv run ruff format --check .
```

Expected: `10 passed`, `All checks passed!`, and all files already formatted. This test file stays unchanged through Lecture 10: storage changes, the contract does not.

## Hands-on lab

Build the same API for **your** record type.

1. **Models.** Translate your data sketch into `app/models.py` with the four-model split. Give every field a type and a limit, and decide which fields have defaults. **Checkpoint:** `/docs` shows your Create, Update and Public schemas.
2. **Routes.** Add the five contract routes, renamed for your resource (for example `/tasks/{task_id}`), using the store dependency and `get_or_404`. **Checkpoint:** POST returns 201 with an `id`; a missing id returns 404 with your `detail`.
3. **Predict, then send.** In your README, write six requests (two happy, four broken) with predicted status codes. Send them, then correct your predictions. **Checkpoint:** you can explain each 422 from its `loc` and `msg`.
4. **Tests.** Copy the fixture, then cover each table row, two or more invalid bodies, 404 on GET, PATCH and DELETE, and isolation. **Checkpoint:** at least 8 tests pass, and ruff is clean.
5. **Ship it** on a branch with a PR on your own repo, as in Lecture 1. **Checkpoint:** `gh pr list --state merged` shows it.

## Break it on purpose

Break it, run `uv run pytest`, read the failure, then restore the code.

1. **Forget the forbid.** Remove `extra="forbid"` from both models. `test_unknown_field_is_rejected` fails with `assert 201 == 422`: the typo field was silently dropped. Use the same move to check an AI-written test: break the code it protects, and the test must go red.
2. **A bug the tests miss.** Change the PATCH line to `body.model_dump(exclude_unset=True)`. All ten tests **still pass**, yet `PATCH {"title": null}` now returns `"title": null`. `model_copy` skipped validation, and FastAPI trusts a model object you return. Add this regression test, watch it fail with `AssertionError: assert None == 'Soup'`, then restore `exclude_none=True`:

   ```python
   # backend/tests/test_patch_null.py
   def test_patch_null_keeps_the_old_value(client):
       rid = client.post("/recipes", json={"title": "Soup", "minutes": 40}).json()["id"]
       client.patch(f"/recipes/{rid}", json={"title": None})
       assert client.get(f"/recipes/{rid}").json()["title"] == "Soup"
   ```

   The lesson: assert the body, not just the status code. Keep the file until Lecture 3, where the database turns this bug into a 500 that `test_patch_changes_only_sent_fields` catches.
3. **Shared state.** Make the fixture return a plain `TestClient(app)` with no override. `test_list_is_paginated` and `test_each_test_starts_empty` fail (`Left contains … more items`; the count depends on test order): earlier tests left recipes behind. Results that depend on test order are the definition of a flaky suite.

## Open-source track

This week: **find one real issue or documentation gap** in your best candidate, and ask before doing anything big ([etiquette](../README.md#contribution-etiquette)).

```bash
gh label list -R OWNER/REPO --limit 100
gh issue list -R OWNER/REPO --state open --label "documentation"
gh issue view NUMBER -R OWNER/REPO
gh issue view NUMBER -R OWNER/REPO --comments
gh pr list -R OWNER/REPO --state all --search "words from the issue"
```

- **Labels differ** per project, so check the list first.
- **Read the body, who is assigned, and all comments.** If someone is assigned or an open PR already fixes it, move on. On 16 October 2026, one documentation issue in a large project already had two competing open PRs.
- **Documentation gaps count.** Follow the project's tutorial in a fresh folder; a step that fails or assumes unexplained knowledge is a candidate.
- **Ask first** for anything beyond a typo: describe what you found and propose a fix, in your own words.

Add the issue URL and your plan to your README. In Lecture 3 you reproduce it and open PR #1.

## Working with AI assistants

1. **Tests first.** "Here are my models and route table. Write pytest tests with a `client` fixture, including 404 and 422 cases. Don't write the routes." Run them before the routes exist: they must fail.
2. **Nasty inputs.** "List ten invalid JSON bodies for this model, each with the Pydantic v2 error `type` you expect." Send them and compare with the real `detail[0]["type"]`.
3. **Explain a 422.** Paste the full JSON and ask which field broke the contract.

**Spot the outdated suggestion.** Each of these raises a deprecation warning, which `filterwarnings = ["error"]` turns into a failing test:

- `class Config: extra = "forbid"` inside a model. Use `model_config = ConfigDict(extra="forbid")`.
- `.dict()`. Use `.model_dump()`.
- `status.HTTP_422_UNPROCESSABLE_ENTITY`. Use `status.HTTP_422_UNPROCESSABLE_CONTENT`.

## Completion check

```bash
uv run pytest
uv run ruff check .
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/recipes/999
curl -s -o /dev/null -w "%{http_code}\n" --json '{}' http://localhost:8000/recipes
```

Expected: `N passed` (N is at least 8), `All checks passed!`, `404`, and `422`. Use your own resource path.

- [ ] Five CRUD routes plus `/health` for your record type, with the contract's status codes.
- [ ] Separate Create, Update and Public models, with `extra="forbid"` and a limit on every field.
- [ ] Tests that assert status codes **and** bodies, with a fresh store per test.
- [ ] One issue or documentation gap noted for your open-source candidate.

## Quick quiz

<details markdown="1">
<summary>Q1. A client retries POST /recipes after a timeout, and both requests arrive. What happens? (a) One recipe, as POST is idempotent (b) Two recipes, as POST is not idempotent (c) A 409 error</summary>

**(b).** Each POST creates a new resource with a new id, like `f(x) = x + 1`. Retrying a POST needs care, which Lecture 9 returns to.

</details>

<details markdown="1">
<summary>Q2. A client sends "minutes": "40" (a string) to POST /recipes. What does this API return? (a) 422 int_parsing (b) 500 (c) 201 with minutes 40</summary>

**(c).** Pydantic's default *lax* mode converts a numeric string to an int. `"forty"` cannot convert, so it gets 422 `int_parsing`. Strict mode rejects any string.

</details>

<details markdown="1">
<summary>Q3. GET /recipe/1 (no "s") returns {"detail": "Not Found"}. What does that tell you? (a) Recipe 1 was deleted (b) No route matched the path (c) The store is empty</summary>

**(b).** Your handler would have said `"Recipe not found"`. The generic `"Not Found"` means no route matched, so check the path.

</details>

<details markdown="1">
<summary>Q4. Why does the client fixture override get_store? (a) It makes tests faster (b) Ruff requires it (c) Each test starts empty, whatever the order</summary>

**(c).** Shared state makes tests depend on each other's leftovers (drill 3). Next week the same override swaps in a test database.

</details>

<details markdown="1">
<summary>Q5. (Lecture 1) At the repo root, <code>uv run pytest</code> says "Failed to spawn: pytest". Why? (a) A syntax error (b) No uv project at the root (c) FastAPI isn't global</summary>

**(b).** `uv run` uses the nearest `pyproject.toml`; the root has none, so `backend/.venv` is never used. With a global pytest you get `No module named 'fastapi'` instead, for the same reason. Run `cd backend` first.

</details>

## Stretch goals

Optional:

- Add `PUT /recipes/{recipe_id}` that replaces the whole record (a `RecipeCreate` body), and test that two identical PUTs leave the same state.
- Add a `q` query parameter that filters titles case-insensitively, with a test.
- Try HTTPie: `uvx --from httpie http POST :8000/recipes title=Soup minutes:=40` (`:=` sends a JSON number).

## Common pitfalls

- **422 `model_attributes_type` from curl** → `-d` without a JSON content type sends form data → use `--json`, or add `-H "Content-Type: application/json"`.
- **`ModuleNotFoundError: No module named 'app'`** in tests → missing `pythonpath = ["."]` → add it to `[tool.pytest.ini_options]`.
- **`StarletteDeprecationWarning: Using httpx with starlette.testclient is deprecated`** → `httpx2` is not installed → `uv add --dev httpx2`.
- **Data vanishes while coding** → `fastapi dev` restarts on save → expected until Lecture 3.
- **A test passes alone but fails in the full run** → shared state → use the fixture override.

## Instructor notes

Suggested flow:

1. Warm-up: students label every part of the raw request and response.
2. REST smell test on five URLs; idempotency with `|x|` vs `x + 1`.
3. Live: models, then routes, with `/docs` open throughout.
4. Prediction round: students call each status code before you run each curl.
5. Write `conftest.py` and two tests live, then reveal the rest.
6. Drill 2 live: ten green tests hide a real bug until you add the regression test.
7. Lab: circulate and read 422 bodies with students.
8. Open-source step: `gh issue list` and `gh pr list --search` on one repo.
9. Exit ticket: a status code you used to confuse; the issue you found.

Emphasize that the contract is the product and storage is a detail; keep the 204-vs-404 debate short. Students get stuck on the JSON content type, PATCH semantics (unset vs `null`), and tests that only check status codes.

## Read more

- [FastAPI: request body](https://fastapi.tiangolo.com/tutorial/body/), [handling errors](https://fastapi.tiangolo.com/tutorial/handling-errors/) and [testing](https://fastapi.tiangolo.com/tutorial/testing/)
- [FastAPI: partial updates with PATCH](https://fastapi.tiangolo.com/tutorial/body-updates/) and [overriding dependencies in tests](https://fastapi.tiangolo.com/advanced/testing-dependencies/)
- [Pydantic: models](https://pydantic.dev/docs/validation/latest/concepts/models/) and [fields](https://pydantic.dev/docs/validation/latest/concepts/fields/)
- [MDN: HTTP request methods](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods) and [status codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status)
- [pytest: fixtures](https://docs.pytest.org/en/stable/how-to/fixtures.html)

---

[← Course home](../README.md) · [← Previous: Lecture 1](01-environment-git-docker-ai.md) · [Next: Lecture 3 →](03-persistence-and-first-pr.md)

<!-- {% endraw %} -->
