# Local inference: from transformer to application endpoint

<!-- {% raw %} -->

[Course home](../README.md) · [Models and AI literacy](models-and-ai-literacy.md) · [Agents](agent-driven-development.md) · [Sandboxes](agent-sandboxes.md)

**Read the conceptual path before Lecture 6; revisit measurements in Lecture 9.** The hands-on routes are optional. No GPU, model download, paid account, or extra service is required for assessment. If hardware or access is limited, use the worked trace and supplied measurement example below. The required application still has the same three responsibilities.

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
- [Measure and diagnose](#measure-and-diagnose)
- [Quick quiz](#quick-quiz)
- [Sources](#sources)

</details>

## Learning checkpoint

Be able to trace text → tokens → model computation → generated tokens → validated application result. Explain why a larger context consumes resources, why an HTTP-compatible endpoint may still fail an agent task, and why local inference does not sandbox generated code.

**Predict first:** if you keep the same model but double the prompt length, which stages do more work? Does changing the model server also grant the model permission to write your database?

## The path from text to tokens

A tokenizer converts text into integer token IDs using a model-specific vocabulary. Tokens can represent words, fragments, punctuation, or other units. The same sentence need not have the same token count across models. A chat template serializes roles, messages, and tool definitions into the input expected by that model. The wrong template can damage tool use even when ordinary text generation looks plausible.

```text
Messages + tool definitions
  → chat template → tokenizer → token IDs
  → model forward passes → next-token scores → decoding
  → output tokens → text / structured tool request
  → harness validates and executes an allowed tool
  → tool result becomes context for another model call
```

The model does not execute a Python function by predicting its name. The harness parses the request, checks arguments and authority, executes the function, and returns its result. A local model is still a model inside this loop; it is not a replacement for the harness.

## A transformer without the mystery

For a **causal decoder transformer**, the common text-generation architecture:

1. **Embeddings** turn token IDs into vectors. Position information lets the computation distinguish token order.
2. **Attention** mixes information from the accessible context. Queries and keys produce relevance scores; normalized scores weight value vectors. Multiple attention heads learn different mixtures. A causal mask prevents a position from using future tokens.
3. **Feed-forward layers**, normalization, and residual connections transform and carry information through successive blocks.
4. The final representation is projected to **logits**, one score per vocabulary token. Decoding selects a next token from these scores.

A compact expression for one attention head is `softmax(QKᵀ / √d + mask)V`. You do not need to implement it for this course. Read it as “score accessible positions, normalize the scores, combine their values.” Attention is a computation, not evidence of human understanding or factual truth.

This is a teaching model, not a claim that every LLM has identical internals. Encoder models, encoder–decoder models, mixture-of-experts systems, and multimodal architectures have additional differences. The original [Transformer paper](https://arxiv.org/abs/1706.03762) introduced an encoder–decoder design; modern causal chat models adapt the architecture. [Hugging Face's introduction](https://huggingface.co/learn/llm-course/chapter1/4) explains the architecture families.

**Training versus inference:** training adjusts weights using data and an optimization procedure. Ordinary inference uses loaded weights to compute outputs; a conversation does not normally update those weights. Application memory, retrieval, context caching, and fine-tuning are different mechanisms. See the [model-literacy guide](models-and-ai-literacy.md#tokens-context-memory-and-retrieval).

## What inference actually does

**Load:** the runtime makes model weights available to the processor. A cold request may include model-loading time.

**Prefill:** process the prompt and construct reusable attention state. For a conventional causal transformer, a key/value (**KV**) cache retains intermediate attention data for prior tokens, avoiding recomputing all of it at each generation step.

**Decode:** compute next-token scores, choose a token, extend the context/cache, and repeat until a stop condition or output budget. Greedy decoding chooses a highest-scoring token; sampling changes how a distribution is used. Temperature and top-p are examples of sampling controls, when supported. Neither guarantees correct answers. Hardware, runtime, batching, and implementation details can also affect reproducibility.

**Return:** the server streams chunks or returns a completed response. A stream chunk is not necessarily a complete word, tool call, or valid JSON object. Validate the complete application result before saving it.

**Worked trace:** the user asks to extract a recipe. The server generates a request for `allowed_tags`; the harness validates and executes that read-only tool. Its result enters the next call. The model then returns a candidate recipe; Pydantic and business rules check it. Only the backend persists the accepted record. Weights remain unchanged throughout this trace.

## Memory and performance

Plan for **weights + KV cache + runtime buffers + the rest of the system**, not only the download size.

- A rough dense-weight estimate is `parameter count × bits per weight / 8`. A hypothetical 7-billion-parameter model at four bits has about **3.5 GB of raw weight data**, before metadata and runtime overhead. That does not imply it fits or runs well on a 4 GB machine.
- **Quantization** uses lower-precision representations to reduce storage and often memory traffic. Speed and quality depend on the model, format, kernels, and hardware; evaluate your task again after changing it. A GGUF filename is not a universal guarantee of capability or memory use.
- The KV cache generally grows with retained tokens and concurrent sequences. A model's advertised maximum context is not necessarily the server's configured limit or a practical laptop setting.
- CPU execution, GPU offload, and unified memory have different capacity and bandwidth constraints. Swapping can make a model technically runnable but unhelpfully slow.
- **Batching** shares computation across requests. Continuous batching admits and removes sequences during generation. It can improve aggregate throughput while individual users still wait. vLLM's [PagedAttention work](https://arxiv.org/abs/2309.06180) concerns efficient KV-cache management, not a change in what the model knows.

Track time to first token, complete response latency, output tokens/second, peak memory, and correctness separately. A faster server can serve the same wrong answer faster. Local execution removes a hosted per-token bill but still uses hardware, electricity, storage, and maintenance time.

## Choose a serving tool

**Documentation reviewed 17 October 2026.** Choose one route, check its current platform support, and record the installed version. This is a comparison of workflows, not a performance ranking.

| Tool | Useful starting situation | What to learn / check |
|---|---|---|
| [LM Studio](https://lmstudio.ai/docs/developer/core/server) | You prefer a desktop model browser and local API controls | Select/load an appropriate model, inspect Developer settings, start the server, and check its bind address and authentication |
| [Ollama](https://docs.ollama.com/quickstart) | You prefer a simple local model-management CLI/API | Inspect installed model tags, context settings, process memory, and native versus compatibility endpoints |
| [llama.cpp](https://github.com/ggml-org/llama.cpp) | You want explicit control over GGUF files and CPU/GPU execution | Model provenance, quantization, chat template, context, GPU offload, and `llama-server` options |
| [vLLM](https://docs.vllm.ai/en/latest/getting_started/quickstart/) | An instructor or lab operates a supported serving machine, often for concurrent users | Supported hardware/model format, scheduling, KV-cache limits, throughput, access controls, and monitoring |

These products overlap, and desktop tools may use lower-level inference engines internally. A supported CPU or accelerator backend does not mean all four have the same installation path or performance. Follow the [vLLM installation matrix](https://docs.vllm.ai/en/latest/getting_started/installation/) rather than treating its GPU-oriented examples as a universal laptop command.

An “OpenAI-compatible” API describes a supported interface. It does not promise all endpoints, tool calls, JSON-schema constraints, streaming events, usage fields, or model behaviors match another server. Verify the particular server + model + framework combination. Compatibility also does not imply requests go to OpenAI: inspect the actual base URL and any fallback configuration.

## Optional local request lab

Use an already available local model or an instructor-approved small instruction model. Check its license, source, download size, supported tools, and hardware needs first. Downloads can be large; do not download four runtimes or models to complete this exercise. If you cannot run locally, analyze the worked trace and measurement example instead.

**Route A — Ollama.** Install from its official quickstart, start the application, and inspect what is already installed:

```bash
ollama --version
ollama list
curl --fail --max-time 10 http://127.0.0.1:11434/api/tags
```

Copy an actual installed local model name from that output. Save this **request template** as `request.json`, replacing `REPLACE_WITH_INSTALLED_LOCAL_MODEL` with that name:

```json
{
  "model": "REPLACE_WITH_INSTALLED_LOCAL_MODEL",
  "messages": [{"role": "user", "content": "Explain HTTP 404 in one sentence."}],
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

**Route B — LM Studio.** Select and load a compatible local model, open Developer, and start its local API server. Inspect the displayed address; leave network sharing off for the laptop exercise. With the port shown by your installation, query `/v1/models` using [List Models](https://lmstudio.ai/docs/developer/openai-compat/models). Then follow its chat-completions example with that returned model ID. Record whether the model was already loaded; do not equate every listed model with a resident model.

**Route C — llama.cpp, advanced.** After following its official installation/build instructions and obtaining a compatible GGUF model, start the installed binary with your real model path. The following is a template; replace the path:

```bash
llama-server -m /absolute/path/to/model.gguf \
  --host 127.0.0.1 --port 8081 -c 2048
```

Use another terminal for `curl --fail --max-time 10 http://127.0.0.1:8081/health`. The [server reference](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md) explains loading status, model/chat settings, and API routes. Explicit flags avoid depending on changing defaults. Do not enable optional tool execution for this simple inference exercise.

**Route D — vLLM, instructor/lab extension.** Use a supported environment and model from its current quickstart. After installing for that hardware, `vllm serve MODEL_ID --host 127.0.0.1 --port 8081` illustrates the server entry point; replace `MODEL_ID` and check model/license/memory requirements before running. Shared service deployment additionally needs authentication, restricted network access, concurrency limits, monitoring, and a resource owner. It is outside the laptop setup requirement.

## Connect an agent without changing its authority

Use a bounded loop: build context → request a model decision → validate the proposed tool and arguments → authorize the target/action → execute through the restricted runner → validate and append the bounded result → continue or stop. Enforce iteration, token, tool-call, output-size, and wall-clock budgets in code. Stop on a validated final answer, explicit cancellation, a policy denial, or exhausted budgets; an agent should not keep asking until a denied operation succeeds.

Keep the model's selected action separate from the controller's decision to permit it. For a recipe extractor, tools remain read-only domain operations even when the same local model could generate shell commands in another harness. Retrieved text and tool results are data, not instructions that can expand the tool allowlist.

```text
frontend → backend → ai-service (Pydantic AI harness)
                              → local/hosted inference endpoint
                              → explicitly allowed domain tools
```

The inference runtime is a dependency of the AI application service. An optional fourth process/container for model serving does not replace any required application responsibility. Backend database ownership, typed contracts, failure handling, and offline tests stay the same.

Before changing the configured provider/base URL, verify: ordinary completion, the required structured output, one permitted tool call, malformed arguments, an unavailable server, and a deadline. Reuse Lecture 6's deterministic tests and Lecture 9's quality cases. Pydantic AI documents [compatible providers](https://ai.pydantic.dev/models/openai/#openai-compatible-models); use its configuration for your installed version instead of changing only the model-name string.

`localhost` inside a container refers to that container. A host inference server is not automatically reachable from `ai-service`; a Compose-hosted server uses its service DNS name and container port. Reaching a host service depends on the platform and bind/firewall configuration. Do not “fix” a connection error by exposing an unauthenticated inference server on every interface. See the [sandbox guide](agent-sandboxes.md#network-and-model-access) for the separate network-policy decision.

## Measure and diagnose

Record: runtime/version, model ID or digest, quantization, hardware, context/output limits, request, allowed tools, cold/warm state, observed timings, memory, and task result. Redact secrets. Model download/load time, queue delay, prefill, and decoding are distinct contributors; total latency includes more than generated-token speed.

**Synthetic example, not a benchmark:** a response reports 100 generated tokens and `eval_duration = 5,000,000,000` nanoseconds. Decode throughput is `100 / 5 = 20 tokens/second`. If total elapsed time was eight seconds, the other three seconds cannot be attributed to decoding alone. Compare identical inputs and output budgets, then rerun the quality cases after any optimization.

| Symptom | First useful investigation |
|---|---|
| Connection refused | Correct process, address, port, and container/host boundary |
| Out of memory or severe swapping | Weights, configured context, simultaneous requests, and other processes |
| Long first request, faster second | Model loading, warm-up, queue, and prefix-cache state |
| Fluent text but broken agent | Chat template, output/tool support, argument validation, and framework compatibility |
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

## Sources

Architecture: [Attention Is All You Need](https://arxiv.org/abs/1706.03762), [Hugging Face LLM course](https://huggingface.co/learn/llm-course/chapter1/4). Serving research: [PagedAttention](https://arxiv.org/abs/2309.06180). Runtime instructions and API details are linked at the relevant steps above; check them against the installed release before teaching.

<!-- {% endraw %} -->
