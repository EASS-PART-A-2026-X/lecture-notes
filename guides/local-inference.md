# Local inference: from transformer to application endpoint

<!-- {% raw %} -->

[Course home](../README.md) · [Models and AI literacy](models-and-ai-literacy.md) · [Agents](agent-driven-development.md) · [Sandboxes](agent-sandboxes.md)

**Read the core path before Lecture 6; revisit measurements in Lecture 9.** The hands-on routes are optional. No GPU, model download, paid account, or extra service is required for assessment. If hardware or access is limited, use the worked trace and supplied measurement examples below. The required application still has the same three responsibilities.

> **Before you start:** the **core path** is about 20 minutes: [The path from text to tokens](#the-path-from-text-to-tokens), [What inference actually does](#what-inference-actually-does), the first prediction of the [Latency experiment](#latency-experiment), and the route table in [Use a local model in your AI service](#use-a-local-model-in-your-ai-service). Everything else on this page is an optional deep dive or an optional hands-on route, and is marked that way.

<details markdown="1" class="lecture-toc">
<summary>On this page</summary>

- [Learning checkpoint](#learning-checkpoint)
- [The path from text to tokens](#the-path-from-text-to-tokens)
- [A transformer without the mystery](#a-transformer-without-the-mystery)
- [What inference actually does](#what-inference-actually-does)
- [Memory and performance](#memory-and-performance)
- [Choose a serving tool](#choose-a-serving-tool)
- [Optional local request lab](#optional-local-request-lab)
- [Connect an agent without changing its authority](#connect-an-agent-without-changing-its-authority)
- [Use a local model in your AI service](#use-a-local-model-in-your-ai-service)
- [Latency experiment](#latency-experiment)
- [Measure and diagnose](#measure-and-diagnose)
- [Quick quiz](#quick-quiz)
- [Sources](#sources)

</details>

**Optional:** [Visual inference engineering](inference-engineering.md) explains the main optimization methods with ten original diagrams, worked examples and predict-then-reveal exercises. Use it alongside Lectures 6–10.

## Learning checkpoint

Be able to trace text → tokens → model computation → generated tokens → validated application result. Explain why a larger context consumes resources, why an HTTP-compatible endpoint may still fail an agent task, and why local inference does not sandbox generated code.

**Predict first:** if you keep the same model but double the prompt length, which stages do more work? Does changing the model server also grant the model permission to write your database?

<details markdown="1">
<summary>Check your prediction</summary>

**Prefill** does more work: the model must process every prompt token, and the KV cache that holds them grows, so memory use rises too. **Decode** work per output token barely changes if the answer stays the same length, although each step now attends over a longer context. Load and queue time do not depend on your prompt. And **no**: a model server only turns tokens into tokens. What the model may *do* is decided by the application code around it (the agent loop's registered tools and the backend's checks), whichever server you point it at.

</details>

## The path from text to tokens

*Core path.*

A tokenizer converts text into integer token IDs using a model-specific vocabulary. Tokens can represent words, fragments, punctuation, or other units. The same sentence need not have the same token count across models. A chat template serializes roles, messages, and tool definitions into the input expected by that model. The wrong template can damage tool use even when ordinary text generation looks plausible.

```text
Messages + tool definitions
  → chat template → tokenizer → token IDs
  → model forward passes → next-token scores → decoding
  → output tokens → text / structured tool request
  → the agent loop validates the request and runs an allowed tool
  → the tool result becomes context for another model request
```

The model does not execute a Python function by predicting its name. The **agent loop** (the harness around the model) parses the request, checks the arguments and the authority, runs the function, and returns its result. A **harness** is the controller code around a model: it builds the context, exposes tools, validates and runs tool calls, and enforces limits. Your coding assistant is a coding harness at development time; in Recipe Box, the Pydantic AI agent loop in `ai-service` plays that role at request time. A local model is still a model inside this loop; it is not a replacement for the harness.

<details markdown="1">
<summary>Optional: predict and measure tokens in Hebrew and English (10 minutes, CPU only)</summary>

**Predict:** which uses more tokens, "Simmer the lentils with cumin for 35 minutes." (45 characters) or its Hebrew translation "לבשל את העדשים עם כמון 35 דקות." (31 characters)?

**Measure** with any local Ollama model. Ollama's generate API reports `prompt_eval_count`; `"raw": true` skips the chat template, so the count is the text alone:

```bash
curl -s http://127.0.0.1:11434/api/generate -H 'Content-Type: application/json' \
  -d '{"model": "qwen2.5:7b", "prompt": "Simmer the lentils with cumin for 35 minutes.", "raw": true, "stream": false, "options": {"num_predict": 1}}'
```

Repeat with the Hebrew sentence and compare the two `prompt_eval_count` values.

On 17 October 2026, `qwen2.5:7b` counted **14 tokens for each**, although the Hebrew has a third fewer characters. Another model's tokenizer can split them differently. That is the point: measure with the tokenizer of the model you use, and never estimate cost or context from characters or words. Relate the count to [Lecture 9's](../lectures/09-failures-evals-costs.md#malformed-output-and-cost-limits) token limits.

</details>

## A transformer without the mystery

*Optional deep dive.* You do not need this section for the course project; it explains what happens inside the "model forward passes" box above.

<details markdown="1">
<summary>Open the deep dive</summary>

For a **causal decoder transformer**, the common text-generation architecture:

1. **Embeddings** turn token IDs into vectors (lists of numbers). Position information lets the computation distinguish token order.
2. **Attention** mixes information from the accessible context. Each position has a *query*, a *key* and a *value* vector. Queries and keys produce relevance scores; normalized scores weight the value vectors. Multiple attention heads learn different mixtures. A causal mask prevents a position from using future tokens.
3. **Feed-forward layers**, normalization, and residual connections transform and carry information through successive blocks.
4. The final representation is projected to **logits**, one score per vocabulary token. Decoding selects a next token from these scores.

A compact expression for one attention head is `softmax(QKᵀ / √d + mask)V`, where `d` is the length of each query and key vector. You do not need to implement it for this course. Read it as "score accessible positions, normalize the scores, combine their values." Attention is a computation, not evidence of human understanding or factual truth.

**Work one example on paper.** Three tokens, `d = 2`. Token 3 has query `q₃ = [1, 0]`. The keys are `k₁ = [1, 0]`, `k₂ = [0, 1]`, `k₃ = [1, 1]`, and the values are `v₁ = [1, 0]`, `v₂ = [0, 1]`, `v₃ = [0.5, 0.5]`.

1. Compute token 3's three scores `q₃ · kᵢ / √2`.
2. Turn them into weights with softmax (`eˢ` for each score, divided by their sum).
3. Take the weighted sum of the values.
4. Token 2 has query `q₂ = [0, 1]`. Which keys may it use, and what are its weights?

<details markdown="1">
<summary>Check your answer</summary>

1. Scores: `1/√2 ≈ 0.707`, `0`, `0.707`.
2. `e^0.707 ≈ 2.03` and `e^0 = 1`, so the weights are about `0.40`, `0.20`, `0.40`.
3. `0.40 × [1, 0] + 0.20 × [0, 1] + 0.40 × [0.5, 0.5] ≈ [0.60, 0.40]`: token 3's new vector is mostly made of tokens 1 and 3, whose keys matched its query.
4. Only `k₁` and `k₂`: the causal mask sets the score for token 3 to minus infinity, so its weight is exactly 0. Scores `0` and `0.707` give weights of about `0.33` and `0.67`.

</details>

This is a teaching model, not a claim that every LLM has identical internals. Encoder models, encoder–decoder models, mixture-of-experts systems, and multimodal architectures have additional differences. The original [Transformer paper](https://arxiv.org/abs/1706.03762) introduced an encoder–decoder design; modern causal chat models adapt the architecture. Hugging Face's [Transformer architectures](https://huggingface.co/learn/llm-course/chapter1/6) chapter explains the families.

</details>

**Training versus inference:** training adjusts weights using data and an optimization procedure. Ordinary inference uses loaded weights to compute outputs; a conversation does not normally update those weights. Application memory, retrieval, context caching, and fine-tuning are different mechanisms. See the [model-literacy guide](models-and-ai-literacy.md#tokens-context-memory-and-retrieval).

## What inference actually does

*Core path.*

**Load:** the runtime makes model weights available to the processor. A cold request may include model-loading time.

**Prefill:** process the prompt and construct reusable attention state. For a conventional causal transformer, a key/value (**KV**) cache retains intermediate attention data for prior tokens, avoiding recomputing all of it at each generation step.

**Decode:** compute next-token scores, choose a token, extend the context/cache, and repeat until a stop condition or output budget. Greedy decoding chooses a highest-scoring token; sampling changes how a distribution is used. Temperature and top-p are examples of sampling controls, when supported. Neither guarantees correct answers. Hardware, runtime, batching, and implementation details can also affect reproducibility.

**Return:** the server streams chunks or returns a completed response. A stream chunk is not necessarily a complete word, tool call, or valid JSON object. Validate the complete application result before saving it.

**Worked trace:** the user asks to extract a recipe. The model proposes a call to `allowed_tags`; the agent loop validates the call and runs that read-only tool. Its result enters the next model request. The model then returns a candidate recipe; Pydantic and business rules check it. Only the backend persists the accepted record. Weights remain unchanged throughout this trace.

**One extraction, several model requests.** Lecture 6's retry trace sends three model requests for one `POST /extract`, and each one repeats prefill over a longer prompt, because the instructions, tool schemas and history are sent again every time. Your waiting time is roughly the sum of those requests, which matters for timeouts in Lectures 7 and 9. Hugging Face's [deep dive into text generation](https://huggingface.co/learn/llm-course/chapter1/8) (optional) walks through prefill, decode, sampling and the KV cache in more detail.

## Memory and performance

Plan for **weights + KV cache + runtime buffers + the rest of the system**, not only the download size. The KV cache grows with every token kept in context and with every concurrent request. A model that fits on disk may still not fit in memory.

<details markdown="1">
<summary>Optional deep dive: size the memory yourself</summary>

- A rough dense-weight estimate is `parameter count × bits per weight / 8`. A hypothetical 7-billion-parameter model at exactly four bits has about **3.5 GB of raw weight data**, before metadata and runtime overhead. That does not imply it fits or runs well on a 4 GB machine.
- **Quantization** uses lower-precision representations to reduce storage and often memory traffic. Speed and quality depend on the model, format, kernels, and hardware; evaluate your task again after changing it. A GGUF filename is not a universal guarantee of capability or memory use.
- The KV cache generally grows with retained tokens and concurrent sequences. A model's advertised maximum context is not necessarily the server's configured limit or a practical laptop setting.
- CPU execution, GPU offload, and unified memory have different capacity and bandwidth constraints. Swapping can make a model technically runnable but unhelpfully slow.
- **Batching** shares computation across requests. Continuous batching admits and removes sequences during generation. It can improve aggregate throughput while individual users still wait. vLLM's [PagedAttention work](https://arxiv.org/abs/2309.06180) concerns efficient KV-cache management, not a change in what the model knows.

**Worked box: weights and KV cache.**

```text
weights  ≈ parameters × bits per weight / 8
KV cache ≈ 2 (keys and values) × layers × KV heads × head size
           × bytes per value × tokens in context × concurrent sequences
```

- **Hypothetical model:** 32 layers, 8 KV heads, head size 128, 16-bit values (2 bytes). One token costs `2 × 32 × 8 × 128 × 2 = 131,072 bytes = 128 KiB`. A 4,096-token context is about **0.5 GiB**; 32,768 tokens are about **4 GiB**, for one request.
- **"4-bit" files are not exactly 4 bits.** The common GGUF type `Q4_K_M` averages about **4.89 bits per weight** in the [llama.cpp quantize README](https://github.com/ggml-org/llama.cpp/blob/master/tools/quantize/README.md) (checked 17 October 2026), so a 7B model at `Q4_K_M` needs about **4.3 GB** for weights, not 3.5 GB.
- **A real check.** `ollama show --verbose qwen2.5:7b` reports 7.6 billion parameters, `Q4_K_M`, 28 layers, 4 KV heads and an embedding length of 3,584 split across 28 heads (head size 128). Weights: `7.6 × 10⁹ × 4.89 / 8 ≈ 4.7 GB`, which matches the 4.7 GB download. KV cache: `2 × 28 × 4 × 128 × 2 = 56 KiB` per token, so its default 32,768-token context on our test laptop needs about **1.75 GiB**. `ollama ps` reported **6.4–6.9 GB** in use across our runs: roughly the weights plus the cache, with the exact figure depending on the server's settings.

**Predict:** you need more room for one more user. Which grows memory more: doubling the context length for one user, or keeping the context and serving two users at once?

<details markdown="1">
<summary>Check your prediction</summary>

Under this formula they cost the **same**: both double the KV-cache term (tokens × sequences), and neither changes the weights. In practice the server's batching and context settings decide how much it reserves up front, so measure with `ollama ps` (or your server's equivalent) rather than trusting the arithmetic alone.

</details>

</details>

Track time to first token, complete response latency, output tokens/second, peak memory, and correctness separately. A faster server can serve the same wrong answer faster. Local execution removes a hosted per-token bill but still uses hardware, electricity, storage, and maintenance time.

## Choose a serving tool

**Documentation reviewed 17 October 2026.** The course's default route is **[Ollama](https://ollama.com/download)**: a simple local model-management CLI and API. Inspect installed model tags, context settings, process memory, and native versus compatibility endpoints. **No Ollama account is needed.** Use local tags (not ones ending in `-cloud`), and optionally set `OLLAMA_NO_CLOUD=1` to switch its cloud features off ([Ollama FAQ](https://docs.ollama.com/faq)): cloud models run on Ollama's servers, and Ollama's [structured-output page](https://docs.ollama.com/capabilities/structured-outputs) says its cloud does not support structured outputs.

<details markdown="1">
<summary>Alternatives: LM Studio, llama.cpp and vLLM</summary>

Choose one route, check its current platform support, and record the installed version. This is a comparison of workflows, not a performance ranking.

| Tool | Useful starting situation | What to learn / check |
|---|---|---|
| [LM Studio](https://lmstudio.ai/docs/developer/core/server) | You prefer a desktop model browser and local API controls | Select/load an appropriate model, inspect Developer settings, start the server, and check its bind address and authentication |
| [llama.cpp](https://github.com/ggml-org/llama.cpp) | You want explicit control over GGUF files and CPU/GPU execution | Model provenance, quantization, chat template, context, GPU offload, and `llama-server` options |
| [vLLM](https://docs.vllm.ai/en/latest/getting_started/quickstart/) | An instructor or lab operates a supported serving machine, often for concurrent users | Supported hardware/model format, scheduling, KV-cache limits, throughput, access controls, and monitoring |

These products overlap, and desktop tools may use lower-level inference engines internally. A supported CPU or accelerator backend does not mean all of them have the same installation path or performance. Follow the [vLLM installation matrix](https://docs.vllm.ai/en/latest/getting_started/installation/) rather than treating its GPU-oriented examples as a universal laptop command.

</details>

An "OpenAI-compatible" API describes a supported interface. It does not promise all endpoints, tool calls, JSON-schema constraints, streaming events, usage fields, or model behaviors match another server. Verify the particular server + model + framework combination. Compatibility also does not imply requests go to OpenAI: inspect the actual base URL and any fallback configuration.

### Place local serving behind the adapter boundary

Choose the serving tool only after identifying the task: a narrow classifier returns bounded decisions; a general model generates text or structured candidates; vLLM serves supported model workloads. These roles are distinct. A fast server does not turn a general model into a calibrated classifier, and using a classifier does not require deploying vLLM.

The [Lecture 6 API diagram](../lectures/06-pydantic-ai-agents.md#one-application-contract-several-provider-adapters) shows where a local endpoint replaces a hosted provider. Keep your own `/extract` contract. Test model/template/output compatibility separately from the ability to send an HTTP request. At Lecture 8, trace the hostname from **inside the calling container**: loopback is that container, a Compose service name addresses another service, and a host model needs the platform-specific host route below.

For optional GPU-host practice, use the [vLLM client example](model-apis-and-decisions.md#vllm-compatible-transport-independently-tested-behavior). For a narrow decision-model comparison, read [Jev and OpenClaw's local ONNX case study](model-apis-and-decisions.md#jev-and-the-openclaw-case-study), including its development-version caveat. Neither route adds a required service or download to the course.

## Optional local request lab

*Optional, about 20 minutes plus download time.* Use an already available local model or the dated default below. Check its license, source, download size, supported tools, and hardware needs first. Downloads can be large; do not download several runtimes or models to complete this exercise. If you cannot run locally, analyze the worked trace and measurement examples instead.

**Route A — Ollama.** Install it from the [download page](https://ollama.com/download); no account is needed. On macOS and Windows the app starts the server; on Linux, run `ollama serve` in another terminal if nothing answers. Then inspect what is installed:

```bash
ollama --version
ollama list
curl --fail --max-time 10 http://127.0.0.1:11434/api/tags
```

If `ollama list` is empty, pull the course's dated default (4.7 GB; see [Use a local model in your AI service](#use-a-local-model-in-your-ai-service)) or another local tag you have checked: `ollama pull qwen2.5:7b`. Save this **request template** as `request.json`, replacing the model name if you use another installed tag:

```json
{
  "model": "qwen2.5:7b",
  "messages": [{"role": "user", "content": "In one sentence: what does HTTP 404 tell a Recipe Box user?"}],
  "stream": false,
  "options": {"num_predict": 64}
}
```

From the directory containing the file:

```bash
curl --fail --max-time 120 http://127.0.0.1:11434/api/chat \
  -H 'Content-Type: application/json' --data-binary @request.json
ollama ps
```

Ollama's [FAQ](https://docs.ollama.com/faq) documents the default loopback listener on port 11434. Its [chat API](https://docs.ollama.com/api/chat) reports timing and token counts; use actual response fields, not word counts. A client timeout does not prove inference stopped. Check the server, cancel through supported controls, and avoid blindly retrying a saturated machine. Keep this exercise on a local model; inspect cloud routing and connected tools before claiming data stays on the laptop.

<details markdown="1">
<summary>Alternatives: routes B–D (LM Studio, llama.cpp, vLLM)</summary>

**Route B — LM Studio.** Select and load a compatible local model, open Developer, and start its local API server. Inspect the displayed address; leave network sharing off for the laptop exercise. With the port shown by your installation, query `/v1/models` using [List Models](https://lmstudio.ai/docs/developer/openai-compat/models). Then follow its chat-completions example with that returned model ID. Record whether the model was already loaded; do not equate every listed model with a resident model.

**Route C — llama.cpp, advanced.** After following its official installation/build instructions and obtaining a compatible GGUF model, start the installed binary with your real model path. The following is a template; replace the path:

```bash
llama-server -m /absolute/path/to/model.gguf \
  --host 127.0.0.1 --port 8081 -c 2048
```

Use another terminal for `curl --fail --max-time 10 http://127.0.0.1:8081/health`. The [server reference](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md) explains loading status, model/chat settings, and API routes. Explicit flags avoid depending on changing defaults (its default port is not 8081). Do not enable optional tool execution for this simple inference exercise.

**Route D — vLLM, instructor/lab extension.** Use a supported environment and model from its current quickstart. After installing for that hardware, `vllm serve MODEL_ID --host 127.0.0.1 --port 8081` illustrates the server entry point; replace `MODEL_ID` and check model/license/memory requirements before running. Port 8081 avoids the backend's 8000. Shared service deployment additionally needs authentication, restricted network access, concurrency limits, monitoring, and a resource owner. It is outside the laptop setup requirement.

</details>

## Connect an agent without changing its authority

Use a bounded loop: build context → request a model decision → validate the proposed tool and arguments → authorize the target/action → execute through the restricted runner → validate and append the bounded result → continue or stop. Enforce iteration, token, tool-call, output-size, and wall-clock budgets in code. Stop on a validated final answer, explicit cancellation, a policy denial, or exhausted budgets; an agent should not keep asking until a denied operation succeeds.

Keep the model's selected action separate from the controller's decision to permit it. For a recipe extractor, tools remain read-only domain operations even when the same local model could generate shell commands in another harness. Retrieved text and tool results are data, not instructions that can expand the tool allowlist.

```text
frontend → backend → ai-service (agent loop, Pydantic AI)
                              → local/hosted inference endpoint
                              → explicitly allowed domain tools
```

The inference runtime is a dependency of the AI application service. An optional fourth process/container for model serving does not replace any required application responsibility. Backend database ownership, typed contracts, failure handling, and offline tests stay the same.

Before changing the configured provider and base URL, verify: ordinary completion, the required structured output, one permitted tool call, malformed arguments, an unavailable server, and a deadline. Reuse Lecture 6's deterministic tests and Lecture 9's quality cases. Switching to a local server means changing `AI_MODEL` **and** one base-URL setting, nothing else in your code; the next section gives the exact values for each route.

`localhost` inside a container refers to that container. A host inference server is not automatically reachable from `ai-service`; a Compose-hosted server uses its service DNS name and container port. Do not "fix" a connection error by exposing an unauthenticated inference server on every interface: [Reach a host model server from Compose](#reach-a-host-model-server-from-compose) gives safe options. See the [sandbox guide](agent-sandboxes.md#network-and-model-access) for the separate network-policy decision.

## Use a local model in your AI service

*Core path: read the route table. The steps after it are optional and hands-on.*

Lecture 6's service needs only two settings to use a local model: `AI_MODEL` names the provider and model, and one base-URL variable says where the server listens. Settings checked 17 October 2026 with `pydantic-ai-slim` 2.57.0 and Pydantic AI's [Ollama](https://pydantic.dev/docs/ai/models/ollama/) and [OpenAI-compatible](https://pydantic.dev/docs/ai/models/compatible-apis/) pages:

| Route | `AI_MODEL` | Base-URL setting | Server requirement |
|---|---|---|---|
| **Ollama (default)** | `ollama:<tag>`, e.g. `ollama:qwen2.5:7b` | `OLLAMA_BASE_URL=http://localhost:11434/v1` | the tag is in `ollama list` and is listed with tool support |
| LM Studio | `openai-chat:<id from /v1/models>` | `OPENAI_BASE_URL=http://localhost:<port>/v1` (the port LM Studio shows) | server started and model loaded; set `OPENAI_API_KEY` only if you turned on its authentication |
| llama.cpp | `openai-chat:<id>` (set it with `--alias`) | `OPENAI_BASE_URL=http://127.0.0.1:8081/v1` | `llama-server … --port 8081 --jinja`: tool calls need `--jinja` |
| vLLM | `vllm:<id>` | `VLLM_BASE_URL=http://127.0.0.1:8081/v1` | `--enable-auto-tool-choice --tool-call-parser <parser for your model>` |

Three details behind that table:

- **Native versus compatibility API.** Ollama has two APIs. Its native `/api/chat` (used in the request lab) reports token counts and timings in nanoseconds. Pydantic AI's `ollama:` provider uses Ollama's OpenAI-compatible `/v1/chat/completions`, which is why the base URL ends in `/v1`.
- **No key needed locally.** With `OPENAI_BASE_URL` set and no `OPENAI_API_KEY`, Pydantic AI 2.57.0 sends a placeholder key, because local servers usually need none.
- **Model profiles.** Pydantic AI decides how to request structured output from a model *profile*. With `openai-chat:` and a custom base URL it assumes an OpenAI model, so for other models "structured output may be ignored or rejected" (Pydantic AI docs). Prefer a dedicated prefix (`ollama:`, `vllm:`) when one exists, and always run the structured-output step below.

> **Version note:** the course's dated default tag for a fresh install is **`qwen2.5:7b`** (checked 17 October 2026 on [ollama.com](https://ollama.com/library/qwen2.5) and with `ollama show`): a 4.7 GB download, 7.6 billion parameters at `Q4_K_M`, Apache-2.0 license, listed with **tools** capability, 32,768-token context. It used 6.4–6.9 GB on our test laptop with its full 32,768-token context; with Ollama's 4,096-token default on smaller machines the KV cache is only about 0.2 GiB, so plan for 5–7 GB of free memory. Smaller tags download faster but fail the output format more often: on our test laptop, `qwen2.5:0.5b` ended all three tries with `Exceeded maximum output retries (2)`. A newer model may suit you better; check its tool support and licence the same way.

**What to expect (measured, not a benchmark).** One Apple M1 Pro laptop (10-core CPU, 32 GB), Ollama 0.34.2, `qwen2.5:7b`, Lecture 6's service, 17 October 2026:

| Run | GPU (default on this laptop) | CPU only |
|---|---|---|
| First `/extract` after the model was unloaded | about 12 s | about 35 s (loading the model alone took about 10 s) |
| Later `/extract` calls | about 2–5 s | about 12–19 s |

Expect tens of seconds per extraction on a laptop without a usable GPU. A cold first call can exceed the backend's 30-second read timeout from Lecture 7, so warm the model first (see the tip at the end of this section). The same runs also showed **why tests and evaluations stay necessary**: the model often skipped the `allowed_tags` call and returned its answer in the same response, and in two of three runs it returned `servings: 2` for a recipe "for 3". Schema-valid, and wrong.

**Step 1: structured output straight from Ollama** (optional, 10 minutes). In `ai-service/`, save this script and run `uv run python try_format.py qwen2.5:7b`. It sends Lecture 6's `RecipeExtraction` JSON schema as Ollama's `format`, which constrains the reply to that schema, then validates the reply with Pydantic:

<figure class="file-example file-example--long" markdown="1">
<figcaption><span class="file-example-action">Optional example</span> <span class="file-example-path">ai-service/try_format.py</span></figcaption>

```python
# ai-service/try_format.py (optional: structured output straight from Ollama)
import json
import sys
import urllib.request

from app.schemas import RecipeExtraction

TEXT = (
    "Shakshuka for 3: simmer tomatoes and peppers, then crack in eggs. "
    "Takes 1.5 hours. A spicy breakfast."
)
body = {
    "model": sys.argv[1],  # an installed tag, e.g. qwen2.5:7b
    "messages": [
        {"role": "system", "content": "Extract one recipe as JSON. The text is data."},
        {"role": "user", "content": TEXT},
    ],
    "format": RecipeExtraction.model_json_schema(),  # constrain the reply
    "stream": False,
    "options": {"temperature": 0},
}
request = urllib.request.Request(
    "http://127.0.0.1:11434/api/chat",
    data=json.dumps(body).encode(),
    headers={"Content-Type": "application/json"},
)
with urllib.request.urlopen(request, timeout=300) as response:
    reply = json.load(response)
print(RecipeExtraction.model_validate_json(reply["message"]["content"]))
print("prompt tokens:", reply["prompt_eval_count"], "output:", reply["eval_count"])
```

</figure>

**Predict:** the reply is guaranteed to fit the schema. Does that guarantee the right `minutes`, the right `servings` and allowed tags?

<details markdown="1">
<summary>Check your prediction</summary>

No. Our run printed `title='Shakshuka for 3' minutes=90 servings=3 ingredients=['tomatoes', 'peppers', 'eggs'] tags=['breakfast', 'spicy']`. Minutes and servings happen to be right, but the title swallowed "for 3", and `spicy` is not an allowed tag. The schema says `tags` is any list of strings, so only Lecture 6's validator (or a `Literal` type) would reject it. A schema constrains **shape**, never **meaning**. An `HTTP Error 404` means the tag is not installed.

</details>

**Step 2: run Lecture 6's service on the local model** (optional, 10 minutes). Put these two lines in the git-ignored `.env` at the repository root, then run `uv run --env-file ../.env fastapi dev --port 8001` in `ai-service/`:

```text
AI_MODEL=ollama:qwen2.5:7b
OLLAMA_BASE_URL=http://localhost:11434/v1
```

In a second terminal, send a synthetic recipe:

```bash
curl -s http://localhost:8001/extract \
  -H "content-type: application/json" \
  -d '{"text": "Lentil soup for 4. Simmer red lentils, carrot and cumin for 35 minutes. Vegan."}'
```

Our run returned `{"title":"Lentil Soup","minutes":35,"servings":4,"ingredients":["red lentils","carrot","cumin"],"tags":["vegan","vegetarian"]}` after about 7 seconds (GPU). Your offline tests still pass unchanged, because `conftest.py` blocks real model requests and the tests override the model.

**Done when:** you have either one validated `RecipeExtraction` from a local model, with the tag, the hardware and the time it took, **or** a recorded failure (the exact error line and what you tried). Both are useful evidence for Lecture 9; neither is required.

### Reach a host model server from Compose

In Lecture 8, `ai-service` runs in a container. Inside it, `localhost` is the container itself, so `http://localhost:11434` reaches nothing. Choose **one** of these options; each keeps the model server off your campus or home network.

<figure class="course-diagram">
  <div class="diagram-scroll" role="region" tabindex="0" aria-label="Reaching a host model server diagram, scroll horizontally">
    <img src="../assets/diagrams/ai-host-model-reach.svg" alt="Four ways Ollama can listen: loopback, the Docker bridge, a Compose service, or 0.0.0.0, with who can reach each." width="640" height="600">
  </div>
  <figcaption><strong>Who can reach the model server?</strong> Predict, for each bind address, whether the container and a stranger on the same Wi-Fi can connect. <span class="screen-only">On a narrow screen, scroll the diagram sideways.</span> <a href="../assets/diagrams/ai-host-model-reach.svg">Open the diagram at full size</a>.</figcaption>
</figure>

<details markdown="1">
<summary>Text version of the diagram</summary>

| Ollama listens on | `ai-service` container can reach it | Another device on the same network can reach it | Use it? |
|---|---|---|---|
| `127.0.0.1:11434` (default) on Docker Desktop | yes, through `host.docker.internal` | no | **Option (a)** |
| `172.17.0.1:11434` (the Docker bridge) on Linux | yes, through `host.docker.internal` mapped to `host-gateway` | no | **Option (b)** |
| an `ollama` Compose service with no `ports:` | yes, as `http://ollama:11434` | no | **Option (c)** |
| `0.0.0.0:11434` (every interface) | yes | **yes: anyone on the network can use your model server, with no password** | never on a shared network |

</details>

**(a) Docker Desktop (macOS, Windows).** Keep Ollama on its default `127.0.0.1` and set `OLLAMA_BASE_URL=http://host.docker.internal:11434/v1` in `.env`. Docker Desktop forwards that name to your computer's loopback. Checked 17 October 2026 with Docker Desktop (Engine 29.1.3) on macOS: from a container, `http://host.docker.internal:11434/api/version` answered, and `http://localhost:11434` was refused.

**(b) Linux with Docker Engine.** The container can reach the host through the Docker bridge, so bind Ollama to the bridge address only:

1. Read the bridge address: `ip -4 addr show docker0` (usually `172.17.0.1`).
2. Run `sudo systemctl edit ollama`, add `Environment="OLLAMA_HOST=172.17.0.1:11434"` under `[Service]`, then `sudo systemctl daemon-reload && sudo systemctl restart ollama`. (If you start it by hand: `OLLAMA_HOST=172.17.0.1:11434 ollama serve`.) Start Docker first, because the address exists only while Docker runs.
3. In `compose.yaml`, give `ai-service` `extra_hosts: ["host.docker.internal:host-gateway"]`. Docker resolves `host-gateway` to the default bridge's address ([dockerd reference](https://docs.docker.com/reference/cli/dockerd/)).
4. Set `OLLAMA_BASE_URL=http://host.docker.internal:11434/v1` in `.env`.
5. Verify: `ss -ltnp | grep 11434` shows `172.17.0.1:11434`, and **not** `0.0.0.0:11434` or `*:11434`.

On the host itself, use `http://172.17.0.1:11434` for `curl` from now on. If a host firewall such as `ufw` is active, it may block the containers; allow port 11434 only from the Docker subnets rather than opening it to everyone. The course staff could not test option (b) on 17 October 2026 (no Linux machine); the two verification checks in step 5 are your evidence.

**(c) Ollama as a Compose service.** Run the model server as infrastructure next to your three application services. It is **not** your third service ([README](../README.md#three-service-product-requirements)), and it publishes no port:

<figure class="file-example" markdown="1">
<figcaption><span class="file-example-action">Optional example</span> <span class="file-example-path">compose.override.yaml</span></figcaption>

```yaml
# compose.override.yaml (optional: Ollama as infrastructure, not your third service)
services:
  ollama:
    image: ollama/ollama:<version>  # pin the version you tested
    volumes:
      - ollama-models:/root/.ollama  # downloaded models survive restarts
    # No "ports:": only containers on this Compose network can reach it.

volumes:
  ollama-models:
```

</figure>

Then set `AI_MODEL=ollama:qwen2.5:7b` and `OLLAMA_BASE_URL=http://ollama:11434/v1` in `.env`, run `docker compose up -d`, and pull the model once inside the container: `docker compose exec ollama ollama pull qwen2.5:7b`. Check `docker compose exec ollama ollama ps` after a request: its PROCESSOR column shows whether the container uses a GPU or only the CPU.

**Never `0.0.0.0` on a shared network.** Ollama's API has no login, and `0.0.0.0` makes it answer every device that can reach your laptop, including everyone on the campus Wi-Fi.

**Warm-up tip:** a cold model load can take longer than the backend's 30-second read timeout (Lecture 7). Before a demo, load the model with one request (`ollama run qwen2.5:7b "hi"`, or any `curl` to `/extract`), and check `ollama ps` shows it as loaded. Ollama unloads an idle model after about 5 minutes by default ([FAQ](https://docs.ollama.com/faq)).

## Latency experiment

**A 15-minute predict → change → explain exercise.** This is a fixed-rate arithmetic model with invented inputs, not a benchmark, GPU sizing tool, or prediction of any named server. It makes no model calls and sends no input anywhere. The PDF and browsers without JavaScript retain the worked warm-request example.

<div class="learning-practice" markdown="1">

**Predict before using a preset or revealing the answer.** Write your answer to question 1 first; only then touch the controls below.

<details markdown="1">
<summary>1. Four times as many input tokens, with all assumed rates fixed: does the whole response take four times as long?</summary>

No. Prefill grows from 2 to 8 s; decode remains 5 s and queue remains 0.5 s. Total is **13.5 s**, not 30 s. Try "Long prompt." This arithmetic holds the rates fixed; real prompt scaling and scheduling need measurements.

</details>

</div>

<div id="inference-lab" class="inference-lab" aria-labelledby="latency-lab-title">
<h3 id="latency-lab-title">Where does the waiting time go?</h3>
<p id="latency-lab-help">Change one assumption at a time. Tokens are model-specific units, not word counts. Rates are assumptions for this exercise.</p>
<form hidden aria-describedby="latency-lab-help" autocomplete="off">
<div class="lab-fields">
<label for="lab-input">Input tokens<input id="lab-input" name="inputTokens" type="number" required min="1" max="1000000" step="1" value="4000"></label>
<label for="lab-output">Output tokens<input id="lab-output" name="outputTokens" type="number" required min="1" max="10000" step="1" value="200"></label>
<label for="lab-prefill">Prefill rate (tokens/s)<input id="lab-prefill" name="prefillRate" type="number" required min="0.1" max="1000000" step="0.1" value="2000"></label>
<label for="lab-decode">Decode rate (tokens/s)<input id="lab-decode" name="decodeRate" type="number" required min="0.1" max="1000000" step="0.1" value="40"></label>
<label for="lab-queue">Queue delay (s)<input id="lab-queue" name="queueSeconds" type="number" required min="0" max="3600" step="0.1" value="0.5"></label>
<label for="lab-load">Model load delay (s)<input id="lab-load" name="loadSeconds" type="number" required min="0" max="3600" step="0.1" value="0"></label>
</div>
<div class="lab-presets"><button type="button" data-preset="warm">Warm request</button><button type="button" data-preset="long">Long prompt</button><button type="button" data-preset="cold">Cold and queued</button></div>
</form>
<p data-error role="status" hidden>Enter values within the listed bounds: positive whole token counts, positive rates, and non-negative delays. Results are hidden until the settings are valid.</p>
<div data-results>
<p data-summary role="status" aria-live="polite" aria-atomic="true">Estimated total 7.5 s; first token 2.525 s.</p>
<div class="lab-chart" aria-hidden="true"><span data-stage="load" style="width:0%"></span><span data-stage="queue" style="width:6.666667%"></span><span data-stage="prefill" style="width:26.666667%"></span><span data-stage="decode" style="width:66.666666%"></span></div>
<ul class="lab-stage-key"><li style="--stage-color:#475569">Load: <output aria-live="off" data-value="load">0 s</output></li><li style="--stage-color:#b7791f">Queue: <output aria-live="off" data-value="queue">0.5 s</output></li><li style="--stage-color:#4051b5">Prefill: <output aria-live="off" data-value="prefill">2 s</output></li><li style="--stage-color:#167d65">Decode: <output aria-live="off" data-value="decode">5 s</output></li></ul>
<p>Total response: <output aria-live="off" data-value="total">7.5 s</output> · First token: <output aria-live="off" data-value="firstToken">2.525 s</output></p>
</div>
<noscript><p>Interactive controls require JavaScript. Use the worked values and equations below to do the same exercise on paper.</p></noscript>
</div>

The equations are deliberately small:

```text
prefill_seconds = input_tokens / assumed_prefill_tokens_per_second
 decode_seconds = output_tokens / assumed_decode_tokens_per_second
  total_seconds = load + queue + prefill + decode
    first_token ≈ load + queue + prefill + (1 / assumed_decode_rate)
```

The warm example uses 4,000 input tokens, 200 output tokens, prefill at 2,000 tokens/s, decode at 40 tokens/s, a 0.5 s queue, and no load delay: `0 + 0.5 + 2 + 5 = 7.5 s`. First-token time includes the first decode step. A complete response with one output token finishes at that same point in this model.

<div class="learning-practice" markdown="1">

**Two more predictions.** Answer each before you open it, then check with the controls.

<details markdown="1">
<summary>2. Halve output from 200 to 100 tokens in the warm example. What happens to the first token and total?</summary>

Decode falls from 5 to 2.5 s, so total becomes **5 s**. The first token remains **2.525 s** under these assumptions. Shorter output can reduce completeness or quality: evaluate the actual task too.

</details>

<details markdown="1">
<summary>3. Cold load is 8 s and queue is 3 s. Does doubling decode speed remove the long wait?</summary>

The cold preset totals **18 s**. Doubling decode speed changes decode from 5 to 2.5 s, so total is still **15.5 s**. Load, queue and prefill remain. First locate the dominant stage rather than optimizing the most visible metric.

</details>

</div>

**Model calls per request.** The lab models **one** model request. A Recipe Box extraction is several: Lecture 6's retry run makes three, and each repeats prefill over a longer prompt. Add the bars up: three warm requests of this size would take about three times as long, before any network or validation time. That is why one slow model can exhaust a timeout that looked generous for a single call.

**What this leaves out:** network transfer, tokenization, framework/tool work, validation, retries, multiple agent calls, scheduling overlap, changing batch sizes and rates that depend on context length or hardware. It cannot decide a production timeout or predict quality. Prefix caching can reduce repeated **prefill** work; it does not automatically shorten output generation. See [vLLM's prefix-caching explanation](https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/), then measure your actual setup.

**Transfer:** close the answers and explain which component dominates each example. Then change one different assumption, calculate the expected result on paper, and check it. Revisit the exercise in Lecture 9 when deciding which timing evidence to collect. The course CI checks the equations and edge cases; a real serving experiment remains separate.

## Measure and diagnose

Record: runtime/version, model ID or digest, quantization, hardware, context/output limits, request, allowed tools, cold/warm state, observed timings, memory, and task result. Redact secrets. Model download/load time, queue delay, prefill, and decoding are distinct contributors; total latency includes more than generated-token speed.

**Synthetic example, not a benchmark:** a response reports 100 generated tokens and `eval_duration = 5,000,000,000` nanoseconds. Decode throughput is `100 / 5 = 20 tokens/second`. If total elapsed time was eight seconds, the other three seconds cannot be attributed to decoding alone. Compare identical inputs and output budgets, then rerun the quality cases after any optimization.

| Symptom | First useful investigation |
|---|---|
| Connection refused | Correct process, address, port, and container/host boundary ([Reach a host model server from Compose](#reach-a-host-model-server-from-compose)) |
| Out of memory or severe swapping | Weights, configured context, simultaneous requests, and other processes |
| Long first request, faster second | Model loading, warm-up, queue, and prefix-cache state |
| Fluent text but broken agent | Chat template, output/tool support, argument validation, and framework compatibility |
| Tools or the schema ignored, but only on long inputs | Compare the response's `prompt_eval_count` with the CONTEXT column of `ollama ps`: the prompt may be cut to fit. Ollama's default is 4,096 tokens on machines with less than 24 GiB of GPU memory ([context length](https://docs.ollama.com/context-length)); raise `OLLAMA_CONTEXT_LENGTH` (or `num_ctx`) within your RAM, using the memory box above |
| Changed answer after quantization | Re-evaluate held-out cases; smaller storage is a tradeoff, not proof of equal quality |

**Completion evidence:** explain the request path and two resource limits; show one actual response or clearly label analysis of the supplied example; name one compatibility check and one authority boundary. Report hardware limitations as findings rather than buying equipment.

## Quick quiz

<details markdown="1">
<summary>Q1. Does the KV cache teach the model new facts permanently?</summary>

No. It reuses intermediate inference state for context. It is different from updating model weights or an application storing durable memory.

</details>

<details markdown="1">
<summary>Q2. The server returns valid chat text. Is it ready for the course agent?</summary>

Not yet established. Test structured output, tool requests, validation, limits, and failure behavior for that exact model/server/framework combination.

</details>

<details markdown="1">
<summary>Q3. A local model writes a shell command. Has it run safely?</summary>

No. Generated text is not execution. If a harness executes it, safety depends on enforced permissions, isolation, data access, and resource/network limits.

</details>

<details markdown="1">
<summary>Q4. In Compose, <code>ai-service</code> gets "Connection refused" from <code>http://localhost:11434/v1</code>, although Ollama runs on your laptop. A classmate suggests <code>OLLAMA_HOST=0.0.0.0</code>. What do you do instead?</summary>

`localhost` inside the container is the container. Point `OLLAMA_BASE_URL` at `http://host.docker.internal:11434/v1`: on Docker Desktop that reaches the default loopback listener; on Linux, bind Ollama to the Docker bridge address and add `extra_hosts: ["host.docker.internal:host-gateway"]`, or run Ollama as a Compose service with no published port. `0.0.0.0` would let anyone on the network use your unauthenticated model server.

</details>

## Sources

Architecture: [Attention Is All You Need](https://arxiv.org/abs/1706.03762) and Hugging Face's LLM course chapters on [Transformer architectures](https://huggingface.co/learn/llm-course/chapter1/6) and [text generation inference](https://huggingface.co/learn/llm-course/chapter1/8). Serving research: [PagedAttention](https://arxiv.org/abs/2309.06180). Quantization: the [llama.cpp quantize README](https://github.com/ggml-org/llama.cpp/blob/master/tools/quantize/README.md). Runtime instructions and API details are linked at the relevant steps above; check them against the installed release before teaching.

<!-- {% endraw %} -->
