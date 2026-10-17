# Learning map: what to understand and demonstrate each week

<!-- {% raw %} -->

[Course home and deadlines](../README.md) · [Student setup](student-setup.md) · [Engineering foundations](engineering-foundations.md) · [Models and AI literacy](models-and-ai-literacy.md)

**One product, built in stages.** You enter with basic Python and leave with a reproducible three-service application, a bounded AI feature, tests, evaluation evidence, and accepted open-source contributions. This map helps you study; the README remains the authority for assignments, dates, and grading.

For the practical connection between configuration, skills, and delivery evidence, use [Engineering contracts: manifests, skills, factories, and evaluations](engineering-contracts.md). It includes Docker reference checks, Compose validation, and a skill-comparison exercise.

Use the [industry engineering studio](industry-studio.md) to practice repository reading, acceptance criteria, code review, record authorization, concurrency, migration and operational judgment. It maps these skills to the existing classes and offers an optional tested database lab.

Use the [visual system walkthrough](system-walkthrough.md) to connect service boundaries, validation, database commits, deadlines, and failure recovery to one user journey.

<details markdown="1" class="lecture-toc">
<summary>On this page</summary>

- [How to read a lecture](#how-to-read-a-lecture)
- [The class-by-class path](#the-class-by-class-path)
- [Visual checkpoints](#visual-checkpoints)
- [What is required and what is a choice](#what-is-required-and-what-is-a-choice)
- [A repeatable study cycle](#a-repeatable-study-cycle)
- [Engineering studio and review criteria](#engineering-studio-and-review-criteria)
- [Verified reference checkpoints](#verified-reference-checkpoints)
- [Choose the smallest useful AI system](#choose-the-smallest-useful-ai-system)
- [Teaching references](#teaching-references)
- [Turn a conference idea into evidence](#turn-a-conference-idea-into-evidence)
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

## Visual checkpoints

Use a diagram to make a prediction, then follow the code and run the relevant check. The picture explains a model of the system; it is not execution evidence.

| When studying | Trace this visual | Explain without the assistant |
|---|---|---|
| Classes 1–3: processes and state | [Database commit boundary](system-walkthrough.md#follow-the-commit-boundary) | What is still only a candidate, and what has been committed? |
| Classes 4–5: a usable UI | [Four request states](../lectures/05-frontend-reliability-testing.md#four-states-every-screen-needs) | Why are an empty response and a failed request different? |
| Class 6: the runtime agent | [Model proposal, tool execution, output checks](../lectures/06-pydantic-ai-agents.md#an-agent-is-a-loop-around-a-model) | Which code executes a tool and which check accepts the output? |
| Classes 7–8: service boundaries | [Compose service map](../lectures/08-docker-compose.md#networking-where-is-localhost) | Which process sends each HTTP call, and which URL can it resolve? |
| Class 9: usage and failure | [Token threshold counterexample](../lectures/09-failures-evals-costs.md#malformed-output-and-cost-limits) | Can already processed usage cross a configured threshold? |
| Class 10 and clinics: delivery | [Factory lifecycle and evidence](software-factory-lab.md#the-instructors-airflow-factory) | Which revision was checked, and what delivery milestone was actually reached? |
| Model foundations and optional inference | [Training/runtime data map](models-and-ai-literacy.md#a-visual-data-lifecycle) and [latency experiment](local-inference.md#latency-experiment) | What changes weights, what supplies context, and where does the request spend time? |

Cover the caption, trace one ordinary case and one failure, and name what the diagram leaves out. Then run the lesson's completion check. No extra submission is required.

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

For difficult concepts, use a worked example, predict a small variation, then solve a fresh variation with the answer hidden. Return to it after a delay and explain the mechanism aloud. Try this with the [training/runtime data map](models-and-ai-literacy.md#a-visual-data-lifecycle) and [inference latency experiment](local-inference.md#latency-experiment), then revisit them in Lectures 6 and 9.

This teaching routine draws on the IES guide's [worked-example, graphics and retrieval recommendations](https://ies.ed.gov/ncee/wwc/PracticeGuide/1) and CMU's [goal-directed practice and feedback principles](https://www.cmu.edu/teaching/principles/learning.html), reviewed 17 October 2026. These sources inform the activity design; this course has not run a study demonstrating a particular learning gain.

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

The course repository automatically executes three complete reference checkpoints and the standalone exercises below on every pull request and publication:

- **Lecture 2:** the ten API tests covering CRUD, rejected input, pagination, partial updates, and test isolation.
- **Lecture 3:** the unchanged API tests plus file-backed restart and idempotent-seed checks.
- **Lecture 6:** six deterministic agent tests covering the endpoint, validation retry, structured output, and domain tools. Real model requests are disabled by the test fixture.
- **Lecture 9:** six standard-library checks of the [evaluation clinic](../lectures/09-failures-evals-costs.md#evaluation-clinic-audit-the-score), plus two [usage-counter checks](../lectures/09-failures-evals-costs.md#malformed-output-and-cost-limits) showing a blocked next step and an observed token overrun. No provider calls are made.
- **Industry studio:** ten SQLite checks, including denied access, stale writes, inert SQL-looking input, and two concurrent writers on separate connections. This is an optional storage lab, not a new complete HTTP application.

The verifier copies code directly from the lecture text into temporary projects, follows the printed continuation/import instructions, and runs tests, lint, and formatting. It uses Python 3.14 and committed dependency versions. There is no separate example implementation to drift away from what students read. The inference visualization separately has nine Node checks covering its arithmetic, input boundaries and static worked-example consistency; it does not measure a real model.

If you have cloned **this course-notes repository**, you can run its checks from the repository root:

```bash
uv run --locked .github/scripts/check_examples.py
```

The first run downloads the pinned Python dependencies. Expected: ten API tests, twelve persistence tests, six agent tests, eight grader/gate/usage checks, and ten industry-studio checks pass (46 total), followed by lint/format checks. The temporary projects are removed afterwards. This command checks the notes; run your own product's test commands in your product repository too.

These checks establish that those three complete examples work with the recorded dependencies. They do not prove every later excerpt is a standalone program, a real model extracts accurately, or a browser/deployment works. Later lectures deliberately ask you to extend earlier files; use their completion checks and failure drills. When reporting a problem, include the lecture link, dependency versions, exact command, and redacted error.

## Choose the smallest useful AI system

There are several valid designs. State the user problem first, then choose a mechanism and a check. The required course project keeps its existing bounded AI feature and three-service architecture; the alternatives below are design literacy and optional extensions.

| Your problem | A useful starting point | What to verify before adding complexity |
|---|---|---|
| Rules and fields are fully known | Ordinary Python and schema validation | Boundary cases and rejected inputs; a model may be unnecessary |
| The steps are known but text is messy | Fixed workflow with one structured model call | Field accuracy, abstention/error path, latency and budget |
| Answers need changing or private documents | Retrieval plus cited evidence | Retrieval recall, source freshness, access filtering **before** retrieval, and whether claims follow the source |
| The next action depends on intermediate results | One bounded agent with narrow tools | Allowed/denied actions, stop conditions, failures and final state |
| A single agent lacks a genuinely separate capability/context | Compare a specialist handoff with the single-agent baseline | Same tasks/budget; coordination errors, duplicated work and integration ownership |
| Repeated failures remain after fixing context/tools | Compare prompt optimization; consider training only with suitable data/resources | Separate development/check data, provenance, gains by slice, and operational cost |
| Remote inference is unavailable or unsuitable | Offline fake for control tests; optionally a local model for quality experiments | Hardware fit, license, structured output/tool support and task quality—not just tokens/second |

A framework packages choices; it does not decide the product contract. Learn the request/tool/state loop in [Lecture 6](../lectures/06-pydantic-ai-agents.md), compare [agent frameworks and harnesses](agent-driven-development.md), then measure one change in [Lecture 9's evaluation clinic](../lectures/09-failures-evals-costs.md#evaluation-clinic-audit-the-score). Do not introduce an orchestrator, vector database, queue, Kubernetes cluster, or second model merely to fill a technology checklist.

## Teaching references

Reviewed **17 October 2026**. MIT's current public [6.102 Software Construction site](https://mit.edu/6.102/) points to Spring 2026. Its [course objectives and active-learning structure](https://web.mit.edu/6.102/www/sp26/general/) emphasize specifications, invariants, testing, comprehensible code, and repeated practice with feedback. Those ideas inform the checkpoints and review routine above.

Stanford's [CS146S: The Modern Software Developer, Fall 2026](https://themodernsoftware.dev/) describes specification-driven work, agent context and tools, iterative evaluation, and software factories. Those themes inform this course's bounded coding-agent workflow and factory lab. Here, students apply them to the same undergraduate Python product rather than adding a second framework or project.

MIT's [6.S950 Agency with AI, Fall 2026](https://agencyai.mit.edu/) adds delegation judgment, context/harness design, evaluation, and auditing artifacts and judges. We use those **published syllabus themes** to motivate the grader clinic. As of this review, its evaluation/auditing pages announce slides for [17 November](https://agencyai.mit.edu/w9/) and [24 November](https://agencyai.mit.edu/w10/); those future slides were not reviewed. The course has ML and algorithms prerequisites, so its full research-project scope is not assumed here.

Stanford's [CS329Z Engineering AI Agents, Fall 2026](https://cs329z.stanford.edu/) organizes agent engineering around decomposition, data, and evaluation. Its [project guidance](https://cs329z.stanford.edu/project.html) calls for baselines, reproducible environments and failure analysis beyond a successful demo. This informs our small experiment record, slice analysis and grader counterexamples. Its NLP background and research-report requirements do not become prerequisites or new assessment requirements for this course.

The studio exercises, synthetic data, code, decision table, and review criteria here are original teaching material. The linked syllabi provide inspiration and further reading; this course retains its own prerequisites, assignments, calendar, and assessment policy. No MIT/Stanford affiliation or equivalence is implied.

## Turn a conference idea into evidence

**Source snapshot: 17 October 2026.** Conference programs are useful maps of practitioners' concerns. A session title or abstract is not independent evidence that a technique improves your product. The references here were checked as official programs/abstracts; this review does not claim to have watched every recording or reproduced a speaker's results.

| Official source | Relevant published topics | A bounded course experiment |
|---|---|---|
| [AI Engineer World's Fair 2026](https://ai.engineer/worldsfair/2026), 29 June–2 July | Software factories, harnesses, context, evaluations, local AI, inference, sandboxes; listed recordings include production evals and tool selection | Compare focused context/tool exposure with the same agent's broader catalog on the same cases; keep denied-action checks in the tool runner |
| [USENIX SREcon26 Americas: The Ironies of AI²](https://www.usenix.org/conference/srecon26americas/presentation/reed), 25 March | Interaction between automation, AI and operators during incidents | Rehearse an AI-service outage: separate observed evidence from an assistant's hypothesis, keep the human release owner, and verify recovery |

Choose **one** optional experiment after the core product works. Use the [factory lab](software-factory-lab.md) for delivery evidence, [local inference](local-inference.md) for serving tradeoffs, [sandboxes](agent-sandboxes.md) for enforced permissions, or the [system walkthrough](system-walkthrough.md) for a service-failure rehearsal. You do not need a conference ticket or commercial tool subscription.

Keep a six-line research note:

1. **Source and status:** primary URL, author/date, and whether you read a syllabus, abstract, paper, docs, or watched a recording. Mark planned material as planned.
2. **Claim:** one precise behavior, with the environment and limitations in which it is supposed to hold.
3. **Hypothesis:** what should improve in your product, compared with what simpler baseline?
4. **Experiment:** fixed case IDs, component changed, permissions, budget, and a check that could disprove the claim.
5. **Observed result:** counts by slice plus failures, latency/usage where relevant; distinguish measured, simulated, and untested claims.
6. **Decision:** adopt, revise, or reject, with a remaining limitation and the exact revision.

For example, “a smaller tool catalog helps” becomes a comparison of task completion, wrong-tool attempts and usage on the same scenarios. Removing a tool the task actually needs may reduce success. A faster run with the wrong final state is a failure. For the outage rehearsal, an agent's plausible explanation is a hypothesis until a health probe, trace, or controlled reproduction supports it. Read-only investigation and permission to restart or deploy are separate authorities.

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
