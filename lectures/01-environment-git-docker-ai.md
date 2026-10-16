# Lecture 1 · Environment, Git, Docker and AI-assisted coding

<!-- {% raw %} -->
[← Course home](../README.md) · [Next: Lecture 2 →](02-http-fastapi-pydantic.md)

**Date:** Monday 19 October 2026, 18:00 Israel time (after HIT's opening-event break), on Zoom ([calendar notes](../README.md#calendar-and-13-meeting-schedule)) · **You leave with:** a working environment, a one-page product sketch, and 2–3 open-source candidates you checked yourself

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

Today you build the workbench for the whole semester: a tiny FastAPI app on your laptop, a container running Python 3.14, a one-page product idea, and 2–3 checked open-source projects. The win you can show: `curl http://localhost:8000/health` prints `{"status":"ok"}` from code you committed and pushed.

## Before you start

- Python basics, a terminal, a GitHub account, and admin rights.
- **Windows:** use WSL2 (Ubuntu). Every command on these pages runs *inside* Ubuntu, not PowerShell.
- **The night before:** run the version commands from demo step 1. If one fails, ask for help with the [PARD template](#asking-for-help-the-pard-template).

## Concepts

### Your toolchain

| Tool | What it does for you | Check |
|---|---|---|
| WSL2 (Windows) | A real Ubuntu inside Windows | `wsl --status` in PowerShell |
| uv | Installs Python, manages environments and dependencies | `uv --version` |
| Git and gh | Version history; the GitHub CLI for repos and PRs | `gh --version` |
| Docker and Compose v2 | Runs software in isolated containers | `docker compose version` |
| Editor | VS Code or any editor with Python support | `code --version` |

### uv: one tool for Python and dependencies

- `pyproject.toml` is the **recipe card**: "this project needs FastAPI".
- `uv.lock` is the **receipt**: the exact version of every installed package. Commit it, so graders get what you tested.
- `.python-version` pins Python (`3.14`), and uv downloads it for you.
- `.venv/` is the **kitchen**: disposable, git-ignored, rebuilt from the lockfile.

The habit: run everything through `uv run …`. It syncs the environment first, so you never activate a virtualenv or `pip install` into system Python.

### Git and GitHub: commits, branches, pull requests

A **commit** is a snapshot plus a message saying why. A **branch** is a movable label on a line of commits; `main` must always work. **Push** uploads commits to GitHub. A **pull request (PR)** asks to merge one branch into another and shows the diff for review. You use PRs on your own repo and upstream, meaning in the original open-source projects you contribute to. The habit for both: **read `git diff --staged` before every commit**, especially when an AI assistant wrote the change.

### Docker: images and containers

- An **image** is a frozen filesystem plus a default command, such as "Debian + Python 3.14". Think of it as a class.
- A **container** is a running instance of an image, like an object. It is a process with its own filesystem and network. Deleting it leaves the image untouched.
- **Port mapping** `-p 8080:8000` forwards *host* port 8080 to *container* port 8000. It works like a phone extension: callers dial the building (8080), and reception forwards them to extension 8000.

```text
your laptop                                  container
curl localhost:8080  -->  -p 8080:8000  -->  python -m http.server 8000
```

### AI-assisted coding: brief, diff, verify, note

AI tools are allowed from week 1 ([rules](../README.md#working-method-ai-use-assessment-and-reproducibility)). The bottleneck has moved from writing code to verifying it: treat AI output like a PR from a stranger.

1. **Brief.** Write five lines before you ask:

   ```text
   Intent:       add GET /health that returns {"status": "ok"}
   Files:        backend/app/main.py only
   Non-goals:    no database, no new dependencies
   Verify with:  uv run fastapi dev, then curl http://localhost:8000/health
   Review focus: the path is /health (not /healthz); return type annotated
   ```

2. **Small diff.** One change at a time. Reject a diff that touches files outside "Files".
3. **Verify.** Run it, read `git diff --staged`, and check unfamiliar calls in the official docs. From Lecture 2 on, also break the code and confirm that a test goes red.
4. **Note.** Keep a short AI-use note in your product README: tools used, help received, checks you ran.

Optional: FastAPI, Streamlit and Pydantic AI ship agent "skills" inside their packages. In a service folder, `uvx library-skills scan` lists them, and `uvx library-skills --claude` links them for your agent ([library-skills.io](https://library-skills.io/)).

### Product scoping: one narrow domain, three services

You grow one product all semester ([requirements](../README.md#three-service-product-requirements)). Narrow beats ambitious: "save and adapt recipes" is buildable; "a food platform" is not. The demo product is **Recipe Box**, and you pick your own domain. A good sketch answers:

1. **Who uses it, and for what?** Three user stories: "As a *user*, I can *action* so that *benefit*."
2. **What data does it keep?** One main record, 4–6 fields, each with a type and a limit.
3. **What does the AI service do?** One job with a structured output, such as messy text in and a record out.
4. **How does data flow?**

```text
browser
  -> frontend    (Streamlit or React)      :8501
  -> backend     (FastAPI)                 :8000  -> SQLite (only the backend)
  -> ai-service  (FastAPI + Pydantic AI)   :8001  (called only by the backend)
```

### Asking for help: the PARD template

Send all four parts to whoever you ask, human or AI. It is also the skeleton of a good upstream bug report.

```text
Problem:   one sentence
Action(s): the exact commands you ran
Result:    the full output, pasted as text (not a screenshot)
Desired:   what you expected
```

### Open source: choose before you code

You need three PRs **merged** into qualifying projects ([rules](../README.md#open-source-contribution-rule-and-evidence); three per student). Reviews take weeks, and some projects restrict outside or AI-assisted PRs: as of October 2026, Streamlit's CONTRIBUTING says it has paused pull requests from outside its maintainer team. So you check projects before writing code for them.

## Live demo

**1. Check the tools** (macOS, Linux, WSL):

```bash
uv --version
git --version
gh --version
docker --version
docker compose version
```

**2. Create the repo and the backend.** Run `git init` first: `uv init` outside a Git repo creates a nested `backend/.git`.

```bash
mkdir recipe-box
cd recipe-box
git init
uv init --app --no-package --python 3.14 backend
cd backend
uv add "fastapi[standard]"
mkdir app
touch app/__init__.py
rm main.py
```

`--no-package` keeps the flat `app/` layout used all semester. Without it, uv 0.13 creates a packaged `src/` layout.

```python
# backend/app/main.py
from fastapi import FastAPI

app = FastAPI(title="Recipe Box API")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
```

Append to `backend/pyproject.toml`, so `fastapi dev` finds the app:

```toml
[tool.fastapi]
entrypoint = "app.main:app"
```

Run it from `backend/`; in a second terminal, call it. Also open <http://localhost:8000/docs>.

```bash
uv run fastapi dev
curl http://localhost:8000/health
```

**3. Commit, push, and practice a PR.** Create `.gitignore` at the repo root:

```text
.env
.venv/
__pycache__/
.pytest_cache/
.ruff_cache/
data/
*.db
```

```bash
git add .
git diff --staged --stat
git commit -m "Add backend skeleton with /health"
gh repo create recipe-box --private --source=. --remote=origin --push
git switch -c add-product-sketch
```

Write the product sketch in `README.md` (template in the lab), then:

```bash
git add README.md
git commit -m "Add product sketch"
git push -u origin add-product-sketch
gh pr create --fill
gh pr merge --squash --delete-branch
```

`--public` works too; how graders get access is part of the submission instructions provided by the instructor. A PR on your own repo never counts toward the three upstream PRs.

**4. Docker in four commands.**

```bash
docker run --rm hello-world
docker run --rm python:3.14-slim python -c "import sys; print(sys.version)"
docker run -d --rm --name hello -p 8080:8000 python:3.14-slim python -m http.server 8000
docker stop hello
```

Line 2 prints `3.14.8 …` even without Python 3.14 on your laptop. While `hello` runs, <http://localhost:8080> shows a directory listing served from inside the container, and `docker ps` lists it; `docker stop` plus `--rm` deletes it. Pin `python:3.14-slim`: `python:3-slim` now means Python 3.15.

**5. Check an open-source candidate.** FastAPI is used only to show the commands; it is not a recommendation.

```bash
gh repo view fastapi/fastapi \
  --json nameWithOwner,stargazerCount,licenseInfo,isFork,isArchived,pushedAt
gh api repos/fastapi/fastapi/community/profile --jq '.files.contributing.html_url'
gh pr list -R fastapi/fastapi --state merged --limit 10
```

On 16 October 2026 the first reported 103,128 stars, MIT, `isFork: false`, and a push the day before. The second command shows that FastAPI's CONTRIBUTING lives in the organization's `.github` repo: never assume it sits at the root.

## Hands-on lab

Do every step for **your own** domain.

1. **Install.**
   - **Windows:** in an admin PowerShell run `wsl --install`, reboot, and create your Ubuntu user. In Docker Desktop, enable WSL integration for Ubuntu (Settings → Resources). Keep code under `~` in Ubuntu, never `/mnt/c`. Open projects with `code .` from Ubuntu (VS Code's WSL extension).
   - **macOS:** Docker Desktop, an editor, and `brew install uv gh` (or the official installers).
   - **Linux:** Docker Engine and the Compose plugin, from [Docker's docs](https://docs.docker.com/engine/install/).
   - **Everyone** (skip the first line if you used Homebrew; on Ubuntu, install gh with the [apt steps](https://github.com/cli/cli/blob/trunk/docs/install_linux.md)):

     ```bash
     curl -LsSf https://astral.sh/uv/install.sh | sh
     uv python install 3.14
     git config --global user.name "Your Name"
     git config --global user.email "you@example.com"
     git config --global init.defaultBranch main
     gh auth login
     gh auth setup-git
     ```

   **Checkpoint:** demo step 1 prints five versions, with uv 0.13 or newer (else run `uv self update` or `brew upgrade uv`).

2. **Create your repo and `/health`** with demo step 2, named after your product (for example `study-planner`). **Checkpoint:** the curl prints `{"status":"ok"}`, and `/docs` opens.

3. **Publish, branch, then write your product sketch.** Run demo step 3 up to `git switch -c add-product-sketch` (with your product's name in `gh repo create`), then write the sketch in `README.md` on that branch:

   ```markdown
   # <Product name>
   One sentence: who it is for and what problem it solves.

   ## User stories
   1. As a <user>, I can <action> so that <benefit>.

   ## Data sketch
   <Record>: field (type, limits), ...

   ## The AI service
   Input: ... Structured output: ...

   ## Data flow
   browser -> frontend -> backend -> ai-service (only the backend touches the database)

   ## Open-source shortlist
   | Repository | Stars (date checked) | License | Why it fits me |
   |---|---|---|---|
   ```

   Recipe Box: save a recipe; browse, edit or delete; paste messy text and get a structured recipe saved. Record: `title` (1–200 chars), `minutes` (1–1440), `servings` (1–50, default 2), `ingredients`, `tags`. **Checkpoint:** a classmate reads it in two minutes and can say what the AI service does.

4. **Merge the sketch through a PR** with the rest of demo step 3. **Checkpoint:** `gh pr list --state merged` shows your PR.

5. **Docker missions.** Run demo step 4, then `docker images` and `docker ps -a`. Tell a buddy which lines are images and which are containers. **Checkpoint:** you can say why `hello` is gone after `docker stop`.

6. **Open-source shortlist.** Pick 2–3 projects you use or care about and work through the [open-source track](#open-source-track). **Checkpoint:** each table row has a dated star count, a license, and the CONTRIBUTING link you read.

## Break it on purpose

Make it fail, read the exact error, fix it, and note the fix in your README.

1. **Wrong folder.** From the repo root, run `uv run fastapi dev`. You get `error: Failed to spawn: fastapi`, because there is no uv project at the root. Fix: `cd backend`.
2. **Port collision.** Start a second `uv run fastapi dev` while one runs. You get `ERROR: [Errno 98] Address already in use` (Errno 48 on macOS). Find the owner with `lsof -i :8000` and stop it, or use `uv run fastapi dev --port 8002`.
3. **The container is not your laptop.** Run `docker run --rm python:3.14-slim python -c "import fastapi"`. You get `ModuleNotFoundError: No module named 'fastapi'`: FastAPI lives in your `.venv`, not in the image. Lecture 3 builds an image that installs your dependencies.

## Open-source track

This week: **choose 2–3 candidates and verify each one yourself.** The course publishes no eligible list ([qualifying rules](../README.md#qualifying-repositories)). For each candidate:

- [ ] **Official upstream:** `isFork: false`, and the project's website links here. Use the `nameWithOwner` gh prints (renamed repos redirect).
- [ ] **More than 10,000 stars:** record `stargazerCount` *and the date*. Your evidence table needs both.
- [ ] **Open-source license:** save the license file's URL.
- [ ] **Maintainers merge outside work:** recent merges, some by authors labeled `CONTRIBUTOR` or `FIRST_TIME_CONTRIBUTOR` (`MEMBER` means the team):

  ```bash
  gh api "repos/OWNER/REPO/pulls?state=closed&per_page=100" \
    --jq '.[] | select(.merged_at) | [.author_association, .user.login] | @tsv' \
    | grep -v "\[bot\]" | sort | uniq -c
  ```

- [ ] **CONTRIBUTING read in full, including any AI policy.** Some ban autonomous agents, require human-written PR text, or want an issue first. Numbers are signals; CONTRIBUTING is the rule.
- [ ] **Tests run locally.** Follow CONTRIBUTING. For a uv-based Python project it often looks like this:

  ```bash
  gh repo clone OWNER/REPO -- --depth 1
  cd REPO
  uv sync
  uv run pytest tests/some_small_folder
  ```

  (Verified on FastAPI, 16 October 2026, with `PYTHONPATH=./docs_src` as its `scripts/test.sh` sets.)

Next week you look for a real issue or documentation gap in your best candidate.

## Working with AI assistants

1. **Explain an error.** Paste a PARD, then add: "Explain the cause in two sentences and give the smallest fix. Don't touch unrelated files."
2. **Predict, then run.** "Explain each flag of `docker run -d --rm -p 8080:8000 python:3.14-slim`, without showing output." Predict, then run it.
3. **Scope review.** "Here is my product sketch. Which user story is too big for ten weeks? Suggest a narrower one."

Verify by running it and checking flags in the official docs. **Spot the outdated suggestion:**

- `pip install fastapi uvicorn` with a `requirements.txt`, where the course uses `uv add` and commits `uv.lock`;
- `uv init --app backend` without `--no-package`, which creates a `src/` layout;
- `FROM python:3-slim`, which is now Python 3.15;
- `docker-compose` with a dash, where Compose v2 is `docker compose`.

## Completion check

```bash
uv run python --version
git pull
git log --oneline
gh pr list --state merged
docker run --rm python:3.14-slim python -c "print('container ok')"
curl http://localhost:8000/health
```

Expected, inside `backend/` on `main` with `uv run fastapi dev` running in a second terminal: `Python 3.14.x`; two or more commits; one merged PR; `container ok`; `{"status":"ok"}`.

- [ ] Repo on GitHub with `backend/` (`pyproject.toml`, `uv.lock`, `.python-version`, `app/main.py`) and a `.gitignore` that excludes `.venv/` and `.env`.
- [ ] README with 3 user stories, a data sketch, the AI service's job, and the data flow.
- [ ] Shortlist of 2–3 verified candidates with dated star counts.

## Quick quiz

<details markdown="1">
<summary>Q1. You stop a container started with <code>--rm</code>. What happens to the <code>python:3.14-slim</code> image? (a) It is deleted too (b) It stays for the next run (c) It is reset to defaults</summary>

**(b).** `--rm` deletes the *container*. The image is the template; it stays in `docker images` and can start many more containers.

</details>

<details markdown="1">
<summary>Q2. In -p 8080:8000, which port does your browser use? (a) 8000, the container port (b) Whichever is free (c) 8080, the host port</summary>

**(c).** The format is `HOST:CONTAINER`. The browser talks to the host on 8080, and Docker forwards that to 8000 inside the container, where nothing listens on 8080.

</details>

<details markdown="1">
<summary>Q3. Which file must you commit so graders get exactly the versions you tested? (a) uv.lock (b) .venv/ (c) README.md</summary>

**(a).** `pyproject.toml` states ranges such as `fastapi[standard]>=0.143.2`; `uv.lock` records the exact resolved versions. `.venv/` is machine-specific build output, so it is git-ignored.

</details>

<details markdown="1">
<summary>Q4. A project has exactly 10,000 stars and a friendly CONTRIBUTING. Does a merged PR there count? (a) Yes (b) No (c) Only with approval</summary>

**(b).** The rule is *more than* 10,000 stars, so exactly 10,000 is not enough ([qualifying rules](../README.md#qualifying-repositories)).

</details>

<details markdown="1">
<summary>Q5. An assistant's change works when you run it, but you haven't read the diff. What is missing? (a) Nothing, it works (b) Reading <code>git diff --staged</code> (c) A second AI opinion</summary>

**(b).** Running it proves one path works, not that the change stayed in scope. You must be able to explain every line you submit.

</details>

## Stretch goals

Optional:

- Explore a container: `docker run --rm -it python:3.14-slim bash`, then `whoami` and `cat /etc/os-release`. You are `root` inside, and slim images have no `curl`.
- Try the next Python without touching your project: `uv run --no-project --python 3.15 python --version`.

## Common pitfalls

- **`uv: command not found`** after installing → the shell hasn't reloaded `PATH` → open a new terminal or run `exec "$SHELL" -l`.
- **`Cannot connect to the Docker daemon`** → Docker Desktop is stopped, or WSL integration is off → start it, enable Ubuntu integration, run `docker ps`.
- **WSL is very slow** → the project lives under `/mnt/c/...` → move it under `~`.
- **"Please tell me who you are"** on commit → no Git identity → run the two `git config --global` lines.
- **Push asks for a password** → Git isn't using your GitHub login → `gh auth login`, then `gh auth setup-git`. Never paste a password or token into a chat or a file.
- **`backend/.git` appeared** → `uv init` ran before `git init` → delete `backend/.git`, run `git init` at the root.

## Instructor notes

Today's meeting starts at 18:00, after HIT's 17:00–18:00 opening-event break ([calendar notes](../README.md#calendar-and-13-meeting-schedule)).

Suggested flow:

1. Introductions: name plus one thing you'd like to build.
2. Mission and the three-service picture (link the README rules; don't read them out).
3. Version check; collect failures as PARD posts and fix them during the lab.
4. Demo step 2 with a student narrating each command before you run it.
5. Docker demo: students predict which port to open before you start `hello`.
6. AI workflow: write the brief live, let an assistant make the change, review the diff out loud.
7. Scoping in pairs: each partner reads the other's sketch and names its riskiest story.
8. Open-source checklist live on one repo; students check their own candidates.
9. Exit ticket: one thing learned, one thing confusing, your first open-source candidate.

Emphasize `git init` before `uv init`, `--no-package`, WSL, and that *merged* is what counts upstream. Students get stuck on Docker's WSL integration, `PATH` after installing uv, the wrong folder, and domains that are too broad: push for one record type and one AI job.

## Read more

- [uv: installation](https://docs.astral.sh/uv/getting-started/installation/) and [working on projects](https://docs.astral.sh/uv/guides/projects/)
- [Install WSL](https://learn.microsoft.com/en-us/windows/wsl/install) and [Docker Desktop's WSL 2 backend](https://docs.docker.com/desktop/features/wsl/)
- [Docker: what is a container?](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-a-container/) and [publishing ports](https://docs.docker.com/get-started/docker-concepts/running-containers/publishing-ports/)
- [GitHub CLI manual](https://cli.github.com/manual/) and [Contributing to a project](https://docs.github.com/en/get-started/exploring-projects-on-github/contributing-to-a-project)
- [FastAPI: first steps](https://fastapi.tiangolo.com/tutorial/first-steps/)

---

[← Course home](../README.md) · [Next: Lecture 2 →](02-http-fastapi-pydantic.md)

<!-- {% endraw %} -->
