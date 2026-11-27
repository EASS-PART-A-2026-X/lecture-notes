# Part 2 · Reinforcement learning, rollouts, and policy staleness

<!-- {% raw %} -->

[Course home](../README.md) · [Part 1 · Building and serving models](ai-systems-01-model-and-serving.md) · [Part 3 · Environments, state and roadmap](ai-systems-03-environments-state-roadmap.md)

> **Optional; not graded:** This bonus lesson sits outside the EASS Class X syllabus and requires zero GPUs, cloud clusters, or paid accounts. Its interactive decision lab and Python 3.14 state-machine exercises run purely on synthetic receipts on your own machine.

**You will be able to:** contrast preference optimization with online RL (PPO, GRPO, RLVR), trace a multi-turn rollout through its durable state machine, explain why faster learner updates or extra inference GPUs can *increase* policy staleness, compare 6 KV-cache consistency policies across weight updates, and run an offline Python rollout-FSM verifier.

**Predict first:** A team adds extra learner GPUs so optimizer steps finish twice as fast, while each multi-turn coding rollout still takes `90` seconds in a test sandbox. Does policy staleness go down or up?

<details markdown="1">
<summary>Check your prediction</summary>

Staleness goes **up**! An approximate measure is `staleness ≈ sampler_lag + T_sample_to_train / T_learner_step`. Halving `T_learner_step` doubles the number of policy versions that elapse while that single `90`-second rollout is still running, making the completed trajectory *more* off-policy when it reaches the learner.

</details>

<details markdown="1" class="lecture-toc">
<summary>On this page</summary>

- [Stages 5–6: from imitation to verifiable exploration](#stages-56-from-imitation-to-verifiable-exploration)
- [The durable rollout state machine](#the-durable-rollout-state-machine)
- [Synchronous versus asynchronous RL and staleness](#synchronous-versus-asynchronous-rl-and-staleness)
- [Weight synchronization and six KV-cache policies](#weight-synchronization-and-six-kv-cache-policies)
- [Leading RL infrastructure projects](#leading-rl-infrastructure-projects)
- [Lab: diagnose rollout receipts and staleness](#lab-diagnose-rollout-receipts-and-staleness)
- [Python 3.14 lab: rollout state machine and GRPO group rules](#python-314-lab-rollout-state-machine-and-grpo-group-rules)
- [Quick quiz](#quick-quiz)
- [Sources](#sources)

</details>

## Stages 5–6: from imitation to verifiable exploration

Supervised fine-tuning (Stage 4) trains a model to imitate static answers. Reinforcement learning (Stage 6) lets the model generate its *own* experience trajectories `τ ~ π_θ` and optimize expected return `J(θ) = E[R(τ)]`.

| Method | Core steps &amp; innovation | Main problem &amp; how addressed | Current status |
|---|---|---|---|
| **DPO (Stage 5)** | Optimize directly on `(chosen, rejected)` pairs without a separate online RL loop | Off-policy drift as the policy moves away from the preference dataset → iterative or online variants | Mature, lightweight alignment baseline |
| **PPO** | Sample responses, score with critic + KL penalty, clip policy updates | High critic memory cost at LLM scale → group baselines or value-free estimators | Widely used; often heavier than GRPO for verifiable tasks |
| **GRPO** | Generate a group of candidates per prompt; compute relative advantage `A_i = (r_i − r̄) / (σ_r + ε)` | Straggler barriers wait for the slowest candidate; zero variance (`σ_r = 0`) yields zero signal | Core workhorse for reasoning &amp; math RL |
| **RLVR** | Replace noisy learned reward models with deterministic unit tests, proofs, or exact checkers | Reward hacking &amp; slow verification sandboxes → isolated trusted verifiers | Standard for coding, math, and formal tasks |
| **Agentic RL** | Multi-turn loop: sample tokens → invoke tool → observe sandbox → repeat → verify | Variable tool latency, environment crashes, side effects → durable FSM + snapshots | Active frontier (`verl`, `AReaL`, `Prime-RL`) |
| **On-policy distillation** | Student generates rollouts; teacher grades or guides student trajectories on-policy | High cost of teacher rollouts alone → combine compact student exploration with teacher supervision | Growing alternative to pure SFT distillation |

## The durable rollout state machine

In agentic RL, a rollout is not a single completion—it is a long-running distributed workflow spanning inference servers, tool sandboxes, and verifiers. Production systems persist explicit state transitions so crashes never corrupt rewards:

`CREATED → ADMITTED → ENVIRONMENT_READY → SAMPLING ⇄ EXECUTING_TOOL → VERIFYING → COMPLETED → ACCEPTED_FOR_TRAINING → CONSUMED`

Recoverable and terminal side states are equally essential: `FAILED_INFRASTRUCTURE`, `CANCELLED`, `TIMED_OUT`, `PAUSED`, `CHECKPOINTED`, `RESUMING`, and `REJECTED_AS_STALE`.

<figure class="course-diagram course-diagram--wide">
  <div class="diagram-scroll" role="region" tabindex="0" aria-label="Rollout state machine and sync versus async RL diagram, scroll horizontally">
    <img src="../assets/diagrams/aisys-rollout-lifecycle.svg" alt="Top shows rollout transitions from CREATED to CONSUMED with separate branches for FAILED_INFRASTRUCTURE and REJECTED_AS_STALE; bottom compares sync barriers vs async overlap." width="960" height="460">
  </div>
  <figcaption><strong>Separate agent failure from infrastructure failure.</strong> A crashed sandbox must route to <code>FAILED_INFRASTRUCTURE</code> and retry—never into the learner buffer with reward 0. <span class="screen-only">On a narrow screen, scroll sideways.</span> <a href="../assets/diagrams/aisys-rollout-lifecycle.svg">Open the diagram at full size</a>.</figcaption>
</figure>

<details markdown="1">
<summary>Text version of the diagram</summary>

Happy path: `CREATED` / `ADMITTED` → `ENVIRONMENT_READY` → `SAMPLING ⇄ EXECUTING_TOOL` under policy `θ_v` → `VERIFYING` / `COMPLETED` → `ACCEPTED_FOR_TRAINING` → `CONSUMED`. Side exits catch `FAILED_INFRASTRUCTURE` (retried, never scored as reward 0) and `REJECTED_AS_STALE` (or checkpointed/resumed). Below, synchronous RL blocks on the slowest GRPO straggler; asynchronous RL overlaps sampling and learning under bounded staleness.

</details>

Four rollout challenges show up immediately in practice:
1. **GRPO group barriers:** fast completions sit idle waiting for the slowest multi-turn candidate in the same prompt group.
2. **Infrastructure vs. agent failure:** if a container times out because of host disk pressure, scoring the agent `0` teaches the wrong lesson.
3. **Cache invalidation:** updating sampler weights invalidates KV prefixes from earlier steps unless managed explicitly.
4. **Reward corruption &amp; nondeterminism:** mismatched tokenizers or logprobs between sampler and learner silently bias policy gradients.

## Synchronous versus asynchronous RL and staleness

- **Synchronous RL:** generate an entire batch → wait for every straggler → verify → update weights → broadcast weights → repeat. Simple and exact, but GPUs sit idle during tool calls and tail latencies.
- **Asynchronous RL:** samplers continuously stream trajectories into a bounded queue while the learner continuously updates and publishes new policy versions `θ_v → θ_{v+1}`. Higher utilization, but trajectories become **off-policy**, governed by the importance ratio:

`ρ_t = π_θ(a_t | s_t) / π_behavior(a_t | s_t)`

When `ρ_t` diverges too far, gradient updates destabilize. **AReaL** addresses this with bounded off-policy clipping and explicit staleness limits; **Microsoft Rocket** highlights two subtle operational truths:

1. **Counterintuitive staleness:** adding inference GPUs or speeding up learner steps without shortening individual tool trajectories can *increase* policy lag (`staleness ≈ sampler_lag + T_sample_to_train / T_learner_step`).
2. **Scheduler selection bias:** blindly dropping slow or failed rollouts—or always scheduling shortest-first—skews the training distribution toward easy, short answers. Healthy schedulers balance age, group completion, and cache locality without silently censoring hard tasks.

## Weight synchronization and six KV-cache policies

When the learner finishes an optimizer step, weights must move from training layout (for example, FSDP) to inference layout (tensor/expert parallelism), pass integrity checks, and activate atomically. Even with identical weights, differing batch shapes or kernels can change floating-point outputs (documented in Thinking Machines' *Defeating Nondeterminism in LLM Inference*).

Worse, KV state `K_t` built under `θ_v` does not strictly match `θ_{v+1}`. Every system must choose an explicit **KV-cache consistency policy**:

| Policy | Mechanism | Trade-off |
|---|---|---|
| **1. Flush on update** | Drop KV caches whenever weights advance | Cleanest parity; highest prefill recomputation |
| **2. Pin trajectory** | Finish active trajectory on its starting `θ_v` | Consistent within episode; increases policy lag |
| **3. Recompute KV** | Re-prefill prompt + history under `θ_{v+1}` | Exact parity; extra prefill compute |
| **4. Multi-version pool** | Serve multiple active `θ_v` replicas briefly | Smooth transitions; multiplies HBM demand |
| **5. Retain deliberately** | Keep prior KV across small steps (e.g., `slime` option) | High throughput; approximate semantics |
| **6. Cross-model / cross-version translation** | Translate hidden states/KV across heterogeneous models (e.g., *Plato's Key* linear baseline vs. *Speculative Encoding* 2.35B MoE) | Cuts multi-model swarm prefill up to 7.5×, **but** a ~3.1% accuracy gap shifts `π_behavior` and `ρ_t` unless exact behavior logprobs are recorded or recomputed |

> **Pitfall:** Never mix translated KV states into an off-policy RL batch while pretending `π_behavior` came from the native target weights. Record the exact behavior logprobs emitted during sampling and treat any latent translation as an explicit approximate-KV policy.

## Leading RL infrastructure projects

| Project | Core architectural strength | When to study it |
|---|---|---|
| **[AReaL](https://github.com/areal-project/AReaL)** | Asynchronous RL with bounded off-policy loss &amp; multi-version trajectories | Studying staleness limits &amp; decoupled sampling |
| **[verl](https://github.com/verl-project/verl)** | HybridFlow controller–worker RL dataflows | Composing flexible PPO/GRPO pipelines |
| **[slime](https://github.com/THUDM/slime)** | Tight Megatron-LM + SGLang integration | High-throughput weight sync &amp; deliberate KV retention |
| **[Prime-RL](https://github.com/PrimeIntellect-ai/prime-rl)** | Clean 3-way split: inference, orchestrator, trainer | Minimal multi-GPU async &amp; environment-centric RL |
| **[TorchTitan](https://github.com/pytorch/torchtitan) / [TRL](https://github.com/huggingface/trl)** | Unified model definitions (`TitanRL`) &amp; fast prototyping | Avoiding training–inference architecture drift |

## Lab: diagnose rollout receipts and staleness

Use this fixed-receipt decision lab to practice separating infrastructure failures, KV parity violations, active checkpoints, staleness rejections, and GRPO straggler barriers.

<div class="sim" id="sim-aisys-rl" role="group" aria-label="RL rollout receipt decision lab" markdown="1">

<p class="sim-title"><strong>Decision lab: handle this RL rollout receipt</strong></p>

<div class="sim-fallback" markdown="1">

**Worked example without JavaScript:** A completed trajectory shows `outcome = "infra_failure"` (`status = "failed_infra"`) with `policyLag = 1 <= 2`. **Exclude infra failure &amp; retry** next—never admit a container crash into GRPO with reward `0`, because that penalizes the policy for a cluster fault. Similarly, when `kvConsistent = false` (after a weight update or unverified cross-model translation), **flush KV or recompute logits** before relying on `ρ_t`.

</div>
</div>

## Python 3.14 lab: rollout state machine and GRPO group rules

Save both files below into a scratch folder and run `python3 -m unittest -v` (zero external packages, zero GPUs). Notice how `rollout_fsm.py` enforces legal transitions, blocks stale trajectories, isolates `FAILED_INFRASTRUCTURE` from reward averages, and handles zero-variance GRPO groups cleanly.

<figure class="file-example file-example--long" markdown="1">
<figcaption><span class="file-example-action">File example</span> <span class="file-example-path">rollout_fsm.py</span></figcaption>

```python
# rollout_fsm.py
"""Zero-dependency Rollout State Machine and GRPO advantage rules."""

from dataclasses import dataclass, field

ALLOWED_TRANSITIONS = {
    "CREATED": {"ADMITTED", "CANCELLED"},
    "ADMITTED": {"ENVIRONMENT_READY", "FAILED_INFRASTRUCTURE", "CANCELLED"},
    "ENVIRONMENT_READY": {"SAMPLING", "FAILED_INFRASTRUCTURE", "TIMED_OUT"},
    "SAMPLING": {"EXECUTING_TOOL", "VERIFYING", "CHECKPOINTED", "FAILED_INFRASTRUCTURE", "TIMED_OUT"},
    "EXECUTING_TOOL": {"SAMPLING", "VERIFYING", "CHECKPOINTED", "FAILED_INFRASTRUCTURE", "TIMED_OUT"},
    "CHECKPOINTED": {"RESUMING", "CANCELLED"},
    "RESUMING": {"SAMPLING", "FAILED_INFRASTRUCTURE"},
    "VERIFYING": {"COMPLETED", "FAILED_INFRASTRUCTURE"},
    "COMPLETED": {"ACCEPTED_FOR_TRAINING", "REJECTED_AS_STALE"},
    "ACCEPTED_FOR_TRAINING": {"CONSUMED"},
}

TERMINAL_STATES = {"CONSUMED", "FAILED_INFRASTRUCTURE", "CANCELLED", "TIMED_OUT", "REJECTED_AS_STALE"}


class InvalidTransitionError(ValueError):
    pass


@dataclass
class RolloutRecord:
    rollout_id: str
    policy_version: int
    status: str = "CREATED"
    reward: float | None = None
    history: list[str] = field(default_factory=lambda: ["CREATED"])

    def transition(self, next_state: str) -> None:
        if next_state == self.status:
            return
        if self.status in TERMINAL_STATES:
            raise InvalidTransitionError(f"Cannot leave terminal state {self.status}")
        if next_state not in ALLOWED_TRANSITIONS.get(self.status, set()):
            raise InvalidTransitionError(f"Illegal transition: {self.status} -> {next_state}")
        self.status = next_state
        self.history.append(next_state)


def admit_completed_rollout(record: RolloutRecord, current_policy: int, max_staleness: int) -> str:
    if record.status != "COMPLETED":
        raise InvalidTransitionError("Only COMPLETED rollouts can be judged for training")
    lag = current_policy - record.policy_version
    if lag < 0:
        raise ValueError("Rollout policy version cannot exceed current learner policy")
    if lag > max_staleness:
        record.transition("REJECTED_AS_STALE")
    else:
        record.transition("ACCEPTED_FOR_TRAINING")
    return record.status


def grpo_advantages(records: list[RolloutRecord], eps: float = 1e-8) -> list[float]:
    trainable = [r for r in records if r.status == "ACCEPTED_FOR_TRAINING" and r.reward is not None]
    if not trainable:
        return []
    mean = sum(r.reward for r in trainable) / len(trainable)
    var = sum((r.reward - mean) ** 2 for r in trainable) / len(trainable)
    std = var ** 0.5
    if std == 0.0:
        return [0.0 for _ in trainable]
    return [(r.reward - mean) / (std + eps) for r in trainable]
```

</figure>

<figure class="file-example file-example--long" markdown="1">
<figcaption><span class="file-example-action">File example</span> <span class="file-example-path">test_rollout_fsm.py</span></figcaption>

```python
# test_rollout_fsm.py
"""Eight stdlib tests for the Rollout State Machine and GRPO advantages."""

import unittest
from rollout_fsm import (
    InvalidTransitionError,
    RolloutRecord,
    admit_completed_rollout,
    grpo_advantages,
)


class RolloutFsmTests(unittest.TestCase):
    def test_happy_path_to_consumed(self):
        r = RolloutRecord("r1", policy_version=10, reward=1.0)
        for state in ("ADMITTED", "ENVIRONMENT_READY", "SAMPLING", "EXECUTING_TOOL", "SAMPLING", "VERIFYING", "COMPLETED"):
            r.transition(state)
        self.assertEqual(admit_completed_rollout(r, current_policy=11, max_staleness=2), "ACCEPTED_FOR_TRAINING")
        r.transition("CONSUMED")
        self.assertEqual(r.status, "CONSUMED")

    def test_illegal_transition_rejected(self):
        r = RolloutRecord("r2", policy_version=10)
        with self.assertRaises(InvalidTransitionError):
            r.transition("CONSUMED")

    def test_terminal_state_blocks_further_transitions(self):
        r = RolloutRecord("r3", policy_version=10)
        r.transition("ADMITTED")
        r.transition("FAILED_INFRASTRUCTURE")
        with self.assertRaises(InvalidTransitionError):
            r.transition("COMPLETED")

    def test_idempotent_same_state_transition(self):
        r = RolloutRecord("r4", policy_version=10)
        r.transition("ADMITTED")
        r.transition("ADMITTED")
        self.assertEqual(r.history, ["CREATED", "ADMITTED"])

    def test_stale_rollout_rejected_above_threshold(self):
        r = RolloutRecord("r5", policy_version=4, reward=1.0)
        for state in ("ADMITTED", "ENVIRONMENT_READY", "SAMPLING", "VERIFYING", "COMPLETED"):
            r.transition(state)
        self.assertEqual(admit_completed_rollout(r, current_policy=8, max_staleness=2), "REJECTED_AS_STALE")

    def test_infra_failure_excluded_from_grpo_advantages(self):
        good = RolloutRecord("g1", policy_version=5, reward=1.0)
        bad = RolloutRecord("g2", policy_version=5, reward=0.0)
        crashed = RolloutRecord("g3", policy_version=5, reward=0.0)
        for rec in (good, bad):
            for state in ("ADMITTED", "ENVIRONMENT_READY", "SAMPLING", "VERIFYING", "COMPLETED"):
                rec.transition(state)
            admit_completed_rollout(rec, current_policy=5, max_staleness=2)
        crashed.transition("ADMITTED")
        crashed.transition("FAILED_INFRASTRUCTURE")
        adv = grpo_advantages([good, bad, crashed])
        self.assertEqual(len(adv), 2)
        self.assertGreater(adv[0], 0.0)
        self.assertLess(adv[1], 0.0)

    def test_zero_variance_group_returns_zero_advantages(self):
        recs = []
        for idx in range(3):
            r = RolloutRecord(f"z{idx}", policy_version=5, reward=1.0)
            for state in ("ADMITTED", "ENVIRONMENT_READY", "SAMPLING", "VERIFYING", "COMPLETED"):
                r.transition(state)
            admit_completed_rollout(r, current_policy=5, max_staleness=2)
            recs.append(r)
        self.assertEqual(grpo_advantages(recs), [0.0, 0.0, 0.0])

    def test_checkpoint_and_resume_round_trip(self):
        r = RolloutRecord("r6", policy_version=5)
        for state in ("ADMITTED", "ENVIRONMENT_READY", "SAMPLING", "EXECUTING_TOOL", "CHECKPOINTED", "RESUMING", "SAMPLING"):
            r.transition(state)
        self.assertEqual(r.status, "SAMPLING")


if __name__ == "__main__":
    unittest.main()
```

</figure>

## Quick quiz

<details markdown="1">
<summary>Q1. Why is dropping slow trajectories dangerous in asynchronous RL?</summary>

Slow trajectories often correspond to harder or multi-step reasoning tasks. Silently censoring them biases the training distribution toward short, easy problems and degrades performance on complex tasks.

</details>

<details markdown="1">
<summary>Q2. What happens if a sandbox OOM is recorded as reward 0 instead of FAILED_INFRASTRUCTURE?</summary>

The optimizer treats a cluster infrastructure fault as a bad model action, penalizing valid reasoning and corrupting GRPO group baselines.

</details>

<details markdown="1">
<summary>Q3. What extra bookkeeping does Speculative Encoding require if used inside an RL rollout engine?</summary>

Because translated KV/hidden states are approximate (reported 96.9% single-hop retention), the sampler must record exact emitted behavior logprobs (or recompute under native weights) so importance ratios `ρ_t` stay accurate.

</details>

## Sources

Checked **27 November 2026**: [AReaL](https://github.com/areal-project/AReaL), [verl](https://github.com/verl-project/verl), [slime](https://github.com/THUDM/slime), [Prime-RL](https://github.com/PrimeIntellect-ai/prime-rl), [Defeating Nondeterminism in LLM Inference](https://thinkingmachines.ai/blog/defeating-nondeterminism-in-llm-inference/), [Microsoft Rocket RL Infrastructure](https://microsoft.ai/news/rl-infrastructure-at-microsoft-ai/), [Stanford Plato's Key](https://hazyresearch.stanford.edu/blog/2026-11-25-platos-key), and [Ramp Labs Speculative Encoding](https://github.com/RampPublic/speculative-encoding).

<!-- {% endraw %} -->
