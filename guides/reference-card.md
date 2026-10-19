# Reference card: commands, ports, status codes and terms

<!-- {% raw %} -->

[Course home](../README.md) · [Learning map](learning-map.md) · [Glossary](engineering-foundations.md#glossary) · [Submission evidence](submission-evidence.md)

**Look it up here; learn it where it is taught.** Each row restates one line from a lecture or guide and links to it, so open the link whenever a row is not enough. This card adds no rule, command or date of its own: the [course guide](../README.md) remains the authority for requirements and [deadlines](../README.md#assignments-and-deadlines).

<details markdown="1" class="lecture-toc">
<summary>On this page</summary>

- [Product map and ports](#product-map-and-ports)
- [Commands by task](#commands-by-task)
- [Status codes in this course](#status-codes-in-this-course)
- [When you are behind](#when-you-are-behind)
- [Ask for help with PARD](#ask-for-help-with-pard)
- [The open-source rule](#the-open-source-rule)
- [Terms](#terms)

</details>

## Product map and ports

Your product has three application services. Requests go from the browser to the frontend, to the backend, to the AI service; only the backend touches the database ([product requirements](../README.md#three-service-product-requirements)).

| Service | Built with | Port | Calls | Taught in |
|---|---|---|---|---|
| Frontend | Streamlit, React or another web framework | 8501 | the backend only | [Lecture 4](../lectures/04-browser-frontend.md#where-the-frontend-sits) |
| Backend | FastAPI and Pydantic | 8000 | the database, and the AI service over HTTP | [Lecture 2](../lectures/02-http-fastapi-pydantic.md#live-demo) · [Lecture 7](../lectures/07-third-service-contracts.md#http-contracts) |
| AI service | FastAPI and Pydantic AI | 8001 | a model, through its provider (`TestModel` in tests) | [Lecture 6](../lectures/06-pydantic-ai-agents.md#why-a-separate-service) |
| Database | a SQLite file on a Docker volume (PostgreSQL is allowed) | none | nothing: only the backend opens it | [Lecture 3](../lectures/03-persistence-and-first-pr.md#where-data-lives) |

Every container has its own `localhost`, so the right address depends on where the caller runs:

| Caller | Reaches | Address | Taught in |
|---|---|---|---|
| Your browser | the frontend | `http://localhost:8501` | [Lecture 4](../lectures/04-browser-frontend.md#live-demo) |
| Your terminal (`curl`, `/docs`) | the backend | `http://localhost:8000` | [Lecture 2](../lectures/02-http-fastapi-pydantic.md#live-demo) |
| The backend, run by hand | the AI service | `http://localhost:8001` | [Lecture 7](../lectures/07-third-service-contracts.md#live-demo) |
| The frontend, under Compose | the backend | `http://backend:8000` | [Lecture 8](../lectures/08-docker-compose.md#networking-where-is-localhost) |
| The backend, under Compose | the AI service | `http://ai-service:8001` | [Lecture 8](../lectures/08-docker-compose.md#networking-where-is-localhost) |
| Your laptop, under Compose | the AI service | nothing: the AI service has no `ports:` | [Lecture 8](../lectures/08-docker-compose.md#networking-where-is-localhost) |

## Commands by task

Run each `uv` command from the service's own folder: `uv run` uses the nearest `pyproject.toml`, so the folder decides the project ([Lecture 1](../lectures/01-environment-git-docker-ai.md#uv-one-tool-for-python-and-dependencies)).

### Run and test one service

| Task | Command | Run it from | Taught in |
|---|---|---|---|
| Start the backend | `uv run fastapi dev` | `backend/` | [Lecture 2](../lectures/02-http-fastapi-pydantic.md#live-demo) |
| Start the AI service | `uv run fastapi dev --port 8001` | `ai-service/` | [Lecture 7](../lectures/07-third-service-contracts.md#live-demo) |
| Start the frontend | `uv run streamlit run streamlit_app.py` | `frontend/` | [Lecture 4](../lectures/04-browser-frontend.md#live-demo) |
| Check that the backend answers | `curl http://localhost:8000/health` | any folder; expect `{"status":"ok"}` | [Lecture 1](../lectures/01-environment-git-docker-ai.md#completion-check) |
| Run the service's tests | `uv run pytest` | the service's folder | [Lecture 2](../lectures/02-http-fastapi-pydantic.md#completion-check) |
| Run the browser test | `uv run pytest e2e --base-url http://localhost:8501` | `frontend/`, with the backend and frontend running | [Lecture 5](../lectures/05-frontend-reliability-testing.md#live-demo) |
| Lint, then check formatting | `uv run ruff check .`, then `uv run ruff format --check .` | the service's folder | [Lecture 2](../lectures/02-http-fastapi-pydantic.md#completion-check) |
| Fix formatting | `uv run ruff format .` | the service's folder | [Lecture 4](../lectures/04-browser-frontend.md#completion-check) |
| Add a package (test tools with `--dev`) | `uv add "fastapi[standard]"`, `uv add --dev pytest` | the service's folder | [Lecture 1](../lectures/01-environment-git-docker-ai.md#live-demo) · [Lecture 2](../lectures/02-http-fastapi-pydantic.md#live-demo) |

### Run the whole stack

Run every `docker compose` command from the repository root, where `compose.yaml` lives.

| Task | Command | Taught in |
|---|---|---|
| Build, start everything and stream the logs (Ctrl+C stops) | `docker compose up --build` | [Lecture 8](../lectures/08-docker-compose.md#commands-you-will-use-every-day) |
| Start in the background and wait until every service is healthy | `docker compose up --build --wait` | [Lecture 8](../lectures/08-docker-compose.md#commands-you-will-use-every-day) |
| See each service's health and ports | `docker compose ps` | [Lecture 8](../lectures/08-docker-compose.md#commands-you-will-use-every-day) |
| Follow one service's logs | `docker compose logs -f backend` | [Lecture 8](../lectures/08-docker-compose.md#commands-you-will-use-every-day) |
| Open a shell inside a running container | `docker compose exec backend sh` | [Lecture 8](../lectures/08-docker-compose.md#commands-you-will-use-every-day) |
| Stop one service (`start` brings it back) | `docker compose stop ai-service` | [Lecture 8](../lectures/08-docker-compose.md#commands-you-will-use-every-day) |
| Remove the containers and the network, and keep your data | `docker compose down` | [Lecture 8](../lectures/08-docker-compose.md#commands-you-will-use-every-day) |
| Also delete the volumes, including your data | `docker compose down -v` | [Lecture 8](../lectures/08-docker-compose.md#commands-you-will-use-every-day) |
| Validate the file without printing it | `docker compose config --quiet` | [Lecture 8](../lectures/08-docker-compose.md#commands-you-will-use-every-day) |

### Git every day

The habit: read `git diff --staged` before every commit, especially when an assistant wrote the change.

| Task | Command | Taught in |
|---|---|---|
| See which files changed and where each change lives | `git status` | [Lecture 1](../lectures/01-environment-git-docker-ai.md#git-and-github-commits-branches-pull-requests) |
| See edits you have not staged yet | `git diff` | [Lecture 1](../lectures/01-environment-git-docker-ai.md#git-and-github-commits-branches-pull-requests) |
| See exactly what the next commit records | `git diff --staged` | [Lecture 1](../lectures/01-environment-git-docker-ai.md#git-and-github-commits-branches-pull-requests) |
| Stage a file | `git add <file>` | [Lecture 1](../lectures/01-environment-git-docker-ai.md#git-and-github-commits-branches-pull-requests) |
| Commit what you staged, with a message saying why | `git commit -m "Add product sketch"` | [Lecture 1](../lectures/01-environment-git-docker-ai.md#live-demo) |
| Start a branch | `git switch -c add-product-sketch` | [Lecture 1](../lectures/01-environment-git-docker-ai.md#live-demo) |
| Push a new branch to GitHub | `git push -u origin add-product-sketch` | [Lecture 1](../lectures/01-environment-git-docker-ai.md#live-demo) |
| Open a PR on your own repository | `gh pr create --fill` | [Lecture 1](../lectures/01-environment-git-docker-ai.md#live-demo) |
| Merge it as one commit and delete the branch | `gh pr merge --squash --delete-branch` | [Lecture 1](../lectures/01-environment-git-docker-ai.md#live-demo) |
| Bring the merge to your laptop | `git switch main`, then `git pull` | [Lecture 1](../lectures/01-environment-git-docker-ai.md#live-demo) |
| List your local commits | `git log --oneline` | [Lecture 1](../lectures/01-environment-git-docker-ai.md#git-and-github-commits-branches-pull-requests) |
| List the PRs merged on GitHub | `gh pr list --state merged` | [Lecture 1](../lectures/01-environment-git-docker-ai.md#git-and-github-commits-branches-pull-requests) |

### Undo a Git mistake

Pick the undo by where the mistake lives.

| I want to | Safe command | Careful | Taught in |
|---|---|---|---|
| Throw away an edit I have not staged | `git restore <file>` | the edit is gone for good: Git never stored it | [Undo&nbsp;safely](engineering-foundations.md#undo-safely) |
| Unstage a file but keep the edit | `git restore --staged <file>` | nothing is lost | [Undo&nbsp;safely](engineering-foundations.md#undo-safely) |
| Fix the last commit's message before pushing | `git commit --amend -m "Better message"` | do not amend commits you already pushed | [Undo&nbsp;safely](engineering-foundations.md#undo-safely) |
| Undo a commit that is already pushed | `git revert <sha>` | safe on shared branches: a new commit reverses the old one | [Undo&nbsp;safely](engineering-foundations.md#undo-safely) |
| Abandon an experiment branch | `git switch main`, then `git branch -D try-x` | unmerged work disappears from view | [Undo&nbsp;safely](engineering-foundations.md#undo-safely) |
| Get out of a merge I do not understand | `git merge --abort` | works only while the merge is unfinished | [Undo&nbsp;safely](engineering-foundations.md#undo-safely) |

**Watch out:** never rewrite pushed `main`. If a bad commit reached GitHub, `git revert` it and push the new commit.

### Pull requests and evidence with gh

| Task | Command | Taught in |
|---|---|---|
| Check your product repository's owner | `gh repo view --json nameWithOwner,url` | [Lecture 1](../lectures/01-environment-git-docker-ai.md#live-demo) |
| Save a candidate's stars, license and fork status on the day you open the PR | `gh repo view OWNER/REPO --json stargazerCount,licenseInfo,pushedAt,isFork` | [Lecture 3](../lectures/03-persistence-and-first-pr.md#open-source-track) |
| Fork the project and clone your fork | `gh repo fork OWNER/REPO --clone` | [Lecture 3](../lectures/03-persistence-and-first-pr.md#open-source-track) |
| Open the upstream PR in the browser | `gh pr create --web` | [Lecture 3](../lectures/03-persistence-and-first-pr.md#open-source-track) |
| List your open PRs | `gh search prs --author=@me --state=open --json url,updatedAt,commentsCount` | [Meeting&nbsp;11](../lectures/11-13-clinics-and-demos.md#what-you-bring) |
| Check that a PR is merged | `gh pr view PR_URL --json state,mergedAt,baseRefName,mergeCommit` | [Meeting&nbsp;12](../lectures/11-13-clinics-and-demos.md#evidence-review) |
| Check that the merge reached the main branch (`ahead` or `identical`) | `gh api repos/OWNER/REPO/compare/MERGE_SHA...DEFAULT_BRANCH --jq .status` | [Meeting&nbsp;12](../lectures/11-13-clinics-and-demos.md#evidence-review) |
| Check CI on the commit you submit | `gh run list --workflow ci.yml --commit "$(git rev-parse HEAD)" --json status,conclusion` | [Meeting&nbsp;12](../lectures/11-13-clinics-and-demos.md#grader-style-self-check) |

**Check yourself:** cover the Command column of one table, say each command and where it runs, then uncover and compare. Next week, do it again with another table.

## Status codes in this course

These meanings are Recipe Box's contract and retry policy, not a rule for every API: another service's 429, for example, usually means a rate limit. Every error body uses FastAPI's `{"detail": ...}` shape.

| Code | What it means here | Taught in |
|---|---|---|
| 200 OK | Success with a body: a list, one record, an update | [Lecture 2](../lectures/02-http-fastapi-pydantic.md#status-codes-you-must-own) |
| 201 Created | A new record, returned in the body | [Lecture 2](../lectures/02-http-fastapi-pydantic.md#status-codes-you-must-own) |
| 204 No Content | Success with an empty body: a delete | [Lecture 2](../lectures/02-http-fastapi-pydantic.md#status-codes-you-must-own) |
| 404 Not Found | `{"detail": "Not Found"}`: no route matched, so check the path.<br>`{"detail": "Recipe not found"}`: your handler ran and the id is missing | [Lecture 2](../lectures/02-http-fastapi-pydantic.md#status-codes-you-must-own) |
| 405 Method Not Allowed | The path exists, but not with that method | [Lecture 2](../lectures/02-http-fastapi-pydantic.md#status-codes-you-must-own) |
| 422 Unprocessable Content | The request broke the contract: a missing field, a value out of range or, in FastAPI, invalid JSON | [Lecture 2](../lectures/02-http-fastapi-pydantic.md#status-codes-you-must-own) |
| 429 Too Many Requests | From the AI service: this run's usage budget is spent. The backend does not retry it and answers 503 | [Lecture 9](../lectures/09-failures-evals-costs.md#retry-at-one-layer-only) |
| 500 Internal Server Error | A bug on your side: the stack trace belongs in the server log, never in the reply. An AI-service 500 (a crash or a provider failure) is not retried; the backend answers 503 | [Lecture 2](../lectures/02-http-fastapi-pydantic.md#status-codes-you-must-own) · [Lecture 9](../lectures/09-failures-evals-costs.md#the-main-ways-the-ai-path-fails) |
| 502 Bad Gateway | The AI service answered with something the backend cannot use: a 4xx, or a 200 that breaks the contract. From Lecture 9 the AI service also sends 502 when the model's output is still invalid after the agent's retries | [Lecture 7](../lectures/07-third-service-contracts.md#service-errors-without-leaking-internals) · [Lecture 9](../lectures/09-failures-evals-costs.md#malformed-output-and-cost-limits) |
| 503 Service Unavailable | A dependency is not available; try later. The backend's answer when a call to the AI service is refused, fails DNS, times out or gets a 5xx | [Lecture 7](../lectures/07-third-service-contracts.md#service-errors-without-leaking-internals) |
| 504 Gateway Timeout | The AI service's 25 s cap fired. Transient: the backend retries it, which runs the model again (paid), then answers 503 | [Lecture 9](../lectures/09-failures-evals-costs.md#the-main-ways-the-ai-path-fails) |

## When you are behind

Find the earliest broken checkpoint: climb from rung 1, and the first check that fails is where to work. The learning map's [When you are behind](learning-map.md#when-you-are-behind) gives the five repair steps, from "confirm the folder" to "restore the checkpoint before a stretch goal".

| Rung | Check | Passes when | Taught in |
|---|---|---|---|
| 1. Tools | the Verify commands | each prints a version | [Student setup](student-setup.md#verify) |
| 2. Backend | `curl http://localhost:8000/health` | `{"status":"ok"}` | [Lecture 1](../lectures/01-environment-git-docker-ai.md#completion-check) |
| 3. API contract | `uv run pytest` in `backend/` | all tests pass | [Lecture 2](../lectures/02-http-fastapi-pydantic.md#completion-check) |
| 4. Durable data | Lecture 3's restart test | data survives a restart | [Lecture 3](../lectures/03-persistence-and-first-pr.md#completion-check) |
| 5. Frontend | open the UI and list records | records appear; failures show a message | [Lecture 4](../lectures/04-browser-frontend.md#completion-check) · [Lecture 5](../lectures/05-frontend-reliability-testing.md#completion-check) |
| 6. AI service | its tests with `TestModel` | all tests pass, no model call | [Lecture 6](../lectures/06-pydantic-ai-agents.md#completion-check) |
| 7. Whole stack | `docker compose up --build`, then `docker compose ps` | every service shows `healthy` | [Lecture 8](../lectures/08-docker-compose.md#completion-check) |
| 8. Release | CI on your commit | green | [Lecture 10](../lectures/10-ci-security-release.md#completion-check) |

## Ask for help with PARD

Send all four parts to whoever you ask, human or AI, in the channel the instructor provides, with secrets redacted. PARD is also the skeleton of a good upstream bug report ([Lecture 1](../lectures/01-environment-git-docker-ai.md#asking-for-help-the-pard-template)).

```text
Problem:   one sentence
Action(s): the exact commands you ran
Result:    the full output, pasted as text (not a screenshot)
Desired:   what you expected
```

Before you ask, write one sentence saying what you think is wrong, and why: a [debug log](engineering-foundations.md#debug-with-a-hypothesis) entry. A wrong guess is fine; it shows the helper where your picture differs from reality.

## The open-source rule

**Policy:** each student needs at least three distinct pull requests of their own, merged into established open-source projects: the official public upstream repository on GitHub, under an open-source license, with more than 10,000 stars on the day you open the PR. Record each PR in your [evidence table](../README.md#evidence-table). The README defines [qualifying repositories](../README.md#qualifying-repositories), [what counts as merged](../README.md#what-counts-as-merged) and the [deadline](../README.md#assignments-and-deadlines).

## Terms

The [glossary](engineering-foundations.md#glossary) gives each course term one line and a link to where it is first taught. Its last line is a five-term drill to run before each lecture.

<!-- {% endraw %} -->
