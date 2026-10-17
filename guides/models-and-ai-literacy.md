# Models and AI literacy: choose, use, and verify

<!-- {% raw %} -->

[Course home](../README.md) · [Student setup](student-setup.md) · [Agent-driven engineering](agent-driven-development.md) · [Lecture 6](../lectures/06-pydantic-ai-agents.md)

**Read the basics in week 1; revisit selection and evaluation in weeks 6 and 9.** You are learning how to judge a model for a task. No particular provider, paid plan, or live model call is required.

For the mechanics behind this choice, read [Local inference and transformers](local-inference.md): tokens, attention, prefill/decode, KV caches, quantization, and optional LM Studio/Ollama/llama.cpp/vLLM routes. Local serving and [agent sandboxing](agent-sandboxes.md) solve different problems.

<details markdown="1" class="lecture-toc">
<summary>On this page</summary>

- [Six things to distinguish](#six-things-to-distinguish)
- [What a model can and cannot establish](#what-a-model-can-and-cannot-establish)
- [Tokens, context, memory, and retrieval](#tokens-context-memory-and-retrieval)
- [Choose by the task](#choose-by-the-task)
- [A dated model landscape](#a-dated-model-landscape)
- [Cost, latency, and local models](#cost-latency-and-local-models)
- [A small comparison exercise](#a-small-comparison-exercise)
- [Use AI to learn](#use-ai-to-learn)
- [Quick quiz](#quick-quiz)

</details>

## Six things to distinguish

| Layer | Example | What you should inspect |
|---|---|---|
| Product/interface | ChatGPT, Gemini chat, Cursor, Copilot | Account, data settings, available features |
| Coding harness | Codex, Claude Code, OpenCode | Workspace, tools, instructions, execution controls |
| Model | A particular GPT, Claude, Gemini, or GLM model | Model ID/version, supported inputs, quality, limits |
| Provider/host | The service answering model requests | Endpoint, credentials, region/access, billing |
| Application framework | Pydantic AI or Mastra | How your code builds runs, tools, validation, and state |
| Your application | Recipe Box's three services | User behavior, contracts, authorization, tests, and operations |

A subscription belongs to a product and account. An API key belongs to a provider and billing arrangement. Installing an open-source harness does not include hosted model capacity. Selecting a model in your editor does not change the model configured in `ai-service`.

Check the actual settings or run metadata. A model's answer to “which model are you?” is not authoritative account or deployment information.

## What a model can and cannot establish

Models can explain unfamiliar code, propose implementations, summarize supplied documents, generate candidate test inputs, and request structured tool calls. Some accept images, audio, or video; check the exact model and interface. A screenshot can help with UI diagnosis, but text code and exact errors are usually easier to inspect and reproduce.

Generation is not execution. A proposed `pytest` command has not passed until a tool or person actually ran it and observed the result. A plausible citation, package name, model ID, or API method can be invented. Open the primary source, check the installed version, and execute the relevant behavior.

Three different successes matter:

1. **Structure:** the output conforms to the requested schema.
2. **Meaning:** its content is accurate and useful for the input.
3. **Authority:** the requested operation is allowed for this caller.

Pydantic validation helps with the first and selected business rules. It does not automatically establish factual accuracy or access rights. A model can propose a tool call; application code decides whether and how to execute it.

## Tokens, context, memory, and retrieval

- **Token:** a model-specific unit of text or other encoded input. Tokens are not words; code, Hebrew, English, and images can have different accounting. Use provider usage reports for measurements.
- **Context window:** the bounded information a request can process. Instructions, conversation, selected files, tool definitions/results, and output allowance compete for capacity. A large limit does not guarantee that every detail will be used correctly.
- **Training knowledge:** patterns learned before deployment. It is not a live package registry or a guarantee of current documentation.
- **Conversation memory:** information an application retains between turns/runs. It can be incomplete or stale and needs deliberate user/thread scope.
- **Retrieval/RAG:** application code finds relevant material and supplies it as context. It changes the evidence available for an answer; it does not retrain the model. Retrieved content can be wrong or contain hostile instructions.
- **Fine-tuning:** additional model training for a defined behavior or task. It is outside the required course project; start with a clear task, useful context, tools, and evaluations.

Provide a small relevant context pack: outcome, constraints, exact failure, relevant code/schema, and verification command. Ask the assistant to retrieve more only when needed. Preserve durable decisions in the repository, rather than depending on a long chat to remember them.

## Choose by the task

| Task | Start with | Check before relying on it |
|---|---|---|
| Explain a short function | An available general model | Can you predict and run an example yourself? |
| Routine edit with clear acceptance tests | An available fast/balanced coding model | Correct diff, contract, and test result |
| Difficult bug or architecture tradeoff | A stronger reasoning option, if available | Reproduction, competing explanations, and evidence |
| Structured product extraction | A model supporting the framework's output/tool mechanism | Schema, semantic quality, retries, cost, and latency |
| UI review | Image-capable model/interface | Actual browser behavior, labels, keyboard access, and layout |
| Offline CI | `TestModel` / `FunctionModel` | Your control flow and contracts, rather than real-model quality |

Reasoning/effort settings can trade time and resource use for performance. They do not turn a response into a proof. Sampling settings such as temperature affect generation; setting a value to zero is not a universal correctness or reproducibility guarantee. Some models do not expose the same settings.

A model that gives a better explanation may be worse at obeying a narrow JSON contract. Choose using your task cases and constraints, not one leaderboard or a provider's marketing label.

## A dated model landscape

**Catalog snapshot: 16 October 2026.** These examples identify families and roles for comparison, not a ranking or a promise that a student account exposes every model. Use the linked catalogs and the tool's current picker; preserve the exact version in an evaluation report.

| Provider | Examples in its current catalog | Useful comparison |
|---|---|---|
| [OpenAI](https://developers.openai.com/api/docs/models) | GPT-6 Astra, GPT-6.1 Sol, GPT-6 Luna | More demanding reasoning versus balanced and high-volume workloads |
| [Anthropic](https://platform.claude.com/docs/en/models/overview) | Claude Fable 5.1, Opus 5.5, Sonnet 5.5, Haiku 5.5 | Long-horizon reasoning/coding versus speed and throughput |
| [Google](https://ai.google.dev/gemini-api/docs/models) | Gemini 4 Argon, Gemini 3.8 Flash, Gemini 3.5 Flash-Lite | Reasoning, agent work, and lower-latency/high-throughput tasks |
| [Z.ai](https://docs.z.ai/guides/llm/glm-5.3) | GLM-5.3; consult the catalog for other GLM variants | Coding/agent work, text-only versus multimodal support, and Coding Plan/API distinctions |

The vendors' role descriptions are starting hypotheses. Only your measurements establish suitability for your product. A model available through an API may be absent from a chat plan or an editor. An automatic router may select a model without exposing an exact ID; record that limitation rather than inventing one.

Lecture 6 uses a provider-prefixed configuration such as `openai:<model>` or `google:<model>`. Replace `<model>` using the provider's supported ID and Pydantic AI's provider documentation. Human-facing names, API IDs, and framework prefixes are different strings. Do not copy a retired model from an old tutorial merely because its code still appears online.

## Cost, latency, and local models

For a paid API, estimate at least:

```text
input tokens × input rate + output tokens × output rate
+ provider-specific cache, reasoning, tool, and other charges
```

Rates may be quoted per million tokens. Read the provider's accounting rules instead of counting words. A retry, delegated agent, or second HTTP attempt can produce additional requests. Use Lecture 9's budgets across the whole request path.

**Hypothetical example:** at $1 per million input tokens and $4 per million output tokens, 2,000 input plus 500 output tokens cost $0.004 before other charges. Three such calls cost $0.012. These are arithmetic examples, not current provider prices.

Measure latency too: the time to first visible output and the time to a usable completed result can differ. Streaming may improve perceived responsiveness without shortening total work. For extraction, the UI should not treat partial JSON as a validated final record.

A local model through [Ollama](https://docs.ollama.com/quickstart) is optional. Available RAM, model size, quantization, and CPU/GPU support affect whether it runs usefully. Local execution is not automatically faster or equally capable. Check that the selected model supports the tool/output behavior your agent requires. See [Lecture 6's local-model route](../lectures/06-pydantic-ai-agents.md#choosing-a-model-with-ai_model).

Open weights describe access to model weights under a license; they do not imply unrestricted use, open training data, or local processing in every product that offers that model. Check the actual host and license.

## A small comparison exercise

Use two model settings you already have access to, or two instructor-provided outputs. No purchase or new API account is needed. Label artifact inspection separately from an executed model run.

1. Choose one narrow task: explain a failing API test, review a small diff, or extract your domain record.
2. Write the expected behavior and a few normal/boundary/failure cases **before** asking the models. Reserve at least one fresh case for the final comparison.
3. Give both the same relevant context and tool access. Keep the task, allowed edits, and verification procedure fixed.
4. Record the model/version if exposed, harness/provider, relevant settings, date, checks, observed latency, and reported usage. Mark unavailable measurements as unknown.
5. Test the proposed change or score the extraction. Inspect surprising outcomes yourself; the assistant should not be the sole judge of its own answer.
6. Choose the smallest/fastest option that meets the task's quality and access constraints, or explain why neither is suitable.

Report observations about this task and these cases. A few classroom runs do not establish a universal model ranking. Keep a held-out case so repeatedly rewriting a prompt does not merely memorize the development examples. Lecture 9 expands this into the required evaluation dataset. Its optional [evaluation clinic](../lectures/09-failures-evals-costs.md#evaluation-clinic-audit-the-score) shows why a higher average can hide a critical regression and how to test a grader without a model.

## Use AI to learn

Use a **predict → ask → run → explain** cycle:

- Predict the response or failure before seeing the model's answer.
- Ask for a hint, explanation, or counterexample when you are stuck.
- Run the command/test and compare the observation with both predictions.
- Explain the result without reading the assistant's prose.

For debugging, provide the smallest reproduction and a hypothesis. For design, ask for tradeoffs and failure cases. For tests, decide the acceptance criteria yourself. For upstream work, follow the project's policy and write maintainer-facing text yourself.

An assistant can translate an explanation into a language that helps you learn. Keep identifiers, commands, exact errors, and API field names unchanged so you can reproduce the behavior and discuss it individually.

## Quick quiz

<details markdown="1">
<summary>Q1. You select a different model in Cursor. Did Recipe Box's AI service change?</summary>

No. The editor's model and the application's `AI_MODEL` configuration are independent. Check the service configuration and its run metadata.

</details>

<details markdown="1">
<summary>Q2. A model returns valid JSON and says its tests passed. What remains to check?</summary>

Validate the structure and business rules, inspect factual/task quality, and find the actual command/result evidence. If no execution happened, run the tests yourself.

</details>

<details markdown="1">
<summary>Q3. Does a larger context window remove the need to select relevant files?</summary>

No. Capacity, relevant evidence, correct retrieval, and effective use of that evidence are different things. Supply focused context and verify the answer.

</details>

<!-- {% endraw %} -->
