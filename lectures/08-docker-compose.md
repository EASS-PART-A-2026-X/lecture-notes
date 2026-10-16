# Lecture 8 · Docker Compose

<!-- {% raw %} -->
[← Course home](../README.md) · [← Previous: Lecture 7](07-third-service-contracts.md) · [Next: Lecture 9 →](09-failures-evals-costs.md)

**Date:** Monday 7 December 2026, 16:00 Israel time, on Zoom. HIT's Hanukkah holiday is Sunday 6 December; this class runs as normal · **You leave with:** the whole stack starting with one command; third upstream PR opened

## Mission

Lecture 7 needed three terminals and a good memory for ports. Today one file replaces all of it. A grader clones your repository, runs `docker compose up --build`, opens <http://localhost:8501> and pastes a recipe: no API keys, no setup beyond Docker. Then you delete the containers, bring them back, and your data is still there.

## Before you start

- The backend `Dockerfile`, `.dockerignore` and named volume from [Lecture 3](03-persistence-and-first-pr.md).
- The three-service flow and its tests from [Lecture 7](07-third-service-contracts.md).
- Docker Desktop running; on Windows, inside WSL2 with Ubuntu integration on. `docker compose version` prints v2.
- Stop Lecture 7's three dev servers. They hold ports 8000, 8001 and 8501.

## Concepts

### One file instead of three terminals

Compose reads `compose.yaml` and creates a network, the volumes and one container per service. Each Lecture 7 habit has a place in the file:

| Lecture 7, by hand | `compose.yaml` |
|---|---|
| `cd ai-service && uv run fastapi dev --port 8001` | a service with `build: ./ai-service` |
| `AI_SERVICE_URL=...` in your shell | `environment:` |
| `localhost:8001` | `http://ai-service:8001` (the service name) |
| `backend/data/app.db` | the named volume `backend-data` |
| waiting for "Application startup complete" | `healthcheck:` plus `depends_on` |

`name: recipe-box` fixes the project name, so containers are called `recipe-box-backend-1` and so on. There is no `version:` key; it is obsolete.

### One Dockerfile per service

Every service reuses Lecture 3's uv pattern: pinned base and uv, a cached dependency layer, `uv sync --locked` (it refuses a stale lockfile), a non-root user (uid 10001) and an exec-form `CMD`. Only the data directory, the port and the start command differ. `.dockerignore` keeps `.venv`, `.env` and `tests` out.

### Networking: where is localhost?

Every container has its **own** `localhost`: inside the backend, `localhost:8001` is the backend itself, where nothing listens. Compose puts all services on one network where **each service name is a DNS name**, so the backend calls `http://ai-service:8001`.

```text
your laptop                      compose network (one per project)
-----------                      ---------------------------------
browser -> localhost:8501 ->     frontend    :8501
                                    |  BACKEND_URL=http://backend:8000
curl    -> localhost:8000 ->     backend     :8000  -> volume backend-data (/app/data)
                                    |  AI_SERVICE_URL=http://ai-service:8001
(nothing at localhost:8001)      ai-service  :8001  (no ports: internal only)
```

`ports: ["HOST:CONTAINER"]` publishes a port on your laptop. Publish only what a person uses: the frontend, and the backend for `curl` and `/docs`. The AI service gets **no** `ports:`, so nobody can bypass the backend.

`BACKEND_URL` is `http://backend:8000` because Streamlit's Python runs *inside the frontend container*. A React app runs in the browser, so it would need the published `http://localhost:8000` plus CORS.

### Volumes: where the SQLite file lives

The named volume `backend-data` is mounted at `/app/data`, and `DATABASE_URL` is `sqlite:////app/data/app.db`: `sqlite:///` plus the absolute path, four slashes. `docker compose down` removes containers and the network but **keeps volumes**; `down -v` deletes them too, and the seed runs again.

### Configuration: interpolation, `environment` and `env_file`

Two different mechanisms:

- **Interpolation:** Compose replaces `${AI_MODEL:-test}` while *reading the file*, from your shell first, then a `.env` file next to `compose.yaml`, then the default after `:-`.
- **Container variables:** `environment:` sets variables in one container; `env_file:` loads a file's lines into it, and `required: false` skips a missing file.

A clean checkout has no `.env`, so `AI_MODEL` is `test` (`TestModel`: no key, no cost). With a real model and key in `.env`, interpolation picks the model and `env_file` hands the key **only** to the AI service. Use defaults for non-secrets only.

### Health and readiness

A `healthcheck` runs a command inside the container every `interval`; after `retries` failures in a row it is `unhealthy` (failures during `start_period` don't count). `depends_on` with `condition: service_healthy` orders startup: AI service, then backend, then frontend. A bare `depends_on` waits only for *started*, not *ready*. `up --wait` blocks until all are healthy, which is what CI and graders use. The checks use Python's `urllib`, because `python:3.14-slim` has no curl.

The backend's `/health` deliberately **does not** call the AI service. Otherwise an AI outage would mark the backend unhealthy and take CRUD down with it; Lecture 7's 503 covers that case. A stricter *readiness* check may test what the service cannot work without, such as its database.

### Secrets

- Real keys live in `.env`, which is git-ignored and in every `.dockerignore`, so it reaches neither Git nor an image. Commit `.env.example` with names and placeholders only. No key ever goes in `compose.yaml` or a Dockerfile.
- `docker compose config` prints the resolved file **including values from `.env`**. Validate with `config --quiet`; never paste the full output anywhere.
- A pushed key is compromised. **Revoke and rotate it at the provider first**, then remove it; rewriting history alone is not enough ([GitHub: removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)).
- Compose `secrets:` mounts a file at `/run/secrets/<name>`. It is a stretch goal, because a missing file stops `up`.

## Live demo

**1. Two more Dockerfiles.** Copy `backend/Dockerfile` into `ai-service/` and `frontend/`. Neither needs the data directory, so drop the `mkdir`/`chown` part, then change the port. `ai-service/Dockerfile` (the `# syntax` line must stay first):

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

# 3) Never run as root.
RUN useradd --create-home --uid 10001 appuser
USER appuser
ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8001
CMD ["fastapi", "run", "app/main.py", "--host", "0.0.0.0", "--port", "8001"]
```

The last lines of `frontend/Dockerfile` start Streamlit instead:

```dockerfile
EXPOSE 8501
CMD ["streamlit", "run", "streamlit_app.py", \
     "--server.address", "0.0.0.0", "--server.port", "8501"]
```

Each `.dockerignore` lists `.venv`, `__pycache__`, `.pytest_cache`, `.ruff_cache`, `.env` and `tests` (plus `e2e` for the frontend).

**2. The compose file**, at the repository root:

```yaml
# compose.yaml (Compose Specification: no top-level "version:" key)
name: recipe-box

services:
  ai-service:
    build: ./ai-service
    # No "ports:" on purpose: only the backend reaches it, on the compose network.
    env_file:
      - path: .env # your real settings and keys (git-ignored)
        required: false # a clean checkout has no .env and still starts
    environment:
      AI_MODEL: ${AI_MODEL:-test} # no key, no cost unless you choose a model
      PYDANTIC_AI_NO_BANNER: "1"
    healthcheck:
      # Slim images have no curl, so ask Python's standard library instead.
      test:
        - CMD
        - python
        - -c
        - >-
          import urllib.request;
          urllib.request.urlopen("http://localhost:8001/health", timeout=2)
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s

  backend:
    build: ./backend
    ports:
      - "${BACKEND_PORT:-8000}:8000" # host:container
    environment:
      DATABASE_URL: sqlite:////app/data/app.db # 4 slashes = absolute path
      AI_SERVICE_URL: http://ai-service:8001 # the service name is a DNS name
    volumes:
      - backend-data:/app/data # survives "down"; "down -v" deletes it
    depends_on:
      ai-service:
        condition: service_healthy
    healthcheck:
      test:
        - CMD
        - python
        - -c
        - >-
          import urllib.request;
          urllib.request.urlopen("http://localhost:8000/health", timeout=2)
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s

  frontend:
    build: ./frontend
    ports:
      - "${FRONTEND_PORT:-8501}:8501"
    environment:
      BACKEND_URL: http://backend:8000 # Streamlit calls the API server-side
    depends_on:
      backend:
        condition: service_healthy
    healthcheck:
      test:
        - CMD
        - python
        - -c
        - >-
          import urllib.request;
          urllib.request.urlopen("http://localhost:8501/_stcore/health", timeout=2)
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s

volumes:
  backend-data:
```

`>-` is YAML for "fold these lines into one", so Compose receives one line of Python.

**3. Settings that stay out of Git:**

```bash
# .env.example: copy to .env (git-ignored) and edit. Never commit .env.
# "test" = Pydantic AI's TestModel: no network, no key, no cost.
AI_MODEL=test

# Optional real-model run (Lecture 6): set AI_MODEL=<provider>:<model>
# and that provider's key, e.g. OPENAI_API_KEY=... or ANTHROPIC_API_KEY=...
# Free and local: AI_MODEL=ollama:<model> and
# OLLAMA_BASE_URL=http://host.docker.internal:11434/v1

# Optional: other host ports if 8000 or 8501 are taken.
# BACKEND_PORT=8000
# FRONTEND_PORT=8501
```

The root `.gitignore` lists `.env`; `git check-ignore .env` prints `.env` to confirm.

On Linux with Docker Engine (not Desktop), `host.docker.internal` resolves only if the ai-service also has `extra_hosts: ["host.docker.internal:host-gateway"]`, and Ollama must listen on more than loopback (its `OLLAMA_HOST` setting).

One frontend line changes too: Lecture 5's backend-down message in `frontend/api.py` still says `uv run fastapi dev in backend/`. Make it `"Start it (docker compose up) and reload the page."`, the command a grader now uses.

**4. Up.** Validate, then build and start. `up --build` keeps streaming logs, so leave it running:

```bash
docker compose config --quiet
docker compose up --build
```

In a second terminal, look around:

```bash
docker compose ps --format "table {{.Service}}\t{{.Status}}"
curl -s localhost:8000/health
curl -sS localhost:8001/health
```

`config --quiet` prints nothing when the file is valid, and `ps` shows `(healthy)` for all three. The first `curl` returns `{"status":"ok"}`; the second fails with `curl: (7) Failed to connect to localhost port 8001`, because the AI service is not published (`-S` makes curl show the error that `-s` alone hides). Paste a recipe at <http://localhost:8501>: it now crosses three containers.

**5. "Where is localhost?"** Predict both answers first:

```bash
docker compose exec backend python -c \
  "import urllib.request as u; print(u.urlopen('http://ai-service:8001/health').read())"
docker compose exec backend python -c \
  "import urllib.request as u; print(u.urlopen('http://localhost:8001/health').read())"
```

The first prints `b'{"status":"ok"}'`. The second ends in `urllib.error.URLError: <urlopen error [Errno 111] Connection refused>`.

**6. Predict, then run.** Add a recipe, then run `docker compose down` and `docker compose up -d --wait`: the recipe is still there. Run `docker compose down -v` and `docker compose up -d --wait`: only the three seed recipes remain.

### Commands you will use every day

| Command | What it does |
|---|---|
| `docker compose up --build` | Build images, start everything, stream logs; Ctrl+C stops |
| `docker compose up --build --wait` | Start in the background and wait until all services are healthy |
| `docker compose ps` | Each service with its health and ports |
| `docker compose logs -f backend` | Follow one service's logs |
| `docker compose exec backend sh` | Open a shell inside a running container |
| `docker compose stop ai-service` | Stop one service; `start` brings it back |
| `docker compose down` | Remove containers and the network; **keep** volumes |
| `docker compose down -v` | Also delete volumes, **including your data** |
| `docker compose config --quiet` | Validate the file without printing it |

## Hands-on lab

Containerize **your** product. Use your own service names, and keep the shape.

1. **Dockerfiles:** copy the backend's into each service; drop the data directory; change the port and `CMD`; add `.dockerignore`. *Checkpoint:* `docker compose build` succeeds.
2. **`compose.yaml`:** three services, `name:` set, no `version:`, `ports:` only for the frontend and backend.
3. **Networking:** the backend calls your third service by its service name; the frontend uses `http://backend:8000` (or the published URL, for a browser-side framework), and its backend-down message now says `docker compose up`.
4. **Health:** a `urllib` healthcheck per service, and `depends_on` with `service_healthy`. *Checkpoint:* `docker compose up --build --wait` returns, and `ps` shows three `(healthy)`.
5. **Data:** a named volume and a four-slash `DATABASE_URL`.
6. **Settings:** `.env.example` committed, `.env` ignored, `env_file` with `required: false`, `${AI_MODEL:-test}`. *Checkpoint:* it starts with **no** `.env`.
7. **Run the full flow** in the browser, AI feature included.
8. **Restart test:** data survives `down` and `up`; `down -v` resets to the seed.
9. **README "Run it":** commands, ports, a `down -v` warning, and the real-model switch.

## Break it on purpose

The loop: predict, break, read the exact error, fix, and note what would have caught it.

**Drill 1: localhost again.** Set the backend's `AI_SERVICE_URL: http://localhost:8001` and run `docker compose up -d --wait`. Everything is healthy, yet pasting returns `{"detail":"AI service unavailable"}`. The second command from demo step 5 shows why. Fix it with the service name.

**Drill 2: the healthcheck that can't pass.** Replace the AI service's test with `["CMD", "curl", "-f", "http://localhost:8001/health"]` and run `docker compose up -d --wait`. About a minute later it fails with `dependency failed to start: container recipe-box-ai-service-1 is unhealthy`. Find out why:

```bash
docker inspect --format "{{json .State.Health}}" recipe-box-ai-service-1
```

The log says `exec: "curl": executable file not found in $PATH`. Restore the Python check.

**Drill 3: one slash short.** Change `DATABASE_URL` to `sqlite:///app/data/app.db` (three slashes) and run `docker compose up -d --wait`. It fails with `dependency failed to start: container recipe-box-backend-1 exited (3)`, and `docker compose logs backend` shows `PermissionError: [Errno 13] Permission denied: 'app/data'`. Three slashes make the path relative to `/app`; even if writable, the database would sit outside the volume and vanish on `down`. Restore four slashes.

## Open-source track

This week: **open PR #3**, and keep #1 and #2 moving ([rules](../README.md#open-source-contribution-rule-and-evidence)).

1. On the day you open it, re-check the repository, as in Lecture 6:

   ```bash
   gh repo view OWNER/REPO \
     --json stargazerCount,licenseInfo,pushedAt,isFork,defaultBranchRef
   ```

2. Re-read CONTRIBUTING and the AI-use policy. PR #3 is a distinct change, not a slice of an earlier one; small is fine.
3. Run the project's tests, or the subset CONTRIBUTING asks for.
4. Open the PR on GitHub (or `gh pr create` from your fork's branch), with a description you wrote: problem, change, verification.
5. Add the [evidence table](../README.md#evidence-table) row, and run Lecture 7's follow-up commands on PRs #1 and #2.

## Working with AI assistants

**Pattern 1: review against a checklist.** "Review my `compose.yaml`: no `version:` key; `ports:` only on frontend and backend; healthchecks without curl; `depends_on` with `service_healthy`; a named data volume; no secrets; `env_file` with `required: false`." *Verify:* `config --quiet`, `up --build --wait`, `ps`, and a failing `curl localhost:8001/health`.

**Pattern 2: explain a failure.** Paste `docker compose logs backend` and the failing command; ask for the likely cause and one check that confirms it. Never paste `.env` or full `docker compose config` output: both can contain keys.

**Spot the outdated suggestion:**

- `version: "3.9"` at the top. Compose warns that the `version` attribute "is obsolete, it will be ignored".
- `docker-compose` with a dash. Compose v2 is `docker compose`.
- `depends_on: [ai-service]` with no condition. That waits for "started", not "healthy".
- A `curl` healthcheck on a slim image, `pip install -r requirements.txt` in a uv project, or unpinned `python:3-slim` (now Python 3.15) and `uv:latest` tags.

## Completion check

Prove a stranger can start your stack. Stop yours with `docker compose down`, commit and push today's work, then use a fresh clone of your repository:

```bash
git clone https://github.com/YOU/YOUR-REPO.git ~/clean-check
cd ~/clean-check
docker compose -p clean-check up --build --wait
curl -s localhost:8000/health
docker compose -p clean-check down -v
```

`-p clean-check` gives the clone its own project name, so it gets a fresh volume instead of yours. Expected: `up` ends with three `Healthy` lines; `curl` prints `{"status":"ok"}`.

- [ ] A clean clone with no `.env` starts three healthy services.
- [ ] A recipe pasted in the browser is saved, with all three services in containers.
- [ ] Nothing answers at `localhost:8001`.
- [ ] Data survives `down` and `up`; `down -v` resets to the seed.
- [ ] `git check-ignore .env` prints `.env`; `.env.example` is committed.
- [ ] Your README's "Run it" section matches what you just typed.

## Quick quiz

<details markdown="1">
<summary>Q1. Inside the backend container, what does localhost port 8001 reach?</summary>

Nothing: `localhost` is the backend's own container, where nothing listens on 8001, so the connection is refused (errno 111). Use the service name, `http://ai-service:8001`, which Compose's network resolves.

</details>

<details markdown="1">
<summary>Q2. (Lecture 3) Which command keeps your recipes: docker compose down, or docker compose down -v?</summary>

`down`. It removes containers and the network, but named volumes survive, so the next `up` mounts the same `backend-data`. `down -v` deletes volumes too, and the seed runs again. As in Lecture 3, only the volume outlives containers.

</details>

<details markdown="1">
<summary>Q3. (Lecture 7) The ai-service container is stopped. What happens when a user pastes a recipe, and what does the backend's /health say?</summary>

The backend returns `503 {"detail": "AI service unavailable"}`, and the UI says "AI service is unavailable, try again in a minute." `/health` still says `{"status":"ok"}` and CRUD keeps working, by design: health that depended on the AI service would take the backend down too.

</details>

<details markdown="1">
<summary>Q4. There is no .env, and you run AI_MODEL=ollama:llama3.2 docker compose up. Which model does the AI service use? And with no shell variable?</summary>

`ollama:llama3.2`: interpolation takes the shell's value first (it would even beat `.env`). With neither, the default after `:-` applies: `test`.

</details>

<details markdown="1">
<summary>Q5. Why do the healthchecks run python -c "import urllib.request; ..." instead of curl?</summary>

`python:3.14-slim` has no curl, so a curl check always fails with "executable file not found", and the service never becomes healthy. Python is already in the image and can make the request itself.

</details>

## Stretch goals

Optional. The required path stays as above.

- **Live reload in containers.** Add this to the backend service and run `docker compose watch`: code edits are copied in and the container restarts; a new `uv.lock` triggers a rebuild.

  ```yaml
  # compose.yaml, under services.backend
      develop: # used only by "docker compose watch"
        watch:
          - action: sync+restart # copy changed code in, restart the container
            path: ./backend/app
            target: /app/app
          - action: rebuild # dependencies changed: build a new image
            path: ./backend/uv.lock
  ```

- **Compose secrets.** Mount a key as a file. Your code must read the file itself, because provider libraries read environment variables. Git-ignore `secrets/`; a missing file makes `up` fail with `bind source path does not exist`.

  ```yaml
  # compose.yaml, under services.ai-service
      secrets: [openai_api_key] # appears as /run/secrets/openai_api_key
  # compose.yaml, at the top level
  secrets:
    openai_api_key:
      file: ./secrets/openai_api_key.txt # git-ignored, like .env
  ```

- **PostgreSQL instead of SQLite:** add a `db` service with a `pg_isready` healthcheck and its own named volume. It is infrastructure, not your third service.

## Common pitfalls

- **`Cannot connect to the Docker daemon`** → Docker Desktop isn't running → start it; on Windows, check WSL integration.
- **`docker-compose: command not found`** → the old v1 tool → type `docker compose`.
- **`env file .../.env not found`** → `env_file` lacks `required: false` → add it.
- **`The lockfile at uv.lock needs to be updated, but --locked was provided.`** → `pyproject.toml` changed without relocking → `uv lock` in that service, commit `uv.lock`.
- **`port is already allocated`, or the old dev server answers** → a Lecture 7 server holds the port → stop it, or set `BACKEND_PORT`/`FRONTEND_PORT` in `.env`.
- **A code change doesn't show up** → the old image was reused → `docker compose up --build`.
- **503 in Compose, fine without Docker** → `localhost` in a URL → use the service name.
- **Data vanished** → someone ran `down -v` → use `down`, and warn in the README.
- **Logs full of `GET /health`** → the healthcheck, every 5 seconds → `docker compose logs backend | grep -v /health`.

## Instructor notes

Suggested flow:

1. Show Lecture 7's three terminals: "What would a grader have to type?" Then the mapping table.
2. Copy the backend's Dockerfile for the AI service; ask what must change.
3. Build `compose.yaml` in steps: AI service and backend, `config --quiet`, `up --build`, then the frontend.
4. "Where is localhost?" predictions, then `curl localhost:8001` from the laptop.
5. Predict-then-run: `down`, then `down -v`.
6. `.env.example`, interpolation, and why plain `config` output is never pasted.
7. Drill 2 live: the minute of waiting makes the point.
8. PR #3 round: each student names the repository and the change.

Emphasize: the service name is the address, `down -v` deletes data, a clean checkout starts with zero keys. Students get stuck on dev servers holding ports, `localhost` in URLs, a forgotten `--build`, and three-slash database URLs.

## Read more

- [Docker: Compose file reference, services](https://docs.docker.com/reference/compose-file/services/)
- [Docker: control startup order](https://docs.docker.com/compose/how-tos/startup-order/) and [networking in Compose](https://docs.docker.com/compose/how-tos/networking/)
- [Docker: environment variables in Compose](https://docs.docker.com/compose/how-tos/environment-variables/) and [their precedence](https://docs.docker.com/compose/how-tos/environment-variables/envvars-precedence/)
- [uv: using uv in Docker](https://docs.astral.sh/uv/guides/integration/docker/)
- [Docker: Compose Watch](https://docs.docker.com/compose/how-tos/file-watch/) and [secrets in Compose](https://docs.docker.com/compose/how-tos/use-secrets/)

---

[← Course home](../README.md) · [← Previous: Lecture 7](07-third-service-contracts.md) · [Next: Lecture 9 →](09-failures-evals-costs.md)

<!-- {% endraw %} -->
