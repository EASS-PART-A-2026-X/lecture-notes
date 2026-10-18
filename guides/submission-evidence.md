# Submission evidence: show what works and what you understand

<!-- {% raw %} -->

[Course home and deadlines](../README.md#assignments-and-deadlines) · [Learning map](learning-map.md) · [Student setup](student-setup.md) · [Final rehearsal](../lectures/11-13-clinics-and-demos.md#grader-style-self-check)

**Use before EX1, EX2 and EX3.** This guide organizes the existing requirements into a review route. It adds no assignment, grading weights, required platform, or new deadline. The [course guide](../README.md) remains authoritative. Recipe Box is the worked example; demonstrate the equivalent behavior in your own domain.

**Your destination:** submit the product repository under **`EASS-PART-A-2026-X/<your-product>`** through the instructor's submission channel. Keep the same repository for all three assignments. Confirm that graders can open it and clone it using their own accounts. A private repository URL alone does not establish access.

<details markdown="1" class="lecture-toc">
<summary>On this page</summary>

- [One short evidence record](#one-short-evidence-record)
- [EX1: the backend](#ex1-the-backend)
- [EX2: the browser and backend](#ex2-the-browser-and-backend)
- [EX3: the complete product](#ex3-the-complete-product)
- [Annotate the evidence](#annotate-the-evidence)
- [A student setup pilot](#a-student-setup-pilot)

</details>

## One short evidence record

Use this as a small README section or a rehearsal note. It is a suggested format, not a new submission artifact. Record actual observations; leave a failed or unrun step visible.

```text
Repository: https://github.com/EASS-PART-A-2026-X/<your-product>
Revision:   <commit SHA, or the release tag required for the final demo>
Environment: <OS, Docker/Compose versions; model configuration if used>
Check:      <exact command or browser action, and its directory>
Expected:   <observable behavior, including stored state>
Observed:   <actual result, exit status, test summary or error>
Limits:     <what this check did not establish>
```

From your product folder, `gh repo view --json nameWithOwner,url` checks the destination and `git rev-parse HEAD` identifies your local revision. `git status` reveals uncommitted changes. A passing CI run for an earlier commit is evidence about that earlier commit; use the revision you are submitting.

Do not paste credentials, `.env`, database contents, private records, or full assistant transcripts into an evidence note. Use synthetic examples. Screenshots can show a user flow; test output and a reproducible command explain how to check it again.

## EX1: the backend

**Due Monday 9 November 2026, 23:59 Israel time.** Follow the [assignment definition](../README.md#assignments-and-deadlines) and [Lecture 3 completion check](../lectures/03-persistence-and-first-pr.md#completion-check).

| Existing requirement | Show the behavior | Explain the boundary |
|---|---|---|
| CRUD API and Pydantic validation | Create, read, update and delete a synthetic record; try invalid input and an absent record | Why do these requests return different status codes? |
| Persistent data | Create a record, stop and restart through the documented procedure, then read it | Which process owns the database, and where does its storage live? |
| Tests | Run the documented backend test command | Which failure would make one important test fail? |
| Backend Dockerfile | Build and start it using the documented command and persistent storage | What is in the image, and what survives container replacement? |
| Setup, run and test instructions | Follow them from a clean checkout | Which files and settings are needed before the first command? |

**Worked annotation:** “`POST /recipes` returns 201 and the record can be fetched after restart” supports creation and durability. “`GET /health` returns 200” supports reachability; it does not prove CRUD or persistence. A screenshot of `/docs` is useful orientation, not evidence that every operation works.

## EX2: the browser and backend

**Due Monday 30 November 2026, 23:59 Israel time.** Follow [Lecture 5's completion check](../lectures/05-frontend-reliability-testing.md#completion-check). EX2 extends EX1; the AI service is part of EX3.

| Existing requirement | Show the behavior | Explain the boundary |
|---|---|---|
| Browser UI connected to EX1 | Create, edit and delete through the UI; confirm backend state | Which component sends HTTP, and which component commits the record? |
| Validation and error states | Submit invalid input and stop the backend; restore it afterwards | How does the user recover, and what happens to their draft? |
| An automated UI or integration flow | Run the documented flow and inspect its actual result | What does this test cover, and what does it substitute? |
| Reproducible instructions | Start the frontend and backend from the README | Which addresses are used by the browser and by the frontend process? |

**Worked annotation:** a browser-created record that appears after refreshing or reopening the page supports integration with persistent backend state. A form that only changes session state can look correct in one browser session while never reaching the backend. Explain how your check distinguishes them.

## EX3: the complete product

**Due Monday 11 January 2027, 23:59 Israel time**, together with the open-source evidence. Use the [full rehearsal](../lectures/11-13-clinics-and-demos.md#demo-rehearsal-checklist) for commands and the [final-demo requirements](../lectures/11-13-clinics-and-demos.md#what-you-bring-2) for the release tag and demonstration.

| Existing requirement | Show the behavior | Explain the boundary |
|---|---|---|
| Three application services and Pydantic AI | Browser → backend → independent AI service → validated result → backend persistence | What does the model propose, what does code enforce, and which service writes data? |
| Docker Compose and initialization | Start from a clean checkout with the documented settings; exercise the browser | How do service DNS, health checks, configuration and the data volume work? |
| Automated tests and failure tests | Run the checks, stop the AI service, verify ordinary CRUD, then recover | Why does a timeout not prove that remote work stopped? |
| Basic CI | Open the successful run for the submitted revision | Which commands ran, and what do they leave untested? |
| Small AI evaluation dataset and results | Show the cases, expected behavior, model/configuration, date and results | Which outcomes are schema checks, domain quality, or control-flow checks? |
| Demo and short runbook | Follow the clean-clone demonstration, including one failure and recovery | How do restart, reset, rollback and restore differ? |
| Individual understanding and AI-use note | Explain your own changes and how you verified assistant help | Which part did you personally inspect or test? |
| Three qualifying merged upstream PRs per student | Complete the [seven-field evidence table](../README.md#evidence-table) and check each merge | Why does a PR in the course organization not satisfy the upstream rule? |

Real-model instructions remain separate and optional. Deterministic substitutes keep automated tests free and repeatable; their passing results do not measure a real model's quality. If an evaluation uses canned outputs or a fake model, label that condition. Record unavailable measurements as unknown.

## Annotate the evidence

The notes below are original examples of **reasoning**, not real test results or model benchmarks. They carry no grading weights.

| Evidence note | What a reviewer can conclude | What is still needed |
|---|---|---|
| “The AI says it is done.” | A claim was made | Actual diff, commands, results and an explanation |
| “Ten tests pass.” | Ten named checks passed in the stated run | Revision, environment, test scope and a relevant failure case |
| “The fake-model integration test saves exactly one validated row.” | The tested service wiring and persistence path work under that substitute | Real-model quality evidence before claiming extraction accuracy |
| “A held-out recipe gets the wrong servings after quantization.” | This case regressed under the recorded configuration | Keep the failure visible, investigate, and avoid a universal model ranking |

**Five-minute rehearsal:** a partner picks one submitted commit. Explain a request, a state change and one failure without an assistant. Then run the check you named. If the explanation and the observation disagree, repair the understanding or the implementation before presenting it.

## A student setup pilot

**Instructor release check; not an extra student assignment.** The website, reference stack and PDF have automated checks. Those do not prove that a new student's invitation, laptop, campus network or grader permissions work. Use this checklist with volunteers; do not describe the pilot as passed until someone performs it.

1. Use the public website and PDF from the student's network. Follow [setup Part A](student-setup.md#part-a-before-the-first-meeting) on representative Windows/WSL, macOS and, where used, Linux machines. Record OS, versions and the first blocker; keep student identities in the instructor's private records.
2. Sign in with the student's own GitHub account, accept the intended invitation, and confirm organization repository creation **or** the instructor-created empty repository route. Do not broaden organization access merely to make the pilot pass.
3. In Lecture 1's sequence, commit, push to the organization project, open and merge the practice PR, and confirm the instructor/grader can clone it with their own account. Never share a token to work around access.
4. Run the relevant product checkpoint. For the final rehearsal, run the integrated reference or the student's documented Compose stack, exercise the browser, verify persistence and recover from one service outage. Keep model access optional.
5. Time preparation and the lab separately. Record pauses, misunderstood instructions and what had to be explained aloud. Update the earliest unclear step and rerun the affected part.

Suggested private pilot record:

```text
Date / platform:
Website and PDF: passed / failed / not run
Account and organization access: passed / failed / not run
Push, PR and grader clone: passed / failed / not run
Relevant product checkpoint: passed / failed / not run
Preparation minutes / lab minutes:
First blocker and the instruction that needs repair:
```

No pilot measurements or student-access results are asserted by publishing this guide. The existing [weekly learning map](learning-map.md#the-class-by-class-path) is the starting route; adjust teaching pace from observations, while preserving the published requirements and deadlines.

<!-- {% endraw %} -->
