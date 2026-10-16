# Lecture 4 · Browser frontend

<!-- {% raw %} -->
[← Course home](../README.md) · [← Previous: Lecture 3](03-persistence-and-first-pr.md) · [Next: Lecture 5 →](05-frontend-reliability-testing.md)

**Date:** Monday 9 November 2026, 16:00 Israel time, on Zoom · **You leave with:** your first working end-to-end user flow in the browser

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

So far only `curl` and `/docs` can use your product. Today it gets a face: a Streamlit page where a person lists, adds, edits and deletes records, each click traveling browser → frontend → backend → SQLite. The win: on a screen share, a classmate tells you what to click and completes all four flows in under a minute, with no terminal.

> **Note:** EX1 (backend) is due tonight at 23:59 Israel time. Its requirements are in the README's [assignments table](../README.md#assignments-and-deadlines).

## Before you start

- Your Lecture 3 backend runs with `uv run fastapi dev` on port 8000, and `GET /recipes` (or your resource) returns the seed rows ([Lecture 3](03-persistence-and-first-pr.md)). If Lecture 3's `backend` container still holds port 8000, stop it first with `docker rm -f backend` (the named volume keeps its data).
- You know your API's field names: open `http://localhost:8000/docs`.
- Two terminals: one for the backend, one for the frontend. On Windows, both run inside WSL2.

## Concepts

### Where the frontend sits

```text
browser <-- websocket --> Streamlit server :8501 -- HTTP --> backend :8000 --> SQLite
                          streamlit_app.py  (what the user sees)
                          api.py            (every HTTP call)
```

The frontend is its own process and reaches data **only** through the backend's API, never the database (README [product requirements](../README.md#three-service-product-requirements)). With Streamlit, your Python runs on the Streamlit server and the browser only draws the result, so the HTTP calls to the backend come from the server, not the browser.

### The rerun model

Every interaction (a click, a submitted form) reruns your script from top to bottom, like a spreadsheet recalculating after an edit. Ordinary variables start fresh each run; widgets remember values through their keys; `st.session_state` is a per-browser-tab dictionary that survives reruns.

```python
# frontend/rerun_demo.py (a throwaway file)
import streamlit as st

clicks = 0  # a normal variable: reset on every rerun
st.session_state.setdefault("clicks", 0)  # survives reruns

if st.button("Click me"):
    clicks += 1
    st.session_state["clicks"] += 1

st.write(f"Local variable: {clicks} · session_state: {st.session_state['clicks']}")
```

Predict the text after three clicks, then run `uv run streamlit run rerun_demo.py`. It shows `Local variable: 1 · session_state: 3`.

One consequence shapes the page. The recipe list is fetched at the top of the script, *before* the form handler further down saves anything. After a write, the page therefore calls `st.rerun()` to fetch fresh data, and it parks the success message in `st.session_state` so the message survives that rerun.

### Forms and keys

`st.form` batches its inputs: typing does not rerun the script; only the submit button does. Every widget and form needs a **unique, stable key**. In a loop over records, derive keys from the record's id (`edit-3-title`), never from the loop position or a fixed string. `clear_on_submit=True` empties the add form after every submit, failed ones included.

### One module owns HTTP

`api.py` holds every call to the backend:

- **Base URL from the environment:** `BACKEND_URL`, default `http://localhost:8000`. Compose will set it to `http://backend:8000` in Lecture 8; no code changes.
- **An explicit timeout:** `httpx.Timeout(10.0, connect=2.0)` gives up connecting after 2 s and waits up to 10 s otherwise. An explicit value is a visible, reviewable decision; `requests` has no default timeout and can wait forever.
- **`raise_for_status()`** turns 4xx and 5xx answers into `httpx.HTTPStatusError`, which the page catches.

The UI never builds URLs or sends requests itself. That pays off in Lecture 5: the error mapping moves out of the page into `api.py`, and `streamlit_app.py` only needs small changes (catch `api.BackendError` instead of httpx errors, add a spinner and an empty state).

### Validation in two places

**Client-side checks** give instant feedback with no round trip: widget bounds (`number_input` from 1 to 1440, `max_chars=200`) and simple required-field checks. Anyone can skip them with `curl`, so the backend's Pydantic validation from [Lecture 2](02-http-fastapi-pydantic.md) stays the authority. When it rejects a body, FastAPI answers 422 with a `detail` list; each item has `loc` (where), `msg` (what) and `type`. Show it in words, for example `Please fix: title: String should have at least 1 character`, never as raw JSON or a traceback.

### Other frameworks, and CORS

React with Vite, or another web framework, is equally acceptable for your product. What changes is where the code runs. JavaScript runs **in the user's browser** and calls the backend directly, so:

- the backend URL must be reachable from the user's machine (for example `http://localhost:8000`), and Vite exposes it to your code as an `import.meta.env.VITE_*` variable at build time;
- the browser enforces **CORS**: the backend must name the frontend's exact origin.

```python
# backend/app/main.py: only if browser JavaScript calls the API
from fastapi.middleware.cors import CORSMiddleware

# after app = FastAPI(...):
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # your dev server's exact origin
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Streamlit's calls are server-side Python, so the Streamlit version needs no CORS settings. Whatever the framework, a CLI alone is not a frontend.

## Live demo

The instructor builds the Recipe Box frontend next to the Lecture 3 backend. From the repository root:

```bash
uv init --app --no-package --python 3.14 frontend
cd frontend
uv add streamlit httpx
uv add --dev ruff
rm main.py
mkdir .streamlit
```

Streamlit settings:

```toml
# frontend/.streamlit/config.toml
[browser]
gatherUsageStats = false  # Streamlit collects usage stats unless you opt out

[server]
headless = true
```

The API client:

```python
# frontend/api.py
"""Every HTTP call to the backend lives here."""

import os

import httpx

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
TIMEOUT = httpx.Timeout(10.0, connect=2.0)


def list_recipes() -> list[dict]:
    r = httpx.get(f"{BACKEND_URL}/recipes", params={"limit": 100}, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


def create_recipe(recipe: dict) -> dict:
    r = httpx.post(f"{BACKEND_URL}/recipes", json=recipe, timeout=TIMEOUT)
    r.raise_for_status()  # 422 -> httpx.HTTPStatusError
    return r.json()


def update_recipe(recipe_id: int, changes: dict) -> dict:
    r = httpx.patch(f"{BACKEND_URL}/recipes/{recipe_id}", json=changes, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


def delete_recipe(recipe_id: int) -> None:
    r = httpx.delete(f"{BACKEND_URL}/recipes/{recipe_id}", timeout=TIMEOUT)
    r.raise_for_status()
```

Try it before any UI exists: `uv run python -c "import api; print(len(api.list_recipes()))"` prints `3` on a freshly seeded backend.

The page, part 1, the helpers:

```python
# frontend/streamlit_app.py (part 1)
import httpx
import streamlit as st

import api

st.set_page_config(page_title="Recipe Box")
st.title("Recipe Box")


def notify(message: str) -> None:
    """Remember a success message, then rerun so lists show fresh data."""
    st.session_state["notice"] = message
    st.rerun()


def show_error(exc: httpx.HTTPStatusError) -> None:
    """Turn the backend's 422 details into words a user can act on."""
    if exc.response.status_code == 422:
        problems = [
            f"{err['loc'][-1]}: {err['msg']}" for err in exc.response.json()["detail"]
        ]
        st.error("Please fix: " + "; ".join(problems))
    else:
        st.error(f"The backend returned {exc.response.status_code}.")
```

Part 2, one form helper for both add and edit. The dictionary keys are the API's field names; the widget keys are built from `key`; `recipe` prefills the inputs when editing; integer bounds and defaults make `number_input` return `int`, not `float`.

```python
# frontend/streamlit_app.py (part 2)
def recipe_fields(key: str, recipe: dict | None = None) -> dict:
    """Draw the recipe inputs (inside a form) and return them as a request body."""
    r = recipe or {}
    return {
        "title": st.text_input(
            "Title", r.get("title", ""), max_chars=200, key=f"{key}-title"
        ),
        "minutes": st.number_input(
            "Minutes", 1, 1440, r.get("minutes", 30), key=f"{key}-minutes"
        ),
        "servings": st.number_input(
            "Servings", 1, 50, r.get("servings", 2), key=f"{key}-servings"
        ),
        "ingredients": st.text_area(
            "Ingredients, one per line",
            r.get("ingredients", ""),
            max_chars=5000,
            key=f"{key}-ingredients",
        ),
        "tags": st.text_input(
            "Tags, comma-separated", r.get("tags", ""), max_chars=500, key=f"{key}-tags"
        ),
    }
```

Part 3, the page itself:

```python
# frontend/streamlit_app.py (part 3)
if notice := st.session_state.pop("notice", None):
    st.success(notice)

recipes = api.list_recipes()  # Lecture 5: what if the backend is down?

browse, add = st.tabs(["Recipes", "Add a recipe"])

with browse:
    for recipe in recipes:
        rid = recipe["id"]
        label = (
            f"{recipe['title']} ({recipe['minutes']} min, serves {recipe['servings']})"
        )
        with st.expander(label), st.form(f"edit-{rid}"):
            changes = recipe_fields(f"edit-{rid}", recipe)
            save_col, delete_col = st.columns(2)
            save = save_col.form_submit_button(
                "Save changes", key=f"save-{rid}", width="stretch"
            )
            delete = delete_col.form_submit_button(
                "Delete", key=f"delete-{rid}", width="stretch"
            )
            try:
                if save:
                    api.update_recipe(rid, changes)
                    notify(f"Saved {changes['title']}.")
                if delete:
                    api.delete_recipe(rid)
                    notify(f"Deleted {recipe['title']}.")
            except httpx.HTTPStatusError as exc:
                show_error(exc)

with add, st.form("add", clear_on_submit=True):
    new_recipe = recipe_fields("add")
    if st.form_submit_button("Add recipe", key="add-submit", width="stretch"):
        try:
            created = api.create_recipe(new_recipe)
        except httpx.HTTPStatusError as exc:
            show_error(exc)
        else:
            notify(f"Added {created['title']}.")
```

Run both services, each in its own terminal:

```bash
cd backend
uv run fastapi dev
```

```bash
cd frontend
uv run streamlit run streamlit_app.py
```

Open `http://localhost:8501`, then show on screen:

1. The three seed recipes as expanders. Edit one, save, reload the page: the change persists.
2. Add a recipe with an empty title: `Please fix: title: String should have at least 1 character`. The backend terminal logs `POST /recipes ... 422`.
3. Add a valid recipe (`201 Created` in the log), then delete it (`204 No Content`).
4. Open the browser's developer tools, Network tab, and reload: there is **no** request to `/recipes`. Ask why before explaining (Quiz Q3).

## Hands-on lab

Build the same four flows for **your own domain**.

1. Create `frontend/` with the commands above, add `.streamlit/config.toml`, and commit `pyproject.toml`, `uv.lock` and `.python-version`.
2. Write `api.py` with list, create, update and delete for your resource. **Checkpoint:** the `uv run python -c "import api; ..."` call prints your seed count.
3. Show the list. Pick a label that identifies each record at a glance.
4. Add the create form with `show_error`. **Checkpoint:** submitting with a required field empty shows a sentence, not JSON or a traceback.
5. Add edit and delete inside each record's form, with keys built from the id. **Checkpoint:** an edit survives a page reload, and a deleted record is gone from `GET` on the backend too.
6. Add one client-side check for a required field of yours, so the request is never sent:

   ```python
   # frontend/streamlit_app.py: the "add" form with a client-side check
   with add, st.form("add", clear_on_submit=True):
       new_recipe = recipe_fields("add")
       submitted = st.form_submit_button(
           "Add recipe",
           key="add-submit",
           width="stretch",
       )
       if submitted and not new_recipe["title"].strip():  # client-side check
           st.warning("Give the recipe a title before saving.")
       elif submitted:
           try:
               created = api.create_recipe(new_recipe)
           except httpx.HTTPStatusError as exc:
               show_error(exc)
           else:
               notify(f"Added {created['title']}.")
   ```

   **Checkpoint:** the warning appears and the backend log shows no new `POST`.
7. Add a "Run the frontend" section to your README: both terminals, the URL, and `BACKEND_URL`.
8. Buddy test on Zoom: share your screen (or give remote control). A classmate directs all four flows in under a minute while you only click what they say. Note where they hesitated.

## Break it on purpose

Make it fail, read the exact message, explain it, fix it. Automated UI tests arrive in Lecture 5 (AppTest); until then, keep each drill as a manual check in your README.

1. **Contract drift.** In `recipe_fields`, rename the `"minutes"` key to `"time"`. Adding a recipe now shows `Please fix: minutes: Field required; time: Extra inputs are not permitted`. Your Lecture 2 `extra="forbid"` rejected the unknown field instead of silently ignoring it, which is why you heard about the typo at once. Fix: use the API's field names from `/docs`. The backend side is already pinned by your Lecture 2 test for unknown fields.
2. **Forget the rerun.** Delete `st.rerun()` from `notify`. Add a recipe: no message appears and the list looks unchanged, yet the backend logged `201 Created`. The list was fetched before the save ran. The message and the new row only appear on the *next* interaction, and a user who thinks the add failed types it in again and creates a duplicate. Fix: restore `st.rerun()`.
3. **Duplicate keys.** Change `st.form(f"edit-{rid}")` to `st.form("edit")`. The page stops with `StreamlitDuplicateElementKey`: "There are multiple elements with the same `key='edit'`. To fix this, please make sure that the `key` argument is unique for each element you create." Fix: build every key from the record id.

Bonus preview: stop the backend and reload the page. You get a traceback ending in `httpx.ConnectError`. Leave it for now; handling it properly is Lecture 5's first job.

## Open-source track

This week you keep PR #1 alive. The etiquette rules are in the README's [contribution etiquette](../README.md#contribution-etiquette).

```bash
gh pr checks 456 --repo OWNER/REPO
gh pr view 456 --repo OWNER/REPO --comments
gh search prs --author=@me --state=open
```

- **CI is red?** Read the failing job, reproduce it locally, fix it on the **same branch** and push; the PR updates itself. Never open a second PR for one change.
- **A review arrived?** Reply in your own words: thank the reviewer, answer every point, say what changed in which commit, ask when unclear. If you disagree, explain once with evidence, then accept the maintainers' decision.
- **Silence?** Wait at least a week (or what CONTRIBUTING says), then post one polite follow-up. Meanwhile, start scouting the issue for PR #2, which should be opened by [Lecture 6](06-pydantic-ai-agents.md).

## Working with AI assistants

- **Generate from the contract, not from memory.** Paste `api.py` and your backend's schema (`curl -s localhost:8000/openapi.json`) and state the rules: all HTTP in `api.py`, `st.form` with keys from ids, `width="stretch"`, 422 details in words. Verify by clicking every flow yourself, then run `grep -nE "sqlmodel|sqlite|use_container_width|experimental_" *.py` in `frontend/`: it must print nothing.
- **Explain before fixing.** When the list does not refresh, ask the assistant to explain the cause in terms of the rerun model, and check the explanation against Streamlit's [main concepts](https://docs.streamlit.io/get-started/fundamentals/main-concepts) before accepting a fix.

**Spot the outdated suggestion:**

- `st.experimental_rerun()`: removed. Streamlit 1.66 raises `st.experimental_rerun has been removed. Use st.rerun instead.`
- `use_container_width=True`: deprecated; use `width="stretch"`.
- `requests.get(url)` with no timeout: one slow backend freezes the page.
- A frontend that opens the SQLite file or a SQLModel session: it bypasses the backend, which the product rules forbid.
- "Add `CORSMiddleware` so Streamlit can reach the API": not needed for server-side calls.

## Completion check

With both terminals running, open `http://localhost:8501`:

- [ ] The list shows your seed rows.
- [ ] Adding a record shows a success message, and the record appears at once.
- [ ] An edit persists after a page reload; a delete removes the record from the backend too.
- [ ] An invalid or empty required field produces a readable sentence, never raw JSON or a traceback.
- [ ] The backend terminal shows `POST`, `PATCH` and `DELETE` lines answered with 201, 200 and 204.
- [ ] `grep -nE "sqlmodel|sqlite" *.py` in `frontend/` prints nothing.
- [ ] EX1 is submitted through the submission channel provided by the instructor.

## Quick quiz

<details markdown="1">
<summary>Q1. You click "Add recipe". Which code runs, and why does the page call st.rerun() after saving?</summary>

The whole script runs from the top, so `api.list_recipes()` executes *before* the form handler saves. `st.rerun()` starts a fresh run that fetches the updated list; the message survives because it waits in `st.session_state`.

</details>

<details markdown="1">
<summary>Q2. (Lecture 2) The form sends {"title": "Soup", "time": 30}. What does the backend answer?</summary>

**422.** `RecipeCreate` uses `extra="forbid"`, so `time` is rejected as an extra input, and the required `minutes` is missing. Both errors arrive in the `detail` list.

</details>

<details markdown="1">
<summary>Q3. The browser's Network tab shows no request to /recipes. Is the frontend broken?</summary>

No. In Streamlit, `api.py` runs on the Streamlit server, which calls the backend; the browser only talks to Streamlit over a websocket. Look for the requests in the backend's terminal log instead.

</details>

<details markdown="1">
<summary>Q4. Does the backend need CORSMiddleware for the Streamlit frontend? For a React frontend?</summary>

Streamlit: no, because CORS is enforced by browsers and the calls come from server-side Python. React: yes, because its JavaScript calls the API from the browser, so the backend must allow the frontend's exact origin.

</details>

<details markdown="1">
<summary>Q5. (Lecture 3) You restart the Streamlit server. What happens to the recipes, and to st.session_state?</summary>

The recipes are safe in the backend's SQLite file. `st.session_state` is lost: it lives in the Streamlit server's memory, per browser session. Nothing important may live only in the frontend.

</details>

## Stretch goals

Optional, once the four flows work.

- **Keep the user's input when a save fails.** With `clear_on_submit=True`, a failed submit empties the form. Drop it, build the add form's widget keys from a counter in `st.session_state` (`f"add-{version}"`), and increase the counter after a successful save so Streamlit draws fresh, empty widgets. Check it in a real browser: AppTest does not reproduce `clear_on_submit`.
- **Two UIs, one API.** Build a minimal React and Vite page that lists the same records, with the CORS setting above. Create in one UI and watch it appear in the other.
- **Search that scales.** Add a `q` query parameter to the backend's list endpoint, with a test, and a search box that sends it. Filtering only in the frontend breaks once pagination kicks in.

## Common pitfalls

- The page shows a traceback ending in `httpx.ConnectError` (`Connection refused`) → the backend is not running, or `BACKEND_URL` points elsewhere → start it, check the variable. Lecture 5 replaces the traceback with a message.
- The list does not update after a submit → no `st.rerun()` after the write → call `notify()`.
- `There are multiple elements with the same key` → keys built from a fixed string or the loop index → use the record id.
- `AttributeError: module 'streamlit' has no attribute 'experimental_rerun'` → outdated code → `st.rerun()`.
- 422 shows up as a JSON blob → the error was displayed raw → format `detail` as in `show_error`.
- A CORS error in the browser console (React or Vite only) → origin not allowed → add your exact dev origin to `CORSMiddleware`; never `"*"` with credentials.
- Your changes never appear → an old Streamlit still holds 8501, so the new one quietly moved to the next free port (its terminal prints `Local URL: http://localhost:8502`) → stop the old process, or open the URL the terminal prints.

## Instructor notes

Suggested flow:

1. EX1 check-in: collect blockers (restart test, Dockerfile) for after class.
2. Draw the architecture: "Which process sends the HTTP request to the backend?"
3. Scaffold `frontend/` (first Live demo block), then run `rerun_demo.py` as predict-then-run; it unlocks everything else.
4. Build `api.py` live and call it from the terminal before any UI exists.
5. Build the page in three passes: list, add with the 422 message, then edit and delete.
6. Run the three drills; let students call out the fix before you type it.
7. Lab: students build the four flows for their own domain; end with the Zoom buddy test.
8. React and CORS in five sentences; show the middleware only if students plan a JavaScript frontend.
9. Open source: read one real review comment aloud, outline a reply together; the student writes the actual reply.
10. Quiz Q1–Q5 as the exit check; Q3 needs the Network-tab demo.

Emphasize: the frontend talks only to the API, the whole script reruns, keys are unique and stable. Students get stuck on field names drifting from the backend, keys inside loops, a backend that is not running (or on another port), and success messages that vanish without `st.session_state`.

## Read more

- [Streamlit: main concepts](https://docs.streamlit.io/get-started/fundamentals/main-concepts)
- [Streamlit: session state](https://docs.streamlit.io/develop/concepts/architecture/session-state)
- [Streamlit: using forms](https://docs.streamlit.io/develop/concepts/architecture/forms)
- [HTTPX: timeouts](https://www.python-httpx.org/advanced/timeouts/)
- [FastAPI: CORS](https://fastapi.tiangolo.com/tutorial/cors/)

---

[← Course home](../README.md) · [← Previous: Lecture 3](03-persistence-and-first-pr.md) · [Next: Lecture 5 →](05-frontend-reliability-testing.md)

<!-- {% endraw %} -->
