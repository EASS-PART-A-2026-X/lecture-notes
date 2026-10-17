# Software factory lab: from work order to verified delivery

<!-- {% raw %} -->

[Course guide](../README.md) · [Agent-driven engineering](agent-driven-development.md)

**Suggested time:** 45–60 minutes, after you have written and run backend tests. Revisit the delivery questions in Lecture 10. This is formative practice with a separate demonstration repository; it adds no assignment or infrastructure requirement.

For the practical connection between configuration, skills, and delivery evidence, use [Engineering contracts: manifests, skills, factories, and evaluations](engineering-contracts.md). It includes Docker reference checks, Compose validation, and a skill-comparison exercise.

<details markdown="1" class="lecture-toc">
<summary>On this page</summary>

- [What you will learn](#what-you-will-learn)
- [The instructor's Airflow factory](#the-instructors-airflow-factory)
- [Part A — replay a complete change](#part-a--replay-a-complete-change)
- [Part B — commission a change in your product](#part-b--commission-a-change-in-your-product)
- [Part C — challenge the evidence](#part-c--challenge-the-evidence)
- [From a local loop to orchestration](#from-a-local-loop-to-orchestration)
- [Debrief](#debrief)
- [Sources and verification boundary](#sources-and-verification-boundary)

</details>

## What you will learn

A software factory turns a request into a candidate, checks that candidate, and moves it through an authorized delivery process. The model can help write code; the surrounding system must decide which checks run, retain the results, and enforce the allowed effects.

By the end, explain:

- what a work order specifies and what remains a design decision;
- which evidence belongs to which source revision;
- why repair attempts need a limit and an explicit failure outcome;
- how review can find a gap after tests pass;
- why a local replay, a GitHub PR, a merge, and a deployed product are different milestones.

## The instructor's Airflow factory

Yossi's [`ariflow-swfactory`](https://github.com/zozo123/ariflow-swfactory) is a substantial case study. Its managed architecture gives Airflow lifecycle scheduling, gives bounded stage agents implementation work, and keeps publication under a trusted control plane. Candidate evidence binds inputs, outputs, diffs, and retained artifacts to identified revisions.

For teaching, extract this sequence:

```text
work order → specification → plan → bounded implementation/repair
           → verification → review → authorized delivery
```

The repository's [lifecycle documentation](https://github.com/zozo123/ariflow-swfactory/blob/b2de672bca6e7a8eb3cb33471396384e16eb555c/docs/lifecycle.md) separates a stable control workflow from issue-specific work. Its [candidate-evidence design](https://github.com/zozo123/ariflow-swfactory/blob/b2de672bca6e7a8eb3cb33471396384e16eb555c/docs/candidate-evidence.md) asks a precise question: which candidate bytes and procedure support this result?

You will first run a small local fixture replay. It uses scripted agent outputs; it does not start Airflow or validate a live autonomous deployment. Later, use the same reasoning with your product and chosen coding assistant.

## Part A — replay a complete change

Use a separate directory outside your product. You need Git and [uv](https://docs.astral.sh/uv/); dependency installation needs network access. The pinned example uses Python 3.12, independently of your course product's Python version. Let uv provision that interpreter if needed.

```bash
git clone https://github.com/zozo123/ariflow-swfactory.git
cd ariflow-swfactory
git checkout b2de672bca6e7a8eb3cb33471396384e16eb555c
uv sync --locked
uv run swfactory demo
```

This snapshot was replayed on **16 October 2026**. It needs no model key, GitHub token, Docker, Airflow, or Rust. The replay makes local Git changes in its demonstration workspace and delivers to a local remote; it opens no GitHub PR. Its fixture approvals are automatic, not human approval evidence.

Expected observations:

1. The terminal labels the run **SCRIPTED REPLAY**.
2. Intent and plan receive fixture approvals.
3. `build_and_test` reports two iterations and `first_pass_ci=0`: an initial failure was repaired.
4. The resulting build reports seven tests and passing status.
5. Review still identifies a missing negative-baseline test among its findings.
6. Delivery prints a local `pr.md` path, with zero model spend.

Follow the printed paths to `.factory/<run_id>/report.json` and `.factory/<run_id>/pr.md`. Inspect the retained intent, plan, review, and metrics. In the replay workspace, read the test and implementation diffs too.

Discuss with a partner:

- Which requirement did the initial patch fail? Find the failing check rather than guessing from the final summary.
- Does a review finding mean the implementation is wrong, the coverage is incomplete, or both? What evidence would distinguish those claims?
- Which stages were scripted and which checks actually executed?
- What would you still need before claiming a real agent solved the task or a live deployment worked?

If installation is unavailable, inspect the pinned repository's [`demo/scripted`](https://github.com/zozo123/ariflow-swfactory/tree/b2de672bca6e7a8eb3cb33471396384e16eb555c/demo/scripted) patches and review file. Label that activity **artifact inspection**, not an executed replay.

## Part B — commission a change in your product

Choose one small behavior you can verify, such as the missing-recipe response from the [development-loop brief](agent-driven-development.md#the-development-loop). Keep this experiment on a branch in your own product repository. Use your available assistant, or perform the implementation manually; the verification exercise is the same.

Write a short work order with these fields:

| Field | What to specify |
|---|---|
| Outcome | User-visible behavior and why it matters |
| Acceptance | Normal, boundary, and failure examples |
| Context | Relevant service, files, interfaces, and existing tests |
| Constraints | Compatibility, dependency, state, and permission boundaries |
| Verification | Exact commands and the user flow to exercise |
| Budget | A small time/repair limit for this experiment |
| Stop conditions | Verified candidate, unresolved ambiguity, failed check, or exhausted limit |
| Delivery authority | Whether this task permits any remote publication |

Then run one bounded cycle:

1. Record the starting commit and establish a clean branch. Keep unrelated work outside the experiment.
2. Have the assistant inspect the code and propose a small plan. Resolve behavior ambiguities yourself.
3. For a bug, write a relevant regression test and see it fail for the expected reason.
4. Let the assistant implement and run checks within the brief. Inspect the diff yourself.
5. At the chosen limit, either retain a verified candidate or record why it is blocked. Do not weaken the check or silently restart the repair budget.
6. Commit the candidate on the local branch. From a clean checkout of that commit, rerun the affected checks and retain their output. Keep generated evidence outside the tracked source or in a CI artifact.

Keep a small evidence record; a full chat transcript is unnecessary:

```text
Work order: missing recipe returns the documented 404 response
Candidate: full commit SHA
Environment: interpreter and committed dependency lock
Checks: exact commands, exit status, and retained output location
Coverage: normal read, missing read, and malformed-ID contract
Review: findings, decisions, unresolved uncertainty
Delivery: local candidate / PR URL / merge SHA / deployed revision, as applicable
```

Record only states actually reached. If a command was unavailable or a test failed, say so. If you change the candidate after verification, rerun the affected checks and update the record. A trustworthy CI run records the revision it checked; typing a SHA into a note alone does not bind evidence to those bytes.

## Part C — challenge the evidence

Try two of these drills on the disposable experiment branch. Restore the intended behavior afterwards. Keep assignment tests and release controls intact.

| Drill | What to observe | Engineering response |
|---|---|---|
| Temporarily break the behavior protected by the new test | The test must fail for that behavior | Strengthen an irrelevant or ineffective test |
| Change source after a passing run | The earlier result describes an older candidate | Verify the changed revision |
| Introduce a controlled service outage | A unit suite may stay green while the user flow fails | Add the appropriate integration/failure check |
| Add a requirement the work order left ambiguous | A plausible patch may implement the wrong interpretation | Resolve the requirement before approving the candidate |
| Ask a reviewer to challenge the happy-path coverage | A counterexample may expose a gap in passing tests | Add a justified case and rerun |

The reviewer may be a classmate or a separate assistant context. Give it the work order, diff, and evidence; ask for reproducible findings. Check its claims too. A fresh context reduces some shared assumptions, but does not guarantee independence or correctness.

## From a local loop to orchestration

Start with commands you can run and explain. A branch, test runner, and CI are enough to learn the core method. Airflow becomes useful when scheduling, concurrent work, retries, approval waits, and recovery need durable coordination.

In the instructor factory, Airflow owns the managed lifecycle. A stage agent can have its own bounded tool loop without becoming another lifecycle scheduler. This is the same separation you met in [Mastra's workflow/agent comparison](agent-driven-development.md#what-mastra-contributes): explicit outer stages can contain uncertain model-driven work.

Before adding parallel agents, define input revisions, separate workspaces, budgets, and who integrates the results. Test the combined candidate after integration. Sibling agents starting from the same code and instructions do not provide independent evidence merely because there are several of them.

Separate three controls when discussing a harness:

- **Guidance:** project instructions and skills describe how to work.
- **Execution:** runtime restrictions determine which files, commands, network destinations, and credentials are accessible.
- **Promotion:** trusted CI and repository policy determine whether a candidate may be published, merged, or released.

A worktree isolates source changes, not processes or credentials. A successful check supports a bounded claim, not permission. A merged PR can still await deployment. Define completion at the level the user actually requested.

## Debrief

Explain one candidate without consulting the assistant:

1. What behavior changed, and which requirement justified it?
2. Which observation showed the original failure?
3. Which revision passed which checks?
4. What did review find that those checks missed?
5. Which operations were permitted, and which component enforced that boundary?
6. What remains unknown, and what would be the next useful check?

For the product agent, ask the corresponding questions about its input, allowed tools, limits, output validation, and evaluation cases. The development process and the runtime agent share these engineering questions, even though their work and authority differ.

## Sources and verification boundary

- The instructor's [factory README at the teaching snapshot](https://github.com/zozo123/ariflow-swfactory/blob/b2de672bca6e7a8eb3cb33471396384e16eb555c/README.md) describes the replay, managed architecture, alpha status, and experimental features.
- The pinned lifecycle and candidate-evidence documents above support the architectural case study. The local replay was executed; selected demo and candidate-evidence tests were also run when preparing this lesson. This does not certify the full factory or its live Airflow, provider, or GitHub integrations.
- For coding-tool context and controls, use the official documentation in [Agent-driven engineering](agent-driven-development.md#sources-and-further-exploration).

Do not point this exercise at an upstream project to generate contribution traffic. Follow the course's [open-source rules and etiquette](../README.md#contribution-etiquette), including writing maintainer-facing prose yourself.

<!-- {% endraw %} -->
