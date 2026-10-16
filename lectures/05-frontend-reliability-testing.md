# Lecture 5 · Frontend reliability and testing

<!-- {% raw %} -->
[← Course home](../README.md) · [← Previous: Lecture 4](04-browser-frontend.md) · [Next: Lecture 6 →](06-pydantic-ai-agents.md)

**Date:** Monday 16 November 2026, 16:00 Israel time, on Zoom · **You leave with:** a usable interface and one automated product flow

<details markdown="1" class="lecture-toc">
<summary>On this page</summary>

- [Mission](#mission)
- [Before you start](#before-you-start)
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

Your Recipe Box works on a good day. Today it learns to behave on a bad one: an empty list, nonsense input, a backend that is switched off. You finish with screens that always say what is happening and what to do next, and a robot that clicks through one real product flow in a real browser.

## Before you start

- The Lecture 4 frontend: `frontend/api.py` and `frontend/streamlit_app.py` with list, add, edit and delete ([Lecture 4](04-browser-frontend.md)).
- The Lecture 3 backend: `uv run fastapi dev` in `backend/` serves `http://localhost:8000/health` ([Lecture 3](03-persistence-and-first-pr.md)).
- You can read a 422 `detail` list ([Lecture 2](02-http-fastapi-pydantic.md)).
- Google Chrome, or about half a gigabyte of free disk for Playwright's own Chromium (start that download early).

## Concepts

### Four states every screen needs

In Lecture 4 the page handled success and a backend 422. A usable screen handles four states.

| State | What the user sees | Streamlit tool |
|---|---|---|
| Loading | "Loading recipes..." while waiting | `st.spinner` |
| Empty | What to do first, not a blank area | `st.info` |
| Error | What went wrong and the next step | `st.error`, then `st.stop()` if nothing else can work |
| Success | Confirmation after a write | `st.success` |

By default Streamlit shows uncaught exceptions, with the full traceback, in the browser: useful to you, confusing to users. The course rule: **expected failures are handled in code, and a traceback in the browser is a bug.** `st.error` renders with the ARIA role `alert`, so screen readers announce it. Put the meaning in words, never in the red color alone.

### The API boundary

```text
browser -> streamlit_app.py -> api.py  --HTTP-->  backend -> SQLite
           widgets and words   httpx, URLs,       the only code that
                               timeouts, errors   touches the database
```

Three rules keep this boundary clean:

1. **The frontend never touches the database**, not even for "one quick read". If the UI needs data, the backend grows an endpoint. This is a [course requirement](../README.md#three-service-product-requirements).
2. **One module owns HTTP.** `streamlit_app.py` imports `streamlit` and `api`, nothing else that does I/O. A test enforces it.
3. **The boundary speaks in typed values.** `api.py` returns a `Recipe` (a `TypedDict` mirroring the backend's `RecipePublic`) or raises a `BackendError` whose message is safe to show. httpx exceptions never leak out.

`api.py` is the waiter: the diner never enters the kitchen, and a kitchen fire becomes "your order will be late".

### Translating failures into words

| What happened | `api.py` raises | The user reads |
|---|---|---|
| Refused, DNS failure, timeout | `BackendUnavailable` | "Cannot reach the backend at … Start it … and reload the page." |
| 422 from the backend | `BackendError` | "Please fix: title: String should have at least 1 character" |
| 404 | `BackendError` | "That recipe no longer exists. Reload the page." |
| Any other error status | `BackendError` | "The backend failed (500). Check its logs." |

Every call also gets an explicit timeout: 2 seconds to connect and 10 seconds for each other phase, such as reading the reply. When the backend is off, the page fails fast instead of spinning.

### Testing a UI in layers

| Layer | Tool | What it proves |
|---|---|---|
| App | Streamlit `AppTest` with respx | each state, the exact JSON a form sends, error wording; no browser, no backend |
| End to end | Playwright | a real browser, the real backend and a real database agree |

`AppTest` runs `streamlit_app.py` in-process and lets you read and click widgets. respx intercepts httpx calls, so the backend can "be down" or "return 422" on demand. Mock at the HTTP boundary, not inside your own code, or the tests skip `api.py`.

Playwright drives a real browser. Two habits keep its tests stable:

- **Role-based locators** such as `get_by_role("button", name="Add recipe")` and `get_by_label("Title")` find elements the way users and screen readers do. They survive CSS changes.
- **Web-first assertions** such as `expect(locator).to_be_visible()` retry until a timeout. No `time.sleep()`, and no `wait_for_load_state("networkidle")`, which Playwright's own docs discourage.

## Live demo

**1. Show the problem.** Run the Lecture 4 app, stop the backend (Ctrl+C), and reload the page. The browser shows `httpx.ConnectError: [Errno 61] Connection refused` and a traceback (errno 111 on Linux). Ask the class what a user would do with that.

**2. Add the test tools** (in `frontend/`):

```bash
uv add --dev pytest pytest-playwright respx
uv run playwright install chromium
```

The second command downloads Playwright's Chromium. On Ubuntu or WSL2, add `--with-deps` to also install the system libraries it needs. Already have Chrome? Skip the download and pass `--browser-channel chrome` to browser tests.

```toml
# frontend/pyproject.toml (append)
[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]  # e2e/ needs a running app: run it explicitly
filterwarnings = ["error"]
```

**3. Rebuild the boundary.** This is the whole file:

```python
# frontend/api.py
"""Every HTTP call to the backend lives here. The UI never sees httpx."""

import os
from typing import TypedDict

import httpx

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
TIMEOUT = httpx.Timeout(10.0, connect=2.0)


class Recipe(TypedDict):
    """One recipe as the backend returns it (RecipePublic)."""

    id: int
    title: str
    minutes: int
    servings: int
    ingredients: str
    tags: str


class BackendError(Exception):
    """Something went wrong; str(error) is a message you can show to a user."""


class BackendUnavailable(BackendError):
    """The backend could not be reached at all."""


def _friendly(response: httpx.Response) -> str:
    match response.status_code:
        case 422:
            problems = [
                f"{err['loc'][-1]}: {err['msg']}" for err in response.json()["detail"]
            ]
            return "Please fix: " + "; ".join(problems)
        case 404:
            return "That recipe no longer exists. Reload the page."
        case code:
            return f"The backend failed ({code}). Check its logs."


def _request(method: str, path: str, **kwargs) -> httpx.Response:
    kwargs.setdefault("timeout", TIMEOUT)
    try:
        response = httpx.request(method, f"{BACKEND_URL}{path}", **kwargs)
    except httpx.TransportError as exc:  # refused, DNS, timeout
        raise BackendUnavailable(
            f"Cannot reach the backend at {BACKEND_URL}. "
            "Start it (uv run fastapi dev in backend/) and reload the page."
        ) from exc
    if response.is_error:
        raise BackendError(_friendly(response))
    return response


def list_recipes() -> list[Recipe]:
    return _request("GET", "/recipes", params={"limit": 100}).json()


def create_recipe(recipe: dict) -> Recipe:
    return _request("POST", "/recipes", json=recipe).json()


def update_recipe(recipe_id: int, changes: dict) -> Recipe:
    return _request("PATCH", f"/recipes/{recipe_id}", json=changes).json()


def delete_recipe(recipe_id: int) -> None:
    _request("DELETE", f"/recipes/{recipe_id}")
```

**4. Add the states to the UI.** Delete `import httpx` and `show_error()`, catch `api.BackendError` instead of `httpx.HTTPStatusError` (showing `st.error(str(exc))`), then change:

```python
# frontend/streamlit_app.py (the parts that change)
def recipe_fields(key: str, recipe: api.Recipe | None = None) -> dict:
    """Draw the recipe inputs (inside a form) and return them as a request body."""
    r: dict = dict(recipe) if recipe else {}
    # ... the inputs stay as in Lecture 4


try:
    with st.spinner("Loading recipes..."):
        recipes = api.list_recipes()
except api.BackendError as exc:
    st.error(str(exc))
    st.stop()  # nothing else on this page works without the backend

browse, add = st.tabs(["Recipes", "Add a recipe"])

with browse:
    if not recipes:
        st.info("No recipes yet. Add one in the 'Add a recipe' tab.")
    for recipe in recipes:
        ...  # unchanged
```

**5. Test the states with AppTest.** Write the backend-down test first. To watch it fail against the Lecture 4 code, set steps 3 and 4 aside with `git stash push api.py streamlit_app.py`, run `uv run pytest`, then bring them back with `git stash pop`:

```python
# frontend/tests/test_app.py
"""AppTest runs streamlit_app.py in-process; respx fakes every backend call."""

import httpx
import pytest
import respx
from streamlit.testing.v1 import AppTest

BASE = "http://localhost:8000"


@pytest.fixture
def backend():
    with respx.mock(base_url=BASE, assert_all_called=False) as mock:
        yield mock


def start_app(backend, recipes: list[dict]) -> AppTest:
    backend.get("/recipes").mock(return_value=httpx.Response(200, json=recipes))
    # Paths resolve relative to THIS file. 30 s: the first run imports pandas.
    return AppTest.from_file("../streamlit_app.py", default_timeout=30).run()


def test_empty_state(backend):
    at = start_app(backend, [])
    assert "No recipes yet" in at.info[0].value


def test_backend_down_shows_next_step_not_traceback(backend):
    backend.get("/recipes").mock(side_effect=httpx.ConnectError("refused"))
    at = AppTest.from_file("../streamlit_app.py", default_timeout=30).run()
    assert not at.exception
    assert "Cannot reach the backend" in at.error[0].value
    assert "reload the page" in at.error[0].value
    assert len(at.tabs) == 0  # st.stop(): the rest of the page is not drawn


def test_validation_errors_are_shown_in_words(backend):
    msg = "String should have at least 1 character"
    detail = [{"loc": ["body", "title"], "msg": msg}]
    reply = httpx.Response(422, json={"detail": detail})
    backend.post("/recipes").mock(return_value=reply)
    at = start_app(backend, [])
    at.text_input(key="add-title").input("Soup")  # passes the Lecture 4 title check
    at.button(key="add-submit").click().run()
    assert not at.exception
    assert at.error[0].value == f"Please fix: title: {msg}"
```

**6. Enforce the boundary with a test.**

```python
# frontend/tests/test_boundary.py
"""The UI may import Streamlit and api.py, nothing that talks to the network."""

import ast
from pathlib import Path

UI = Path(__file__).parent.parent / "streamlit_app.py"


def imported_modules(path: Path) -> set[str]:
    names = set()
    for node in ast.walk(ast.parse(path.read_text())):
        if isinstance(node, ast.Import):
            names |= {alias.name.split(".")[0] for alias in node.names}
        elif isinstance(node, ast.ImportFrom) and node.module:
            names.add(node.module.split(".")[0])
    return names


def test_ui_reaches_the_backend_only_through_api_py():
    assert imported_modules(UI) <= {"streamlit", "api"}
```

**7. One real-browser flow.** Run the backend in one terminal and the frontend (`uv run streamlit run streamlit_app.py`) in another, then:

```python
# frontend/e2e/test_e2e.py
"""One real-browser flow. Start the backend (port 8000) and the frontend
(port 8501) first, then: uv run pytest e2e --base-url http://localhost:8501
"""

import uuid

from playwright.sync_api import Page, expect


def test_add_a_recipe(page: Page):
    title = f"Falafel {uuid.uuid4().hex[:6]}"  # unique: the database persists
    page.goto("/")
    expect(page.get_by_role("heading", name="Recipe Box")).to_be_visible()

    # Add a recipe with the form (frontend -> backend -> database).
    page.get_by_role("tab", name="Add a recipe").click()
    add = page.get_by_role("tabpanel", name="Add a recipe")  # each edit form
    add.get_by_label("Title").fill(title)  # has a "Title" field too
    add.get_by_label("Minutes").fill("45")
    add.get_by_role("button", name="Add recipe").click()
    expect(page.get_by_text(f"Added {title}.")).to_be_visible()

    # After a reload it is still listed: the backend stored it.
    page.reload()
    recipes = page.get_by_role("tabpanel", name="Recipes")
    expect(recipes.get_by_text(f"{title} (45 min, serves 2)")).to_be_visible()
```

## Hands-on lab

Apply each step to **your own domain**; Recipe Box is the pattern, not the answer.

1. Add the dev tools and the pytest config from the demo. Install a browser, or plan to use `--browser-channel chrome`.
2. Move every HTTP call into `frontend/api.py`. Add a `TypedDict` for your main resource, `BackendError` and `BackendUnavailable`, and a `_friendly()` that speaks your domain ("That booking no longer exists").
   *Checkpoint:* `grep -n httpx streamlit_app.py` prints nothing.
3. Give every screen its four states. Each list needs an empty state that says what to do first.
4. Write AppTest tests: one per state, a 422 in words, an edit and a delete, and a form submit that asserts the exact JSON body with `json.loads(post.calls.last.request.content)`, where `post` is the respx route.
   *Checkpoint:* `uv run pytest` is green, and each test fails if you break the code it protects.
5. Add the boundary test.
6. Write one Playwright flow for your product's most important job: create something, reload, and check it is still there. Give it a unique name per run.
7. Unplug by hand: stop the backend, reload, read the message; restart it, reload, and check that the page recovers.
8. Commit: `git add frontend`, then `git commit -m "Frontend: error states, AppTest suite, e2e flow"`.

## Break it on purpose

Break it, read the exact error, fix it, keep the test that caught it.

1. **Unplug the backend.** Replace the `try:` block with a bare `recipes = api.list_recipes()`, then run `uv run pytest`. The backend-down test fails on `assert not at.exception` with `Exception(message='Cannot reach the backend at http://localhost:8000. …')`: a friendly message nobody catches is still a traceback. Restore the block.
2. **Leak the boundary.** Add `import httpx` at the top of `streamlit_app.py`. The boundary test fails with `AssertionError: assert {'api', 'httpx', 'streamlit'} <= {'api', 'streamlit'}`. Remove the import.
3. **Write an ambiguous locator.** In the e2e test, change `add.get_by_label("Title")` to `page.get_by_label("Title")`. Playwright stops with `strict mode violation: get_by_label("Title") resolved to 5 elements` (one per edit form plus the add form; your number depends on the rows). It refuses to guess. Scoping the locator to the tab panel fixes it.

## Open-source track

This week: [respond to review](../README.md#contribution-etiquette) on PR #1, and line up PR #2 for Lecture 6.

1. Check PR #1 (fill in its number and the upstream `OWNER/REPO`):

   ```bash
   gh pr view NUMBER --repo OWNER/REPO --json state,reviewDecision,mergedAt,baseRefName
   gh search prs --author=@me --state=open
   ```

2. Changes requested? Reproduce the point, push follow-up commits to the **same branch** (never a new PR), and reply in your own words: what changed and how you verified it. If CI failed, read the log before asking.
3. No response after a week? One polite ping, no more. Meanwhile, pick your PR #2 candidate.
4. Merged? Fill in its [evidence table](../README.md#evidence-table) row today.

## Working with AI assistants

**Pattern 1: tests for the states.** "Here are `streamlit_app.py` and `api.py`. Write Streamlit AppTest tests that mock HTTP with respx for: list, empty, backend down, 422. Use `AppTest.from_file("../streamlit_app.py", default_timeout=30)`. Don't change the app." *Verify:* run them, then break the code each test protects and watch it fail. A test that passes against broken code is decoration.

**Pattern 2: locator review.** "Which locators in this test are not role- or label-based, and which could match more than one element?" *Verify:* run it with `--headed --slowmo 500` and watch.

**Spot the outdated suggestion.** Assistants trained on older code still produce these:

- `st.button("Save", use_container_width=True)`
- `st.experimental_rerun()`
- `page.wait_for_load_state("networkidle")`, then `time.sleep(2)`
- `page.locator("div:nth-child(3) > input")`

<details markdown="1">
<summary>What is wrong with each one?</summary>

`use_container_width` is deprecated in Streamlit 1.66: use `width="stretch"`. `st.experimental_rerun` is gone ("has been removed. Use st.rerun instead."). `networkidle` and sleeps make tests slow and flaky: use web-first `expect(...)`. Positional CSS selectors break when the layout changes: use `get_by_role` or `get_by_label`.

</details>

## Completion check

In `frontend/`, with the backend and frontend running locally:

```bash
uv run pytest
uv run pytest e2e --base-url http://localhost:8501 --browser-channel chrome
grep -n httpx streamlit_app.py
```

Expected: `7 passed` for the Recipe Box suite (the three AppTest tests above, the list, add and edit-and-delete tests from lab step 4, and the boundary test; your count will differ), `1 passed` for the browser test, and no output from `grep`. Drop `--browser-channel chrome` if you downloaded Playwright's Chromium instead.

- [ ] Every list has an empty state that says what to do first.
- [ ] With the backend stopped, the page shows a next step and no traceback. After a restart and a reload, it recovers.
- [ ] A 422 appears in words that name the field.
- [ ] Both test commands pass, and each test fails when you break what it protects.
- [ ] PR #1's status is checked, and any review is answered.

## Quick quiz

<details markdown="1">
<summary>Q1. The backend is stopped. Which exception does httpx raise, and what should the UI receive?</summary>

`httpx.ConnectError`, a `TransportError`. `api.py` turns it into `BackendUnavailable` with a next step, so the UI only ever handles `BackendError`.

</details>

<details markdown="1">
<summary>Q2. (Lecture 2) Why is <code>loc[-1]</code> a good choice for building the 422 message?</summary>

`loc` is a path such as `["body", "title"]`. Its last item is the field the user can fix. A 422 means the request broke the contract, so the user fixes the input; retrying the same request would fail again.

</details>

<details markdown="1">
<summary>Q3. Why mock HTTP with respx instead of patching <code>api.list_recipes</code>?</summary>

Mocking HTTP also runs `api.py`: the status-code mapping and the friendly messages. Patching your own function skips the code most likely to be wrong.

</details>

<details markdown="1">
<summary>Q4. The e2e test fails with "strict mode violation". Is the bug in the app or in the test?</summary>

In the test. Its locator matches several elements, and Playwright refuses to pick one. Scope it, for example to `get_by_role("tabpanel", name="Add a recipe")`.

</details>

<details markdown="1">
<summary>Q5. Why does the e2e test put a random suffix in the title?</summary>

The database persists between runs (Lecture 3). With a fixed title, the second run also finds the first run's row, so "is it listed?" proves nothing, or the locator matches twice.

</details>

## Stretch goals

Optional:

- Validate responses in `api.py` with a Pydantic `TypeAdapter`, so a changed backend contract fails loudly.
- Cache the list with `st.cache_data(ttl=30)`, call `.clear()` after every write, and prove with a test that the list refreshes.
- Give alerts a headline with `st.error(message, title="Backend unavailable")`.
- Run the e2e test with `--tracing retain-on-failure`, then open the saved trace with `uv run playwright show-trace test-results/<test>/trace.zip`.

## Common pitfalls

- **`FileNotFoundError: AppTest script not found at …/tests/streamlit_app.py`.** Relative paths resolve against the test file, not the working directory. Fix: use `"../streamlit_app.py"`.
- **AppTest times out on the first run.** Cold imports are slow. Fix: `default_timeout=30`.
- **A form test fails with `IndexError: list index out of range` on `at.error[0]`.** A client-side check (Lecture 4) stopped the form, so the message is in `at.warning` and nothing was sent. Fix: fill the required fields first; respx still answers 422.
- **`BrowserType.launch: Executable doesn't exist at …`.** Playwright's browser isn't downloaded, or was downloaded for an older Playwright version. Fix: `uv run playwright install chromium`, or use `--browser-channel chrome`.
- **`uv run pytest` tries to open a browser.** It collected `e2e/`. Fix: `testpaths = ["tests"]`, and run e2e explicitly.
- **respx doesn't intercept a request.** respx patches httpx only, not httpx2 or `requests`. Fix: keep `api.py` on httpx.
- **Flaky e2e test.** It sleeps or waits for "network idle". Fix: web-first `expect(...)` assertions.
- **WSL2:** run the backend, frontend and tests inside Ubuntu, and keep the repo under `~`, not `/mnt/c`.

## Instructor notes

Suggested flow:

1. Have everyone start `uv run playwright install chromium` first; it is slow on a shared network.
2. Stop the backend under the Lecture 4 app and let the class read the traceback.
3. Draw the boundary diagram; agree on the three rules.
4. Refactor `api.py` live, then add the four states.
5. Run the backend-down AppTest test against the stashed Lecture 4 code (red), then the new code (green).
6. Add the boundary test and break it once.
7. Run the flow with `--headed --slowmo 500` so the class watches the robot type, then show the strict mode violation.
8. Lab. Expect questions on AppTest paths, browser installs on WSL2, and locator scoping.
9. PR #1 status round; model a respectful review reply on screen.
10. Quiz. Exit ticket: name your most important flow; it becomes your e2e test.

Emphasize: mock at the boundary; a test counts only if it fails when the code breaks; the frontend never touches the database. The `BackendUnavailable` message names today's run command, so it changes when the run procedure does (Lecture 8).

## Read more

- [Streamlit app testing](https://docs.streamlit.io/develop/concepts/app-testing)
- [Streamlit status elements](https://docs.streamlit.io/develop/api-reference/status)
- [Playwright locators](https://playwright.dev/python/docs/locators) and [assertions](https://playwright.dev/python/docs/test-assertions)
- [Playwright pytest plugin](https://playwright.dev/python/docs/test-runners)
- [RESPX](https://lundberg.github.io/respx/)

---

[← Course home](../README.md) · [← Previous: Lecture 4](04-browser-frontend.md) · [Next: Lecture 6 →](06-pydantic-ai-agents.md)

<!-- {% endraw %} -->
