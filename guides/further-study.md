# Further study and how this course was designed

<!-- {% raw %} -->

[Course home](../README.md) · [Learning map](learning-map.md) · [Engineering foundations](engineering-foundations.md)

This page lists public course sites and research papers you can read *after* the weekly work is done, and explains where this course's teaching methods come from. **Everything here is optional.**

**You will be able to:** find a trustworthy next resource for a topic you want to go deeper in, tell a published course from one still in progress, and explain why each teaching routine in this course exists.

**Predict first:** two well-known courses both care about understanding. One forbids generative AI on its coursework; the other allows AI-written code that you can validate and explain, and checks this orally. Which one is this course's AI policy closer to, and does that mean we copied its rules?

<details markdown="1">
<summary>Check your prediction</summary>

Closer to the second (Stanford CS329Z), and also to MIT 6.1040: this course allows AI tools from week 1, requires you to understand and verify everything, and checks understanding through your individual explanation. But the rules are **our own**: the [course guide](../README.md#working-method-ai-use-assessment-and-reproducibility) is the authority, and the table in [AI policies differ](#ai-policies-differ-ours-is-our-own) shows how different the rules at MIT and Stanford are.

</details>

<details markdown="1" class="lecture-toc">
<summary>On this page</summary>

- [How to use this page](#how-to-use-this-page)
- [How this course was designed](#how-this-course-was-designed)
- [AI policies differ; ours is our own](#ai-policies-differ-ours-is-our-own)
- [Course sites by topic](#course-sites-by-topic)
- [Engineering sources to work through](#engineering-sources-to-work-through)
- [Inference engineering book and companion](#inference-engineering-book-and-companion)
- [Research papers](#research-papers)
- [Accessibility standards](#accessibility-standards)
- [What we could not verify](#what-we-could-not-verify)
- [Turn a conference idea into evidence](#turn-a-conference-idea-into-evidence)

</details>

## How to use this page

- **Optional, always.** Nothing on this page is a prerequisite, an assignment, or assessed. If a lecture's prerequisite check fails, use [Engineering foundations](engineering-foundations.md) first; it is shorter and written for this course.
- **Reviewed 17 October 2026.** Each course entry says what was public that day: **Published** (real material online), **In progress** (running now; the entry says what is not released yet), **Archived** (an older, stable copy), or **Unverified** (we could not confirm it). Anything announced but not yet released is marked *planned*.
- **No affiliation.** EASS is **not affiliated with** MIT or Stanford, and this course is not equivalent to any of their courses. Our activities are original; where one was inspired by a course site, this page says so.
- **Respect licenses.** Follow each site's license and policies, and do not copy coursework or solutions. Two repositories listed below have **no license**: read and link them, but do not copy from them.
- **Read with a question.** Before opening a source, write the one question you want it to answer, and stop when it is answered. Each entry's *Read for* line suggests where to start.

## How this course was designed

Each recurring routine in the lectures comes from published research on how people learn to program. The table names the routine, the primary source, and where you meet it.

| Design choice | Evidence (primary source) | Where you meet it |
|---|---|---|
| Predict → Run → Investigate → Modify → Make (PRIMM) | Sentance, Waite & Kallia (2019), [doi:10.1080/08993408.2019.1608781](https://doi.org/10.1080/08993408.2019.1608781). The study was with school pupils, so we apply it by analogy. | "Predict first" in every lecture; "Investigate" questions after demos; the hands-on lab |
| Worked examples, then faded practice | Sweller & Cooper (1985), [doi:10.1207/s1532690xci0201_3](https://doi.org/10.1207/s1532690xci0201_3); Atkinson et al. (2000), [doi:10.3102/00346543070002181](https://doi.org/10.3102/00346543070002181); Renkl & Atkinson (2003), [doi:10.1207/S15326985EP3801_3](https://doi.org/10.1207/S15326985EP3801_3) | Recipe Box live demos first, then the same steps in your own domain; the practice ladders in Engineering foundations |
| Self-explanation | Chi et al. (1989), [doi:10.1207/s15516709cog1302_1](https://doi.org/10.1207/s15516709cog1302_1) | "Explain after" prompts; the individual technical discussion |
| Subgoal labels | Margulieux, Guzdial & Catrambone (2012), [doi:10.1145/2361276.2361291](https://doi.org/10.1145/2361276.2361291); Margulieux, Morrison & Decker (2020), [doi:10.1186/s40594-020-00222-7](https://doi.org/10.1186/s40594-020-00222-7) | The five labels on live-demo steps ([learning map](learning-map.md#how-to-read-a-lecture)) |
| Retrieval and spacing | Roediger & Karpicke (2006), [doi:10.1111/j.1467-9280.2006.01693.x](https://doi.org/10.1111/j.1467-9280.2006.01693.x); Cepeda et al. (2006), [doi:10.1037/0033-2909.132.3.354](https://doi.org/10.1037/0033-2909.132.3.354); Dunlosky et al. (2013), [doi:10.1177/1529100612453266](https://doi.org/10.1177/1529100612453266) | "Warm-up from earlier classes"; quizzes with hidden answers |
| Parsons problems | Ericson, Margulieux & Rick (2017), [doi:10.1145/3141880.3141895](https://doi.org/10.1145/3141880.3141895) | Text-only "put these lines in order" items in early lectures |
| Tracing before writing | Lister et al. (2004), [doi:10.1145/1041624.1041673](https://doi.org/10.1145/1041624.1041673); Lopez et al. (2008), [doi:10.1145/1404520.1404531](https://doi.org/10.1145/1404520.1404531) | "Trace it" tables that follow one request or one state change |
| Explain in plain English | Murphy et al. (2012), [doi:10.1145/2361276.2361299](https://doi.org/10.1145/2361276.2361299) | One "Explain it" item per quiz; the three-level self-rubric in [Individual understanding](learning-map.md#individual-understanding) |
| Peer instruction | Porter, Bailey Lee & Simon (2013), [doi:10.1145/2445196.2445250](https://doi.org/10.1145/2445196.2445250) | Vote, discuss with a partner, vote again (instructor notes) |
| Hypothesis-driven debugging | Michaeli & Romeike (2019), [doi:10.1145/3361721.3361724](https://doi.org/10.1145/3361721.3361724); Loksa et al. (2016), [doi:10.1145/2858036.2858252](https://doi.org/10.1145/2858036.2858252) | The [debug log](engineering-foundations.md#debug-with-a-hypothesis) and "hypothesis before assistant" |
| Guarding against an "illusion of progress" with AI | Prather et al. (2024), [doi:10.1145/3632620.3671116](https://doi.org/10.1145/3632620.3671116) | Hypothesis before assistant; read the diff and run the check before you keep a change; the AI-use note |

**An honest limit:** no learning gain has been measured for *this* course. The studies above involved different students (some of them school pupils) and different settings, so they are reasons for our choices, not guarantees.

Some activities were also **inspired by** public course sites. The activities and wording are original; the table credits the idea.

| Activity in this course | Inspired by | Where you meet it |
|---|---|---|
| Purpose and operational principle in your product sketch | Concept design in MIT 6.1040 Software Design, Fall 2026 ([schedule](https://61040.github.io/fa26/schedule/)) | Lecture 1 lab, product sketch |
| A three-line forecast before delegating to an assistant | MIT 6.S950 Agency with AI, [Lab 1](https://agencyai.mit.edu/lab1/); Missing Semester 2026, [Agentic Coding](https://missing.csail.mit.edu/2026/agentic-coding/) | Lecture 1, working with an assistant |
| An "undo without panic" Git drill | MIT 6.102, [Git 2: disaster recovery](https://web.mit.edu/6.102/www/sp26/tools/git-2-disaster-recovery/); Missing Semester 2026, [Version Control](https://missing.csail.mit.edu/2026/version-control/) | Lecture 1, Break it on purpose |
| Writing test partitions down before testing | MIT 6.102, [Testing](https://web.mit.edu/6.102/www/sp26/classes/02-testing/) | Lecture 2 tests; the [engineering studio](learning-map.md#engineering-studio-and-review-criteria) |
| A written debugging method with a debugger | MIT 6.102, [Debugging](https://web.mit.edu/6.102/www/sp26/classes/13-debugging/); Missing Semester 2026, [Debugging and Profiling](https://missing.csail.mit.edu/2026/debugging-profiling/); Stanford CS107 [debugging guide](https://web.stanford.edu/class/archive/cs/cs107/cs107.1272/resources/debugging.html) | [Debug with a hypothesis](engineering-foundations.md#debug-with-a-hypothesis) |
| Reading a real review before your first upstream PR | Missing Semester 2026, [Beyond the Code](https://missing.csail.mit.edu/2026/beyond-code/) | Lecture 2, open-source track |
| AI use as "Encouraged / Required / Not OK" | Stanford CS224G, Winter 2026 ([course site](https://web.stanford.edu/class/cs224g/)) | [AI use at a glance](../README.md#working-method-ai-use-assessment-and-reproducibility) |
| Short, ungraded random check-offs before the final discussion | MIT 6.5840 [check-offs](https://pdos.csail.mit.edu/6.824/general.html); Stanford CS329Z [oral checks](https://cs329z.stanford.edu/logistics.html) | Meetings 11–12 ([instructor pacing](learning-map.md#instructor-pacing-and-readiness-review)) |

**Check yourself:** which design choice explains why every "Predict first" in this course has a hidden answer you open only *after* writing your own?

<details markdown="1">
<summary>Check your answer</summary>

Retrieval practice with feedback (and PRIMM's predict step): committing to an answer before seeing one makes you retrieve what you know, and the hidden answer gives immediate feedback on it. Reading the answer first turns the question back into re-reading, which helps far less.

</details>

## AI policies differ; ours is our own

The courses this page cites set very different rules for AI tools. Their rules apply to *their* students; ours are in the [course guide](../README.md#working-method-ai-use-assessment-and-reproducibility).

| Course (latest published) | AI policy (checked 17 October 2026) | How understanding is checked |
|---|---|---|
| MIT 6.102 Software Construction, Spring 2026 | Generative AI for writing code or text is prohibited on coursework ([collaboration policy](https://web.mit.edu/6.102/www/sp26/general/collaboration.html)) | Reading exercises, short start-of-class quizzes, code review then revision, exams |
| MIT 6.1800 Computer Systems Engineering, Spring 2026 | Generative AI may not create text beyond a single word; spelling, grammar and search help are allowed ([grading and policies](https://web.mit.edu/6.1800/www/grades.shtml)) | Exams, communication assignments, participation |
| MIT 6.5840 Distributed Systems, Spring 2026 | An assistant writing lab code means you learn correspondingly less; you must be able to explain all submitted code ([general information](https://pdos.csail.mit.edu/6.824/general.html)) | Randomly chosen lab check-offs, questions before lectures, exams |
| MIT 6.1040 Software Design, Fall 2026 | LLMs encouraged as a skill, but attempt problem sets and new skills without them first, and never use one for reflections ([class guide](https://61040.github.io/fa26/guide)) | Competency levels per skill, reflections in your repository |
| Stanford CS329Z Engineering AI Agents, Fall 2026 | AI-generated code allowed if you can validate and explain it; AI may not write reports ([logistics](https://cs329z.stanford.edu/logistics.html)) | Oral examinations, quizzes after each homework, peer review |
| Stanford CS107, Autumn 2026 | AI treated like a classmate: high-level questions allowed, AI-written code or answers prohibited ([collaboration policy](https://web.stanford.edu/class/archive/cs/cs107/cs107.1272/collaboration.html)) | Similarity detection, truthful citation |
| Stanford CS190 Software Design Studio, Winter 2024 | ChatGPT and other AI assistants not permitted ([course site](https://web.stanford.edu/~ouster/cs190-winter24/)) | Code reviews and revision of your own code |

EASS borrows these courses' **specification, testing, review and verification methods**, not their AI rules. The [course guide](../README.md#working-method-ai-use-assessment-and-reproducibility) is the authority for ours.

**Check yourself:** a friend taking MIT 6.102 says, "EASS lets me use an assistant, so I can use one on my 6.102 problem set too." What is wrong with that reasoning?

<details markdown="1">
<summary>Check your answer</summary>

Each course's policy governs work submitted *to that course*. 6.102 prohibits generative AI on its coursework, so its rule applies there regardless of what EASS allows. The same holds in reverse for upstream projects: follow each project's own AI-use policy when you contribute.

</details>

## Course sites by topic

Statuses are as of **17 October 2026**. Terms and URLs change; if a link breaks, search the course number on the university's site rather than a mirror.

### Tools and workflow

- **[The Missing Semester of Your CS Education, 2026](https://missing.csail.mit.edu/)** (MIT CSAIL, IAP January 2026). *Published*; CC BY-NC-SA. *Read for:* the [shell](https://missing.csail.mit.edu/2026/course-shell/), [version control](https://missing.csail.mit.edu/2026/version-control/), [debugging and profiling](https://missing.csail.mit.edu/2026/debugging-profiling/), packaging with uv, Docker and Compose, [agentic coding](https://missing.csail.mit.edu/2026/agentic-coding/), and [beyond the code](https://missing.csail.mit.edu/2026/beyond-code/) (issues, PRs, AI disclosure). The best repair resource when a tool feels like magic.
- **[Stanford CS45: Software Tools Every Programmer Should Know](https://web.stanford.edu/class/cs45/)** (Spring 2023). *Published.* The page says it continues as CS104; no public CS104 site was found (*Unverified*). *Read for:* version control I and II, debugging and profiling, CI/CD.

### Software construction and design

- **[MIT 6.102 Software Construction](https://web.mit.edu/6.102/www/sp26/)** (Spring 2026). *Published*; readings CC BY-SA 4.0; examples in TypeScript. *Read for:* [testing](https://web.mit.edu/6.102/www/sp26/classes/02-testing/) (partitions and boundaries), [specifications](https://web.mit.edu/6.102/www/sp26/classes/04-specifications/), [debugging](https://web.mit.edu/6.102/www/sp26/classes/13-debugging/), and [Git disaster recovery](https://web.mit.edu/6.102/www/sp26/tools/git-2-disaster-recovery/). Its coursework forbids generative AI.
- **[MIT 6.1040 Software Design](https://61040.github.io/fa26/)** (Fall 2026). *In progress:* slides through 14 October are posted; lectures from 19 October are placeholders, and assignments P4, P5 and F0–F6 are not released yet (*planned*). MIT's teaching list shows the title "Software Studio"; we did not resolve the difference. *Read for:* concept design (purpose, operational principle, state, actions) and [problem framing](https://61040.github.io/fa26/assignments/e1/). Previous term: [Fall 2025](https://61040-fa25.github.io/).
- **[Stanford CS190 Software Design Studio](https://web.stanford.edu/~ouster/cs190-winter24/)** (Winter 2024, the latest public offering). *Published.* *Read for:* information hiding, deep modules, and the implement → review → revise cycle, based on *A Philosophy of Software Design*.
- **[MIT OCW 6.005 Software Construction](https://ocw.mit.edu/courses/6-005-software-construction-spring-2016/)** (Spring 2016). *Archived*; CC BY-NC-SA 4.0. A stable copy of the readings that 6.102 grew from.

### Web applications and security

- **[Stanford CS142 Web Applications](https://web.stanford.edu/class/cs142/)** (Spring 2023, the latest public offering; an older stack). *Published.* *Read for:* the storage tier and the week-8 web-security lectures.
- **[Stanford CS155 Computer and Network Security](https://cs155.stanford.edu/)** (Spring 2026). *Published.* *Read for:* the web-security project and past finals.
- **[MIT 6.566 Computer Systems Security](https://css.csail.mit.edu/6.5660/2026/)** (Spring 2026, graduate). *Published.* *Read for:* the web security model, supply-chain security, and the guest lecture on AI agent security. Its [demo repository](https://github.com/anishathalye/ai-agent-security-lecture) runs with `uv` and a local model; it has **no license**, so read and run it but do not copy from it.

<details markdown="1">
<summary>Guiding questions for the AI agent security lecture</summary>

Answer them for **your** product after Lecture 6:

1. Which of your agent's tools could text inside a pasted recipe (or your domain's input) trigger?
2. Which data could flow from that input to which output: a saved record, a log, a page another user sees?
3. What do your Pydantic schema and your validators *not* prevent?

There is no single right answer; a good answer names a concrete tool, a concrete field, and one check you would add.

</details>

### Systems and distributed systems

- **[MIT 6.1800 Computer Systems Engineering](https://web.mit.edu/6.1800/www/)** (Spring 2026). *Published.* *Read for:* weekly reading guides; start with the [End-to-End Arguments reading page](https://web.mit.edu/6.1800/www/readings/07-e2e.shtml).
- **[MIT 6.5840 Distributed Systems](https://pdos.csail.mit.edu/6.824/)** (Spring 2026, graduate). *Published*; lecture notes, no linked videos. *Read for:* the [Lecture 2 notes on RPC](https://pdos.csail.mit.edu/6.824/notes/l-rpc.txt), which explain why a lost reply leaves the caller unsure whether the work happened.
- **[Stanford CS244B Distributed Systems](https://www.scs.stanford.edu/24sp-cs244b/)** (Spring 2024) and **[CS244C](https://www.scs.stanford.edu/26wi-cs244c/)** (Winter 2026). *Published.* *Read for:* two-phase commit, Raft, Dynamo and Spanner; CS244C's reading list starts with the end-to-end arguments paper.
- **[MIT 6.5830 Database Systems](https://dsg.csail.mit.edu/6.5830/)** (Spring 2026, graduate). *Published.* *Read for:* transactions and query processing, after Lecture 3.

<details markdown="1">
<summary>Three self-check questions on lost replies and end-to-end checks</summary>

Read the 6.5840 RPC notes or the end-to-end reading page first, then answer for the course's Recipe Box (`POST /recipes/from-text`):

1. Which component can confirm that a recipe was actually saved?
2. Why does the backend, not the AI service, decide whether a candidate recipe is accepted?
3. If the frontend retried after a timeout, where could a duplicate appear?

Model answers:

1. Only the **backend**, because it owns the database and the commit. The frontend sees only the reply; if the reply is lost, it cannot know.
2. The AI service only *proposes* a candidate; the backend holds the contract and the data, so the check must live where the data is written. An end-to-end check belongs at the endpoint that owns the outcome.
3. In the **database**: if the first request was committed but its reply was lost, a blind retry inserts a second row. That is why the course separates "nothing was sent" from "outcome unknown" ([Lecture 9](../lectures/09-failures-evals-costs.md#is-it-safe-to-repeat)).

</details>

### Building with coding agents

- **[Stanford CS146S: The Modern Software Developer](https://themodernsoftware.dev/)** (Fall 2026). *In progress:* weeks 1–4 slides sit behind a newsletter prompt; transcripts are posted for 24 September, 29 September and 1 October; weeks 5–10 are topic outlines only (*planned*). Its grading includes a 30% open-source contribution component. *Read for:* coding-agent internals, context and tool design, agent-ready repositories, code review with agents. The [assignment repository](https://github.com/mihail911/modern-software-dev-assignments) has **no license**: read only. Earlier term: [Fall 2025](https://themodernsoftware.dev/fall2025).
- **[MIT 6.S950 Agency with AI](https://agencyai.mit.edu/)** (Fall 2026). *In progress:* slides for week 9 are announced for 17 November and week 10 for 24 November (*planned*, not reviewed). Strict machine-learning and algorithms prerequisites. *Read for:* delegation judgment ([Lab 1](https://agencyai.mit.edu/lab1/)), evaluation as experimental design, and auditing judges.

### Engineering agentic systems and evaluation

- **[Stanford CS329Z Engineering AI Agents](https://cs329z.stanford.edu/)** (Fall 2026). *In progress:* slides for lectures 1–7 are posted. *Read for:* the [project guidance](https://cs329z.stanford.edu/project.html) on baselines, reproducibility and failure analysis. The [HW1 starter](https://github.com/cs329z/assignment1-harness) is MIT-licensed.
- **[Stanford CS224G Building and Scaling LLM Applications](https://web.stanford.edu/class/cs224g/)** (Winter 2026). *Published.* *Read for:* its proposal template and its clearly laid-out AI-tools policy.
- **[Stanford CS224V Agentic AI](https://web.stanford.edu/class/cs224v/)** (Fall 2026). *In progress.* *Read for:* homeworks built on one running case study.
- **[Stanford CS329A Self-Improving AI Agents](https://cs329a.stanford.edu/)** (Autumn 2025). *Published*; no Autumn 2026 offering is visible (*Unverified*). A graduate reading list on verification, planning and agentic evaluation.
- **[MIT Introduction to Data-Centric AI](https://dcai.csail.mit.edu/)** (IAP 2024). *Published*; CC BY-NC-SA. *Read for:* evaluating per slice, keeping held-out data separate, leakage, and label errors in test sets: background for Lecture 9's [evaluation clinic](../lectures/09-failures-evals-costs.md#evaluation-clinic-audit-the-score).

### Models, transformers and inference

- **[MIT 6.S191 Introduction to Deep Learning](https://introtodeeplearning.com/)** (2026). *Published*; MIT license with attribution on reuse. Needs linear algebra and calculus. *Read for:* the Deep Sequence Modeling lecture, before or after [Local inference](local-inference.md).
- **MIT 6.5940 TinyML and Efficient AI Computing.** [Fall 2024](https://hanlab.mit.edu/courses/2024-fall-65940): *Published*, with "Efficient LLM Deployment", "Long Context LLM" and a lab that runs an LLM on a laptop. [Fall 2026](https://hanlab.mit.edu/courses/2026-fall-65940): *In progress*; its LLM lectures (22 October–3 November) are scheduled (*planned*, not reviewed). Graduate prerequisites.
- **[Stanford CS224N NLP with Deep Learning](https://web.stanford.edu/class/cs224n/)** (Winter 2026). *Published.* *Read for:* slides and notes, including benchmarking and evaluation.
- **[Stanford CS336 Language Modeling from Scratch](https://cs336.stanford.edu/)** (Spring 2026). *Published.* *Read for:* tokenization and resource accounting. Its assignments need GPUs and are out of scope here.
- **[Stanford CS25 Transformers United](https://web.stanford.edu/class/cs25/)** (Spring 2026). *Published*; an open research seminar with recordings.

### ML systems

- **[Stanford CS329S Machine Learning Systems Design](https://stanford-cs329s.github.io/)** (Winter 2022, the latest verified offering). *Published.* *Read for:* deployment, failure diagnosis, distribution shift and monitoring.

## Engineering sources to work through

**Added and reviewed 18 October 2026.** Use the [Systems reasoning clinics](systems-reasoning.md) to turn these primary resources into an original worked example, diagram, runnable lab or calculation. All are optional; no cloud account is needed.

- **[Amazon Builders' Library: Making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/)** and **[AWS transactional outbox guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html)**: intent identity and the boundary between a committed change and later delivery. The clinic's code is original, uses two SQLite files, and does not reproduce AWS services.
- **[Google SRE: Service Level Objectives](https://sre.google/sre-book/service-level-objectives/)** and **[Embracing Risk](https://sre.google/sre-book/embracing-risk/)**: define a user-journey measure and an error-budget decision. The clinic's counts are synthetic.
- **Dean & Barroso, [The Tail at Scale](https://research.google/pubs/the-tail-at-scale/), CACM 2013:** a research starting point for latency tails. We verified the publication entry and abstract; the interactive fan-out arithmetic is our own simplified model.
- **[Anthropic: Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)** and **Yao et al., [τ-bench](https://arxiv.org/abs/2406.12045), 2024:** distinguish tasks, trials and consistency. We reviewed the engineering discussion and the paper's abstract/metric framing; the clinic's matrix is synthetic and establishes no vendor comparison.

Read for a specific question, state the source's assumptions, then bring back one check that could disprove your proposed application. Reputation helps find material; it does not establish that a pattern is needed in your product.

## Inference engineering book and companion

**Added and checked 18 October 2026.** Philip Kiely's [*Inference Engineering*](https://www.baseten.co/inference-engineering/book/) is publicly readable online without registration. Start with Chapter 1's product and measurement questions, then use the [visual course companion](inference-engineering.md#start-with-the-book) for a three-sitting route through Lectures 6–10, ten original diagrams and worked prediction exercises. Quantization, caching, batching and production measurement connect to Recipe Box; GPU kernels, multi-GPU serving and extra modalities remain optional depth.

Gergely Orosz's [*What is inference engineering?*, 31 March 2026](https://newsletter.pragmaticengineer.com/p/what-is-inference-engineering) introduces the area with material adapted from Kiely's book. These are industry perspectives, not university endorsements or independent guarantees of performance. Follow the companion's links to the official engine documentation and primary papers; test an optimization against a fixed task and workload. No subscription, model download, GPU or extra account is required.

## Research papers

The primary sources behind [How this course was designed](#how-this-course-was-designed), plus reviews for context. DOIs were checked against publisher metadata on 17 October 2026; several papers were read at abstract level only.

**Teaching methods**

- Sentance, Waite & Kallia (2019). *Teaching computer programming with PRIMM: a sociocultural perspective.* Computer Science Education 29(2–3). [doi:10.1080/08993408.2019.1608781](https://doi.org/10.1080/08993408.2019.1608781)
- Sweller & Cooper (1985). *The use of worked examples as a substitute for problem solving in learning algebra.* Cognition and Instruction 2(1). [doi:10.1207/s1532690xci0201_3](https://doi.org/10.1207/s1532690xci0201_3)
- Atkinson, Derry, Renkl & Wortham (2000). *Learning from examples: Instructional principles from the worked examples research.* Review of Educational Research 70(2). [doi:10.3102/00346543070002181](https://doi.org/10.3102/00346543070002181)
- Renkl & Atkinson (2003). *Structuring the transition from example study to problem solving in cognitive skill acquisition.* Educational Psychologist 38(1). [doi:10.1207/S15326985EP3801_3](https://doi.org/10.1207/S15326985EP3801_3)
- Kirschner, Sweller & Clark (2006). *Why minimal guidance during instruction does not work: An analysis of the failure of constructivist, discovery, problem-based, experiential, and inquiry-based teaching.* Educational Psychologist 41(2). [doi:10.1207/s15326985ep4102_1](https://doi.org/10.1207/s15326985ep4102_1)
- Chi, Bassok, Lewis, Reimann & Glaser (1989). *Self-explanations: How students study and use examples in learning to solve problems.* Cognitive Science 13(2). [doi:10.1207/s15516709cog1302_1](https://doi.org/10.1207/s15516709cog1302_1)
- Margulieux, Guzdial & Catrambone (2012). *Subgoal-labeled instructional material improves performance and transfer in learning to develop mobile applications.* ICER. [doi:10.1145/2361276.2361291](https://doi.org/10.1145/2361276.2361291)
- Morrison, Margulieux & Guzdial (2015). *Subgoals, context, and worked examples in learning computing problem solving.* ICER. [doi:10.1145/2787622.2787733](https://doi.org/10.1145/2787622.2787733)
- Margulieux, Morrison & Decker (2020). *Reducing withdrawal and failure rates in introductory programming with subgoal labeled worked examples.* International Journal of STEM Education 7. [doi:10.1186/s40594-020-00222-7](https://doi.org/10.1186/s40594-020-00222-7) (open access)
- Roediger & Karpicke (2006). *Test-enhanced learning.* Psychological Science 17(3). [doi:10.1111/j.1467-9280.2006.01693.x](https://doi.org/10.1111/j.1467-9280.2006.01693.x)
- Karpicke & Blunt (2011). *Retrieval practice produces more learning than elaborative studying with concept mapping.* Science 331. [doi:10.1126/science.1199327](https://doi.org/10.1126/science.1199327)
- Cepeda, Pashler, Vul, Wixted & Rohrer (2006). *Distributed practice in verbal recall tasks: A review and quantitative synthesis.* Psychological Bulletin 132(3). [doi:10.1037/0033-2909.132.3.354](https://doi.org/10.1037/0033-2909.132.3.354)
- Dunlosky, Rawson, Marsh, Nathan & Willingham (2013). *Improving students' learning with effective learning techniques.* Psychological Science in the Public Interest 14(1). [doi:10.1177/1529100612453266](https://doi.org/10.1177/1529100612453266)
- Parsons & Haden (2006). *Parson's programming puzzles: a fun and effective learning tool for first programming courses.* Proceedings of ACE 2006 (CRPIT 52). Cited from the literature; no DOI.
- Ericson, Margulieux & Rick (2017). *Solving Parsons problems versus fixing and writing code.* Koli Calling. [doi:10.1145/3141880.3141895](https://doi.org/10.1145/3141880.3141895)
- Du, Luxton-Reilly & Denny (2020). *A review of research on Parsons problems.* ACE. [doi:10.1145/3373165.3373187](https://doi.org/10.1145/3373165.3373187)
- Crouch & Mazur (2001). *Peer Instruction: Ten years of experience and results.* American Journal of Physics 69(9). [doi:10.1119/1.1374249](https://doi.org/10.1119/1.1374249)
- Porter, Bailey Lee & Simon (2013). *Halving fail rates using peer instruction: a multi-institutional study of computing courses.* SIGCSE. [doi:10.1145/2445196.2445250](https://doi.org/10.1145/2445196.2445250)
- Lister et al. (2004). *A multi-national study of reading and tracing skills in novice programmers.* ACM SIGCSE Bulletin 36(4). [doi:10.1145/1041624.1041673](https://doi.org/10.1145/1041624.1041673)
- Lopez, Whalley, Robbins & Lister (2008). *Relationships between reading, tracing and writing skills in introductory programming.* ICER. [doi:10.1145/1404520.1404531](https://doi.org/10.1145/1404520.1404531)
- Murphy, Fitzgerald, Lister & McCauley (2012). *Ability to 'explain in plain English' linked to proficiency in computer-based programming.* ICER. [doi:10.1145/2361276.2361299](https://doi.org/10.1145/2361276.2361299)
- Xie et al. (2019). *A theory of instruction for introductory programming skills.* Computer Science Education 29(2–3). [doi:10.1080/08993408.2019.1565235](https://doi.org/10.1080/08993408.2019.1565235)
- Kulik, Kulik & Bangert-Drowns (1990). *Effectiveness of mastery learning programs: A meta-analysis.* Review of Educational Research 60(2). [doi:10.3102/00346543060002265](https://doi.org/10.3102/00346543060002265)
- Edwards et al. (2024). *Early experiences with specifications grading in introductory CS courses.* IEEE FIE. [doi:10.1109/FIE61694.2024.10893554](https://doi.org/10.1109/FIE61694.2024.10893554)
- Loksa, Ko, Jernigan, Oleson, Mendez & Burnett (2016). *Programming, problem solving, and self-awareness: effects of explicit guidance.* CHI. [doi:10.1145/2858036.2858252](https://doi.org/10.1145/2858036.2858252)
- Michaeli & Romeike (2019). *Improving debugging skills in the classroom: The effects of teaching a systematic debugging process.* WiPSCE. [doi:10.1145/3361721.3361724](https://doi.org/10.1145/3361721.3361724)
- Ko et al. (2019). *Teaching explicit programming strategies to adolescents.* SIGCSE. [doi:10.1145/3287324.3287371](https://doi.org/10.1145/3287324.3287371)
- Prather et al. (2020). *What do we think we think we are doing? Metacognition and self-regulation in programming.* ICER. [doi:10.1145/3372782.3406263](https://doi.org/10.1145/3372782.3406263)
- Hundhausen, Agrawal & Agarwal (2013). *Talking about code: Integrating pedagogical code reviews into early computing courses.* ACM TOCE 13(3). [doi:10.1145/2499947.2499951](https://doi.org/10.1145/2499947.2499951)

**Generative AI and assessment**

- Prather et al. (2023). *The robots are here: Navigating the generative AI revolution in computing education.* ITiCSE Working Group Reports. [doi:10.1145/3623762.3633499](https://doi.org/10.1145/3623762.3633499)
- Lau & Guo (2023). *From "Ban it till we understand it" to "Resistance is futile": How university programming instructors plan to adapt as more students use AI code generation and explanation tools.* ICER. [doi:10.1145/3568813.3600138](https://doi.org/10.1145/3568813.3600138)
- Denny et al. (2024). *Computing education in the era of generative AI.* Communications of the ACM 67(2). [doi:10.1145/3624720](https://doi.org/10.1145/3624720)
- Prather, Reeves, Leinonen et al. (2024). *The widening gap: The benefits and harms of generative AI for novice programmers.* ICER. [doi:10.1145/3632620.3671116](https://doi.org/10.1145/3632620.3671116) ([preprint](https://arxiv.org/abs/2405.17739))
- Kazemitabaar et al. (2023). *Studying the effect of AI code generators on supporting novice learners in introductory programming.* CHI. [doi:10.1145/3544548.3580919](https://doi.org/10.1145/3544548.3580919)
- Denny et al. (2024). *Prompt Problems: A new programming exercise for the generative AI era.* SIGCSE. [doi:10.1145/3626252.3630909](https://doi.org/10.1145/3626252.3630909)
- Liu, Zenke, Liu, Holmes, Thornton & Malan (2024). *Teaching CS50 with AI: Leveraging generative artificial intelligence in computer science education.* SIGCSE. [doi:10.1145/3626252.3630938](https://doi.org/10.1145/3626252.3630938)
- Stanford Office of Community Standards. *[Generative AI Policy Guidance](https://communitystandards.stanford.edu/generative-ai-policy-guidance)* (adopted 16 February 2023): without a course policy, generative AI counts as help from another person.

## Accessibility standards

This site follows these W3C documents: diagrams have a short `alt` plus a text version, nothing requires dragging, and motion respects your system setting.

- [Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/), W3C Recommendation, 12 December 2024.
- [Understanding Success Criterion 1.4.10: Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html): why pages must work at narrow widths, and why diagrams and tables may scroll inside their own region.
- [Images tutorial: Complex images](https://www.w3.org/WAI/tutorials/images/complex/): a short text alternative plus a long description.
- [Technique C39: Using the CSS prefers-reduced-motion query](https://www.w3.org/WAI/WCAG22/Techniques/css/C39).

## What we could not verify

On 17 October 2026 we could not confirm the following, so the entries above avoid claims about them:

- **MIT web.lab (6.9620):** the next edition's schedule, public materials, stack and AI policy; only its home page was readable.
- **Stanford CS104,** the successor to CS45: no public course site was found.
- **Stanford CS190** offerings after Winter 2024, and **CS142** offerings after Spring 2023.
- **Stanford CS329S:** whether a current offering exists; the catalog entry shows no sections.
- **Stanford CS329A:** whether an Autumn 2026 offering exists.
- **MIT 6.1040:** whether its Fall 2026 title is "Software Design" (its site) or "Software Studio" (the EECS teaching list).
- **MIT 6.5940:** a Fall 2025 course page.
- **Stanford CS146S:** the content of its Fall 2026 slides, which sit behind a newsletter prompt.
- **MIT 6.S950** week 9 and week 10 slides, which are planned for 17 and 24 November 2026.

## Turn a conference idea into evidence

**Source snapshot: 17 October 2026.** Conference programs are useful maps of practitioners' concerns. A session title or abstract is not independent evidence that a technique improves your product. The references here were checked as official programs and abstracts; this review does not claim to have watched every recording or reproduced a speaker's results.

| Official source | Relevant published topics | A bounded course experiment |
|---|---|---|
| [AI Engineer World's Fair 2026](https://ai.engineer/worldsfair/2026), 29 June–2 July | Software factories, harnesses, context, evaluations, local AI, inference, sandboxes; listed recordings include production evals and tool selection | Compare focused context/tool exposure with the same agent's broader catalog on the same cases; keep denied-action checks in the tool runner |
| [USENIX SREcon26 Americas: The Ironies of AI²](https://www.usenix.org/conference/srecon26americas/presentation/reed), 25 March | Interaction between automation, AI and operators during incidents | Rehearse an AI-service outage: separate observed evidence from an assistant's hypothesis, keep the human release owner, and verify recovery |

Choose **one** optional experiment after the core product works. Use the [factory lab](software-factory-lab.md) for delivery evidence, [local inference](local-inference.md) for serving tradeoffs, [sandboxes](agent-sandboxes.md) for enforced permissions, or the [system walkthrough](system-walkthrough.md) for a service-failure rehearsal. You do not need a conference ticket or commercial tool subscription.

Keep a six-line research note:

1. **Source and status:** primary URL, author/date, and whether you read a syllabus, abstract, paper, docs, or watched a recording. Mark planned material as planned.
2. **Claim:** one precise behavior, with the environment and limitations in which it is supposed to hold.
3. **Hypothesis:** what should improve in your product, compared with what simpler baseline?
4. **Experiment:** fixed case IDs, component changed, permissions, budget, and a check that could disprove the claim.
5. **Observed result:** counts by slice plus failures, latency/usage where relevant; distinguish measured, simulated, and untested claims.
6. **Decision:** adopt, revise, or reject, with a remaining limitation and the exact revision.

For example, "a smaller tool catalog helps" becomes a comparison of task completion, wrong-tool attempts and usage on the same scenarios. Removing a tool the task actually needs may reduce success. A faster run with the wrong final state is a failure. For the outage rehearsal, an agent's plausible explanation is a hypothesis until a health probe, trace, or controlled reproduction supports it. Read-only investigation and permission to restart or deploy are separate authorities.

<!-- {% endraw %} -->
