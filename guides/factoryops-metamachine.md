# FactoryOps: build the product, build the factory, operate both

<!-- {% raw %} -->

[Course guide](../README.md) · [Agent-driven engineering](agent-driven-development.md) · [Software factory lab](software-factory-lab.md) · [Submission evidence](submission-evidence.md)

**Optional depth, not an extra EX3 requirement.**

**When:** after the [software factory lab](software-factory-lab.md), or with Lecture 10 and the clinics, about 30–40 minutes of reading (estimate). It adds no deadline, grade weight, required fourth service or prescribed framework. The required work stays as stated in the [README](../README.md#assignments-and-deadlines), including the [English-narrated EX3 video](../README.md#ex3-recorded-demo-in-english-required).

<details markdown="1" class="lecture-toc">
<summary>On this page</summary>

- [The engineering shift](#the-engineering-shift)
- [Three different questions: production, knowledge, authority](#three-different-questions-production-knowledge-authority)
- [Enforcement boundaries](#enforcement-boundaries)
- [The mathematics: four non-equivalences](#the-mathematics-four-non-equivalences)
- [The Solar System Machine: an honest case study](#the-solar-system-machine-an-honest-case-study)
- [Optional EX3 FactoryOps challenge](#optional-ex3-factoryops-challenge)
- [Student exercises](#student-exercises)
- [References](#references)

</details>

> **You will be able to:**
>
> - tell the two systems you build (product, factory) from the two responsibilities you operate (FactoryOps / Mission Control, DevOps / platform);
> - keep production, knowledge and authority with different actors, and say where each is enforced;
> - explain four non-equivalences that stop a green dashboard from being mistaken for proof;
> - describe what a real example implements, and what it does not establish.

**Predict first:** an agent crew synchronizes through a shared document, every validator check is green, and the reviewing agent approves. Which of these facts shows that the product is correct?

<details markdown="1">
<summary>Check your prediction</summary>

None of them, on its own. Synchronization shows that replicas hold the same state, not that the agents mean the same thing. A green gate shows that a finite set of checks passed. An approving agent is one more model reading the same material. Together they are useful evidence; a person or a written policy still decides what ships.

</details>

## The engineering shift

**Build the product. Build the factory. Run the factory. Run the platform.**

This describes two systems to build and two operational responsibilities,
not four additional microservices or four compulsory deliverables.

AI coding agents make the production process itself something engineers can build, inspect, test and operate. The product is what customers use. The factory is the software that turns work orders into candidate changes and verified pull requests. Running the factory (FactoryOps, from Mission Control) means watching its queue, its failures and its debt, and deciding what may ship. Running the platform (DevOps) means keeping CI, runners, sandboxes, caches and deployments working underneath both.

```text
+-----------------------------------------------------------------+
| Product                 what customers use                      |
|   browser -> backend -> AI service -> data                      |
+-----------------------------------------------------------------+
        ^ verified, approved changes only
+-----------------------------------------------------------------+
| Factory                 where agents write code                 |
|   work order -> isolated work cell -> candidate -> checks -> PR |
+-----------------------------------------------------------------+
        ^ orders, STOP, approvals        | status, evidence, debt
        |                                v
+-----------------------------------------------------------------+
| Mission Control / FactoryOps   where people and policy decide   |
|   queue, attention, approvals, release decision, STOP           |
+-----------------------------------------------------------------+
+-----------------------------------------------------------------+
| DevOps / platform       what everything runs on                 |
|   CI, runners, sandboxes, caches, registries, deploys           |
+-----------------------------------------------------------------+
```

The Factory and Mission Control are the new layers. In your course project the "factory" can be you and one coding assistant on a branch, and "Mission Control" can be you reading the PR and its CI run before you merge.

## Three different questions: production, knowledge, authority

1. Production: Can an agent generate a candidate?
2. Knowledge: Why should anyone trust that candidate?
3. Authority: Who is allowed to stop, accept, publish or roll back?

These questions should not collapse into one unchecked actor.

An agent that writes a change, grades it and merges it answers all three questions alone, and nothing outside it can catch its mistake. Production belongs to the factory. Knowledge comes from checks that run on the exact revision and are kept as evidence. Authority belongs to people and written policy in Mission Control. The instructor's [Airflow software factory](https://github.com/zozo123/ariflow-swfactory) states the same split in its own words: evidence informs a release decision but never grants permission to release.

## Enforcement boundaries

An authority that exists only in a prompt is a request, not a control. Put each one where the agent cannot remove it:

| Authority | Where it is enforced | What the agent cannot do |
|---|---|---|
| Accept a change into `main` | Branch protection with required status checks on the merged revision | Merge a red or unchecked candidate |
| Approve intent and plan | A required human review, or an explicit approval step in the factory | Approve its own work order |
| Publish or deploy | Credentials held by the control plane or CI environment, not the work cell | Push, release or deploy from the sandbox |
| Stop | A STOP that the orchestrator or platform enforces, plus a way to check that work stopped | Ignore an interruption it was sent |
| Roll back | A documented runbook step owned by a person | Decide alone that a rollback is unnecessary |

Your EX3 already uses two of these: green CI on the tagged SHA, and your own review before merging. See [Agent sandboxes](agent-sandboxes.md) for the laptop-sized version and the factory lab's [three controls](software-factory-lab.md#from-a-local-loop-to-orchestration) for the orchestrated one.

## The mathematics: four non-equivalences

Each statement below says that one thing is *not* the same as another. Treat them as checks on your own reasoning when a dashboard turns green.

### 1. State convergence is not agreement on meaning

A CRDT such as Yjs can synchronize replicas. This does not establish shared understanding or correctness.

A conflict-free replicated data type guarantees *strong eventual consistency*: any two replicas that have received the same set of updates are in the same state, whatever order the updates arrived in ([Shapiro et al., 2011](https://inria.hal.science/inria-00609399)). That is a statement about state. Two agents reading an identical chat can still interpret an order differently, and a document that converged can still contain a wrong instruction.

### 2. A green validation gate is not a theorem

Passing finite tests does not establish correctness over every possible input or execution.

If a test suite checks a finite set of cases `T`, a pass shows that the program behaved as expected on `T`, in that environment, at that revision. Outside `T` it shows nothing without further argument. In Dijkstra's words, testing can show the presence of bugs, never their absence ([EWD249](https://www.cs.utexas.edu/~EWD/ewd02xx/EWD249.PDF)). A gate is still valuable: it is evidence for one revision, not a proof for all of them.

### 3. Instrumentation is not automatically an independent oracle

Self-reported measurements may differ from actual user-visible behavior. Independent observation matters.

When the code under test also produces the numbers the checker reads, one defect can break the behavior and the measurement together. Correlation has the same effect on repeated evidence. If `K` checks each have variance `σ²` and pairwise correlation `ρ`, the variance of their average is `σ² · [ρ + (1 − ρ) / K]`, which never falls below `ρ · σ²` however large `K` gets. The instructor's preprint ([arXiv 2607.09689](https://arxiv.org/html/2607.09689)) makes the related point that runtime isolation does not imply statistical independence: ten sandboxes running the same prompt on the same tests are not ten independent witnesses.

### 4. Review-and-repair is not proof of convergence

An agent can oscillate, regress or exhaust its budget. Bounded retries control cost, not correctness.

A repair loop produces candidates `c₀, c₁, c₂, …`. Nothing guarantees that each is closer to correct than the last, so the loop can cycle or get worse. A budget of `B` attempts guarantees that the loop *ends*; it does not guarantee that it ends well. When the budget runs out, the honest outcome is a recorded failure handed to a person, as in the [factory lab](software-factory-lab.md#debrief).

## The Solar System Machine: an honest case study

[EASS-PART-A-2026-X/solar-system-machine](https://github.com/EASS-PART-A-2026-X/solar-system-machine) keeps a product, the machine that built it and the mission control that steered it in one repository.

- **Product:** the 3D application.
- **Factory:** roles, instructions, shared communication and recorded work.
- **Mission Control:** human orders, status, STOP and validation display.
- **Platform:** synchronization, tests and CI.

The example does not establish formal safe interruptibility, universality, self-reproduction or deterministic replay.

### Implementation audit

Read at commit `a81083e` on 3 November 2026. Read it; do not modify it.

| Layer | What exists | What it does not show |
|---|---|---|
| Product | [`product/`](https://github.com/EASS-PART-A-2026-X/solar-system-machine/tree/main/product): a three.js scene, editorial overlay and NASA fact captions; browser checks in `product/checks/validate.mjs` | Some checks sample values the page publishes about itself (`window.__labelAnchors`, `window.__copyRects`), so they are partly self-reported (non-equivalence 3) |
| Factory | [`crew/`](https://github.com/EASS-PART-A-2026-X/solar-system-machine/tree/main/crew): brief, prompts for three agents, the lead's playbook, and [`contract.json`](https://github.com/EASS-PART-A-2026-X/solar-system-machine/blob/main/crew/contract.json) naming the files each agent owns; [`logbook/`](https://github.com/EASS-PART-A-2026-X/solar-system-machine/tree/main/logbook): the recorded run and `check_machine.py`, which compares edited files and order replies with the contract | The run is recorded, not replayable deterministically; file ownership is checked after the run, not prevented during it |
| Mission Control | [`mission-control/`](https://github.com/EASS-PART-A-2026-X/solar-system-machine/tree/main/mission-control): a shared chat on Yjs over a Hocuspocus server, a control panel with agent status, orders and STOP ALL; clients without the write token are read-only | STOP ALL posts an order into the chat; agents are expected to obey it, but nothing verifies that work stopped (non-equivalence 1) |
| Platform | [`validate.mjs`](https://github.com/EASS-PART-A-2026-X/solar-system-machine/blob/main/validate.mjs) runs product, mission-control and machine checks as one gate; [`validate.yml`](https://github.com/EASS-PART-A-2026-X/solar-system-machine/blob/main/.github/workflows/validate.yml) runs it on every push and pull request | A green gate covers the sizes, themes and checks it runs (non-equivalence 2) |

The repository's README reports how its gate changed the product: the reviewing agent had approved, but the first validator run was red. One fix then passed the gate while making the page worse, and that became a new check. This is non-equivalence 4 in a real run. The numbers are the README's report; they were not re-run for this guide.

## Optional EX3 FactoryOps challenge

Demonstrate one real work order, candidate revision, independent verification, bounded repair and human decision.
Report actual evidence, limits, cost and delivery state.

A modest version is enough:

1. Write a work order for one small change in your product: goal, acceptance checks, out of scope.
2. Let an assistant produce the candidate on its own branch, and record the SHA.
3. Verify it with something the assistant did not write: CI on that SHA, plus one check or test you wrote from the work order.
4. Allow at most a fixed number of repair attempts, and record what happens if they run out.
5. Decide yourself whether to merge, and say why. Name the delivery state reached: local, PR, merged, tagged.

Record cost as you measured it (time, tokens, money), or as unknown. This challenge cannot replace any required service, test, live demonstration, video or open-source contribution.

## Student exercises

**Q1.** Your assistant writes a change, writes its tests and opens the PR, and you merge when CI is green. Which of the three questions did nobody independent answer?

<details markdown="1">
<summary>Check your answer</summary>

Knowledge. The tests came from the same actor as the code, so a misunderstanding of the requirement passes both. Add one check you wrote from the work order, or a reviewer who did not write it.

</details>

**Q2.** For each layer of the Solar System Machine, name one fact you would need to see before trusting a "released" label.

<details markdown="1">
<summary>Check your answer</summary>

Examples: product, the gate verdict for the exact commit; factory, the ownership check result for the run; Mission Control, the order history showing every order answered; platform, the CI run for that commit. Any answer that names a specific revision and a specific check is on the right track.

</details>

**Q3.** A repair loop has a budget of three attempts. Attempt two passes every test but removes a feature. What should happen next?

<details markdown="1">
<summary>Check your answer</summary>

Reject the candidate and add a check for the removed feature, so the regression becomes visible. Passing the gate was not convergence (non-equivalences 2 and 4). If the budget runs out, stop with a recorded failure and hand the decision to a person.

</details>

## References

- Marc Shapiro, Nuno Preguiça, Carlos Baquero and Marek Zawirski, [*Conflict-free Replicated Data Types*](https://inria.hal.science/inria-00609399), SSS 2011.
- [Yjs documentation](https://docs.yjs.dev/), the CRDT library used by the case study's mission control.
- Edsger W. Dijkstra, [*Notes on Structured Programming* (EWD249)](https://www.cs.utexas.edu/~EWD/ewd02xx/EWD249.PDF), 1970.
- Yossi Eliaz, [*Evidence-Aware Reduction for Forkable Compute*](https://arxiv.org/html/2607.09689), arXiv preprint 2607.09689. A preprint by the instructor, not a peer-reviewed result.
- [zozo123/ariflow-swfactory](https://github.com/zozo123/ariflow-swfactory) and its [project site](https://zozo123.github.io/ariflow-swfactory/), the instructor's factory, explored in the [software factory lab](software-factory-lab.md).
- [EASS-PART-A-2026-X/solar-system-machine](https://github.com/EASS-PART-A-2026-X/solar-system-machine), the case study above.

<!-- {% endraw %} -->
