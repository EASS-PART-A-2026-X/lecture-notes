# Lecture 3 · Persistence and your first upstream PR

<!-- {% raw %} -->
[← Course home](../README.md) · [← Previous: Lecture 2](02-http-fastapi-pydantic.md) · [Next: Lecture 4 →](04-browser-frontend.md)

**Date:** Monday 2 November 2026, 16:00 Israel time, on Zoom · **You leave with:** a backend whose data survives restarts, locally and in Docker, and your first upstream PR opened

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

Restart your Lecture 2 API and every record is gone. Today you give it a real memory, SQLite through SQLModel, without changing the HTTP contract or `tests/test_recipes.py`. Then you ship it as a Docker image whose data survives the container being deleted. Upstream, last week's issue becomes a reproduced bug, a focused change and an opened PR.

## Before you start

- A tested CRUD API from [Lecture 2](02-http-fastapi-pydantic.md), with `uv run pytest` green.
- Your Lecture 2 open-source issue or doc gap, plus any maintainer replies.
- Docker Desktop running: `docker run --rm hello-world` prints a greeting ([Lecture 1](01-environment-git-docker-ai.md)). On Windows, work inside WSL2 (Ubuntu).
- In `backend/`: `uv add sqlmodel`.

**Visual review:** [One request, end to end](../guides/system-walkthrough.md) connects this checkpoint to service ownership, validation, the commit boundary, and failure evidence.

**Professional practice:** [Explore authorization and concurrent edits at the storage boundary](../guides/industry-studio.md#lab-private-records-and-concurrent-edits) in the industry studio. This optional activity deepens the current checkpoint without changing the assignment.

## Learning checkpoint

By the end, you should be able to:

- Trace one request through its session to a committed row, and explain what survives a restart.
- Change persistence while preserving the API contract and its existing tests.
- Distinguish an idempotent seed, a schema migration, a persistent volume, and a backup.

**Predict first:** Why can a response look correct after flush() yet fail the restart test without commit()?

**Bridge if needed:** [State and transactions](../guides/engineering-foundations.md#state-transactions-and-ownership). These questions are formative practice; the existing completion check and assignment requirements remain the target.

## Concepts

### Same contract, new storage

Routes keep their URLs, bodies and status codes; only the storage behind them changes, so last week's tests must pass untouched.

```text
request -> route (unchanged) -> SessionDep -> Session -> Engine -> data/app.db
tests/test_recipes.py (unchanged)
tests/conftest.py swaps the session for a fresh in-memory database
```

### Engine, session and the session dependency

- The **engine** opens connections to one database URL and pools them. One per process.
- A **session** is one unit of work: `add()` objects, `commit()` writes them together, `refresh()` reloads generated values such as `id`. The engine is the library; a session is one visit with a borrowing slip.
- Each request gets a session from the `yield` dependency `get_session()`; tests replace it. `check_same_thread=False` is needed because FastAPI runs `def` endpoints in a thread pool.

SQLite URLs: `sqlite:///./data/app.db` is relative to the current directory, `sqlite:////app/data/app.db` (four slashes) is absolute, and `sqlite://` is in memory.

### Table model versus API schemas

| Class | Role | Validates input? |
|---|---|---|
| `RecipeBase` | Shared fields and limits | (base only) |
| `Recipe(table=True)` | The database table | **No**: table models skip validation in `__init__` |
| `RecipeCreate`, `RecipeUpdate` | POST and PATCH bodies, `extra="forbid"` | Yes |
| `RecipePublic` | Response body, always has `id` | Yes |

`Recipe(title="", minutes=0)` does not raise, so routes validate through `RecipeCreate` first, then convert with `Recipe.model_validate(body)`.

### Tables, migrations and seeds

`SQLModel.metadata.create_all(engine)` creates missing tables but never alters existing ones: enough for EX1, while changing columns under real data needs migrations (the Alembic stretch goal). The **lifespan** creates tables and seeds at startup, and calls `engine.dispose()` at shutdown.

A seed inserts 2–3 demo rows into an empty database and must be **idempotent**: a second run inserts nothing. Keep rows as plain dicts and build fresh `Recipe(**row)` objects per call; re-used table objects carry SQLAlchemy state, and a later seed can silently insert nothing (Drill 1).

### Test isolation

Every test gets its own empty database, so nothing leaks between tests or into `data/app.db`.

| Strategy | Watch out for |
|---|---|
| In-memory SQLite + `StaticPool` (used here) | Without `StaticPool`, each connection sees a different, empty database |
| A temporary file per test (`tmp_path`) | Needed when a test restarts the app |
| A transaction per test, rolled back | More setup; mostly for PostgreSQL |

`app.dependency_overrides[get_session]` swaps in the test session. A plain `TestClient(app)` does **not** run the lifespan, so tests never touch the real file; `with TestClient(app)` does, which is what a restart test needs.

### Where data lives

Locally, data is `backend/data/app.db`; git-ignore `data/` and `*.db`, because a database is runtime state. In Docker, a container's filesystem disappears with `docker rm`, while a **named volume** mounted at `/app/data` outlives it. EX1 needs a backend Dockerfile, so you write one today with uv's official pattern.

## Live demo

The instructor converts Recipe Box to SQLite, rerunning the unchanged tests after each file.

The complete models. `Field` now comes from `sqlmodel`: Pydantic's own `Field` does not know `index=True` and emits a deprecation warning, which your `filterwarnings = ["error"]` turns into a failure. `RecipeUpdate` keeps its Lecture 2 fields but extends `SQLModel`; `RecipePublic` still adds `id`.

```python
# backend/app/models.py
from pydantic import ConfigDict
from sqlmodel import Field, SQLModel


class RecipeBase(SQLModel):
    title: str = Field(min_length=1, max_length=200, index=True)
    minutes: int = Field(ge=1, le=24 * 60)
    servings: int = Field(default=2, ge=1, le=50)
    ingredients: str = Field(default="", max_length=5000)
    tags: str = Field(default="", max_length=500)


class Recipe(RecipeBase, table=True):
    id: int | None = Field(default=None, primary_key=True)


class RecipeCreate(RecipeBase):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class RecipeUpdate(SQLModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str | None = Field(default=None, min_length=1, max_length=200)
    minutes: int | None = Field(default=None, ge=1, le=24 * 60)
    servings: int | None = Field(default=None, ge=1, le=50)
    ingredients: str | None = Field(default=None, max_length=5000)
    tags: str | None = Field(default=None, max_length=500)


class RecipePublic(RecipeBase):
    id: int
```

The engine and the session dependency:

```python
# backend/app/db.py
import os
from collections.abc import Iterator
from pathlib import Path
from typing import Annotated

from fastapi import Depends
from sqlalchemy import Engine
from sqlmodel import Session, SQLModel, create_engine

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/app.db")


def make_engine(url: str) -> Engine:
    return create_engine(url, connect_args={"check_same_thread": False})


engine = make_engine(DATABASE_URL)


def create_db_and_tables() -> None:
    db_file = engine.url.database  # e.g. "./data/app.db"; None for in-memory
    if db_file:
        Path(db_file).parent.mkdir(parents=True, exist_ok=True)
    SQLModel.metadata.create_all(engine)


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]
```

The complete lifespan, helpers, and routes. `main.py` always says `db.engine`, never `from app.db import engine`: the restart test below swaps `db.engine`, and a name imported once would keep pointing at the real file.

```python
# backend/app/main.py
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import FastAPI, HTTPException, Query, status
from sqlmodel import Session, select

from app import db
from app.models import Recipe, RecipeCreate, RecipePublic, RecipeUpdate
from app.seed import seed_if_empty


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.create_db_and_tables()
    with Session(db.engine) as session:
        seed_if_empty(session)
    yield
    db.engine.dispose()


app = FastAPI(title="Recipe Box API", lifespan=lifespan)


def save(session: Session, recipe: Recipe) -> Recipe:
    session.add(recipe)
    session.commit()
    session.refresh(recipe)
    return recipe


def get_or_404(session: Session, recipe_id: int) -> Recipe:
    recipe = session.get(Recipe, recipe_id)
    if recipe is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Recipe not found")
    return recipe


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/recipes", response_model=list[RecipePublic])
def list_recipes(
    session: db.SessionDep,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[Recipe]:
    query = select(Recipe).order_by(Recipe.id).offset(offset).limit(limit)
    return list(session.exec(query).all())


@app.post("/recipes", response_model=RecipePublic, status_code=status.HTTP_201_CREATED)
def create_recipe(body: RecipeCreate, session: db.SessionDep) -> Recipe:
    return save(session, Recipe.model_validate(body))


@app.get("/recipes/{recipe_id}", response_model=RecipePublic)
def get_recipe(recipe_id: int, session: db.SessionDep) -> Recipe:
    return get_or_404(session, recipe_id)


@app.patch("/recipes/{recipe_id}", response_model=RecipePublic)
def update_recipe(recipe_id: int, body: RecipeUpdate, session: db.SessionDep) -> Recipe:
    recipe = get_or_404(session, recipe_id)
    recipe.sqlmodel_update(body.model_dump(exclude_unset=True, exclude_none=True))
    return save(session, recipe)


@app.delete("/recipes/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recipe(recipe_id: int, session: db.SessionDep) -> None:
    session.delete(get_or_404(session, recipe_id))
    session.commit()
```

All routes preserve Lecture 2's contract. `save()` does `add`, `commit` and `refresh`; `get_or_404()` uses `session.get(Recipe, recipe_id)`; the list runs `select(Recipe).order_by(Recipe.id).offset(offset).limit(limit)`; `DELETE` calls `session.delete()`, then `commit()`. `PATCH` calls `recipe.sqlmodel_update(body.model_dump(exclude_unset=True, exclude_none=True))`, so only the fields the client sent change.

The seed:

```python
# backend/app/seed.py
from sqlmodel import Session, select

from app.models import Recipe

SEED: list[dict] = [
    {
        "title": "Shakshuka",
        "minutes": 25,
        "servings": 2,
        "ingredients": "4 eggs\n1 can tomatoes\n1 onion\n1 tsp paprika",
        "tags": "breakfast,vegetarian",
    },
    {
        "title": "Hummus",
        "minutes": 15,
        "servings": 4,
        "ingredients": "chickpeas\ntahini\nlemon",
        "tags": "vegan,quick",
    },
    {
        "title": "Lentil soup",
        "minutes": 40,
        "servings": 4,
        "ingredients": "lentils\ncarrot\nonion",
        "tags": "vegan",
    },
]


def seed_if_empty(session: Session) -> int:
    """Insert the demo rows only when the table is empty. Returns rows added."""
    if session.exec(select(Recipe).limit(1)).first() is not None:
        return 0
    session.add_all([Recipe(**row) for row in SEED])
    session.commit()
    return len(SEED)
```

Delete Lecture 2's drill file `tests/test_patch_null.py` (SQLite now rejects a null title, so the PATCH test catches that bug). The only test file you edit:

```python
# backend/tests/conftest.py
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.db import get_session
from app.main import app


@pytest.fixture
def session() -> Iterator[Session]:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()  # else: ResourceWarning (an error under filterwarnings)


@pytest.fixture
def client(session: Session) -> Iterator[TestClient]:
    app.dependency_overrides[get_session] = lambda: session
    yield TestClient(app)  # no `with`: the lifespan does not run
    app.dependency_overrides.clear()
```

A new test starts the app twice on one file:

```python
# backend/tests/test_restart.py
from fastapi.testclient import TestClient

from app import db
from app.main import app
from app.seed import SEED, seed_if_empty


def test_data_survives_restart(tmp_path, monkeypatch):
    url = f"sqlite:///{tmp_path / 'app.db'}"

    monkeypatch.setattr(db, "engine", db.make_engine(url))  # "process" 1
    with TestClient(app) as client:  # `with` runs lifespan startup + shutdown
        assert len(client.get("/recipes").json()) == len(SEED)  # seeded
        client.post("/recipes", json={"title": "Falafel", "minutes": 60})

    monkeypatch.setattr(db, "engine", db.make_engine(url))  # "process" 2
    with TestClient(app) as client:
        titles = [r["title"] for r in client.get("/recipes").json()]
    assert titles == [row["title"] for row in SEED] + ["Falafel"]  # no double seed


def test_seed_is_idempotent(session):
    assert seed_if_empty(session) == len(SEED)
    assert seed_if_empty(session) == 0
```

Run the suite (`12 passed`), then restart for real: `uv run fastapi dev`, add a recipe in `/docs`, Ctrl+C, start, list. Look inside:

```bash
sqlite3 data/app.db "SELECT id, title, minutes FROM recipe;"
sqlite3 data/app.db ".schema recipe"
```

The schema shows `title VARCHAR(200) NOT NULL` and an index on `title`. On Ubuntu, `sudo apt install sqlite3` adds the tool.

`backend/Dockerfile` (the `# syntax` line must stay first):

```dockerfile
# syntax=docker/dockerfile:1
FROM python:3.14-slim
COPY --from=ghcr.io/astral-sh/uv:0.13.1 /uv /uvx /bin/
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_NO_DEV=1 \
    UV_PYTHON_DOWNLOADS=0 \
    PYTHONUNBUFFERED=1
WORKDIR /app

# 1) Dependencies only: cached until uv.lock changes.
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --locked --no-install-project

# 2) Application code.
COPY . /app
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked

# 3) Never run as root. /app/data holds the SQLite volume.
RUN useradd --create-home --uid 10001 appuser \
    && mkdir -p /app/data && chown appuser /app/data
USER appuser
ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8000
CMD ["fastapi", "run", "app/main.py", "--host", "0.0.0.0", "--port", "8000"]
```

`backend/.dockerignore` lists, one per line: `.venv`, `__pycache__`, `.pytest_cache`, `.ruff_cache`, `.env`, `data`, `*.db`, `tests`.

Build, run with a named volume, add a recipe, delete the container, run a new one:

```bash
docker build -t recipe-box-backend .
docker run -d --name backend -p 127.0.0.1:8000:8000 -v backend-data:/app/data recipe-box-backend
curl -s --json '{"title": "Falafel", "minutes": 60}' localhost:8000/recipes
docker rm -f backend
docker run -d --name backend -p 127.0.0.1:8000:8000 -v backend-data:/app/data recipe-box-backend
curl -s localhost:8000/recipes
docker exec backend id
```

Run the lines one at a time: the server needs a second or two after `docker run -d`, and an early `curl -s` prints nothing. Falafel is still listed, and `id` prints `uid=10001(appuser)` (`curl --json` needs curl 7.82+). The working directory is `/app`, so the default `./data/app.db` lands in the volume; Lecture 8's Compose file sets `sqlite:////app/data/app.db` explicitly.

**Predict, then run.** Before each step, say what happens to Falafel.

<details markdown="1">
<summary>Predictions: stop and start, remove without a volume, remove with a volume</summary>

- `docker stop backend`, then `docker start backend`: **kept**. The container still exists.
- `docker rm -f backend`, then a new `docker run` **without** `-v`: **gone**; only the 3 seed rows remain.
- The same with `-v backend-data:/app/data`: **kept**. The volume outlives every container.

</details>

## Hands-on lab

Apply each step to **your own domain**; Recipe Box is only the example.

1. Turn your Lecture 2 models into SQLModel classes: a base, a `table=True` class with `id`, and the Create, Update and Public schemas.
2. Add `app/db.py` and switch every route to `db.SessionDep`, keeping the contract.
3. Replace `tests/conftest.py` with the in-memory fixtures and delete `tests/test_patch_null.py`. **Checkpoint:** your Lecture 2 tests pass, and `git diff --stat -- tests/test_recipes.py` (your CRUD tests) prints nothing.
4. Write `app/seed.py` with 2–3 realistic rows as dicts, call it from the lifespan, and add `test_seed_is_idempotent`.
5. Add `tests/test_restart.py`. **Checkpoint:** temporarily replace `session.commit()` with `session.flush()` in `save()`; the restart test must fail. Undo it.
6. Check that your Lecture 1 `.gitignore` covers `data/` and `*.db`, then create a record with `uv run fastapi dev`, restart and confirm it is still there.
7. Add the `Dockerfile` and `.dockerignore`. **Checkpoint:** a record survives the build, `rm`, run sequence.
8. Put setup, run and test commands (local and Docker) in your README, as EX1 requires ([assignments](../README.md#assignments-and-deadlines)).

## Break it on purpose

Make it fail, read the exact error, explain, fix, keep a test that catches it.

1. **The seed that lies.** Build `SEED_RECIPES = [Recipe(**row) for row in SEED]` once at module level and `session.add_all(SEED_RECIPES)`. `uv run pytest -k idempotent` passes; the full suite fails with `assert 3 == 0`, because the restart test used those objects first and the next seed "added 3" rows that never reached the new table. Fix: fresh objects per call. Passing alone but failing in the suite means shared state.
2. **The vanishing table.** Remove `poolclass=StaticPool` from the fixture. Tests fail with `sqlite3.OperationalError: no such table: recipe`: the endpoint runs in another thread, gets another connection, and therefore another empty in-memory database. Fix: restore `StaticPool`.
3. **The container that forgets.** Run without `-v backend-data:/app/data`, add a record, `docker rm -f backend`, run again: only the seed rows remain. Fix: mount the volume, and put the exact run command in your README for the grader.

## Open-source track

Last week's issue becomes PR #1. The rules live in the README's [open-source section](../README.md#open-source-contribution-rule-and-evidence) and [contribution etiquette](../README.md#contribution-etiquette).

1. **Re-check first.** Re-read CONTRIBUTING and the AI-use policy, look for duplicate work, and on the day you open the PR save a dated star snapshot (stars are measured when the PR is opened); it is PR #1's star evidence:

   ```bash
   gh repo view OWNER/REPO --json stargazerCount,licenseInfo,pushedAt,isFork
   gh issue view 123 --repo OWNER/REPO --comments
   gh pr list --repo OWNER/REPO --state all --search "words from the issue"
   ```

2. **Reproduce it.** Write a minimal reproduction: versions, smallest steps, expected versus actual; for a docs fix, what the page says versus what the code does. Cannot reproduce it? Say so on the issue.
3. **Make one focused change** on a branch of your fork, in the project's style:

   ```bash
   gh repo fork OWNER/REPO --clone
   cd REPO
   git switch -c fix/short-description
   ```

4. **Run the project's own checks** as CONTRIBUTING describes; add a test if the project expects one.
5. **Commit and open the PR.** Follow the project's commit style (`git commit -s` if it requires a DCO, Developer Certificate of Origin, sign-off). Run `git push -u origin fix/short-description`, then `gh pr create --web`, which targets the upstream repository, and fill in its template in the browser.
6. **Write the description yourself.** Without a template, use four headings: *What* (one or two sentences), *Why* (link the issue; "Fixes #123" only if fully resolved), *How I verified* (commands and results) and *Notes for reviewers* (open questions; AI-use disclosure if the project asks). Keep it short, specific and checkable, never claiming more than the diff shows.
7. **Record it** in your [evidence table](../README.md#evidence-table). Opened is a checkpoint; only a merge counts.

## Working with AI assistants

- **Contract-preserving refactor.** "Here are `models.py`, `main.py` and `tests/test_recipes.py`. Move storage to SQLModel and SQLite. Do not edit `tests/test_recipes.py` or change any URL, body or status code." Verify: `git diff --stat -- tests/test_recipes.py` prints nothing and the suite is green.
- **Make the test prove something.** Ask for a restart test, then mutate the code: `session.commit()` becomes `session.flush()`. The demo suite reports `1 failed, 11 passed`, and the failure is the restart test. A test that stays green under that mutation proves nothing.
- **Open source.** An assistant may explain unfamiliar code; you reproduce, run the checks and write every maintainer-facing word, within the project's AI policy.

**Spot the outdated suggestion:**

- `@app.on_event("startup")`: use a lifespan.
- `class Config: orm_mode = True`: Pydantic v1; use `model_config`.
- `create_engine("sqlite:///:memory:")` in tests without `StaticPool`: Drill 2.
- `FROM python:3-slim` or `uv:latest`: `3-slim` already means Python 3.15; pin `python:3.14-slim` and a uv version.

## Completion check

From `backend/`:

```bash
uv run pytest
uv run ruff check .
uv run ruff format --check .
docker build -t recipe-box-backend .
docker rm -f backend
docker run -d --name backend -p 127.0.0.1:8000:8000 -v backend-data:/app/data recipe-box-backend
curl -s localhost:8000/health
```

`docker rm -f backend` removes the demo container so the name is free; if there is none, its `No such container` message is harmless. Give the server a second before the `curl`.

- [ ] Tests pass: unchanged Lecture 2 tests, idempotent seed, restart.
- [ ] `/health` prints `{"status":"ok"}`; a fresh database holds your seed rows.
- [ ] A record survives `docker rm -f backend` plus a new `docker run` with the same volume.
- [ ] `git status` shows no `.db` file and no `data/` folder.
- [ ] Your README has EX1's setup, run and test instructions.
- [ ] PR #1 is open upstream and listed in your evidence table.

## Quick quiz

<details markdown="1">
<summary>Q1. Recipe(title="", minutes=0) raises no error. Why, and how does the API still reject that input?</summary>

Table models skip validation in `__init__`. The route accepts a `RecipeCreate`, which validates, and only then converts it with `Recipe.model_validate(body)`.

</details>

<details markdown="1">
<summary>Q2. Your Lecture 2 test file passes unchanged against SQLite. What does that tell you?</summary>

The tests pin the HTTP contract (201 on create, 404 for a missing id, 422 for invalid bodies), not the storage. Needing edits would signal a breaking change or tests coupled to the implementation.

</details>

<details markdown="1">
<summary>Q3. Why does the in-memory test database need StaticPool?</summary>

Each new connection to `sqlite://` is a new, empty database. The tables live on one connection; the endpoint's worker thread would open another. `StaticPool` shares one connection.

</details>

<details markdown="1">
<summary>Q4. Why are seed rows plain dicts rather than ready-made Recipe objects?</summary>

A used table object carries SQLAlchemy state; adding it to a session for a new database can insert nothing while the seed reports success.

</details>

<details markdown="1">
<summary>Q5. Which survives docker rm -f backend: the container's filesystem, a named volume, or both?</summary>

Only the named volume. `docker rm` deletes the container and its writable layer; the volume exists independently.

</details>

## Stretch goals

Optional, once the required path works.

- **Migrations with Alembic.** `uv add alembic` and `uv run alembic init -t pyproject migrations`. In `migrations/env.py`, import `app.models`, set `target_metadata = SQLModel.metadata`, take the URL from `app.db.DATABASE_URL`, and pass `render_as_batch=True` to both `context.configure(...)` calls. Then `uv run alembic revision --autogenerate -m "create recipe table"` and `uv run alembic upgrade head`. Verified traps:
  - Without `import sqlmodel` in `migrations/script.py.mako`, upgrade fails with `NameError: name 'sqlmodel' is not defined`.
  - Autogenerate diffs against the live database: if `create_all` already made the table, the first migration is empty (`pass`).
  - A new NOT NULL column on a table with rows fails with `Cannot add a NOT NULL column with default value NULL`; add a `server_default` in the migration.
  - On a fresh clone there is no `data/` folder until the app has started once, so autogenerate fails with `unable to open database file`: `mkdir -p data` first. Ruff also flags `migrations/`: run `uv run ruff check --fix .` and `uv run ruff format .` after each revision (the ruff `post_write_hooks` that `alembic init` left commented out in `pyproject.toml` automate it for new revisions).
- **A second table** for your domain; decide what `DELETE` does to its children.

## Common pitfalls

- `no such table: recipe` in tests → in-memory database without `StaticPool` → restore the fixture.
- `ResourceWarning: unclosed database` (an error under `filterwarnings`) → an engine was never disposed → `engine.dispose()` in teardown and lifespan.
- A 500 on `PATCH {"title": null}` with `NOT NULL constraint failed: recipe.title` → `None` copied into a required column → dump with `exclude_none=True`.
- Container exits with `unable to open database file` → user 10001 cannot write `/app/data`, for example a bind-mounted host folder or a volume that an older image filled as root → mount a fresh named volume (`-v backend-data:/app/data`); Docker copies the image folder's ownership into an empty volume.
- A new field is missing from the table → `create_all` never alters tables → reset only a disposable demo database, or use Alembic. Preserve real data and test its backup/restore before migrating it.
- `docker run` reports `address already in use` or `port is already allocated` → `fastapi dev` still holds 8000 → stop it or use `-p 127.0.0.1:8080:8000`.
- `docker run` reports `Conflict. The container name "/backend" is already in use` → a container from an earlier run still exists → `docker rm -f backend`, then run again (a named volume keeps the data).
- Build fails with "The lockfile at `uv.lock` needs to be updated, but `--locked` was provided" → `pyproject.toml` changed without relocking → `uv lock`, commit `uv.lock`.
- A second, empty `app.db` appears elsewhere → the relative URL follows the working directory → start from `backend/`.

## Instructor notes

Suggested flow:

1. Show the Lecture 2 restart losing a recipe; explain engine and session with the diagram.
2. Convert `models.py`, `db.py` and `main.py` live, running the unchanged suite after each file.
3. Write `conftest.py`, then run Drill 2 live so the `StaticPool` reason sticks.
4. Seed and restart test; mutate `commit()` to `flush()` to show why it exists.
5. Walk the Dockerfile, then the predict-then-run sequence.
6. Open source: a student narrates a reproduction; the class improves a PR description draft.
7. Lab time; collect PR links at the end.

Emphasize: the contract is unchanged, table models do not validate, only a volume survives `docker rm`. Students get stuck on routes still calling the old store, the wrong working directory, the port clash with a running dev server, and which tests to change (only `conftest.py`). For heavy upstream suites, running the relevant subset is fine when CONTRIBUTING allows it.

## Read more

- [FastAPI: SQL (relational) databases](https://fastapi.tiangolo.com/tutorial/sql-databases/)
- [FastAPI: testing dependencies with overrides](https://fastapi.tiangolo.com/advanced/testing-dependencies/)
- [uv: using uv in Docker](https://docs.astral.sh/uv/guides/integration/docker/)
- [Docker: volumes](https://docs.docker.com/engine/storage/volumes/)
- [GitHub: creating a pull request from a fork](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/creating-a-pull-request-from-a-fork)

---

[← Course home](../README.md) · [← Previous: Lecture 2](02-http-fastapi-pydantic.md) · [Next: Lecture 4 →](04-browser-frontend.md)

<!-- {% endraw %} -->
