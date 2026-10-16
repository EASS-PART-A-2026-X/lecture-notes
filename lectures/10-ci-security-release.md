# Lecture 10 · CI, security and release

<!-- {% raw %} -->
[← Course home](../README.md) · [← Previous: Lecture 9](09-failures-evals-costs.md) · [Next: Meetings 11–13 →](11-13-clinics-and-demos.md)

**Date:** Monday 21 December 2026, 16:00 Israel time, on Zoom · **You leave with:** a release candidate: green CI, a passing clean-checkout test, hardened containers, a runbook README and a `v1.0.0-rc1` tag

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

Until today, "it works" meant "on my laptop". Now a robot checks every push, a script plays the grader on a fresh clone, and your containers lose every privilege they don't need. You finish by tagging a release candidate that a stranger can start, test and break using only your README.

## Before you start

- The stack from [Lecture 8](08-docker-compose.md): non-root containers, ai-service not published, `.env` git-ignored.
- The failure tests and evals from [Lecture 9](09-failures-evals-costs.md), green in all three services.
- Your product on GitHub with `main` as the default branch, and `gh auth status` succeeding.

## Concepts

### CI: the same checks on every push

Continuous integration runs your checks on a fresh machine for every push and pull request, so "works on my laptop" becomes "works from Git". A workflow in `.github/workflows/` has **jobs**, each on a new virtual machine; a **matrix** runs one job per service; `needs:` orders jobs.

```text
push to main, or a pull request
  test (matrix: backend, ai-service, frontend)
    uv sync --locked -> ruff check -> ruff format --check -> pytest -> uv audit
  compose (needs: test)
    config --quiet -> up --build --wait -> curl smoke -> logs if failed -> down -v
```

CI never calls a paid model: `AI_MODEL=test`, and Lecture 6's conftest guard `models.ALLOW_MODEL_REQUESTS = False` turns any real request into an error.

### Reproducible means pinned

The same commit should build the same thing next month. Pin every layer:

| Layer | Pinned by |
|---|---|
| Python packages | `uv.lock`, enforced by `uv sync --locked` |
| Python | `.python-version` and the `python:3.14-slim` base image |
| uv itself | `uv:0.13.1` in each Dockerfile, `version: "0.13.1"` in CI |
| CI actions | a full commit SHA, with the version as a comment |

`--locked` fails when `uv.lock` no longer matches `pyproject.toml`; `--frozen` would quietly use the stale lock. A tag like `@v7` can be moved to new code by whoever controls the action's repository; a 40-character SHA cannot.

### Least privilege, layer by layer

Give each part only what it needs, so a bug or a stolen token can do little:

- **CI token:** `permissions: contents: read`, and `persist-credentials: false` so checkout does not leave the token in `.git/config` for later steps.
- **Containers:** non-root uid 10001, `cap_drop: [ALL]` (no Linux capabilities) and `no-new-privileges` (no escalation through setuid programs).
- **Network:** no `ports:` for the ai-service, so only the backend reaches it.
- **Model:** usage limits and a timeout per request; no tool that writes, deletes or runs code.

### Secrets and the leaked-key procedure

Real keys live only in `.env`: git-ignored, listed in every `.dockerignore`, and documented by name in `.env.example`. If a key reaches a pushed commit, assume it is stolen; bots scan public pushes within minutes.

1. **Revoke and rotate it at the provider first.**
2. Stop tracking the file: `git rm --cached .env`, then commit.
3. Clean the history ([GitHub's guide](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)): `git rm` removes the file from the next commit only.
4. Check usage and billing at the provider.

GitHub's push protection blocks some recognized key formats when it is enabled. Never rely on it.

### Validation and access control where needed

Every input is untrusted. `extra="forbid"`, length limits and `limit` ≤ 100 reject unexpected data with 422; SQLModel sends values as bound parameters, never pasted into SQL; the agent treats pasted text as data. Recipe Box has no user accounts (JWT is not required), but a third service reachable by more than your backend deserves a check. **401** means "who are you?"; **403** means "I know you, and no".

```python
# ai-service/app/security.py (optional shared secret between services)
import os
import secrets
from typing import Annotated

from fastapi import Header, HTTPException, status


def require_internal_token(
    x_internal_token: Annotated[str | None, Header()] = None,
) -> None:
    expected = os.getenv("AI_SHARED_SECRET", "")
    if not expected:
        return  # not configured: the compose network is the only boundary
    sent = (x_internal_token or "").encode()
    if not secrets.compare_digest(sent, expected.encode()):  # constant time
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
```

Attach it with `@app.post("/extract", dependencies=[Depends(require_internal_token)])`. The backend sends the header by passing `headers={"X-Internal-Token": token} if token else {}` to its `httpx.Client`. Unset, the check is off, so a clean checkout still needs zero secrets. `compare_digest` takes as long for a wrong first character as for a wrong last one, so timing leaks nothing.

```python
# ai-service/tests/test_security.py
from pydantic_ai.models.test import TestModel

from app.agent import extract_agent

BODY = {"text": "Hummus: chickpeas. 15 min."}


def test_token_required_when_configured(client, monkeypatch):
    monkeypatch.setenv("AI_SHARED_SECRET", "s3cret-for-tests")
    with extract_agent.override(model=TestModel()):
        assert client.post("/extract", json=BODY).status_code == 401
        wrong = {"X-Internal-Token": "guess"}
        assert client.post("/extract", json=BODY, headers=wrong).status_code == 401
        right = {"X-Internal-Token": "s3cret-for-tests"}
        assert client.post("/extract", json=BODY, headers=right).status_code == 200
```

### Dependency hygiene

`uv audit` checks every locked package against the OSV vulnerability database and exits 1 on a finding, which fails CI. It is experimental in uv 0.13; `--preview-features audit-command` acknowledges that and silences the warning. An alternative: `uv export --format requirements.txt -o req.txt`, then `uvx pip-audit -r req.txt --disable-pip`.

### Releases

A **release candidate** is a version you believe is final, published so others can try it: `v1.0.0-rc1` ([Semantic Versioning](https://semver.org/)). Fixes after rehearsal become `rc2`; the version you demo is `v1.0.0`. Tag a commit whose CI run on `main` is green. Recipe Box's CI does not run on tags: zizmor, the workflow security linter from demo step 2, flags tag-triggered workflows that share a build cache (cache poisoning).

## Live demo

**1. The workflow:**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:

# Least privilege: this workflow only reads the repository.
permissions:
  contents: read

jobs:
  test:
    name: test (${{ matrix.service }})
    runs-on: ubuntu-latest
    timeout-minutes: 15
    strategy:
      fail-fast: false # show every failing service, not just the first
      matrix:
        service: [backend, ai-service, frontend]
    defaults:
      run:
        working-directory: ${{ matrix.service }}
    steps:
      # Actions are pinned by full commit SHA (a tag can be moved; a SHA cannot).
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: astral-sh/setup-uv@1c37ad07a6a961277cf70c0d37d6f313000f5884 # v10.3.0
        with:
          version: "0.13.1" # pin the tool too, not just the libraries
          enable-cache: true
          working-directory: ${{ matrix.service }}
      - run: uv sync --locked # fails if uv.lock is out of date
      - run: uv run ruff check .
      - run: uv run ruff format --check .
      - run: uv run pytest
        env:
          AI_MODEL: test # never call a paid model in CI
      - name: Known vulnerabilities in locked dependencies (OSV)
        run: uv audit --locked --preview-features audit-command # experimental in 0.13

  compose:
    needs: test
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      # A clean checkout must start with zero secrets (no .env present).
      - run: docker compose config --quiet
      - run: docker compose up --build --wait --wait-timeout 180
      - name: Smoke test
        run: |
          curl --fail --silent --show-error http://localhost:8000/health
          curl --fail --silent --show-error http://localhost:8501/_stcore/health
          curl --fail --silent --show-error -X POST \
            -H "Content-Type: application/json" \
            -d '{"text": "Hummus: chickpeas, tahini. 15 min."}' \
            http://localhost:8000/recipes/from-text
      - if: failure()
        run: docker compose logs
      - if: always()
        run: docker compose down -v
```

**2. Lint the workflow** before pushing it:

```bash
actionlint .github/workflows/ci.yml
uvx zizmor --offline .github/workflows/ci.yml
```

Install actionlint once: `brew install actionlint` on macOS, or a release binary from [actionlint's releases](https://github.com/rhysd/actionlint/releases) on Linux and WSL; zizmor needs nothing beyond `uvx`.

actionlint checks syntax and expressions and prints nothing. zizmor checks security and ends with `No findings to report. Good job! (2 suppressed)`. Drill 2 shows a workflow that passes the first and fails the second.

**3. Harden the containers.** Add two lines to each service in `compose.yaml`:

```yaml
# compose.yaml: under each of ai-service, backend and frontend
    security_opt: ["no-new-privileges:true"]
    cap_drop: [ALL]
```

After `docker compose up --build --wait`, compare a hardened container with the same image started without the flags:

```bash
docker compose exec backend grep -E "CapBnd|NoNewPrivs" /proc/self/status
docker run --rm recipe-box-backend grep -E "CapBnd|NoNewPrivs" /proc/self/status
```

```text
CapBnd:	0000000000000000
NoNewPrivs:	1
CapBnd:	00000000a80425fb
NoNewPrivs:	0
```

The stack stays healthy and "Paste a recipe" still works: nothing needed those privileges.

**4. Play the grader.** `scripts/clean-checkout.sh` clones HEAD into a temporary folder, follows the README, and removes everything it created:

```bash
#!/usr/bin/env bash
# scripts/clean-checkout.sh: do what a grader does, on a fresh clone of HEAD.
set -euo pipefail

repo="$(git rev-parse --show-toplevel)"
work="$(mktemp -d)"
project="clean-checkout-$$" # own project name: own containers, own volume
export BACKEND_PORT="${BACKEND_PORT:-8000}" FRONTEND_PORT="${FRONTEND_PORT:-8501}"

trap 'rm -rf "$work"' EXIT

git clone --quiet "$repo" "$work" # committed files only: no .env, no .venv
cd "$work"
if [ -e .env ]; then
  echo "FAIL: .env is committed. Rotate every key in it, then remove it."
  exit 1
fi
cp .env.example .env

cleanup() {
  docker compose -p "$project" --project-directory "$work" down -v --rmi local
  rm -rf "$work"
}
trap cleanup EXIT # from here on, also remove containers, volume and images

docker compose -p "$project" up --build --wait --wait-timeout 180
check() { curl --fail --silent --show-error --output /dev/null "$@"; }
check "http://localhost:$BACKEND_PORT/health"
check "http://localhost:$FRONTEND_PORT/_stcore/health"
check -X POST "http://localhost:$BACKEND_PORT/recipes/from-text" \
  -H "Content-Type: application/json" -d '{"text": "Hummus: chickpeas. 15 min."}'

for service in backend ai-service frontend; do
  (cd "$service" && uv sync --locked --quiet && uv run pytest --quiet)
done
echo "Clean checkout OK"
```

Make it executable with `chmod +x scripts/clean-checkout.sh`, then run `scripts/clean-checkout.sh` from the repo root. It prints `Clean checkout OK`, then the cleanup's output (about 40 s for Recipe Box with a warm build cache). Ports taken? Prefix it with `BACKEND_PORT=18000 FRONTEND_PORT=18501`.

**5. Audit.** In `backend/`, `uv audit --locked --preview-features audit-command` prints `Found no known vulnerabilities and no adverse project statuses in 69 packages`.

**6. Tag the release candidate** (lab step 7).

## Hands-on lab

1. **CI.** Copy the workflow; adapt the matrix to your service folders and the smoke step to your endpoints. Open a pull request in your own repository. *Checkpoint:* both jobs green.
2. **Lint it** with actionlint and zizmor until both are clean.
3. **Harden** every service; check `id` and `CapBnd` in each container, then rerun your Lecture 9 drills.
4. **Clean-checkout script:** adapt the smoke URLs and run it. *Checkpoint:* `Clean checkout OK`.
5. **Security review** in pairs: list what you protect (data, keys, money), every entry point (UI, API, pasted text) and the control for each. Add the shared-secret check only if something besides your backend can reach your third service.
6. **Runbook.** Give your README these sections (Recipe Box's adds one for releases):

   ```text
   Setup                 requirements and configuration
   Run                   docker compose up --build, URLs, down versus down -v
   Test                  the command per service, scripts/clean-checkout.sh
   Failure drills        your Lecture 9 table: what to stop, what the user sees
   Real-model run        optional: variables, cost limits, eval results table
   Troubleshooting       symptom, cause, fix for problems you actually hit
   AI-use note           tools, what they helped with, what you checked
   Open-source evidence  the evidence table
   ```

7. **Release candidate**, once CI on `main` is green:

   ```bash
   gh run list --branch main --limit 1 --json conclusion,headSha
   git rev-parse HEAD
   git tag -a v1.0.0-rc1 -m "Release candidate 1"
   git push origin v1.0.0-rc1
   gh release create v1.0.0-rc1 --verify-tag --prerelease --generate-notes
   ```

   The first command must show `"conclusion":"success"` for the SHA that `git rev-parse HEAD` prints.

## Break it on purpose

**Drill 1: a stale lockfile.** Add `"rich>=14.0",` to `dependencies` in `backend/pyproject.toml` by hand, not with `uv add`. `uv sync --locked`, and so CI, stops:

```text
error: The lockfile at `uv.lock` needs to be updated, but `--locked` was provided.

hint: To update the lockfile, run `uv lock`.
```

CI refuses to build something you never tested. Revert, or run `uv add rich` and commit `uv.lock`.

**Drill 2: unpin an action.** In a copy of the workflow, make both checkout steps plain `- uses: actions/checkout@v7`, with no `with:` block. actionlint still passes; zizmor exits non-zero with `error[unpinned-uses]: unpinned action reference` and `help[artipacked]: credential persistence through GitHub Actions artifacts`. Delete the `permissions:` block too: zizmor adds `warning[excessive-permissions]: overly broad permissions`. Restore the original.

**Drill 3: commit the key.** In a throwaway clone, put a fake key in `.env`. `git add .env` refuses ("The following paths are ignored by one of your .gitignore files"). Force it with `git add -f .env`, commit, run the script: `FAIL: .env is committed. Rotate every key in it, then remove it.` Then `git rm --cached .env`, commit, and run `git log --oneline --all -- .env`: the oops commit is still in history, which is why rotation comes first.

**Drill 4: a vulnerable pin (optional).** In a scratch uv project, `uv add "jinja2==3.1.2"`, then `uv audit --locked --preview-features audit-command`: `Found 10 known vulnerabilities and no adverse project statuses in 2 packages`, each with a "Fixed in:" version, and exit code 1. `uv add "jinja2>=3.1.6"` clears it.

## Open-source track

Evidence week. Fill the [evidence table](../README.md#evidence-table) in your product README with every field the course README lists, one row per PR.

1. Merge evidence for each merged PR: `gh pr view URL --json state,mergedAt,mergeCommit,baseRefName`. `baseRefName` must be the project's main development branch (FastAPI's is `master`).
2. Star evidence, dated: the snapshot you saved the day you opened each PR (Lectures 3, 6 and 8). If one is missing, record today's `gh repo view OWNER/REPO --json stargazerCount,licenseInfo` output with today's date, and say that it was taken later.
3. Answer open reviews with Lecture 9's routine.
4. A PR silent for two weeks? Start another viable contribution now; the requirement stays three merged PRs ([what counts as merged](../README.md#what-counts-as-merged)).

## Working with AI assistants

- **Workflow review against a checklist.** "Review my ci.yml: SHA-pinned actions with version comments, `contents: read`, `persist-credentials: false`, `uv sync --locked`, `AI_MODEL=test`, no secrets, logs on failure, `down -v` always." *Verify:* actionlint, zizmor, then a real run.
- **Threat model.** Paste your architecture diagram (never `.env`) and ask for the five likeliest risks, each with a control. *Verify:* each control exists in your code, or goes on your list.
- **Spot the outdated suggestion:** `actions/checkout@v4` or another floating tag (setup-uv v10 has no `v10` tag at all); `pip install -r requirements.txt` in CI; `uv sync --frozen`, which skips the lock check; `permissions: write-all`.

## Completion check

```bash
scripts/clean-checkout.sh
gh run list --branch main --limit 1 --json conclusion,headSha
git tag --list "v1.0.0*"
```

Expect `Clean checkout OK`, `"conclusion":"success"` for your HEAD, and `v1.0.0-rc1`.

- [ ] CI: test matrix and compose smoke, green on `main`; SHA-pinned actions; `contents: read`.
- [ ] actionlint and zizmor clean; `uv audit` clean, or each finding explained in the README.
- [ ] Containers non-root, with `cap_drop: [ALL]` and `no-new-privileges`; ai-service not published.
- [ ] `.env` never committed; `.env.example` lists every setting.
- [ ] README: the eight runbook sections and a filled evidence table.
- [ ] `v1.0.0-rc1` tagged and published as a pre-release.

## Quick quiz

<details markdown="1">
<summary>Q1. Why pin actions/checkout to a 40-character SHA instead of @v7?</summary>

A tag is a movable pointer: whoever controls the action's repository can point `v7` at new code that then runs with your token. A SHA names exactly one commit; the comment keeps it readable.

</details>

<details markdown="1">
<summary>Q2. (Lecture 8) Why must a clean checkout start with zero real keys?</summary>

Graders and CI have none. `env_file` with `required: false` and `AI_MODEL=${AI_MODEL:-test}` make `TestModel` the default, so the flow runs offline and free; a real model is a documented opt-in.

</details>

<details markdown="1">
<summary>Q3. You pushed a commit with a real API key an hour ago. What do you do first, and why?</summary>

**Rotate it at the provider.** Rewriting history first leaves a valid key in every clone, fork and cache made in that hour. Then stop tracking the file, clean the history, and check usage.

</details>

<details markdown="1">
<summary>Q4. (Lecture 9) CI runs on every push. What stops it from spending money on models?</summary>

`AI_MODEL=test` everywhere, and `models.ALLOW_MODEL_REQUESTS = False` in the ai-service conftest, which makes any real model request fail the test. `UsageLimits` would cap a run that slipped through.

</details>

<details markdown="1">
<summary>Q5. CI fails at <code>uv sync --locked</code>, but everything passes on your laptop. What happened, and why is that useful?</summary>

`pyproject.toml` changed without `uv lock`, or `uv.lock` was not committed. CI refuses to build what you never tested: run `uv lock` and commit it.

</details>

## Stretch goals

Optional:

- **Wire the shared secret** through Compose: `AI_SHARED_SECRET: ${AI_SHARED_SECRET:-}` under `environment:` of both backend and ai-service, and a value in `.env` from `python -c "import secrets; print(secrets.token_hex(32))"`.
- **Pin the base image by digest:** `docker buildx imagetools inspect python:3.14-slim` prints it; write `FROM python:3.14-slim@sha256:<digest>`.
- **Dependabot** with `package-ecosystem: github-actions`, so SHA pins get update PRs.
- **CHANGELOG.md** in [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.

## Common pitfalls

- **`The lockfile at uv.lock needs to be updated`** → `pyproject.toml` changed without relocking → `uv lock` in that service; commit `uv.lock`.
- **The compose job fails at `up --wait`** → a healthcheck never passes → read the output of the "logs if failed" step.
- **`curl: (7) Failed to connect` in the smoke step** → that port is not published → smoke-test only the frontend and backend.
- **Passes for you, fails for the grader** → a file you never committed → the script clones HEAD; commit, then rerun it.
- **Pushing the tag starts no workflow** → no tag trigger, by design → tag a commit already green on `main`.

## Instructor notes

Suggested flow:

1. Ask "what exactly will the grader type?" and write it down: it becomes the clean-checkout script.
2. Walk through `ci.yml` top to bottom: triggers, permissions, matrix, compose job.
3. Run actionlint and zizmor, then drill 2 live.
4. Harden compose and show the `CapBnd` comparison.
5. Start the clean-checkout script; while it builds, the leaked-key procedure.
6. Lab, with the security review in pairs.
7. Release-candidate round: each student shows a green run and a tag, or names the blocker.

Emphasize: pin everything, least privilege at every layer, rotate first. Students get stuck on stale `uv.lock` files, wrong smoke-test ports, uncommitted files and `gh auth`.

## Read more

- [GitHub Actions: secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)
- [uv: using uv in GitHub Actions](https://docs.astral.sh/uv/guides/integration/github/)
- [zizmor documentation](https://docs.zizmor.sh/)
- [Compose file reference: services](https://docs.docker.com/reference/compose-file/services/)
- [GitHub CLI: gh release create](https://cli.github.com/manual/gh_release_create)

---

[← Course home](../README.md) · [← Previous: Lecture 9](09-failures-evals-costs.md) · [Next: Meetings 11–13 →](11-13-clinics-and-demos.md)

<!-- {% endraw %} -->
