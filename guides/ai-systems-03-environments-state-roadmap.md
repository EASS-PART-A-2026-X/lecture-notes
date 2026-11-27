# Part 3 · Environments, verifiers, unified state, and roadmap

<!-- {% raw %} -->

[Course home](../README.md) · [Part 2 · RL and rollouts](ai-systems-02-rl-and-rollouts.md) · [Agent sandboxes](agent-sandboxes.md) · [Systems reasoning](systems-reasoning.md) · [Further study](further-study.md)

> **Optional; not graded:** This final bonus lesson sits outside the EASS Class X syllabus and adds zero deadlines or hardware requirements. It completes the knowledge graph—connecting sandboxes, trusted graders, unified state, reliability, and a practical build roadmap.

**You will be able to:** separate the 4+1 machine pools, explain what a filesystem snapshot *can* and *cannot* rewind ("The Rewind Wall"), keep hidden tests outside the agent's write scope, apply the Versioned Trajectory data contract in Python 3.14, and navigate the 4-milestone build roadmap and primary literature.

**Predict first:** An agent inside a sandbox edits `app.py` and sends an HTTP webhook to Slack. You then rewind the sandbox disk snapshot back to `t = 0`. Did the Slack message disappear?

<details markdown="1">
<summary>Check your prediction</summary>

**No!** Rewinding a local filesystem snapshot restores files inside the sandbox, not emails, Slack messages, payments, or remote database rows. Just like the SQLite outbox lab in [Systems reasoning](systems-reasoning.md), external effects need idempotency keys, mocked test endpoints, or compensation.

</details>

<details markdown="1">
<summary>Terms used on this page (plain English)</summary>

- **Compute fleet:** a pool of machines specialized for one job (GPUs for training, GPUs for inference, CPUs/SSDs for sandboxes, isolated CPUs for grading).
- **Copy-on-write (CoW) snapshot:** a fast frozen disk copy where two forked sandboxes share unchanged base files and only store the lines they modify.
- **Fork:** branching a running environment into two independent trials that share setup work up to the split point.
- **Trusted verifier:** a grading script sitting *outside* the agent's writable disk so the agent cannot edit its own tests.
- **Side effect:** any change escaping the sandbox (network request, email, remote DB write) that disk rewind cannot undo.
- **Action mask (`True`/`False`):** a per-token flag telling the trainer which tokens the *model* wrote (`True`) versus text pasted back by a tool (`False`).

</details>

<details markdown="1" class="lecture-toc">
<summary>On this page</summary>

- [Stages 11–12: four fleets and fast sandboxes](#stages-1112-four-fleets-and-fast-sandboxes)
- [Stage 8: task factory and independent verifiers](#stage-8-task-factory-and-independent-verifiers)
- [The Rewind Wall: unified state and cross-model K_t](#the-rewind-wall-unified-state-and-cross-model-k_t)
- [Versioned trajectory contract, recovery, and tracing](#versioned-trajectory-contract-recovery-and-tracing)
- [Practical roadmap, experiments, and open challenges](#practical-roadmap-experiments-and-open-challenges)
- [Python 3.14 lab: trajectory contract and multi-hop gate](#python-314-lab-trajectory-contract-and-multi-hop-gate)
- [Quick quiz](#quick-quiz)
- [Curated bibliography and sources](#curated-bibliography-and-sources)

</details>

## Stages 11–12: four fleets and fast sandboxes

Traditional ML had two machine pools: training GPUs and inference GPUs. Agentic AI adds two more pools plus a small control plane:

| Pool | Typical hardware | Job | Main bottleneck &amp; fix |
|---|---|---|---|
| **1. Training** | GPUs + fast links | Update model weights | Memory &amp; sync → sharding (`FSDP`) |
| **2. Inference** | GPUs + high memory bandwidth | Generate tokens &amp; tool calls | KV memory &amp; decode → `PagedAttention` |
| **3. Environments** | CPUs, RAM, fast SSDs | Compilers, shells, browsers | Cold start → warm pools, CoW snapshots, build cache |
| **4. Verifiers** | Isolated CPUs/GPUs | Hidden tests &amp; graders | Reward hacking &amp; flakiness → separate trust boundary |
| **Control plane** | CPUs + Postgres / event log | Leases, budgets, state tracking | Slow controller → send IDs/refs, never large weights |

[Agent sandboxes](agent-sandboxes.md) explains why ordinary containers need `--network none`, `--read-only`, and `--cap-drop ALL` (or microVMs like Firecracker / gVisor). At RL scale, two speedups connect directly back to Part 1's capacity law:

1. **Standardized environment API:** [OpenEnv](https://github.com/openenv/OpenEnv) standardizes `reset(task, seed)`, `step(action)`, and `state()`. Adding proposed `snapshot()`, `restore(id)`, and `fork(id)` operations lets parallel reasoning branches share a pre-built repo without running `uv sync` or `npm install` from scratch every time.
2. **Build &amp; artifact caching:** Prepared base images, copy-on-write filesystems, and content-addressed build caches keep `λ_environment` fast enough that GPUs stay fed.

## Stage 8: task factory and independent verifiers

A reproducible agent task bundles an immutable container image, an initial snapshot, network/resource rules, and a **trusted verifier**—the pattern used by [Harbor](https://github.com/harbor-framework/harbor), [Verifiers](https://github.com/PrimeIntellect-ai/verifiers), [SWE-bench](https://github.com/SWE-bench/SWE-bench), [Terminal-Bench](https://github.com/harbor-framework/terminal-bench), and [Inspect AI](https://github.com/UKGovernmentBEIS/inspect_ai).

> **Simpler is enough:** Reuse an existing task layout (like Harbor's `task.toml`, `environment/`, and `tests/`) instead of inventing an incompatible custom format.

Just like your Recipe Box FastAPI backend never trusts raw frontend data, a **trusted verifier runs outside the agent's writable disk** and sorts every attempt into six clean buckets:

| Verifier outcome | What happened | Action for learner |
|---|---|---|
| `correct` | Passed hidden tests | Positive reward |
| `incorrect` | Ran cleanly, failed tests | Negative reward |
| `partial` | Passed some milestones | Partial reward |
| `invalid_action` | Bad tool syntax or denied access | Format/policy penalty |
| `infrastructure_failure` | Host crashed or image pull failed | **Exclude &amp; retry** (never train on it!) |
| `verification_failure` | Buggy test suite or broken grader | **Exclude &amp; alert engineer** |

## The Rewind Wall: unified state and cross-model K_t

Think of a concrete bug-fix story: an agent inside a sandbox edits `app.py` (local disk), builds a KV scratchpad while reading logs, and sends an external HTTP webhook. Every piece of that running rollout fits in a six-part tuple:

`S_t = (θ_v, K_t, H_t, E_t, Q_t, R_t)`

- `θ_v` = policy weight version · `K_t` = KV scratchpad · `H_t` = exact token/observation history
- `E_t` = sandbox filesystem · `Q_t` = pending tool calls · `R_t` = random seed &amp; metadata

<figure class="course-diagram">
  <div class="diagram-scroll" role="region" tabindex="0" aria-label="The Rewind Wall diagram separating local state from external side effects, scroll horizontally">
    <img src="../assets/diagrams/aisys-unified-state.svg" alt="Left box shows reversible local state E_t, K_t, H_t, theta_v inside the sandbox. Right box shows irreversible external effects: email sent, remote DB row, payment call. Bottom box shows the locked verifier boundary outside the agent disk." width="640" height="480">
  </div>
  <figcaption><strong>The Rewind Wall.</strong> Only local state on the left (<code>E_t</code>, <code>K_t</code>) can be cleanly snapshotted or forked. External side effects require idempotency keys or mocked boundaries. <span class="screen-only">On a narrow screen, scroll sideways.</span> <a href="../assets/diagrams/aisys-unified-state.svg">Open the diagram at full size</a>.</figcaption>
</figure>

<details markdown="1">
<summary>Text version of the diagram</summary>

A dashed vertical Sandbox Wall splits two worlds. On the left (`Inside: CAN rewind`), `E_t` (local sandbox files), `K_t` (KV scratchpad), `H_t` (exact token IDs), `θ_v` (pinned policy version), and `Q_t`/`R_t` (queue and RNG seed) can be snapshotted and forked safely. On the right (`Outside: CANNOT rewind`), sent emails, remote database rows, and payment or webhook API calls cannot be undone by disk rewind and require idempotency keys. Below both, a Locked Verifier Boundary sits outside the agent's writable disk to separate wrong answers from broken sandboxes.

</details>

### Connecting `K_t` to Plato's Key and Speculative Encoding
When two different models collaborate on one task, `K_t` is no longer locked to one model:
- **Linear chaining vs. learned translation:** *Plato's Key* reports that chaining closed-form Procrustes rotations `A → B → C` keeps `~99%` of direct `A → C` transfer accuracy (and surfaces dormant "dark memories" without weight changes). *Speculative Encoding*'s 2.35B MoE translator delivers high single-hop serving accuracy (`96.9%` reported), yet multi-hop pipelines must enforce two safeguards: (1) check accuracy decay over chained hops (`0.969^k` in a simple model), and (2) enforce **tenant isolation** on `K_t` so one user's translated KV cache never leaks to another user.

## Versioned trajectory contract, recovery, and tracing

If you save only plain text from a rollout and re-tokenize it on the trainer, subtle whitespace or tokenizer differences break token alignment and `logprobs`. Every completed trajectory must pass **five exact fields**:

`token_ids` · `behavior_logprobs` · `token_policy_versions` · `action_mask` (`True` for model tokens, `False` for tool outputs) · `verifier_version`

- **Independent recovery:** Design for *at-least-once* delivery with unique attempt IDs and leases so a crashed inference replica or sandbox restarts cleanly without aborting the whole run.
- **One end-to-end trace:** Connect every metric (`MFU`, `TTFT`, `policy_lag`, `snapshot_hit_rate`, `cost_per_success`) along one chain: `Experiment → Run → Policy → Task → Group → Trajectory → Inference → Tool → Sandbox → Verifier → Batch → Step`.

## Practical roadmap, experiments, and open challenges

### Four-milestone build path (14 phases simplified)
1. **Numerical foundation (Phases 0–2):** One-command local setup, small PyTorch training + checkpoint restore, and token/logit parity check with vLLM/SGLang.
2. **Environments before agents (Phases 3–5):** Isolated sandbox runner, Harbor task + trusted verifier, and exact multi-turn trajectory recording.
3. **Sync then async RL (Phases 6–8):** Baseline synchronous GRPO (`Prime-RL`, `verl`, or `TRL`), then bounded async queues, staleness caps, and atomic weight sync.
4. **Forkable state &amp; resilience (Phases 9–14):** Prepared snapshots, CoW forks, fault injection, independent fleet scaling, and end-to-end cost-per-success tracking.

### Experimental matrix (speed only counts if quality holds!)
Every infra speedup must be tested against **held-out task accuracy per dollar and per second**, never isolated latency alone:
- Cold containers vs. prepared snapshots · Clean rebuilds vs. content-addressed build caches · Independent sandboxes vs. CoW forks · Raw `N×` text re-prefill vs. Speculative Encoding (auditing multi-hop accuracy!) · FIFO vs. staleness-aware scheduling · Restart-from-zero vs. checkpoint/resume.

### Open frontiers &amp; optional 12-week study plan
Unsolved challenges include consistent unified state across external tools, forkable reasoning trees, bias-free policy-aware scheduling, exact numerical parity, cheat-proof verifiers, secure multi-tenant KV caches, and energy per solved task.

For self-study after EASS: **Weeks 1–3** performance math, GPU kernels, TorchTitan; **Weeks 4–5** minimal paged-KV inference engine; **Weeks 6–7** sync GRPO → async staleness; **Weeks 8–10** Harbor/OpenEnv, CoW snapshots, fault injection; **Weeks 11–12** policy-aware scheduling and full cost-vs-quality benchmarks.

## Python 3.14 lab: trajectory contract and multi-hop gate

Read the plain-English rules before the code:
1. `token_ids`, `behavior_logprobs`, `token_policy_versions`, and `action_mask` must all have the **exact same length** (otherwise training updates align the wrong probability with the wrong word!).
2. At least one token must have `action_mask = True` (the model actually wrote something).
3. `verifier_version` must match the trainer's expected grader version.
4. `infrastructure_failure` and `verification_failure` are cleanly excluded (`False`) instead of raising a crash or training on bad data.
5. Multi-hop translated KV (`kv_hops > 0`) is rejected for re-prefill if `base_accuracy × 0.969^kv_hops` drops below `min_accuracy_floor`.

<details markdown="1">
<summary>New Python syntax used here</summary>

- `@dataclass(frozen=True)`: creates an immutable data record whose fields cannot be accidentally modified after grading.
- `tuple[bool, str]`: returns both a True/False decision and a human-readable reason string.

</details>

Save both files in a new folder and run `python3 trajectory_verifier.py` first to see the decision trace, then `python3 -m unittest -v` for all eight checks.

<figure class="file-example file-example--long" markdown="1">
<figcaption><span class="file-example-action">File example</span> <span class="file-example-path">trajectory_verifier.py</span></figcaption>

```python
# trajectory_verifier.py
"""Zero-dependency Versioned Trajectory contract and multi-hop KV gate."""

from dataclasses import dataclass

EXCLUDED_OUTCOMES = {"infrastructure_failure", "verification_failure"}
VALID_OUTCOMES = {"correct", "incorrect", "partial", "invalid_action"} | EXCLUDED_OUTCOMES


class ContractViolationError(ValueError):
    pass


@dataclass(frozen=True)
class Trajectory:
    trajectory_id: str
    task_id: str
    verifier_version: str
    token_ids: list[int]
    behavior_logprobs: list[float]
    token_policy_versions: list[int]
    # True = token generated by the model; False = token pasted by a tool/environment
    action_mask: list[bool]
    outcome: str
    reward: float | None
    kv_hops: int = 0


def validate_trajectory(traj: Trajectory, expected_verifier_version: str) -> None:
    if traj.outcome not in VALID_OUTCOMES:
        raise ContractViolationError(f"Unknown outcome: {traj.outcome}")
    if traj.verifier_version != expected_verifier_version:
        raise ContractViolationError(
            f"Verifier mismatch: got {traj.verifier_version}, expected {expected_verifier_version}"
        )
    n = len(traj.token_ids)
    if n == 0:
        raise ContractViolationError("Trajectory cannot have zero tokens")
    if not (len(traj.behavior_logprobs) == len(traj.token_policy_versions) == len(traj.action_mask) == n):
        raise ContractViolationError("Array lengths for tokens, logprobs, policy versions, and action_mask must match")
    if not any(traj.action_mask):
        raise ContractViolationError("Trajectory must contain at least one model-generated action token")
    if traj.kv_hops < 0:
        raise ContractViolationError("kv_hops cannot be negative")


def admit_for_training(
    traj: Trajectory,
    expected_verifier_version: str,
    base_accuracy: float = 0.94,
    min_accuracy_floor: float = 0.85,
) -> tuple[bool, str]:
    validate_trajectory(traj, expected_verifier_version)
    if traj.outcome in EXCLUDED_OUTCOMES:
        return False, f"excluded:{traj.outcome}"
    if traj.reward is None:
        raise ContractViolationError("Trainable outcome requires a numeric reward")
    estimated_acc = base_accuracy * (0.969 ** traj.kv_hops)
    if traj.kv_hops > 0 and estimated_acc < min_accuracy_floor:
        return False, f"re_prefill_required:{estimated_acc:.3f}<{min_accuracy_floor:.3f}"
    return True, "admitted"


if __name__ == "__main__":
    samples = [
        Trajectory("t1", "task-1", "v1.2", [10, 11, 12], [-0.2, -0.4, -0.1], [7, 7, 7], [True, False, True], "correct", 1.0, kv_hops=2),
        Trajectory("t2", "task-1", "v1.2", [10, 11, 12], [-0.2, -0.4, -0.1], [7, 7, 7], [True, False, True], "correct", 1.0, kv_hops=6),
        Trajectory("t3", "task-1", "v1.2", [10, 11], [-0.2, -0.4], [7, 7], [True, False], "infrastructure_failure", None, kv_hops=0),
    ]
    for item in samples:
        print(item.trajectory_id, "->", admit_for_training(item, "v1.2"))
```

</figure>

<figure class="file-example file-example--long" markdown="1">
<figcaption><span class="file-example-action">File example</span> <span class="file-example-path">test_trajectory_verifier.py</span></figcaption>

```python
# test_trajectory_verifier.py
"""Eight stdlib tests for Trajectory validation and multi-hop KV gating."""

import unittest
from trajectory_verifier import ContractViolationError, Trajectory, admit_for_training


def sample_traj(**overrides) -> Trajectory:
    base = dict(
        trajectory_id="t1",
        task_id="task-001",
        verifier_version="v1.2",
        token_ids=[10, 11, 12],
        behavior_logprobs=[-0.2, -0.4, -0.1],
        token_policy_versions=[7, 7, 7],
        action_mask=[True, False, True],
        outcome="correct",
        reward=1.0,
        kv_hops=0,
    )
    base.update(overrides)
    return Trajectory(**base)


class TrajectoryVerifierTests(unittest.TestCase):
    def test_valid_native_trajectory_admitted(self):
        self.assertEqual(admit_for_training(sample_traj(), "v1.2"), (True, "admitted"))

    def test_mismatched_array_lengths_fail_contract(self):
        with self.assertRaises(ContractViolationError):
            admit_for_training(sample_traj(action_mask=[True, False]), "v1.2")

    def test_missing_action_tokens_fail_contract(self):
        with self.assertRaises(ContractViolationError):
            admit_for_training(sample_traj(action_mask=[False, False, False]), "v1.2")

    def test_verifier_version_mismatch_fails_contract(self):
        with self.assertRaises(ContractViolationError):
            admit_for_training(sample_traj(verifier_version="v1.0"), "v1.2")

    def test_infrastructure_failure_excluded_cleanly(self):
        ok, reason = admit_for_training(sample_traj(outcome="infrastructure_failure", reward=None), "v1.2")
        self.assertFalse(ok)
        self.assertEqual(reason, "excluded:infrastructure_failure")

    def test_verification_failure_excluded_cleanly(self):
        ok, reason = admit_for_training(sample_traj(outcome="verification_failure", reward=None), "v1.2")
        self.assertFalse(ok)
        self.assertEqual(reason, "excluded:verification_failure")

    def test_two_hop_speculative_encoding_within_floor_admitted(self):
        ok, reason = admit_for_training(sample_traj(kv_hops=2), "v1.2", base_accuracy=0.94, min_accuracy_floor=0.85)
        self.assertTrue(ok)
        self.assertEqual(reason, "admitted")

    def test_six_hop_speculative_encoding_triggers_reprefill_gate(self):
        ok, reason = admit_for_training(sample_traj(kv_hops=6), "v1.2", base_accuracy=0.94, min_accuracy_floor=0.85)
        self.assertFalse(ok)
        self.assertTrue(reason.startswith("re_prefill_required:"))


if __name__ == "__main__":
    unittest.main()
```

</figure>

**Break it on purpose:** Change `t2` in `trajectory_verifier.py` or pass `min_accuracy_floor=0.0` in `test_six_hop_speculative_encoding_triggers_reprefill_gate` to see what happens when the multi-hop drift gate is turned off. Restore it afterwards!

<details markdown="1">
<summary>Show what breaks</summary>

Turning off the floor (`min_accuracy_floor=0.0`) lets a 6-hop chain (`~77.8%` synthetic accuracy) slip into the training batch without re-prefilling, causing `test_six_hop_speculative_encoding_triggers_reprefill_gate` to fail because `ok` becomes `True`.

</details>

## Quick quiz

<details markdown="1">
<summary>Q1. Why must hidden verifier tests sit outside the agent's writable sandbox scope?</summary>

If an agent can edit or read hidden test fixtures, it can pass verification by weakening the grader instead of solving the task.

</details>

<details markdown="1">
<summary>Q2. Why store token_ids and behavior_logprobs instead of plain text?</summary>

Re-tokenizing text on the trainer can change token splits and boundaries, and missing behavior probabilities break importance ratios `ρ_t`.

</details>

<details markdown="1">
<summary>Q3. Name two safeguards required when sharing translated KV state across swarms.</summary>

Check compounding accuracy across chained hops (`0.969^k` in a simple model) and isolate caches strictly between different users or tenants.

</details>

## Curated bibliography and sources

Checked **27 November 2026** (tracking parameters removed; primary links verified):

- **Foundational books:** [Google DeepMind — How to Scale Your Model](https://jax-ml.github.io/scaling-book/), [Chris Fregly — AI Systems Performance Engineering](https://github.com/cfregly/ai-performance-engineering), [Sutton &amp; Barto — Reinforcement Learning (2nd ed.)](http://incompleteideas.net/book/the-book-2nd.html), [Machine Learning Systems](https://mlsysbook.ai/), [Philip Kiely — Inference Engineering](https://www.baseten.co/inference-engineering/book/), [OSTEP](https://pages.cs.wisc.edu/~remzi/OSTEP/), [Systems Performance](https://www.brendangregg.com/systems-performance-2nd-edition-book.html).
- **Courses:** [Stanford CS336](https://stanford-cs336.github.io/), [Harvard CS2680](https://cs2680.seas.harvard.edu/), [GPU MODE](https://github.com/gpu-mode/lectures).
- **Core papers:** [Attention Is All You Need](https://arxiv.org/abs/1706.03762), [Megatron-LM](https://arxiv.org/abs/1909.08053), [ZeRO](https://arxiv.org/abs/1910.02054), [Chinchilla](https://arxiv.org/abs/2203.15556), [DeepSeek-V3](https://arxiv.org/abs/2412.19437), [Orca](https://www.usenix.org/conference/osdi22/presentation/yu), [FlashAttention](https://arxiv.org/abs/2205.14135), [PagedAttention](https://arxiv.org/abs/2309.06180), [DistServe](https://arxiv.org/abs/2401.09670), [Mooncake](https://arxiv.org/abs/2407.00079), [PPO](https://arxiv.org/abs/1707.06347), [IMPALA](https://arxiv.org/abs/1802.01561), [DPO](https://arxiv.org/abs/2305.18290), [DeepSeek-R1](https://arxiv.org/abs/2501.12948), [HybridFlow](https://arxiv.org/abs/2409.19256), [AReaL](https://arxiv.org/abs/2505.24298), [Stanford Plato's Key](https://hazyresearch.stanford.edu/blog/2026-11-25-platos-key), and [Ramp Labs Speculative Encoding](https://github.com/RampPublic/speculative-encoding).
- **Core repositories:** [TorchTitan](https://github.com/pytorch/torchtitan), [Megatron-LM](https://github.com/NVIDIA/Megatron-LM), [Triton](https://github.com/triton-lang/triton), [vLLM](https://github.com/vllm-project/vllm), [SGLang](https://github.com/sgl-project/sglang), [AReaL](https://github.com/areal-project/AReaL), [verl](https://github.com/verl-project/verl), [Prime-RL](https://github.com/PrimeIntellect-ai/prime-rl), [Harbor](https://github.com/harbor-framework/harbor), and [OpenEnv](https://github.com/openenv/OpenEnv).

<!-- {% endraw %} -->
