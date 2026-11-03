# FactoryOps: build the product, build the factory, operate both

<!-- {% raw %} -->

[Course guide](../README.md) · [Software factory lab](software-factory-lab.md) · [Agent-driven engineering](agent-driven-development.md) · [Submission evidence](submission-evidence.md)

**Optional depth, not an extra EX3 requirement.** Study this after the three-service product works. You do **not** need a particular assistant, three agents, Airflow, a dashboard, cloud hosting, or a paid model. The required EX3 product and its [English-narrated demo recording](../README.md#ex3-recorded-demo-in-english-required) remain unchanged by this optional extension.

## The engineering shift

A traditional team designs a product and operates the infrastructure that builds, tests and deploys it. Coding agents add a new system worth engineering: the *software-producing process itself*. A useful slogan is:

> **Build the product. Build the factory. Run the factory. Run the platform.**

This describes **two systems to build** and **two operational responsibilities**, not four additional microservices or four compulsory deliverables.

| Concern | The question it answers | Example | What does not count as proof |
|---|---|---|---|
| **Product** (build) | What did we build for users? | Your EX3 browser, FastAPI backend and separate Pydantic AI service | A convincing screenshot without persistence or service integration |
| **Software factory** (build) | How do work orders become *verified candidate changes*? | Spec, bounded agent tools, isolated worktree, tests, review, proposed PR | An agent saying "done" |
| **FactoryOps / Mission Control** (operate) | How do people observe, steer, pause and authorize this work? | Attention queue, failure receipts, budgets, human approval | A decorative dashboard or a STOP message no process must honor |
| **DevOps / platform** (operate) | What executes, isolates, verifies and deploys both systems? | CI, runners, sandboxes, caches, secrets, release and monitoring | A prompt that asks an agent to behave safely |

The product and the factory are both software: each can have its own source history, tests, dependencies and releases. The factory may create changes to the product without acquiring permission to merge them. FactoryOps operates that production process; DevOps keeps the underlying execution and delivery platform dependable. In a small student project these may share one repository or terminal, but their **responsibilities and trust boundaries** must remain distinguishable.

### Map of the four concerns

```text
   Work order / human intent
                |
                v
  +---------------------------+    candidates + evidence    +----------------------+
  | FACTORY (software)        | --------------------------> | PRODUCT (software)   |
  | spec -> agent -> checks   |                             | browser / API / AI   |
  | -> review -> proposed PR  |                             | only backend owns DB |
  +-------------+-------------+                             +----------+-----------+
                ^                                                          |
      policy / decisions                                            user outcomes
                |                                                          |
  +-------------+-------------+                                +-----------v---------+
  | FACTORYOPS / MISSION       | <----- status and evidence ---- | observed behavior   |
  | CONTROL                   |                                +---------------------+
  | attention, budget, stop,  |
  | approve/reject a release  |
  +-------------+-------------+
                |
  +-------------v-----------------------------------------------------------+
  | DEVOPS / PLATFORM: CI, runners, sandboxing, cache, secrets, deploys,    |
  | monitoring. It supports BOTH the product and the factory.               |
  +-------------------------------------------------------------------------+
```

**Read the arrows carefully:** a factory proposes a candidate. Checks produce evidence **about that candidate revision**. A separate trusted decision authorizes promotion. Mission Control may *display* an approval button, but the actual permission must be enforced by the platform, repository rules or a trusted controller.

## Three different questions: production, knowledge, authority

1. **Production:** Can an agent generate a candidate? Capture the work order, scope, tools, changed files and revision.
2. **Knowledge:** Why should anyone trust that candidate? Run checks that can fail, inspect counterexamples, use independent measurements, and retain the tested SHA, command, environment and results.
3. **Authority:** Who is allowed to stop, accept, publish or roll back? Identify which rule is advisory, which is enforced by the runtime, and which is enforced by repository or release controls.

These questions should not collapse into one unchecked actor. Generation may be exploratory and parallel; acceptance should be deterministic where possible and governed by evidence and explicit authority.

### Guidance is not enforcement

- `AGENTS.md`, role assignments and natural-language orders guide agents; **they do not restrict their filesystem, network or credentials**.
- Distinct Git worktrees prevent edits from landing in the same checkout; **they do not isolate processes or secrets**. A sandbox or runtime permission boundary must enforce those restrictions.
- Tests, review findings and CI provide evidence about a candidate; **they do not give the model authority to merge**.
- A STOP message is a request. To guarantee interruption of execution, a supervisor must be able to terminate the task or revoke capabilities, while preserving any needed recovery evidence.

The important operational distinction is **observability vs control vs enforcement**. A UI can show a STOP button; only the component that can reliably stop the worker enforces it.

## The mathematics: four non-equivalences

### 1. State convergence is not agreement on meaning

A CRDT such as Yjs is designed to make collaborating replicas converge under its synchronization assumptions when updates are delivered. Informally, the replicas can eventually display the same shared document. This does **not** imply the text is accurate, agents share the same interpretation, or a software change satisfies its specification.

**Counterexample:** three agents all read the same incorrect orbit radius. Their documents agree perfectly; the product is still wrong.

### 2. A green validation gate is not a theorem

A check samples some inputs or properties. A failed test gives a concrete counterexample to the tested claim. Passing a finite suite means **those checks observed no failure under those conditions**. It does not establish correctness over every viewport size, animation frame, concurrent interleaving, or future revision.

If you sample a moving object's location at a few times, you may miss an extreme between samples. More samples improve coverage; a continuous guarantee would need additional reasoning such as a proven bound, a suitable invariant, or exhaustive analysis under explicit assumptions.

### 3. Instrumentation is not automatically an independent oracle

A product can expose its own layout measurements to a validator. That is useful instrumentation, but if an agent controls both the thing being measured and the values reported, a bug or deceptive implementation may satisfy the reported measurement without satisfying the real user goal.

**Design response:** where practical, corroborate self-reported state with a browser geometry read, a screenshot inspected by a human, an independent integration test, or a check over external observable behavior. State exactly which measurement is independent and which is self-reported.

### 4. Review-and-repair is not proof of convergence

A repeated sequence `candidate -> critique -> repair -> critique` need not approach a fixed point. An agent can oscillate between two bugs, regress a previous requirement, or exhaust the available time. A maximum number of retries ensures a **bounded process**, not a correct final result. To claim convergence you would need a justified progress measure and a process that preserves it; an LLM's confidence is not that proof.

**Engineering response:** cap attempts, time and spend; preserve failed evidence; rerun regressions on the *new* SHA; and stop without publication when a gate remains red.

## The Solar System Machine: an honest case study

The course organization's [Solar System Machine](https://github.com/EASS-PART-A-2026-X/solar-system-machine/tree/a81083e) is a small **illustration**, not a mandated stack and not a replacement for EX3's three application services. At commit `a81083e` it separates:

- **Product:** the 3D solar-system page.
- **Factory:** roles A (scene), B (editorial), C (review), instructions, shared document, ownership contract and recorded run.
- **Mission Control:** human orders, visible agent status, a STOP-all command and a validation display.
- **Platform:** the sync server, tests and CI supporting that demonstration.

Use it to identify what the implementation actually enforces:

| Claim | Inspectable mechanism | Limitation to name out loud |
|---|---|---|
| Shared state | Hocuspocus/Yjs synchronizes and persists document updates | Shared text does not prove semantic agreement |
| Write access | The sync server checks a write token | A shared token is not independent proof of the speaker's agent role |
| File ownership | A/B/C have documented file scopes; the run checker reviews recorded edits | Ownership is mostly an agreement checked *after* the edit, not OS-level isolation |
| Order completion | A textual order is followed by `ack` and `done` messages | A text match is not evidence the requested work is correct |
| Stop | Mission Control posts an `ALL: STOP` order | The message is advisory without an enforced task termination path |
| Validation | Product, Mission Control and machine checks run in CI | Checks can miss unsampled geometry; some geometry comes from product instrumentation |

Do not infer that the system has formal safe interruptibility, cryptographically authenticated roles, independent oracles for every property, or deterministic replays. Its `run.json` lets us inspect a recorded trajectory; running the same prompts again may take another path.

**One useful history analogy:** cybernetics studies regulation through feedback, and von Neumann's universal constructor explores formally described construction. This factory resembles a description-plus-builder architecture, **not** a demonstrated universal constructor, self-reproducing machine or formal proof of safe interruptibility.

## Optional EX3 FactoryOps challenge

Only attempt this *after* your required three-service product works. One small, honest work-order loop is more educational than an elaborate multi-agent animation.

1. **Baseline:** choose one real, narrow defect or feature in your EX3 product and capture its original behavior and failing or missing check.
2. **Work order:** write goal, allowed files/tools, non-goals, acceptance check, attempt/time budget, and who may authorize a PR or merge.
3. **Candidate:** use one bounded agent or scripted loop in a branch/worktree; keep the exact resulting SHA. Extra agents are optional and must have distinct roles or evidence of benefit.
4. **Verification:** execute an independent test against that SHA; include a negative/failure case. Record commands, status, and relevant logs with secrets redacted.
5. **FactoryOps:** show where a person can see progress, the budget remaining, a failed check and the reason, and how the process actually stops. A simple CLI is enough.
6. **Decision:** demonstrate human acceptance or rejection. No model gets unattended merge/release credentials. If the final check fails, your factory must report `blocked`, not `shipped`.
7. **Comparison:** report at least one useful baseline: elapsed time, verification attempts, compute or API cost, or correctly accepted changes. Explain the trade-off and measurement limitations rather than declaring all automation faster.

An optional trace can be small:

```text
work_order: change-17
candidate: <full Git commit SHA>
check: cd backend && uv run pytest tests/test_feature.py
observed: FAILED first, PASSED after repair (include actual exit codes)
review: one identified finding resolved, or one finding still open
budget: 1 of 2 repair attempts used
control: manual approve/reject; timeout stops worker (state what enforces it)
delivery: local candidate | PR opened | merged | released (report ONLY the actual state)
```

This challenge carries **no new deadline, required framework, mandatory fourth service, or substitute for the open-source upstream PR rule**. If you demonstrate it in your [required English-narrated EX3 video](../README.md#ex3-recorded-demo-in-english-required), show it *after* the real product flow and keep the product, failure and verification coverage intact.

## Check your understanding

Before reading the answers, explain these three situations:

1. Three Yjs clients show identical messages. Is their program correct?
2. All tests pass, but an agent edited the reported coordinates and rendered coordinates differently. Has the validator established the intended geometry?
3. A dashboard says STOP and the agent continues calling tools. Did Mission Control enforce interruption?

<details markdown="1">
<summary>Compare your answers</summary>

1. No. Replica convergence concerns state consistency, not semantic correctness.
2. No. Correlated measurement can invalidate the inference. Observe the actual rendering independently and describe coverage limits.
3. No. The STOP order was advisory; identify a trusted runtime with revocation or termination authority, and record its observed response.

</details>

## References and boundaries

- [Course software factory lab](software-factory-lab.md), especially the [three controls](software-factory-lab.md#from-a-local-loop-to-orchestration): guidance, execution, promotion.
- [Solar System Machine](https://github.com/EASS-PART-A-2026-X/solar-system-machine/tree/a81083e), commit-specific teaching example. Inspect its `crew/`, `mission-control/`, `logbook/`, and validator; do not mistake a green CI run for universal proof.
- [Yjs documentation](https://docs.yjs.dev/): synchronized shared data and its consistency model.
- [Safely Interruptible Agents](https://intelligence.org/files/Interruptibility.pdf): a research goal, not a property established by a chat STOP command.
- [Stanford Encyclopedia of Philosophy: Cellular Automata](https://plato.stanford.edu/entries/cellular-automata/): historical context for von Neumann's constructive-machine models, not evidence of universality here.

<!-- {% endraw %} -->
