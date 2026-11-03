# FactoryOps and Mission Control: four concerns when agents build software

<!-- {% raw %} -->

[Course guide](../README.md) · [Agent-driven engineering](agent-driven-development.md) · [Software factory lab](software-factory-lab.md) · [Systems reasoning clinics](systems-reasoning.md)

**When:** after the [software factory lab](software-factory-lab.md) Part A, or with Lecture 10 and the clinics, about 30–40 minutes of reading (estimate). This is optional depth: it adds no assignment, grading category or infrastructure requirement. Your EX3 product is still judged by the [existing criteria](submission-evidence.md#ex3-the-complete-product).

<details markdown="1" class="lecture-toc">
<summary>On this page</summary>

- [What you will learn](#what-you-will-learn)
- [Four concerns, not two](#four-concerns-not-two)
- [The Factory: work orders in, verified PRs out](#the-factory-work-orders-in-verified-prs-out)
- [Mission Control: people and policy decide what ships](#mission-control-people-and-policy-decide-what-ships)
- [A small machine you can read end to end](#a-small-machine-you-can-read-end-to-end)
- [Mathematical foundations](#mathematical-foundations)
- [Map the four concerns onto your EX3 demo](#map-the-four-concerns-onto-your-ex3-demo)
- [Check yourself](#check-yourself)
- [Sources and verification boundary](#sources-and-verification-boundary)

</details>

## What you will learn

For years, a team building software mostly thought about two things: the **product** customers use, and the **DevOps** infrastructure that builds, tests and deploys it. When AI agents write a large share of the code, two more things need their own design: the **Factory**, where agents do the work, and **Mission Control**, where people and policy watch the factory and decide what ships. This guide names the four concerns, shows them in two working repositories, and gives the small amount of mathematics you need to reason about them.

> **You will be able to:**
>
> - name the four concerns and say which one owns a given decision;
> - explain why an agent work cell may edit code but must not approve, publish or promote it;
> - use Little's law to reason about work in progress and human review capacity;
> - compute the chance that a defect passes several independent checks, and explain why correlated checks or agent branches give less evidence than their count suggests.

**Predict first:** you ask ten agents to attempt the same work order in parallel. All ten branches pass the same test suite. Is that ten times the evidence of one passing branch?

<details markdown="1">
<summary>Check your prediction</summary>

No. The ten branches came from the same task text, often the same model, the same repository and the same tests. A misunderstanding in the task or a blind spot in the tests is shared by all of them, so their results are correlated. Ten copies of a shared mistake are still one mistake. Running in separate sandboxes isolates the *runtime*; it does not make the *evidence* statistically independent. [Correlated evidence](#correlated-agent-branches-are-not-independent-evidence) below puts a number on this.

</details>

<details markdown="1">
<summary>Words used on this page</summary>

- **Work order:** a written request for one change: the goal, the acceptance checks and what is out of scope.
- **Work cell:** one isolated place (a sandbox, a worktree, a container) where one agent works on one work order.
- **Gate:** a check a candidate must pass before it moves to the next stage, such as tests, CI, an evaluation or a human review.
- **Verified PR:** a pull request whose checks ran on the exact revision it proposes, with the results kept.
- **Promotion:** moving a candidate to the next milestone: PR, merge, release, deployment.
- **Mission Control:** the place where people see the factory's state and make the decisions that policy keeps for people.
- **Metamachine:** the machine that builds the product. "Meta" because its output is another machine, your software.

</details>

## Four concerns, not two

| Concern | Question it answers | Who acts there | Examples |
|---|---|---|---|
| **Product** | What do customers use? | Users, and the code that serves them | Your EX3 frontend, backend and AI service |
| **Factory** | Where do agents write code? | Agents, each inside an isolated work cell | Work order → work cell → candidate branch → checks → PR |
| **Mission Control** | Who watches the factory and decides what ships? | People, plus written policy | Queue of work, attention needed, open debt, approvals, release decisions, STOP |
| **DevOps** | What runs underneath? | Platform automation | CI, runners, sandboxes, caches, registries, deploys |

**The Factory and Mission Control are the new parts.** Product and DevOps already have mature practice: product design, testing, CI/CD, infrastructure as code. The two new concerns sit between them. They exist because an agent can produce a candidate change quickly, but a candidate is not a decision. Somebody has to say which work is worth doing, which candidate is good enough and what may reach users.

Keep the boundaries clear:

- The **Factory** produces *candidates and evidence*. It does not decide to release.
- **Mission Control** makes *decisions* using that evidence and policy. It does not write the code.
- **DevOps** provides *capabilities* (compute, isolation, pipelines) to both. Being able to deploy is not the same as being allowed to.
- The **Product** is what all three exist for. Its users never see the factory.

**Simpler is enough:** for a course project, the "factory" can be you plus one coding assistant on a branch, and "Mission Control" can be you reading the PR and the CI run before merging. The four concerns are about *who decides what*, not about how much infrastructure you own.

## The Factory: work orders in, verified PRs out

The instructor's [Airflow software factory](https://github.com/zozo123/ariflow-swfactory) ([project site](https://zozo123.github.io/ariflow-swfactory/)) is the reference implementation used in this course. Its pipeline runs from an issue to a work cell, through Airflow orchestration, agent work and verification, to a pull request. In its design:

- **One durable work cell per issue and target.** The agent edits inside that cell. Work from two requests does not mix.
- **The sandbox can edit, but cannot approve, publish or promote.** The credentials that open a PR or merge are held outside the agent, by the control plane.
- **Verification produces evidence for a specific revision.** The project's own wording is that evidence informs a release decision but never grants permission to release.
- **On the default line, a person approves the intent and plan, and a person merges.** Running several candidates in parallel is described there as a future capability, not current behavior.

You replay one complete change from this factory in the [software factory lab](software-factory-lab.md#part-a--replay-a-complete-change). The lab's milestones (local replay, PR, merge, deployed product) are the Factory's outputs; this guide adds the layer that decides between them.

**Policy:** an agent that reads untrusted text (issues, code, tool output) can be steered by it. Keep publishing rights outside the agent, as the lab's [three controls](software-factory-lab.md#from-a-local-loop-to-orchestration) explain, and as [Agent sandboxes](agent-sandboxes.md) does for your own laptop.

## Mission Control: people and policy decide what ships

A factory that runs unattended still needs a place where people can see it and act. Mission Control answers four questions at any moment:

1. **What is in the queue, and what is running?** Work orders waiting, cells active, candidates waiting for review.
2. **What needs attention?** Failed gates, exhausted repair budgets, a work cell that asked for a decision.
3. **What debt is building up?** Known issues, skipped checks, waivers that need follow-up.
4. **What may ship?** Approvals, release decisions, and an emergency STOP.

Policy is written down so it does not depend on who is watching. Examples: "no merge without green CI on the merged revision", "a person approves any change to authentication", "a failed evaluation blocks release unless a named person waives it in writing". Mission Control applies the policy; it does not invent a new one per change.

**Pitfall:** a dashboard full of green lights is not a decision. Each light should name the revision it checked and the gate it represents. Otherwise you are reading the [same mistake as "7 tests passed"](software-factory-lab.md#what-you-will-learn): a fact without the boundary it covers.

## A small machine you can read end to end

The course repository [solar-system-machine](https://github.com/EASS-PART-A-2026-X/solar-system-machine) holds a product, the machine that built it and the mission control that steered the machine, all in one repository. Its README maps directly onto the four concerns:

| Concern | Where it lives | What to look for |
|---|---|---|
| Product | `product/` | A 3D solar-system page and its checks in `product/checks/` |
| Factory (the machine) | `crew/` and `logbook/` | The brief, the agents' prompts, the file-ownership contract, and the record of what each agent did |
| Mission Control | `mission-control/` | A shared chat the agents work through, agent status, orders to one or all agents, and STOP ALL |
| DevOps and the gate | `validate.mjs` and `.github/workflows/validate.yml` | One validator for all three layers; CI runs the same gate on every push |

Two details are worth studying:

- **File ownership is checked, not just requested.** Each agent may edit only the files it owns; the machine check compares the run record with the contract.
- **A release needs two things:** the reviewing agent's approval *and* a green measured gate. The README describes a run where the reviewer had approved but the first validator run was red, and the failures were then sent back as orders to the agents that owned the affected files. That is Mission Control and the gate catching what review alone missed.

Read it; do not change it. It is a reference for this guide, not a project to contribute to.

## Mathematical foundations

Four short ideas explain most of the behavior you will see when agents produce changes faster than people can review them. Every number in the examples below is synthetic, chosen to make the arithmetic easy; none is a measurement of a real factory.

### Throughput and queueing

**Little's law.** For a stable system observed over a long time, the average number of items inside it equals the arrival rate times the average time each item spends inside:

```text
L = λ · W
```

`L` is the average work in progress, `λ` the average arrival (or completion) rate, and `W` the average time from arrival to leaving. It holds for any stable system, whatever the order of service.

*Synthetic example:* if 6 work orders arrive per day and each spends 2 days between "opened" and "merged or closed", about `6 × 2 = 12` are open at any time. To cut that to 6 without reducing demand, you must halve the time each spends in the system.

**Utilization.** If one reviewer can finish `μ` reviews per day and candidates arrive at `λ` per day, the reviewer's utilization is `u = λ / μ`. With `c` reviewers working in parallel, `u = λ / (c · μ)`. The queue is stable only when `u < 1`. At `u ≥ 1` the backlog grows without limit, however hard anyone works.

Waiting time also grows quickly as `u` gets close to 1. In the simplest textbook queue (one server, random arrivals and random service times, called M/M/1), the average time in the system is `W = 1 / (μ − λ)`.

*Synthetic example:* with `μ = 10` reviews a day, `λ = 5` gives `W = 1/5` of a day; `λ = 9` gives a full day; `λ = 9.9` gives 10 days. Real review is not M/M/1, but the shape is the lesson: near full utilization, a small increase in arrivals causes a large increase in waiting.

**The bottleneck sets the pace.** A line of stages can complete work no faster than its slowest stage. Adding agents raises the arrival rate at review; it does not raise review capacity. If people review in Mission Control, their capacity is often the bottleneck, and the useful moves are fewer, smaller candidates, better automated gates before a person looks, and policies that state which changes need a person at all.

### Verification as gates

Treat each check (unit tests, type checks, CI, an evaluation set, a human review) as a gate that a defective candidate might slip through. Let `mᵢ` be the probability that gate `i` *misses* a given kind of defect. A defect escapes only if every gate misses it.

If the gates miss **independently**:

```text
P(defect passes all k gates) = m₁ · m₂ · … · mₖ
```

and with equal miss probabilities, `mᵏ`.

*Synthetic example:* three independent gates, each missing a defect 10% of the time, let it through with probability `0.1 × 0.1 × 0.1 = 0.001`.

That multiplication depends entirely on independence. Suppose instead that with probability `s` a defect belongs to a blind spot that **every** gate shares (for example, the requirement was misunderstood when the tests and the evaluation cases were written), and otherwise the gates miss independently with probability `m`. Then:

```text
P(defect passes all k gates) = s + (1 − s) · mᵏ
```

As you add gates, `mᵏ` goes to zero but the total never drops below `s`. *Synthetic example:* with `s = 0.05` and three gates at `m = 0.1`, the escape probability is `0.05 + 0.95 × 0.001 ≈ 0.051`: about 51 times the independent answer. More gates of the same kind barely help. A *different* kind of gate does, such as a person checking the work order against the user's goal, or an outage drill that exercises a path the tests do not.

This is the same multiplication as the [slowest-dependency clinic](systems-reasoning.md#explore-the-slowest-dependency), applied to misses instead of latency, and with the same warning: it assumes independence, and real systems often violate it.

### Correlated agent branches are not independent evidence

Now run `K` agent branches on the same work order and score each one (a test pass rate, an evaluation score). Suppose each score has the same variance `σ²` and every pair of scores has correlation `ρ`. The variance of their average is:

```text
Var(average of K) = σ² · [ ρ + (1 − ρ) / K ]
```

With `ρ = 0` this is the familiar `σ² / K`: more branches, less noise. With `ρ > 0`, the variance can never fall below `ρ · σ²`, however large `K` gets. An equivalent way to say it is the **effective number** of independent branches:

```text
K_eff = K / (1 + (K − 1) · ρ)
```

which approaches `1 / ρ` as `K` grows.

*Synthetic example:* 10 branches with `ρ = 0.5` give `K_eff = 10 / 5.5 ≈ 1.8`. A thousand such branches give less than 2. Ten correlated "votes" are worth about two independent ones.

Where the correlation comes from: the same task text, the same model and prompt, the same repository snapshot, the same tests and the same evaluation cases. Separate containers do not remove any of these. The instructor's preprint, [*Evidence-Aware Reduction for Forkable Compute*](https://arxiv.org/html/2607.09689), makes this point formally: runtime isolation does not imply statistical independence, and the number of workers by itself carries no statistical information. Two practical rules follow:

- **Count evidence, not workers.** A retry or a duplicate run of the same check on the same revision reuses the same evidence identity; it is not a new observation.
- **Diversify the gate, not just the copies.** Evidence becomes more independent when something real changes: a different kind of check, data the agents did not see, a person who did not write the work order.

### What the mathematics does not tell you

These models need inputs you usually do not know: real miss probabilities, real correlations, real arrival and service rates. Record such values as unknown rather than guessing. The formulas are for *reasoning about direction and shape*, such as "adding more of the same check helps less than adding a different check". They are not a way to certify a release. A passing gate is still evidence for one revision, and a person or written policy still makes the release decision.

## Map the four concerns onto your EX3 demo

You already build all four concerns at course scale. Use this table to explain your project in the [final demonstration](../lectures/11-13-clinics-and-demos.md#final-demo-instructions); it adds no new requirement.

| Concern | In your EX3 project | What to show or say in the demo |
|---|---|---|
| Product | The three services, the browser flow, persistent data | The happy path and the AI flow from your demo script |
| Factory | You and your coding assistant working on branches and PRs | One change: the request you wrote, the candidate, and the check that caught or confirmed it |
| Mission Control | Your review before merging, your release tag, your evidence table | Why the tagged SHA is the one you trust: green CI on that revision, and the evidence table |
| DevOps | Docker Compose, GitHub Actions CI, the clean-checkout script | A clean clone of the tag, one outage drill, recovery |

The [narrated EX3 demonstration](../lectures/11-13-clinics-and-demos.md#ex3-demonstration-video-english-narration) follows the same order.

## Check yourself

**Q1.** An agent work cell holds a token that can merge PRs. Which concern's boundary is broken, and why does it matter?

<details markdown="1">
<summary>Check your answer</summary>

The boundary between the **Factory** and **Mission Control**. The factory should produce candidates and evidence; deciding what ships belongs to people and policy. An agent reading untrusted text can be steered, so a merge token inside the cell turns "steer the agent" into "ship the change". Move the credential to the control plane and keep the merge decision outside the cell.

</details>

**Q2.** Your team doubles the number of agents producing candidate PRs. Review capacity stays the same, and review was already at `u = 0.8`. What happens?

<details markdown="1">
<summary>Check your answer</summary>

Arrivals at review double, so utilization becomes `1.6`, which is above 1. The review queue grows without limit, and work in progress grows with it (Little's law). Throughput of merged PRs does not double, because review is the bottleneck. Useful responses: smaller candidates, stronger automated gates before review, and a policy stating which changes need a person.

</details>

**Q3.** Five agent branches all pass the same 40 tests. A classmate says the chance of a shared defect is now tiny. What do you ask?

<details markdown="1">
<summary>Check your answer</summary>

How independent are the branches and the checks? They share the task text, probably the model, and certainly the 40 tests, so a defect the tests do not cover passes all five. The relevant number is the shared blind spot `s`, which the five passes do not reduce. Ask for a different kind of evidence: a test written from the requirement by someone else, an evaluation case the agents did not see, or a person checking the behavior against the work order.

</details>

## Sources and verification boundary

- **Factory reference:** [zozo123/ariflow-swfactory](https://github.com/zozo123/ariflow-swfactory) and its [project site](https://zozo123.github.io/ariflow-swfactory/), read on 3 November 2026 for the work-cell, credential and approval descriptions above. This guide does not certify its live Airflow, provider or GitHub integrations. The [software factory lab](software-factory-lab.md#sources-and-verification-boundary) lists what was executed for the lab.
- **Machine and Mission Control example:** [EASS-PART-A-2026-X/solar-system-machine](https://github.com/EASS-PART-A-2026-X/solar-system-machine), README read at commit `a81083e` on 3 November 2026. The run described in the section above is reported by that README; it was not re-run for this guide.
- **Correlated evidence:** Yossi Eliaz, [*Evidence-Aware Reduction for Forkable Compute*](https://arxiv.org/html/2607.09689), arXiv preprint 2607.09689. This is a preprint by the instructor, not a peer-reviewed result.
- **Little's law, utilization and the M/M/1 waiting time** are standard results in queueing theory; the variance of a mean of equally correlated variables is a standard statistics identity. All worked numbers on this page are synthetic.

<!-- {% endraw %} -->
