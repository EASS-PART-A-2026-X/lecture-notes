# Part 1 · Building and serving models: the big picture

<!-- {% raw %} -->

[Course home](../README.md) · [Learning map](learning-map.md) · [Local inference](local-inference.md) · [Visual inference engineering](inference-engineering.md) · [Part 2 · RL and rollouts](ai-systems-02-rl-and-rollouts.md)

> **Optional; not graded:** This three-part mini-series sits **outside** the EASS Class X syllabus. It adds zero deadlines, assignments, GPUs, or paid accounts. Finish your Recipe Box milestones first, then read these three sessions as a simple map of how real-world AI systems work from end to end.

**You will be able to:** trace the five-node knowledge graph that connects data, weights, serving, sandboxes, and grading; explain all 13 lifecycle stages without jargon; compute a tiny toy training budget by hand; explain with tiny numbers how DeepSeek and Kimi cut compute (MoE), memory (MLA, sparse and linear attention), and training risk (MuonClip); spot why adding GPUs fails when sandboxes are slow; and see how *Plato's Key* and *Speculative Encoding* let different models share reading work.

**Predict first:** Imagine your Recipe Box backend can save `15` recipes per minute, while your fast frontend can click `40` times per minute. If you add a second identical frontend server (`80` clicks/min), how many more recipes get saved per minute?

<details markdown="1">
<summary>Check your prediction</summary>

Zero more: you still save `15` recipes per minute. The system as a whole can never move faster than its slowest link. In AI systems, the exact same rule holds across four machine pools: `goodput <= min(inference, sandboxes, graders, learner)`. Adding inference GPUs while sandboxes are the bottleneck leaves GPUs sitting idle.

</details>

<details markdown="1">
<summary>Terms used on this page (plain English)</summary>

- **Weights:** the millions or billions of saved numbers inside a trained model—like its permanent recipe book.
- **Token:** one chunk of text (roughly three-quarters of an English word) that a model reads or writes.
- **Goodput:** useful, verified work finished per minute—counting real progress, not wasted retries or crashed runs.
- **Prefill and decode:** *prefill* is reading your prompt once to prepare a scratchpad; *decode* is writing the reply one token at a time.
- **KV cache (scratchpad):** temporary attention notes a model builds while reading a prompt so it does not re-read the whole prompt on every output word.
- **Hidden state:** the internal list of numbers representing what the model "understands" at a given token.
- **Inference:** running an already-trained model to get an answer (weights stay frozen).
- **MoE (Mixture of Experts):** a model split into specialist sub-networks so each token wakes up only a small fraction of the weights.
- **Sharding (`FSDP` / `ZeRO`):** splitting a giant model's weights and training memory across multiple GPUs so it fits without crashing (*Fully Sharded Data Parallel* / *Zero Redundancy Optimizer*).
- **Fast links &amp; collectives (`NVLink`, `RDMA`, `NCCL`):** ultra-fast cables connecting GPUs inside one server (`NVLink`) or across servers (`RDMA`), plus the software library (`NCCL`) that coordinates data transfers between them.
- **Quantization (`FP8`, `FP4`) &amp; GPU kernels (`CUTLASS`, `Triton`):** shrinking each number from 16 bits down to 8-bit (`FP8`) or 4-bit (`FP4`) floating point to save memory and bandwidth, and writing fast low-level GPU math routines (`CUTLASS` C++ templates or the `Triton` Python-like GPU compiler).
- **`SFT` and `DPO`:** *Supervised Fine-Tuning (`SFT`)* teaches a model by copying expert examples; *Direct Preference Optimization (`DPO`)* teaches it by comparing a better answer against a worse answer.
- **Linux `cgroups`:** built-in Linux kernel resource limits that cap how much CPU and RAM a single container can use.
- **Procrustes rotation:** turning and scaling one coordinate map until its directions line up with another map—like rotating a tourist map until North points straight up.
- **`MLA` (Multi-head Latent Attention):** DeepSeek's KV-compression trick that squeezes all attention keys and values into one tiny shared vector `c_KV` per token instead of storing full-size per-head notes.
- **Sparse attention (`NSA` / `DSA`):** reading only the most relevant parts of a long prompt—selected blocks plus summaries and a local window (`NSA`), or the top-`k` past tokens picked by a tiny "lightning indexer" (`DSA`, `k = 2,048` in DeepSeek-V3.2)—instead of every token.
- **Linear attention (`KDA` / `Kimi Linear`):** replacing a growing per-token KV list with one fixed-size memory matrix `S_t` updated every token; Kimi Linear mixes `3` such layers with `1` full-attention layer, cutting KV memory by up to `75%`.
- **Conditional memory (`Engram`):** DeepSeek's `O(1)` static fact lookup table (offloaded to cheap host CPU RAM) so expensive GPU MoE experts spend compute on reasoning instead of memorizing trivia.
- **`MuonClip` (`QK-Clip`):** Moonshot AI's optimizer for Kimi K2 that rescales runaway attention matrices (`W_Q`, `W_K`) so trillion-parameter training never suffers loss spikes.
- **DeepSeek open stack (`FlashMLA`, `DeepEP`, `DeepGEMM`, `3FS`, `DualPipe`):** open-source Hopper `MLA` decode kernels (`FlashMLA`), `MoE` `NVLink`/`RDMA` all-to-all dispatch (`DeepEP`), fine-grained 8-bit `FP8` matrix math (`DeepGEMM`), fast `RDMA` distributed storage (`3FS`), and bidirectional pipeline scheduling (`DualPipe`) that hides idle GPU bubbles.

</details>

<details markdown="1" class="lecture-toc">
<summary>On this page</summary>

- [The knowledge graph: five connected parts](#the-knowledge-graph-five-connected-parts)
- [How Recipe Box maps to a frontier AI system](#how-recipe-box-maps-to-a-frontier-ai-system)
- [All 13 lifecycle stages in four simple phases](#all-13-lifecycle-stages-in-four-simple-phases)
- [Explore how the field progressed](#explore-how-the-field-progressed)
- [How the 16-layer stack fits underneath](#how-the-16-layer-stack-fits-underneath)
- [Deep dive: building vs. serving a model](#deep-dive-building-vs-serving-a-model)
- [NVIDIA examples: from weights to running agents](#nvidia-examples-from-weights-to-running-agents)
- [Sharing reading work across different models](#sharing-reading-work-across-different-models)
- [Lab: find the bottleneck and check multi-hop drift](#lab-find-the-bottleneck-and-check-multi-hop-drift)
- [Quick quiz](#quick-quiz)
- [Sources](#sources)

</details>

## The knowledge graph: five connected parts

Modern AI infrastructure has evolved through three waves: first systems that **learn** intelligence (distributed training), second systems that **serve** intelligence quickly (distributed inference), and now systems that **experiment and verify** on their own (autonomous execution).

**One running story across all three parts:** Imagine building an AI coding agent to **fix a failing `pytest` bug inside a `64,000`-token Python repository**. In **Part 1**, we build the model's weights, serve `64,000`-token prompts quickly without blowing GPU memory, and share reading work between two models. In **Part 2**, the agent practices `4` candidate patches in parallel and learns from real `pytest` outcomes. In **Part 3**, we lock down the sandbox, respect the Rewind Wall, verify fairly, and log exact training receipts.

Instead of memorizing forty buzzwords, picture one **five-node loop** controlled by an orchestrator (`Control Plane`):

1. **Clean Data** trains **Model Weights**.
2. **Model Weights** load into **Fast Serving** so the model can read and propose actions.
3. **Fast Serving** sends code or tool calls into a **Sandbox** to try them safely.
4. A **Trusted Grader** checks whether the sandbox work actually passed hidden tests.
5. Passing traces and rewards flow back to improve **Clean Data** and **Model Weights**.

Every engineering goal across all three sessions aims at one metric: **maximum useful, verified work per dollar, per second, and per unit of energy**.

<figure class="course-diagram course-diagram--wide">
  <div class="diagram-scroll" role="region" tabindex="0" aria-label="AI systems knowledge graph diagram, scroll horizontally">
    <img src="../assets/diagrams/aisys-lifecycle-and-stack.svg" alt="Control plane over a five-node loop: Clean Data to Weights to Serving to Sandbox to Trusted Grader and back, over shared GPUs, links, Linux isolation, and storage." width="960" height="500">
  </div>
  <figcaption><strong>One connected knowledge graph.</strong> Every box depends on the box before it; the Control Plane passes small job IDs and rules, never huge model weight files. <span class="screen-only">On a narrow screen, scroll sideways.</span> <a href="../assets/diagrams/aisys-lifecycle-and-stack.svg">Open the diagram at full size</a>.</figcaption>
</figure>

<details markdown="1">
<summary>Text version of the diagram</summary>

The Control Plane coordinates five connected nodes over a shared base (GPUs, fast network links, Linux isolation, and storage for checkpoints and KV scratchpads): `1. Clean Data` trains `2. Weights`, which load into `3. Serving`, which runs tool calls in `4. Sandbox`, which is checked by `5. Trusted Grader`, which feeds rewards and new traces back to Data and Weights.

</details>

## How Recipe Box maps to a frontier AI system

You already built the small-scale version of this graph in EASS:

| Everyday Recipe Box idea | Frontier AI systems equivalent | Why the edge exists |
|---|---|---|
| Your SQLite database + seed data | **Clean Data &amp; Shards** (Stage 1) | Bad or duplicate input teaches bad habits |
| `AI_MODEL` in `.env` | **Model Weights** (Stages 2–7) | Saved knowledge; frozen while serving users |
| `ai-service` calling Ollama | **Fast Serving** (Stages 9–10) | Turns prompts + scratchpad into tokens fast |
| `sandbox_probe.py` container | **Sandbox Execution** (Stage 11) | Runs untrusted generated code safely |
| FastAPI Pydantic check + `pytest` | **Trusted Grader** (Stage 8) | Never trust the model's claim of "done" |
| Docker Compose + CI | **Control Plane** (`L11` Orchestrator) | Starts, stops, budgets, and records versions |

## All 13 lifecycle stages in four simple phases

Real AI labs do not run these 13 stages strictly one-by-one; they run them in parallel loops. Notice that every stage follows the same story: **what it does → why it broke → how engineers fixed it → where it stands today**.

### Phase A · Build the model (Stages 0–4 and 7)

| Stage | Simple core steps | Key innovation &amp; main problem | How it was addressed &amp; status |
|---|---|---|---|
| **0. Infrastructure** | Wire GPUs, CPUs, fast links, and disks | Topology-aware clusters; **problem:** idle GPUs waiting on slow network | Managed via Ray, Slurm, Kubernetes + NVLink/RDMA (**Mature core**) |
| **1. Data engineering** | Crawl, clean, remove duplicates, filter privacy, convert to token files | Content-hashed manifests (DataTrove, Dolma); **problem:** crashed runs lose track of which rows were read | Checkpointable data loaders save exact file + row cursor (**Standard; synthetic curation active**) |
| **2. Pretraining** | Predict the next token on billions of examples | Splitting one giant model across many GPUs (6D parallelism — splitting data, layers, and matrices across GPUs + mixed precision); **problem:** out-of-memory crashes &amp; silent math errors | Shard parameters/optimizer state (FSDP/ZeRO) + periodic parity checks (**Mature dense; MoE active**) |
| **3. Mid-training** | Continue training on math, code, long docs, and tool formats | Context parallelism for huge inputs; **problem:** forgetting earlier skills | Mix replay data with domain curricula (**Standard practice**) |
| **4. SFT (Supervised Fine-Tuning / imitation)** | Show input → expert tool call → expert answer examples | Loss masking so gradients only score assistant turns, not user/tool text; **problem:** model only imitates | Pair SFT with Reinforcement Learning (RL) exploration in Part 2 (**Standard: TRL, TorchTune, TorchTitan**) |
| **7. Distillation** | Teach a small fast model from a large smart teacher | *On-policy* distillation grades the student's own answers; **problem:** student drifts on multi-step tasks | Teacher grades student rollouts rather than static essays (**Widely used for efficiency**) |

### Phase B · Serve it fast (Stages 9–10)

| Stage | Simple core steps | Key innovation &amp; main problem | How it was addressed &amp; status |
|---|---|---|---|
| **9. Deployment opt.** | Shrink weight precision (16-bit → 8/4-bit) &amp; compile GPU kernels | Kernel fusion &amp; quantization; **problem:** shrinking numbers can break accuracy | Re-run held-out quality tests on every quantized build (**Mature; 4-bit FP4 active**) |
| **10. Inference** | Read prompt once (prefill), then emit 1 token per step (decode) | Paged KV memory (vLLM), continuous batching (Orca), prefix reuse (SGLang); **problem:** KV scratchpad fills GPU memory | Virtualized KV blocks + optional prefill/decode splitting (**Mature single-model; cross-model new**) |

### Phase C &amp; D · Practice, grade, and improve (Stages 5, 6, 8, 11, 12 — covered in Parts 2 &amp; 3)

- **Stage 5 (Direct Preference Optimization, DPO)** &amp; **Stage 6 (Reinforcement Learning, RL &amp; rollouts):** model tries problems itself and learns from graded rewards (**Part 2**).
- **Stage 11 (Agentic execution)** &amp; **Stage 8 (Evaluation)** &amp; **Stage 12 (Feedback):** sandboxes run untrusted code safely, hidden graders separate broken sandboxes from wrong answers, and verified traces feed future training (**Part 3**).

## Explore how the field progressed

Pick any of the six core themes below and step from the **early problem**, through the **breakthrough**, to **today's open gaps**.

<div class="sim" id="sim-aisys-progress" role="group" aria-label="How AI systems progressed explorer" markdown="1">

<p class="sim-title"><strong>Interactive explorer: concepts, problems, and field progress</strong></p>

<div class="sim-fallback" markdown="1">

**Worked example without JavaScript:** On **Cross-model context**, prefix caching breaks whenever two agents use different model families, forcing Model B to re-read all 64k raw tokens (`1. Early problem`). **Plato's Key** solved the geometry question using a zero-training Procrustes rotation + scale (`2. Breakthrough`: `~99%` relative chaining), and **Speculative Encoding** pushed serving speed with a 2.35B MoE translator (`3. Today's status`: reported `96.9%` retention and up to `7.5×` prefill speedup, while leaving multi-hop drift and tenant isolation as open engineering checks).

</div>
</div>

## How the 16-layer stack fits underneath

Engineers split the stack into layers (`L0`–`L15`) so you can upgrade one layer (like swapping vLLM for SGLang) without rewriting everything else:

- **`L0`–`L3` (Machines &amp; OS):** GPUs/CPUs, fast links (NVLink, RDMA), Linux containers/sandboxes (`cgroups`), and cluster schedulers (Ray, Kubernetes, Slurm).
- **`L4`–`L7` (Speed &amp; Storage):** fast GPU math kernels (FlashAttention, CUTLASS), compilers (Triton), multi-GPU communication (NCCL, FSDP), and storage for datasets, checkpoints, and KV caches (S3, Mooncake, LMCache).
- **`L8`–`L10` (Three Runtimes):** Training (TorchTitan, Megatron-LM), Inference (vLLM, SGLang, Dynamo), and Sandboxes (Firecracker, gVisor).
- **`L11`–`L15` (Brains &amp; Grading):** Orchestrators (Ray, Monarch), RL engines (verl, AReaL, Prime-RL, slime), Environments (Harbor, OpenEnv), Graders (Inspect AI), and user apps.

## Deep dive: building vs. serving a model

### Worked-by-hand: how much math does pretraining do?
For a standard dense model, total training math operations follow a simple rule of thumb: `C ≈ 6 · N · D` (`N` = number of weights, `D` = number of training tokens; forward pass is `~2ND`, backward pass is `~4ND`).

Try a tiny toy example on paper: `N = 1,000,000` weights (`10^6`) trained on `D = 10,000,000` tokens (`10^7`).
- `C ≈ 6 × 10^6 × 10^7 = 6 × 10^13` operations.
- Now scale `N` to `70B` and `D` to `15T`—that is why pretraining needs thousands of GPUs, **checkpointable data loaders** (saving both weights *and* exact dataset position so a crash never re-trains on the same rows), and corruption detectors for faulty GPUs.

### Worked-by-hand: why serving slows down as conversations grow
When serving a user, [Visual inference engineering](inference-engineering.md) shows that **prefill** is compute-limited while **decode** is limited by how fast bytes move out of GPU memory: `P <= min(P_peak, B_memory × I)` (where `P_peak` is the GPU's peak math speed, `B_memory` is memory bandwidth in bytes/second, and `I` is math operations done per byte loaded). Each user also keeps a KV scratchpad of size `M_KV = 2 · L · T · H_KV · d_h · s` (the `2` is for storing both *key* and *value* notes, `L` is the number of model layers, `T` is the number of tokens in the conversation, `H_KV` is the number of attention heads, `d_h` is the size of each head, and `s` is bytes per number). Double `T` from `1,000` to `2,000` tokens, and `M_KV` immediately doubles!

> **Simpler is enough:** Keep prefill and decode on the same GPU workers when starting out. Only split them onto separate pools (disaggregation) when profiling proves long prompts are stalling live user typing enough to justify copying KV caches over the network.

### Worked-by-hand: how DeepSeek and Kimi beat the compute, memory, and stability walls

Eight short ideas explain how 2025–2026 open models keep our `64,000`-token repo affordable. Every number below is either toy arithmetic or an author-reported figure.

1. **MoE: pay only for the experts you use.** Training compute counts *active* weights: `C ≈ 6 · N_active · D`. DeepSeek-V3 (`671B` total, `37B` active, `14.8T` tokens): `6 × 37×10^9 × 14.8×10^12 ≈ 3.3 × 10^24` operations. Kimi K2 (`1T` total, `32B` active, `15.5T` tokens): `≈ 3.0 × 10^24`. A dense `671B` model on the same data would need `≈ 6.0 × 10^25`—about `18×` more. (Rule of thumb only: it ignores attention math and routing overhead, and all `671B` weights must still be stored.) Side note: Chinchilla's compute-optimal rule is `D ≈ 20 · N` (a `70B` model → `1.4T` tokens); today's models train on far more tokens because a smaller, longer-trained model is cheaper to serve.
2. **The attention wall (`O(T^2)`).** In causal attention, token `t` compares itself with all `t` tokens so far: `T · (T + 1) / 2` pairs per layer per head. At `T = 64,000` that is `≈ 2.05 billion` pairs, while the KV cache `M_KV` grows linearly with `T`.
3. **DeepSeek `MLA`: compress the KV cache.** Plain multi-head attention stores a key and a value for every head: `2 · H · d_h` numbers per token per layer. `MLA` stores one compressed latent `c_KV` of width `d_c` plus a small position key of width `d_R`: `d_c + d_R` numbers. With DeepSeek-V3's settings (`H = 128`, `d_h = 128`, `d_c = 512`, `d_R = 64`): `32,768` vs `576` numbers—about `57×` smaller than plain multi-head attention with the same heads.
4. **Sparse attention: read only what matters.** [Native Sparse Attention (`NSA`)](https://arxiv.org/abs/2502.11089) (research, February 2025) mixes three cheap views of the past: compressed block summaries, a few selected full-detail blocks, and a sliding local window. [DeepSeek-V3.2](https://arxiv.org/abs/2512.02556)'s *DeepSeek Sparse Attention* (`DSA`) uses a tiny FP8 "lightning indexer" to score past tokens, then runs full attention on only the top `k = 2,048`. At `T = 64,000`, the last token reads `2,048 / 64,000 = 3.2%` of the prompt, and total core-attention pairs drop from `≈ 2.05 billion` to `≈ 0.13 billion` (`≈ 16×` fewer; the saving grows as prompts get longer). The indexer still glances at every past token, but with far cheaper math.
5. **Kimi Linear (`KDA`): a fixed-size memory.** Instead of a KV list that grows with `T`, a [`KDA`](https://arxiv.org/abs/2510.26692) layer keeps one fixed-size matrix `S_t` and updates it every token with a gated *delta rule*: `S_t = (I − β_t · k_t · k_tᵀ) · Diag(α_t) · S_{t−1} + β_t · k_t · v_tᵀ`. Read it right to left: fade old memory channel by channel (`α_t`, each between `0` and `1`), erase whatever conflicts with the new key (`I − β_t · k_t · k_tᵀ`), then write the new key–value pair (`β_t · k_t · v_tᵀ`, where `β_t` is a step size). Kimi Linear interleaves `3` KDA layers with `1` full-attention `MLA` layer, so KV memory drops by up to `75%` (not to zero), with up to `6×` faster decoding at `1M` tokens reported.
6. **DeepSeek `Engram`: look facts up instead of recomputing them.** [Engram](https://arxiv.org/abs/2601.07372) adds an `O(1)` hashed `N`-gram memory table that can live in cheap host CPU RAM, so GPU experts spend their compute on reasoning instead of memorized phrases.
7. **Kimi K2 `MuonClip`: stop training blow-ups.** Attention scores (logits) can explode and spike the loss. After each step, `QK-Clip` checks every head's largest score `S_max`. If it exceeds `τ = 100`, it computes `γ = τ / S_max` and multiplies that head's query and key weights (`W_Q`, `W_K`) by `√γ`, so their product shrinks by exactly `γ`. Toy example: `S_max = 400` → `γ = 0.25` → both weights × `0.5` → the score returns to `100`. [Kimi K2](https://arxiv.org/abs/2507.20534) reports training `1T` weights on `15.5T` tokens with zero loss spikes.
8. **The open-source plumbing.** DeepSeek also released the systems code behind these models: [`FlashMLA`](https://github.com/deepseek-ai/FlashMLA) (MLA decode kernels), [`DeepGEMM`](https://github.com/deepseek-ai/DeepGEMM) (`FP8` matrix math), [`DeepEP`](https://github.com/deepseek-ai/DeepEP) (MoE all-to-all over `NVLink`/`RDMA`), [`3FS`](https://github.com/deepseek-ai/3FS) (distributed storage), and [`DualPipe`](https://github.com/deepseek-ai/DualPipe) (overlapping forward and backward passes to hide idle pipeline bubbles). They live in layers `L4`–`L8` of the stack above.

## NVIDIA examples: from weights to running agents

These projects give concrete examples of the five-node loop. Read the linked READMEs for architecture; installing this stack is optional.

| Project | Place in the loop | What to look for |
|---|---|---|
| [Megatron-LM](https://github.com/NVIDIA/Megatron-LM) | Build **weights** | How tensor, pipeline, data, context, and expert parallelism divide training work across GPUs |
| [Dynamo](https://github.com/ai-dynamo/dynamo) | Coordinate **serving** | Routing requests toward workers with reusable KV state, and scaling prefill and decode pools independently above engines such as vLLM or SGLang |
| [NeMo Gym](https://github.com/NVIDIA-NeMo/Gym) | Run **environments and grading** | [Part 2](ai-systems-02-rl-and-rollouts.md#nemo-gym-where-rollouts-meet-environments) connects tasks, agent interactions, and verifiers |
| [TimeTravelContainer](https://github.com/NVlabs/TimeTravelContainer) and [OpenShell](https://github.com/ai-openshell/openshell) | Branch **execution state** and enforce **access policy** | [Part 3](ai-systems-03-environments-state-roadmap.md#case-study-timetravelcontainer-and-openshell) separates live forks from security controls |

**Apply the bottleneck rule:** Megatron-LM changes training capacity; Dynamo changes serving capacity. If sandboxes still complete only `15` attempts/min, faster serving alone cannot raise verified throughput above `15`/min. Dynamo's KV-aware routing also does not make caches interchangeable between different models; that is the separate question below.

## Sharing reading work across different models

In [Visual inference engineering](inference-engineering.md), **prefix caching** saves work when two prompts start identically on the *same* model. What if an agent team uses *two different models*—say, Model A (a fast reader) reads a `64,000`-token codebase and hands off to Model B (a deeper coder)?

Normally, Model B cannot read Model A's KV scratchpad at all—its hidden-state vectors point in different directions. So Model B has to re-read all `64,000` tokens from raw text. Two breakthroughs published on **25 November 2026** tackle this edge directly:

1. **Plato's Key ([Stanford Hazy Research](https://hazyresearch.stanford.edu/blog/2026-11-25-platos-key)) — the geometric "why":**
   Researchers tested 12 open models (8 families, 1.5B–27B) and discovered you can map Model A's hidden states straight into Model B's space by solving one exact closed-form Orthogonal Procrustes rotation `min_R ||A · R − B||_F` (keeping lengths and angles intact via `R^T · R = I`, plus one scalar scale `α`)—with *zero* gradient training! Across factual swaps, it hit `41%` median accuracy (vs. `55%` swapping a model's own state), retained `~99%` relative accuracy across `A → B → C` chains, and even unlocked "dark memories" stored inside weights.
2. **Speculative Encoding (Ramp Labs with Baseten: [code](https://github.com/b10-tv/speculative-encoding), [checkpoint](https://huggingface.co/RampPublic/speculative-encoding)) — the serving "how":**
   While a raw linear rotation proves the geometry lines up, production serving wants near-native accuracy. The team trained one shared **2.35B MoE translator** that turns a source model's hidden states into a target model's KV cache, served through vLLM. It covers **7 models from 4 families** (Qwen, Llama, Gemma, Ministral) in all `42` directions, reporting **96.9%** of native accuracy on documents up to `8,192` tokens, **4×–7.5× faster prefill** on `32K`–`128K` documents, and optional query-aware cache compression of `16×`, `64×`, or `128×`.

<figure class="course-diagram">
  <div class="diagram-scroll" role="region" tabindex="0" aria-label="Three ways different models share context diagram, scroll horizontally">
    <img src="../assets/diagrams/aisys-cross-model-kv.svg" alt="Row 1 shows Model A and Model B both reading 64k tokens. Row 2 shows Plato's Key rotating Model A's tilted axes to match Model B. Row 3 shows Speculative Encoding's 2.35B MoE translator skipping Model B's re-read." width="640" height="500">
  </div>
  <figcaption><strong>From geometry to fast serving.</strong> <em>Plato's Key</em> proves different models share rotated maps; <em>Speculative Encoding</em> trains a small translator to skip re-reading long text. <span class="screen-only">On a narrow screen, scroll sideways.</span> <a href="../assets/diagrams/aisys-cross-model-kv.svg">Open the diagram at full size</a>.</figcaption>
</figure>

<details markdown="1">
<summary>Text version of the diagram</summary>

Row 1 (Raw text): Model A reads 64k tokens, sends text, and Model B reads all 64k tokens again (100% baseline accuracy, double reading work). Row 2 (Plato's Key): a tilted coordinate frame in Model A rotates and scales with zero training into Model B's upright frame (~99% relative A→B→C chaining). Row 3 (Speculative Encoding): Model A reads once, passes hidden states through a 2.35B MoE translator, and Model B starts almost immediately (up to 7.5× prefill speedup reported, ~3.1% per-hop accuracy gap).

</details>

**Worked-by-hand catch (multi-hop drift):** Suppose one translation keeps `96.9%` (`0.969`) of native accuracy. Across `2` hops, `0.969 × 0.969 = 0.939` (`93.9%`). Across `6` chained hops without re-reading raw text, `0.969^6 ≈ 0.828` (`82.8%`). Fast prefill is a great win—as long as your grader checks the final answer!

> **Pitfall:** *Speculative Encoding* is not *speculative decoding*. Speculative decoding ([Visual inference engineering](inference-engineering.md#speculative-decoding)) speeds up **writing** tokens on one model, using a small draft model plus exact verification. Speculative Encoding skips **re-reading** a document when handing it to a *different* model, and its output is approximate.

> **Checked:** Figures for DeepSeek (`V3`/`NSA`/`V3.2`/`Engram`), Moonshot AI (`Kimi K2`/`Kimi Linear`/`K2.5`), *Plato's Key*, and *Speculative Encoding* are author-reported paper and release results verified **27 November 2026**, not independently benchmarked on cluster hardware in this course.

## Lab: find the bottleneck and check multi-hop drift

Remember the pipeline law: `goodput <= min(inference, sandboxes, graders, learner)`. Use the visual bars below to see which pool caps the cluster, and test what happens when you scale the wrong pool or chain too many cross-model hops.

<div class="sim" id="sim-aisys-capacity" role="group" aria-label="Synthetic capacity and cross-model prefill explorer" markdown="1">

<p class="sim-title"><strong>Visual cluster bottleneck &amp; cross-model prefill explorer</strong></p>

<div class="sim-fallback" markdown="1">

**Worked example without JavaScript:** An RL cluster runs `40`/min inference GPUs, `15`/min sandboxes, `50`/min trusted graders, and `35`/min learner updates. Steady-state goodput is **`15`/min** (bottleneck: **sandboxes**). Adding `+20`/min GPUs leaves goodput stuck at `15`/min; adding `+20`/min sandboxes raises goodput to **`35`/min**. Separately, on a `64k`-token doc across `5` models (`94%` native accuracy), Speculative Encoding cuts synthetic prefill time from `5,760 ms` to `823 ms` (`7.0×` faster) with `88.3%` 2-hop accuracy (`0.969^2 × 94%`), whereas `6` chained hops decay to `77.8%`, triggering a drift warning.

</div>
</div>

## Quick quiz

<details markdown="1">
<summary>Q1. Why must a crashed pretraining job restore its data-loader cursor alongside its weights?</summary>

If you restore only the weights, the training job loses track of which batches it already read—re-reading old examples or skipping new ones silently.

</details>

<details markdown="1">
<summary>Q2. In plain words, how do Plato's Key and Speculative Encoding complement each other?</summary>

*Plato's Key* shows the geometry works (different models' spaces line up via a closed-form rotation + scale with zero training). *Speculative Encoding* trains a small 2.35B MoE translator to make that cross-model transfer accurate and fast enough for real serving engines.

</details>

<details markdown="1">
<summary>Q3. Your sandboxes finish 15 tasks/min and GPUs finish 40/min. Should you buy more GPUs?</summary>

No. By the steady-state capacity law, completed work cannot exceed `15`/min until you speed up sandboxes (for example with warm pools or snapshots in Part 3).

</details>

**Next step in the story:** Now that our model can read a `64,000`-token Python repository quickly (and even hand off KV notes across models), [Part 2](ai-systems-02-rl-and-rollouts.md) follows the agent as it tries `4` candidate bug fixes in parallel and learns from real `pytest` passes and crashes.

## Sources

Checked **27 November 2026**: [DeepSeek-V3](https://arxiv.org/abs/2412.19437), [Native Sparse Attention](https://arxiv.org/abs/2502.11089), [DeepSeek-V3.2](https://arxiv.org/abs/2512.02556), [DeepSeek Engram](https://arxiv.org/abs/2601.07372), [DeepSeek FlashMLA](https://github.com/deepseek-ai/FlashMLA), [DeepEP](https://github.com/deepseek-ai/DeepEP), [DeepGEMM](https://github.com/deepseek-ai/DeepGEMM), [DualPipe](https://github.com/deepseek-ai/DualPipe), [3FS](https://github.com/deepseek-ai/3FS), [Kimi K2 &amp; MuonClip](https://arxiv.org/abs/2507.20534), [Kimi Linear](https://arxiv.org/abs/2510.26692), [Stanford Hazy Research — Plato's Key](https://hazyresearch.stanford.edu/blog/2026-11-25-platos-key), [Speculative Encoding code](https://github.com/b10-tv/speculative-encoding), [Speculative Encoding checkpoint](https://huggingface.co/RampPublic/speculative-encoding), [TorchTitan](https://github.com/pytorch/torchtitan), [Megatron-LM](https://github.com/NVIDIA/Megatron-LM), [vLLM](https://github.com/vllm-project/vllm), [SGLang](https://github.com/sgl-project/sglang), [Dynamo](https://github.com/ai-dynamo/dynamo), [Mooncake](https://github.com/kvcache-ai/Mooncake), and [DataTrove](https://github.com/huggingface/datatrove).

<!-- {% endraw %} -->
