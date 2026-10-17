# Learning map: what to understand and demonstrate each week

<!-- {% raw %} -->

[Course home and deadlines](../README.md) · [Student setup](student-setup.md) · [Engineering foundations](engineering-foundations.md) · [Models and AI literacy](models-and-ai-literacy.md)

**One product, built in stages.** You enter with basic Python and leave with a reproducible three-service application, a bounded AI feature, tests, evaluation evidence, and accepted open-source contributions. This map helps you study; the README remains the authority for assignments, dates, and grading.

For the practical connection between configuration, skills, and delivery evidence, use [Engineering contracts: manifests, skills, factories, and evaluations](engineering-contracts.md). It includes Docker reference checks, Compose validation, and a skill-comparison exercise.

Use the [visual system walkthrough](system-walkthrough.md) to connect service boundaries, validation, database commits, deadlines, and failure recovery to one user journey.

<details markdown="1" class="lecture-toc">
<summary>On this page</summary>

- [How to read a lecture](#how-to-read-a-lecture)
- [The class-by-class path](#the-class-by-class-path)
- [What is required and what is a choice](#what-is-required-and-what-is-a-choice)
- [A repeatable study cycle](#a-repeatable-study-cycle)
- [Engineering studio and review criteria](#engineering-studio-and-review-criteria)
- [Verified reference checkpoints](#verified-reference-checkpoints)
- [Teaching references](#teaching-references)
- [When you are behind](#when-you-are-behind)
- [Individual understanding](#individual-understanding)
- [Instructor pacing and readiness review](#instructor-pacing-and-readiness-review)

</details>

## How to read a lecture

1. **Before you start:** run the previous checkpoint. Bring a precise blocker if it fails.
2. **Learning checkpoint and concepts:** predict one result before reading the implementation. Use the foundations guide when a term is unfamiliar.
3. **Live demo:** follow the request path and explain each changed file. Recipe Box is a worked example; your own product has its own domain.
4. **Hands-on lab:** make the behavior work in your product. Run the intermediate checkpoints rather than pasting a whole lecture at once.
5. **Break it on purpose:** create a controlled failure and identify the check that detects it. Restore the intended behavior afterwards.
6. **Completion check and quiz:** demonstrate the behavior and explain why it works. Reveal answers after trying the questions.
7. **Stretch goals:** explore after the core flow works. Optional infrastructure does not replace required behavior.

Instructions identify the directory where a command runs. Code marked “excerpt,” “append,” or “the parts that change” updates earlier files; it is not always a complete replacement file. Keep a working Git checkpoint so you can inspect and reverse a mistaken edit.

## The class-by-class path

| Class | Main engineering question | Evidence you should be able to explain |
|---|---|---|
| [1 — Workbench](../lectures/01-environment-git-docker-ai.md) | Which files, interpreter, process, and Git history am I using? | `/health` response, a reviewed practice PR, narrow product sketch |
| [2 — API](../lectures/02-http-fastapi-pydantic.md) | What may clients send, and what do they receive? | CRUD contract, meaningful 422/404 cases, isolated API tests |
| [3 — Persistence](../lectures/03-persistence-and-first-pr.md) | What survives a restart, and who owns that state? | Unchanged API behavior, seed/restart tests, persistent Docker data |
| [4 — Frontend](../lectures/04-browser-frontend.md) | Which process handles a click and sends each request? | Create/edit/delete flows, validation feedback, persisted result |
| [5 — Reliability](../lectures/05-frontend-reliability-testing.md) | What happens while loading, empty, failed, and successful? | Controlled HTTP-failure tests and one real browser flow |
| [6 — Agent](../lectures/06-pydantic-ai-agents.md) | What does the model propose, and what does code enforce? | Typed extraction, allowed tools, a retry trace, offline tests |
| [7 — Services](../lectures/07-third-service-contracts.md) | How do independently running components agree and fail? | Three-service flow, consumer validation, timeout/outage behavior |
| [8 — Compose](../lectures/08-docker-compose.md) | Can another machine start the same system? | Clean checkout startup, service DNS, health, persistent volume |
| [9 — Evals](../lectures/09-failures-evals-costs.md) | How do you measure quality and bound a bad request? | Selective retry tests, budgets, dataset/evaluators, dated results |
| [10 — Release](../lectures/10-ci-security-release.md) | What evidence and controls make a release reviewable? | Green CI, clean-checkout run, security controls, tag and runbook |
| [11 — Integration clinic](../lectures/11-13-clinics-and-demos.md#meeting-11--integration-and-upstream-review-clinic) | Where is the first broken boundary? | A reproduced blocker, targeted repair, upstream-review next steps |
| [12 — Rehearsal](../lectures/11-13-clinics-and-demos.md#meeting-12--demo-rehearsal-troubleshooting-and-evidence-review) | Can someone else repeat the demonstration? | Fresh-clone rehearsal, failure recovery, checked contribution evidence |
| [13 — Demonstration](../lectures/11-13-clinics-and-demos.md#meeting-13--final-demos-and-individual-technical-discussion) | Can you operate and explain the product you submit? | Working user journey, individual answers, verified merged PRs |

The open-source track runs alongside all of these classes. Each student needs three qualifying **merged** PRs by the README's deadline. Start early, obey upstream policies, and write maintainer-facing text yourself. A local product PR is useful practice but does not satisfy that requirement.

## What is required and what is a choice

| Required by the course | A choice or optional extension |
|---|---|
| FastAPI, Pydantic, Pydantic AI, Docker Compose | Cursor, VS Code, or another editor |
| Browser UI, backend, and independent AI application service | Copilot, Codex, Gemini, Claude Code, OpenCode, Z.ai, or manual development |
| Backend-owned persistent product storage | SQLite is sufficient; PostgreSQL is optional |
| Automated tests and a small AI evaluation dataset with results | A paid model account or a large local model is unnecessary |
| Reproducible setup, CI, runbook, and individual explanation | Mastra, Airflow deployment, Kubernetes, RAG, and multi-agent orchestration are optional exploration |

Use the assistant and model you can access. If a tool lacks a model picker or a provider is unavailable, meet the same learning outcome with an alternative. The [setup guide](student-setup.md) provides routes; the [model guide](models-and-ai-literacy.md) explains how to compare them.

The [agent-driven engineering guide](agent-driven-development.md) connects development agents to runtime agents. The [factory lab](software-factory-lab.md) illustrates how a candidate change progresses through tests, review, and delivery. Both deepen the existing product work without adding another graded project.

Read [local inference and transformers](local-inference.md) before Lecture 6 and revisit its measurements in Lecture 9. Use [agent sandboxes](agent-sandboxes.md) alongside Lectures 1, 6, 8, and 10. The concepts support the shared path; local hardware experiments and specialized sandbox infrastructure are optional.

## A repeatable study cycle

**Before class:** check the prerequisites, read the mission, and predict one request or failure. Write down the first thing you cannot explain.

**During class:** identify the relevant process, file, boundary, and state. Run a small step, inspect its result, and compare it with your prediction.

**After class:** adapt the example to your domain, run the completion check, and explain one failure without reading an assistant's answer. Commit a working checkpoint and update your product's run instructions when they change.

Keep the required AI-use note short: tool, kind of help, and verification performed. Keep task/model settings and dated results with evaluations. Full prompt transcripts are not required.

## Engineering studio and review criteria

Use this 25-minute formative routine on one small change during the existing lab. It adds practice, not another submission or grading category.

1. **Specify (4 minutes):** write the input, observable output, rejected inputs, and one invariant before asking an assistant to implement anything. An invariant is a condition that must remain true, such as “only the backend writes product records.”
2. **Partition (4 minutes):** choose cases with different expected behavior. For a recipe title, consider valid text, an empty string, whitespace-only text, a missing field, `null`, and the wrong type. Derive expectations from your actual schema; do not assume whitespace is rejected unless the contract says so.
3. **Implement and test (8 minutes):** make the smallest change. Run a targeted check and the relevant regression checks. Record actual results, including failures; a generated test that was never executed is a proposal.
4. **Review (5 minutes):** a partner reads the diff and contract. Report one concrete observation with file/function, triggering input, expected and actual behavior, and a reproducer. If no defect is found, explain which property you checked and what remains uncertain. Keep review within the team's permitted collaboration rules.
5. **Revise and explain (4 minutes):** address the finding, rerun checks on the final revision, and explain one decision without the assistant. Save the commit and evidence together.

Suggested applications: class 2, API input partitions; class 3, seed/restart invariants; class 5, a loading or failure state; class 6, permitted agent tools; class 9, a held-out evaluation case; class 10, release evidence. For upstream work, follow that project's collaboration and AI policies instead of assuming this local routine is allowed.

| Self-review question | Evidence of readiness | Revise when… |
|---|---|---|
| Does it meet the contract? | Normal, boundary, and rejected-input cases have stated outcomes | Only the happy path is demonstrated |
| Can another person understand it? | Small diff, useful names, explanation of the changed behavior | The author cannot trace a request through the code |
| Do checks detect meaningful faults? | A controlled failure fails the intended check; the repair passes | Checks merely repeat implementation details or assert nothing |
| Are authority and failure bounded? | Validation, state ownership, permissions, timeouts, and user feedback are explicit | Model output is treated as permission or a timeout as proof of no effect |
| Can someone reproduce the result? | Final commit, commands, environment assumptions, and observed results are recorded | Evidence refers to an earlier revision or an unknown model configuration |

These are feedback criteria, not replacement marks. A student should be able to explain the evidence as well as produce it. An assistant can suggest cases and critique a diff; the student remains responsible for the contract and the observed result.

## Verified reference checkpoints

The course repository automatically executes three complete reference checkpoints on every pull request and publication:

- **Lecture 2:** the ten API tests covering CRUD, rejected input, pagination, partial updates, and test isolation.
- **Lecture 3:** the unchanged API tests plus file-backed restart and idempotent-seed checks.
- **Lecture 6:** six deterministic agent tests covering the endpoint, validation retry, structured output, and domain tools. Real model requests are disabled by the test fixture.

The verifier copies code directly from the lecture text into temporary projects, follows the printed continuation/import instructions, and runs tests, lint, and formatting. It uses Python 3.14 and committed dependency versions. There is no separate example implementation to drift away from what students read.

If you have cloned **this course-notes repository**, you can run its checks from the repository root:

```bash
uv run --locked .github/scripts/check_examples.py
```

The first run downloads the pinned Python dependencies. Expected: ten API tests, twelve persistence tests, and six agent tests pass, followed by lint/format checks. The temporary projects are removed afterwards. This command checks the notes; run your own product's test commands in your product repository too.

These checks establish that those three complete examples work with the recorded dependencies. They do not prove every later excerpt is a standalone program, a real model extracts accurately, or a browser/deployment works. Later lectures deliberately ask you to extend earlier files; use their completion checks and failure drills. When reporting a problem, include the lecture link, dependency versions, exact command, and redacted error.

## Teaching references

Reviewed **17 October 2026**. MIT's current public [6.102 Software Construction site](https://mit.edu/6.102/) points to Spring 2026. Its [course objectives and active-learning structure](https://web.mit.edu/6.102/www/sp26/general/) emphasize specifications, invariants, testing, comprehensible code, and repeated practice with feedback. Those ideas inform the checkpoints and review routine above.

Stanford's [CS146S: The Modern Software Developer, Fall 2026](https://themodernsoftware.dev/) describes specification-driven work, agent context and tools, iterative evaluation, and software factories. Those themes inform this course's bounded coding-agent workflow and factory lab. Here, students apply them to the same undergraduate Python product rather than adding a second framework or project.

The studio exercises and review criteria on this page are original adaptations for this course. Use the linked courses as further reading; this course retains its own prerequisites, assignments, calendar, and assessment policy.

## When you are behind

Find the earliest broken checkpoint. A frontend error may come from an unavailable backend, which may come from a missing database directory. Adding more generated frontend code does not repair that dependency.

1. Confirm the correct folder, environment, and command.
2. Run the smallest check at that boundary, such as `/health` or one failing test.
3. Read the relevant service's error, redact secrets, and use [PARD](../lectures/01-environment-git-docker-ai.md#asking-for-help-the-pard-template).
4. Ask a person or assistant for a targeted explanation or repair.
5. Restore the checkpoint before taking on a stretch goal.

An unavailable model should not block ordinary API/UI work or deterministic tests. If installation rights, hardware, access, or a documented accommodation requires another route, contact the instructor early. Work with synthetic data while the environment is being resolved.

## Individual understanding

Be ready to trace one user action through your own code, explain a boundary, and defend a verification decision. You should be able to answer:

- What input caused the behavior, and where is it validated?
- Which process/function/tool ran next, with what permissions?
- Where is the authoritative state, and when is it committed?
- What can fail, and what does the user see?
- Which check detects that failure, and what does it leave unproven?
- What changed in the final diff, and why is it necessary?

These support the existing individual technical discussion. They apply whether code was typed manually, completed by an editor, or produced by a coding agent.

## Instructor pacing and readiness review

Treat each live demonstration as checkpoints with pauses, not one long paste. For each class, identify the essential user behavior, one failure to demonstrate, and one explanation to hear from students. If the setup checkpoint fails for many students, resolve it before introducing the next layer.

The lectures' core sequence is setup → API → durable state → UI → tests → agent → service boundary → Compose → evaluations → release. Each class now includes a learning checkpoint and a targeted bridge back to fundamentals. Meetings 11–13 consolidate those skills through diagnosis, rehearsal, and demonstration.

Offer advanced learners the existing stretch goals while keeping the shared completion check reachable. Verify changing installer, education-benefit, and model-catalog links before teaching. Treat vendor claims as hypotheses to test; keep the course's stack, deadlines, and contribution rules explicit.

<!-- {% endraw %} -->
