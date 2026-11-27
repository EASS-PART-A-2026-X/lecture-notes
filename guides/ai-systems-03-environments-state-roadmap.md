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
- **Copy-on-write (`CoW`) snapshot:** a fast frozen disk copy where two forked sandboxes share unchanged base files and only store the lines they modify.
- **Fork:** branching a running environment into two independent trials that share setup work up to the split point.
- **Trusted verifier:** a grading script sitting *outside* the agent's writable disk so the agent cannot edit its own tests.
- **Side effect:** any change escaping the sandbox (network request, email, remote DB write) that disk rewind cannot undo.
- **Action mask (`True`/`False`):** a per-token flag telling the trainer which tokens the *model* wrote (`True`) versus text pasted back by a tool (`False`).
- **Idempotency key &amp; outbox:** an *idempotency key* is a unique receipt ID attached to an outbound API call so retrying never double-posts or double-charges; an *outbox* is a local log recording outbound actions reliably before sending them.
- **`KV` cache (`K_t`) &amp; `Logprob`:** *KV cache* is the model's reading scratchpad; *logprob* is the exact probability score recorded for each token the model generated (Parts 1–2).
- **`MoE` &amp; Procrustes rotation:** *MoE (Mixture of Experts)* activates specialist sub-networks per token; *Procrustes rotation* aligns two models' hidden coordinate maps using one closed-form rotation and scale (Part 1).
- **`FSDP`, `ZeRO`, `Triton`, &amp; `PagedAttention`:** training weight sharding across GPUs (`FSDP` / `ZeRO`), a Python-like GPU kernel compiler (`Triton`), and virtual-memory paging for KV caches (`PagedAttention`).
- **`PPO`, `DPO`, &amp; `GRPO`:** post-training reinforcement learning methods from Part 2 (*Proximal Policy Optimization*, *Direct Preference Optimization*, *Group Relative Policy Optimization*).
- **`UID` (User ID):** the numeric Linux user identity inside a container—running as a non-root `UID` blocks admin privileges.
- **`TTFT` &amp; `MFU`:** *Time to First Token (`TTFT`)* is how long a user waits for the very first reply token; *Model FLOPs Utilization (`MFU`)* is what percentage of a GPU's peak math speed is doing useful work.
- **Goodput &amp; `OOM`:** *Goodput* is useful, verified tasks finished per minute (ignoring wasted retries); *Out-of-Memory (`OOM`)* is a sandbox or GPU RAM crash—always an infrastructure failure, never a model mistake.
- **Agent swarm (`Kimi K2.5`):** coordinating many specialized sub-agents in parallel (up to `100` in Kimi K2.5) to split complex workflows—making fast `CoW` sandbox forks and shared KV caches essential.
- **Attention &amp; memory shortcuts (`MLA`, `NSA`, `DSA`, `KDA`, `Engram`, `MuonClip`):** Part 1's 2025–2026 DeepSeek and Kimi techniques for shrinking KV caches (`MLA`, `KDA`), skipping irrelevant tokens (`NSA`/`DSA`), offloading static facts (`Engram`), and preventing trillion-parameter training spikes (`MuonClip`).
- **DeepSeek open stack (`FlashMLA`, `DeepEP`, `DeepGEMM`, `DualPipe`, `3FS`):** Part 1's open-source kernels, MoE all-to-all dispatch, FP8 GEMM, bidirectional pipeline scheduling, and fast distributed storage.
- **Supervised Fine-Tuning (`SFT`), cross-entropy (`L_SFT`), clipping (`ε_clip`), &amp; partial rollouts:** Part 2's imitation tuning (`SFT` with loss `−ln(p)`), RL step-size guardrail (`[1 − ε_clip, 1 + ε_clip]`), and saving unfinished long rollouts across steps (`Kimi k1.5`).

</details>

<details markdown="1" class="lecture-toc">
<summary>On this page</summary>

- [Stages 11–12: four fleets and fast sandboxes](#stages-1112-four-fleets-and-fast-sandboxes)
- [Case study: TimeTravelContainer and OpenShell](#case-study-timetravelcontainer-and-openshell)
- [Stage 8: task factory and independent verifiers](#stage-8-task-factory-and-independent-verifiers)
- [The Rewind Wall: unified state and cross-model K_t](#the-rewind-wall-unified-state-and-cross-model-k_t)
- [Versioned trajectory contract, recovery, and tracing](#versioned-trajectory-contract-recovery-and-tracing)
- [Practical roadmap, experiments, and open challenges](#practical-roadmap-experiments-and-open-challenges)
- [Python 3.14 lab: trajectory contract and multi-hop gate](#python-314-lab-trajectory-contract-and-multi-hop-gate)
- [Quick quiz](#quick-quiz)
- [One-page math cheat sheet (all 10 equations)](#one-page-math-cheat-sheet-all-10-equations)
- [Finish line: trace a full AI system end to end](#finish-line-trace-a-full-ai-system-end-to-end)
- [Curated bibliography and sources](#curated-bibliography-and-sources)

</details>

## Stages 11–12: four fleets and fast sandboxes

Traditional ML had two machine pools: training GPUs and inference GPUs. To let our `64,000`-token coding agent actually edit files, run `pytest`, and get fairly graded, agentic AI adds two more pools plus a small control plane:

| Pool | Typical hardware | Job | Main bottleneck &amp; fix |
|---|---|---|---|
| **1. Training** | GPUs + fast links | Update model weights | Memory &amp; sync → sharding (`FSDP`) |
| **2. Inference** | GPUs + high memory bandwidth | Generate tokens &amp; tool calls | KV memory &amp; decode → `PagedAttention` |
| **3. Environments** | CPUs, RAM, fast SSDs | Compilers, shells, browsers | Cold start → warm pools, CoW snapshots, build cache |
| **4. Verifiers** | Isolated CPUs/GPUs | Hidden tests &amp; graders | Reward hacking &amp; flakiness → separate trust boundary |
| **Control plane** | CPUs + Postgres / event log | Leases, budgets, state tracking | Slow controller → send IDs/refs, never large weights |

[Agent sandboxes](agent-sandboxes.md) explains why ordinary containers need `--network none`, `--read-only`, and `--cap-drop ALL` (or microVMs like Firecracker / gVisor). At RL scale, two speedups connect directly back to Part 1's capacity law:

1. **Standardized environment API:** [OpenEnv](https://github.com/openenv/OpenEnv) standardizes `reset(task, seed)`, `step(action)`, and `state()`. Adding proposed `snapshot()`, `restore(id)`, and `fork(id)` operations lets parallel reasoning branches share a pre-built repo without running `uv sync` or `npm install` from scratch every time.
2. **Build &amp; artifact caching:** Prepared base images, copy-on-write filesystems, and content-addressed build caches keep sandbox throughput (`λ_environment`) fast enough that GPUs stay fed.
3. **Why swarms multiply sandbox pressure ([Kimi K2.5](https://arxiv.org/abs/2602.02276)):** Modern agentic models split big tasks into dynamic sub-agent teams—*Kimi K2.5* coordinates up to `100` parallel agents per workflow. Without sub-second `CoW` forks and shared KV scratchpads (`Mooncake`, *Speculative Encoding*), `100` agents cold-booting `uv sync` would stall every inference GPU on earth.

Step through how execution environments evolved to keep pace with GPU fleets:

<div class="stepper" markdown="1">

1. **Plain containers.** Fast to start, but default mounts and network routes risk leaking host secrets or letting code alter your checkout.
2. **Hardened containers.** Add `--network none`, `--read-only`, `--cap-drop ALL`, and non-root `UIDs` (User IDs, like `sandbox_probe.py`) to block exfiltration.
3. **MicroVMs &amp; user-space kernels.** Firecracker and gVisor isolate each sandbox's kernel boundary so hostile model code cannot exploit a shared host kernel.
4. **Warm pools + CoW snapshots.** Pre-warmed base images and copy-on-write forks cut cold setup from minutes to sub-second branching.
5. **Locked verifiers (Harbor, OpenEnv).** Hidden tests sit outside the agent's writable disk so agents cannot cheat or confuse crashes with bad answers.

</div>

## Case study: TimeTravelContainer and OpenShell

[TimeTravelContainer (TTC)](https://github.com/NVlabs/TimeTravelContainer) is a rootless container runtime built on gVisor. Its **live fork** branches running processes, filesystem state, and supported OS resources, including internal network sockets. Memory and writable storage use copy-on-write: branches share unchanged data until a write. This extends our disk-snapshot example to a running environment.

**Optional command walkthrough:** With matching `ttc`/`ttcd` release binaries installed and the daemon started, the README's branch workflow can be reduced to:

```bash
ttc run -dit --name agent --network=ttc --nat ubuntu:26.04 bash
ttc exec agent@main sh -lc 'apt-get update && apt-get install -y git'
ttc fork agent@main approach-a approach-b
ttc ls --tree
```

Both branches inherit the prepared setup and then evolve separately. These are upstream usage examples, not commands executed by this course's automated labs. Read the README's installation instructions and [current limitations](https://github.com/NVlabs/TimeTravelContainer/blob/master/g3doc/user_guide/ttc_limitations.md) before experimenting; GPU resources have their own fork semantics. TTC has not yet received the security review needed for hostile multi-tenant production isolation.

**OpenShell supplies a different layer:** [OpenShell](https://github.com/ai-openshell/openshell), originally under NVIDIA and now hosted at `ai-openshell`, enforces policies for filesystem, process, and network access. TTC's README describes running within a guardrail such as OpenShell or beneath an environment orchestrator such as NeMo Gym. Treat that as a layering model whose compatibility and configuration you must validate for your deployment.

### What a sandbox fork does not promise

- **Model state:** Forking the execution environment does not automatically fork a remote inference server's KV cache, policy weights, or token history. The harness must coordinate these with each branch.
- **External effects:** A preserved internal socket does not rewind a remote service. A webhook sent before or after the fork remains sent; mock outbound services or use idempotency and compensation.
- **Trusted grading:** Keep hidden tests and grading authority outside the agent's writable state. A fork remains subject to the same verifier trust boundary.

**Reading exercise, no installation needed:** Our agent prepares one repository and explores two patches. Name the setup work shared at the fork, the model-state references recorded for each branch, and the outbound calls that must be mocked. Then compare cold starts against forks using setup time, memory, and verified tasks per second; measure rather than assume a speedup.

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

<div class="sim" id="sim-aisys-state" role="group" aria-label="Rewind Wall and verifier explorer" markdown="1">

<p class="sim-title"><strong>Interactive explorer: The Rewind Wall, verifiers, and multi-hop KV</strong></p>

<div class="sim-fallback" markdown="1">

**Worked example without JavaScript:** In scenario **File edit + Slack webhook sent**, simulating a disk rewind restores `app.py` (`E_t`) back to `t=0`, **but the HTTP POST to Slack is STILL PRESENT** in the outside world—snapshots cannot un-send external calls. In scenario **6-hop Speculative Encoding chain**, chained latent translations decay to `77.8%` synthetic accuracy (`< 85%` floor), triggering a forced raw-text re-prefill checkpoint before grading.

</div>
</div>

## Versioned trajectory contract, recovery, and tracing

If you save only plain text from a rollout and re-tokenize it on the trainer, subtle whitespace or tokenizer differences break token alignment and `logprobs`. Every completed trajectory must pass **five exact fields**:

`token_ids` · `behavior_logprobs` · `token_policy_versions` · `action_mask` (`True` for model tokens, `False` for tool outputs) · `verifier_version`

- **Independent recovery:** Design for *at-least-once* delivery with unique attempt IDs and leases so a crashed inference replica or sandbox restarts cleanly without aborting the whole run.
- **One end-to-end trace:** Connect every metric (`MFU` = GPU utilization, `TTFT` = Time to First Token, `policy_lag`, `snapshot_hit_rate`, `cost_per_success`) along one chain: `Experiment → Run → Policy → Task → Group → Trajectory → Inference → Tool → Sandbox → Verifier → Batch → Step`.

## Practical roadmap, experiments, and open challenges

### Four-milestone build path (14 phases simplified)
1. **Numerical foundation (Phases 0–2):** One-command local setup, small PyTorch training + checkpoint restore, and token/logit parity check with vLLM/SGLang.
2. **Environments before agents (Phases 3–5):** Isolated sandbox runner, Harbor task + trusted verifier, and exact multi-turn trajectory recording.
3. **Sync then async RL (Phases 6–8):** Baseline synchronous GRPO (`Prime-RL`, `verl`, or `TRL`), then bounded async queues, staleness caps, and atomic weight sync.
4. **Forkable state &amp; resilience (Phases 9–14):** Prepared snapshots, CoW forks, fault injection, independent fleet scaling, and end-to-end cost-per-success tracking.

### Experimental matrix (speed only counts if quality holds!)
Every infra speedup must be tested against **held-out task accuracy per dollar and per second**, never isolated latency alone:
- Cold containers vs. prepared snapshots · Clean rebuilds vs. content-addressed build caches · Independent sandboxes vs. CoW forks · Raw `N×` text re-prefill vs. Speculative Encoding (auditing multi-hop accuracy!) · FIFO (first-in, first-out) vs. staleness-aware scheduling · Restart-from-zero vs. checkpoint/resume.

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

<details markdown="1">
<summary>Show the expected demo and test output</summary>

Captured with Python 3.14 (stdlib only, no GPU):

```text
$ python3 trajectory_verifier.py
t1 -> (True, 'admitted')
t2 -> (False, 're_prefill_required:0.778<0.850')
t3 -> (False, 'excluded:infrastructure_failure')

$ python3 -m unittest -v
...
Ran 8 tests in 0.000s

OK
```

`t1` (2 latent hops, `88.3% >= 85%`) passes, `t2` (6 chained hops, `77.8% < 85%`) is caught before training so it re-prefills from `token_ids`, and `t3` (`infrastructure_failure`) is cleanly excluded.

</details>

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

## One-page math cheat sheet (all 10 equations)

| # | Concept | Equation (plain text) | Concrete toy example |
|---|---|---|---|
| **1** | **Training compute** (Part 1) | `C ≈ 6 · N · D` | `10^6` weights × `10^7` tokens = `6 × 10^13` math ops |
| **2** | **Serving roofline** (Part 1) | `P <= min(P_peak, B_memory × I)` | Decode waits for bytes/sec (`B_memory`), not raw math |
| **3** | **KV memory vs. MLA / KDA** (Part 1) | `M_KV = 2·L·T·H_KV·d_h·s` vs `M_MLA = L·T·d_c·s` vs `O(1)` `KDA` | `MLA` shrinks per-token KV **16×**; `KDA` stays constant in `T` |
| **4** | **Sparse attention** (Part 1) | `O(T^2)` dense → `O(T · k)` top-`k` (`NSA`/`DSA`) | At `T = 64k, k = 2,048`, attend to `3.2%` (**~31× fewer pairs**) |
| **5** | **4-fleet goodput** (Part 1) | `goodput <= min(inference, sandboxes, graders, learner)` | `min(40, 15, 50, 35) = 15` solved tasks/min |
| **6** | **Cross-model KV rotation** (Part 1) | `min_R ||A · R − B||_F` (`R^T·R = I`) &amp; `0.969^k` | `6` chained Speculative Encoding hops: `0.969^6 ≈ 82.8%` |
| **7** | **Trillion-scale stability** (Part 1) | `MuonClip` (`QK-Clip`): scale `W_Q, W_K` by `√(τ / s_max)` | `Kimi K2` trained `1T` weights on `15.5T` tokens with zero loss spikes |
| **8** | **Imitation (`SFT`)** (Part 2) | `L_SFT = −(1/N) · Σ ln π_θ(y_t | s_t)` | `p = 0.50` → loss `0.69`; `p = 0.90` → loss `0.11` |
| **9** | **Group RL (`GRPO` &amp; clip)** (Part 2) | `A_i = (r_i − r̄) / (σ_r + ε)`, `clip(ρ_t, 1 − ε_clip, 1 + ε_clip)` | Rewards `[1, 0, 1, 0]` → `[+1.0, −1.0, +1.0, −1.0]` |
| **10** | **Async policy lag** (Part 2) | `staleness ≈ sampler_lag + T_rollout / T_step` | `0 + 90s / 15s = 6` weight updates behind |

## Finish line: trace a full AI system end to end

Suppose an instructor asks you in plain English: **"Walk me through how an AI coding agent reads a `64,000`-token repo, fixes a failing `pytest` bug, and gets smarter overnight."** Try tracing all five steps below before opening the answer key:

1. **Building &amp; serving (Part 1):** Why can't the trainer skip saving its data-loader cursor, why does a huge `64,000`-token codebase slow down serving, and how can two different models share that `64,000`-token reading work?
2. **Cluster bottleneck (Part 1):** If GPUs serve `40` tries/min while sandboxes build `15` tries/min, what happens if you buy twice as many GPUs?
3. **Practicing with RL (Part 2):** How does GRPO score `4` tries (`[1.0, 0.0, 1.0, 0.0]`), and what happens if Try 3 suffers an `OOM` sandbox crash?
4. **Sandboxes &amp; The Rewind Wall (Part 3):** If the agent edits `app.py` and sends an HTTP webhook to Slack, what does rewinding the sandbox disk snapshot undo—and how do we stop the agent from editing `test_app.py` to cheat?
5. **Closing the loop (Part 3):** Which exact fields must go into the training batch so weight updates stay mathematically valid?

<details markdown="1">
<summary>Check your complete end-to-end trace</summary>

1. **Part 1:** Restoring only weights without the data-loader cursor repeats or skips batches. Long `64,000`-token prompts grow the `KV` scratchpad linearly with token count `T` (shrunk by DeepSeek `MLA`/`NSA`/`DSA` or kept constant by `Kimi Linear`); *Plato's Key* shows two models' hidden states align via a zero-training Procrustes rotation + scale, and *Speculative Encoding* trains a small `2.35B` MoE translator so Model B skips re-reading raw text (subject to multi-hop drift checks).
2. **Part 1 bottleneck:** Goodput stays pinned at `15`/min (`goodput <= min(inference, sandboxes, graders, learner)`). You must speed up sandboxes with warm pools or `CoW` snapshots first.
3. **Part 2:** GRPO compares valid tries against the group average (`0.5`), giving `+1.0` to passes and `-1.0` to genuine test failures—while routing the `OOM` crash to `FAILED_INFRASTRUCTURE` so it is excluded and retried instead of receiving reward `0`. Meanwhile, async training bounds `policy_lag` (or uses Kimi `k1.5` partial rollouts) and keeps KV state aligned with emitted `logprobs`.
4. **Part 3:** Rewinding disk snapshot `E_t` restores `app.py`, **not** the external Slack webhook (external side effects need idempotency keys or mocks). Placing hidden tests outside the sandbox's writable disk stops test tampering.
5. **Part 3 trajectory contract:** Log exact `token_ids`, `behavior_logprobs`, `token_policy_versions`, `action_mask` (`True` only for model-written tokens), and `verifier_version`, and trigger raw re-prefill if multi-hop KV translation drops below the safety floor.

</details>

## Curated bibliography and sources

Checked **27 November 2026** (tracking parameters removed; primary links verified):

- **NVIDIA-related systems across the three parts:** [Megatron-LM](https://github.com/NVIDIA/Megatron-LM) (training), [Dynamo](https://github.com/ai-dynamo/dynamo) (distributed serving), [NeMo Gym](https://github.com/NVIDIA-NeMo/Gym) (environments and evaluation), [TimeTravelContainer README](https://github.com/NVlabs/TimeTravelContainer#readme) (live sandbox branches), and [OpenShell README](https://github.com/ai-openshell/openshell#readme) (access policy). These links explain separate responsibilities; this course has not benchmarked them as one integrated stack.

- **Foundational books:** [Google DeepMind — How to Scale Your Model](https://jax-ml.github.io/scaling-book/), [Chris Fregly — AI Systems Performance Engineering](https://github.com/cfregly/ai-performance-engineering), [Sutton &amp; Barto — Reinforcement Learning (2nd ed.)](http://incompleteideas.net/book/the-book-2nd.html), [Machine Learning Systems](https://mlsysbook.ai/), [Philip Kiely — Inference Engineering](https://www.baseten.co/inference-engineering/book/), [OSTEP](https://pages.cs.wisc.edu/~remzi/OSTEP/), [Systems Performance](https://www.brendangregg.com/systems-performance-2nd-edition-book.html).
- **Courses:** [Stanford CS336](https://stanford-cs336.github.io/), [Harvard CS2680](https://cs2680.seas.harvard.edu/), [GPU MODE](https://github.com/gpu-mode/lectures).
- **Core papers:** [Attention Is All You Need](https://arxiv.org/abs/1706.03762), [Megatron-LM](https://arxiv.org/abs/1909.08053), [ZeRO](https://arxiv.org/abs/1910.02054), [Chinchilla](https://arxiv.org/abs/2203.15556), [DeepSeek-V3](https://arxiv.org/abs/2412.19437), [Native Sparse Attention](https://arxiv.org/abs/2502.11089), [DeepSeek-V3.2](https://arxiv.org/abs/2512.02556), [DeepSeek Engram](https://arxiv.org/abs/2601.07372), [Kimi k1.5](https://arxiv.org/abs/2501.12599), [Kimi K2 &amp; MuonClip](https://arxiv.org/abs/2507.20534), [Kimi Linear](https://arxiv.org/abs/2510.26692), [Kimi K2.5](https://arxiv.org/abs/2602.02276), [Orca](https://www.usenix.org/conference/osdi22/presentation/yu), [FlashAttention](https://arxiv.org/abs/2205.14135), [PagedAttention](https://arxiv.org/abs/2309.06180), [DistServe](https://arxiv.org/abs/2401.09670), [Mooncake](https://arxiv.org/abs/2407.00079), [PPO](https://arxiv.org/abs/1707.06347), [IMPALA](https://arxiv.org/abs/1802.01561), [DPO](https://arxiv.org/abs/2305.18290), [DeepSeek-R1](https://arxiv.org/abs/2501.12948), [HybridFlow](https://arxiv.org/abs/2409.19256), [AReaL](https://arxiv.org/abs/2505.24298), [Stanford Plato's Key](https://hazyresearch.stanford.edu/blog/2026-11-25-platos-key), and [Ramp Labs Speculative Encoding](https://github.com/RampPublic/speculative-encoding).
- **Core repositories:** [TorchTitan](https://github.com/pytorch/torchtitan), [Megatron-LM](https://github.com/NVIDIA/Megatron-LM), [Triton](https://github.com/triton-lang/triton), [FlashMLA](https://github.com/deepseek-ai/FlashMLA), [DeepEP](https://github.com/deepseek-ai/DeepEP), [DeepGEMM](https://github.com/deepseek-ai/DeepGEMM), [DualPipe](https://github.com/deepseek-ai/DualPipe), [3FS](https://github.com/deepseek-ai/3FS), [Engram](https://github.com/deepseek-ai/Engram), [Kimi Linear](https://github.com/MoonshotAI/Kimi-Linear), [Kimi K2.5](https://github.com/MoonshotAI/Kimi-K2.5), [vLLM](https://github.com/vllm-project/vllm), [SGLang](https://github.com/sgl-project/sglang), [AReaL](https://github.com/areal-project/AReaL), [verl](https://github.com/verl-project/verl), [Prime-RL](https://github.com/PrimeIntellect-ai/prime-rl), [Harbor](https://github.com/harbor-framework/harbor), and [OpenEnv](https://github.com/openenv/OpenEnv).

<!-- {% endraw %} -->
