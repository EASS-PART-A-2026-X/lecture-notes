# EASS · Class X — Course guide

<!-- {% raw %} -->

- **Course:** Engineering of Advanced Software Solutions (EASS), Class X, at HIT
- **Semester:** A, 2026–2027 (<span lang="he">תשפ״ז</span>)
- **Instructor:** Yossi Eliaz
- **Meetings:** Mondays at 16:00 Israel time (Asia/Jerusalem) on Zoom; the first meeting, on 19 October, starts at 18:00. The link is provided by the instructor
- **Required stack:** FastAPI, Pydantic, Pydantic AI, Docker
- **Course PDF:** [every page in one PDF](https://eass-part-a-2026-x.github.io/lecture-notes/EASS-Class-X-course.pdf), rebuilt on each update

In this course you build, test, run, debug, and explain a useful full-stack application, and you contribute accepted changes to established open-source projects.

**On this page:** [Start here](#start-here) · [Calendar](#calendar-and-13-meeting-schedule) · [Product](#three-service-product-requirements) · [Assignments](#assignments-and-deadlines) · [Open source](#open-source-contribution-rule-and-evidence) · [Working method](#working-method-ai-use-assessment-and-reproducibility) · [Resources](#official-resources) · [Earlier material](#earlier-course-material)

## Start here

1. **Prepare for the first meeting:** follow [Lecture 1's setup checklist](lectures/01-environment-git-docker-ai.md#before-you-start) and check your tools before class.
2. **Plan your product:** read the [three-service requirements](#three-service-product-requirements) and [assignment deadlines](#assignments-and-deadlines). You grow the same product through EX1, EX2 and EX3.
3. **Start the open-source track early:** check the [qualifying-project rules](#qualifying-repositories). Each student needs three merged PRs; finding suitable projects and waiting for reviews takes time.

## Calendar and 13-meeting schedule

Ten planned lectures come first, then three flexible meetings.

| # | Date | Focus | Deliverable |
|---|---|---|---|
| 1 | Mon 19 Oct 2026, 18:00 | [Environment, Git, Docker and AI-assisted coding](lectures/01-environment-git-docker-ai.md) | Working setup; product sketch; 2–3 open-source candidates |
| 2 | Mon 26 Oct 2026 | [HTTP, FastAPI and Pydantic](lectures/02-http-fastapi-pydantic.md) | Tested CRUD API |
| 3 | Mon 2 Nov 2026 | [Persistence and your first upstream PR](lectures/03-persistence-and-first-pr.md) | Persistent backend; first upstream PR opened |
| 4 | Mon 9 Nov 2026 | [Browser frontend](lectures/04-browser-frontend.md) | First end-to-end user flow; EX1 due |
| 5 | Mon 16 Nov 2026 | [Frontend reliability and testing](lectures/05-frontend-reliability-testing.md) | Usable interface; one automated product flow |
| 6 | Mon 23 Nov 2026 | [Pydantic AI agents](lectures/06-pydantic-ai-agents.md) | Small domain agent; second upstream PR opened |
| 7 | Mon 30 Nov 2026 | [The third service and its contract](lectures/07-third-service-contracts.md) | Full three-service flow; EX2 due |
| 8 | Mon 7 Dec 2026 | [Docker Compose](lectures/08-docker-compose.md) | One-command stack startup; third upstream PR opened |
| 9 | Mon 14 Dec 2026 | [Failures, evaluations and costs](lectures/09-failures-evals-costs.md) | Failure tests; small evaluation dataset with results |
| 10 | Mon 21 Dec 2026 | [CI, security and release](lectures/10-ci-security-release.md) | Release candidate with runbook |
| 11 | Mon 28 Dec 2026 | [Flexible: integration and upstream-review clinic](lectures/11-13-clinics-and-demos.md#meeting-11--integration-and-upstream-review-clinic) | Integrated stack; PR reviews followed up |
| 12 | Mon 4 Jan 2027 | [Flexible: demo rehearsal, troubleshooting and evidence review](lectures/11-13-clinics-and-demos.md#meeting-12--demo-rehearsal-troubleshooting-and-evidence-review) | Rehearsed demo and individual explanation; evidence table reviewed |
| 13 | Mon 11 Jan 2027 | [Final demos and individual technical discussion](lectures/11-13-clinics-and-demos.md#meeting-13--final-demos-and-individual-technical-discussion) | Final demo; EX3 and open-source evidence due |

Notes, checked against the [HIT academic calendar](https://www.hit.ac.il/students/calender/) on 16 October 2026:

- HIT's term runs Sunday 18 October 2026 – Sunday 17 January 2027. Exams run 18 January – 19 February 2027, so Monday 18 January is not a class day.
- No Monday in the term is closed. The election holiday (Tuesday 27 October) and HIT's Hanukkah holiday (Sunday 6 December) fall on other days, so class on Monday 7 December runs as normal.
- HIT lists opening-event teaching breaks on 18–20 October, including 17:00–18:00, so the first meeting (Monday 19 October) starts at 18:00. Every other meeting starts at 16:00.
- Israel clocks go back on Sunday 25 October: the 19 October meeting (18:00 Israel time) is 15:00 UTC, and from 26 October 16:00 Israel time is 14:00 UTC. From abroad, convert from Asia/Jerusalem time for each date.

## Three-service product requirements

Choose one narrow domain, such as document analysis, recipe management, study planning, or a catalogue, and grow one product through every assignment.

Your product has three application services:

- **Backend:** a FastAPI HTTP API with Pydantic request and response validation, domain logic, persistent data, automated tests, and calls to the third service.
- **Frontend:** a browser-based UI that talks to the backend through its API, with meaningful workflows and clear loading, empty, and error states. React, Streamlit, or another suitable web framework is fine. A CLI alone is not enough, and the frontend never bypasses the backend to change its database.
- **Third service:** an independent application service with a clear contract. It holds your product's Pydantic AI functionality (structured extraction, analysis, recommendations, or domain assistance); the recommended form is a FastAPI service. The backend calls it over HTTP with validated inputs and outputs. An agent class inside the backend does not count, and the service need not execute generated code.

Data flows from user to frontend to backend to third service; only the backend touches persistent storage. You build the product individually or in a pair, and every student explains their own work.

A database, Redis, proxy, or monitoring container is infrastructure, not your third service. Three containers alone do not prove three application services.

Scope and safety:

- Docker Compose is the required way to run all three services. Add infrastructure only when you can justify it.
- SQLite is enough; PostgreSQL is allowed. Data must survive your documented restart procedure.
- Redis, Kubernetes, cloud hosting, JWT, and multiple database engines are optional. You need neither AWS Educate nor any paid account; a free local model (for example, through Ollama) works for real runs.
- Apply input validation, secret management, appropriate permissions, and access controls wherever your domain needs them.

## Assignments and deadlines

Deadlines are at 23:59 Israel time on the dates below. Submit through the submission channel provided by the instructor.

| Assignment | Deadline | What you hand in |
|---|---|---|
| EX1 — Backend | Mon 9 Nov 2026 | CRUD API with Pydantic validation, persistent data, tests, a backend Dockerfile, and setup, run, and test instructions |
| EX2 — Frontend plus backend | Mon 30 Nov 2026 | Browser UI integrated with EX1: core flows, error states, one automated UI or integration flow, and reproducible run instructions |
| EX3 — Complete product | Mon 11 Jan 2027 | Three application services, Pydantic AI functionality, Docker Compose, persistent data initialization, automated and failure tests, basic CI, a small AI evaluation dataset with results, a demo, and a short runbook |
| Open-source evidence | Mon 11 Jan 2027 | Three qualifying merged PRs, documented in your evidence table |

Both the application and the open-source requirement are mandatory.

## Open-source contribution rule and evidence

Each student needs at least three distinct pull requests (PRs) of their own accepted and merged into established open-source projects; credit is per student, not per team, and each PR counts for one student only. Size does not matter: documentation, typo fixes, examples, tests, bug fixes, and features all qualify once maintainers merge them.

### Qualifying repositories

- The official public upstream repository on GitHub, under an open-source license, of an established project with ongoing maintainer activity.
- More than 10,000 GitHub stars on the day you open the PR; exactly 10,000 is not enough.
- Not a fork, a classroom repository, a personal copy, or a repository created to satisfy this assignment.

All three PRs may go to one qualifying project or to several. The course publishes no list of eligible projects; you verify each candidate yourself, as [Lecture 1](lectures/01-environment-git-docker-ai.md) shows.

### What counts as merged

- **Counts:** the change reaches the project's main development branch (`main`, `master`, or a documented equivalent). Merge, squash, and rebase merges all count. An integration-branch merge counts only after you show the change later landed on the main development branch.
- **Does not count:** open PRs, approved but unmerged PRs, PRs closed or rejected without a merge, and merges that exist only in a fork.
- **Ask the instructor:** about a PR you opened before the term began.

The "PR opened" entries in the calendar are progress checkpoints; only merged PRs meet the requirement. Maintainers control acceptance, so start in week 1, follow up on reviews every week, and keep extra viable contributions going if a review stalls.

### Evidence table

In your product README, add one row per PR with these seven fields:

1. Student name and GitHub handle
2. Official repository
3. License URL
4. Star count and the date you checked it
5. PR URL
6. Contribution summary
7. Merge evidence showing the change on the main development branch

### Contribution etiquette

- Before you start, read the project's CONTRIBUTING guide and AI-use policy; some projects restrict AI-assisted work or outside PRs.
- Check for duplicates, reproduce the issue, keep the change focused, and run the project's tests.
- Write all maintainer-facing text yourself (issue comments, PR descriptions, review replies), and respond to reviews respectfully.
- Don't manufacture issues, spam maintainers, or split one change into artificial PRs. Legitimate small fixes are fully acceptable.

## Working method, AI use, assessment and reproducibility

**AI assistants.** AI coding tools are allowed from week 1. You must understand and verify everything you submit. Your product README includes a short AI-use note: the tools you used, the help you received, and the checks you performed. Prompt logs are not needed.

**Assessment.** Assessment covers working behavior, understandable design, tests, reproducibility, documentation, contribution evidence, and your individual understanding. You individually explain your own product work and each of your contributions, including how you verified them, even if you build in a pair.

**What a grader does.** A grader clones your repository, configures the documented settings, runs the stack, exercises the frontend, runs the tests, and inspects the important failure cases. To make that path work, the recommended setup is:

- `docker compose up --build` starts the stack after the documented setup.
- Dependency manifests and lockfiles (`pyproject.toml`, `uv.lock`) are committed.
- `.env.example` lists every setting without real credentials. Secrets and private user data never reach Git.
- The database initializes itself, and data lives in persistent storage.
- Each service reports health or readiness, for example at `GET /health`.
- The README gives the exact test command for each service.
- Automated tests make no paid API calls; they use deterministic substitutes such as Pydantic AI's `TestModel`.
- Separate instructions explain how to run with a real model.

## Official resources

- [HIT academic calendar](https://www.hit.ac.il/students/calender/) (Hebrew)
- [FastAPI](https://fastapi.tiangolo.com/) · [Pydantic](https://pydantic.dev/docs/validation/latest/) · [Pydantic AI](https://pydantic.dev/docs/ai/overview/)
- [Docker Compose](https://docs.docker.com/compose/) · [uv](https://docs.astral.sh/uv/) · [pytest](https://docs.pytest.org/)
- [Streamlit](https://docs.streamlit.io/) · [Playwright for Python](https://playwright.dev/python/)
- [Contributing to a project on GitHub](https://docs.github.com/en/get-started/exploring-projects-on-github/contributing-to-a-project)

Tool versions in the lecture pages were verified in October 2026; your `uv.lock` pins the versions you actually use.

## Earlier course material

Archived PDFs from earlier runs, for reference only; where they differ, this guide and the lecture pages apply: [Class IX course notes](old/class-ix-course-notes.pdf) · [Slides (2022)](old/slides-2022.pdf) · [Natalie's notes](old/natalie-notes.pdf)

<!-- {% endraw %} -->
