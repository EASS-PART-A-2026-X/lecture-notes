# Student setup: your laptop, GitHub, and one AI tool

<!-- {% raw %} -->

[Course home](../README.md) · [Learning map](learning-map.md) · [Models and AI literacy](models-and-ai-literacy.md) · [Lecture 1](../lectures/01-environment-git-docker-ai.md)

**Start here before the first class.** Complete the development-tool checks first. Then choose one assistant you can access. The course requires no paid AI subscription, model API key, GPU, or particular editor.

<details markdown="1" class="lecture-toc">
<summary>On this page</summary>

- [Choose a simple route](#choose-a-simple-route)
- [Install the development tools](#install-the-development-tools)
- [Connect Git and GitHub](#connect-git-and-github)
- [Choose and configure one assistant](#choose-and-configure-one-assistant)
- [Do the same first task in any tool](#do-the-same-first-task-in-any-tool)
- [Permissions, privacy, and cost](#permissions-privacy-and-cost)
- [When setup fails](#when-setup-fails)
- [Ready-for-class checklist](#ready-for-class-checklist)

</details>

## Choose a simple route

| Your situation | Start with |
|---|---|
| You want a familiar editor | VS Code with Python support; optionally add GitHub Copilot or the Codex extension |
| You already use Cursor | Keep Cursor; open the course product folder and use its integrated terminal |
| You prefer terminal agents | Add Codex CLI, Gemini CLI, Claude Code, or OpenCode after the basic tools work |
| You only have a browser assistant | Use ChatGPT, Gemini, Claude, or Z.ai chat to discuss a small supplied example; apply and test edits yourself |
| You have no assistant access or your quota runs out | Follow the lecture examples manually, pair for discussion, and run the same local checks |

An **editor** is where you work with files. A **chat product** is an interface for asking questions. A **coding agent** can inspect a workspace and use permitted tools. A **model** generates the responses. An **API provider** supplies a programmatic model service. These can be different companies and different accounts.

Choose one route first. Switching tools is optional; the expected product behavior and assessment remain the same.

## Install the development tools

Install from the linked official sources. Check installer names and publishers; keep credentials out of screenshots and prompts. You do not need to install system Python separately: uv manages the project's Python.

### Windows: one Ubuntu environment for course commands

1. Follow [Microsoft's WSL installation](https://learn.microsoft.com/en-us/windows/wsl/install). The initial command runs in an administrator **PowerShell** window:

   ```powershell
   wsl --install -d Ubuntu
   ```

2. Restart if requested, open Ubuntu, and create its Linux username/password. Password entry may show no characters. From now on, run the lecture's Bash commands in **Ubuntu**, not PowerShell.
3. Keep repositories under your Ubuntu home, such as `~/eass/recipe-box`. Avoid mixing a Windows Python environment with Linux files or running the same project from two shells.
4. Install Git and curl using Ubuntu's package manager. Install [uv](https://docs.astral.sh/uv/getting-started/installation/) and the [GitHub CLI](https://github.com/cli/cli#installation) using their Linux instructions inside Ubuntu.
5. Install [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/), enable its WSL 2 integration for your Ubuntu distribution, and keep Docker Desktop running.
6. With VS Code, use the [WSL extension](https://code.visualstudio.com/docs/remote/wsl) and open the Linux folder from Ubuntu. Confirm the editor terminal is Ubuntu too. For another editor, follow its documented WSL/remote-folder support.

### macOS

Install [Git](https://git-scm.com/downloads/mac), [uv](https://docs.astral.sh/uv/getting-started/installation/), [GitHub CLI](https://github.com/cli/cli#installation), and [Docker Desktop](https://docs.docker.com/desktop/setup/install/mac-install/). Choose the Docker installer for Apple silicon or Intel as appropriate. Open Docker Desktop and wait until its engine is ready. Run the course commands in Terminal or your editor's terminal.

### Linux

Install Git with your distribution's package manager, then [uv](https://docs.astral.sh/uv/getting-started/installation/) and [GitHub CLI](https://github.com/cli/cli#installation). Use [Docker Engine's distribution-specific instructions](https://docs.docker.com/engine/install/) and install the [Compose plugin](https://docs.docker.com/compose/install/linux/). Docker access may need administrator configuration; Docker-group membership grants substantial host privileges. Ask for help instead of changing socket permissions to world-writable.

### Check from the terminal you will actually use

```bash
pwd
uv --version
git --version
gh --version
docker --version
docker compose version
uv python install 3.14
docker run --rm hello-world
```

`pwd` prints the current directory. Version commands should print a version, not “command not found.” `hello-world` should print its greeting. Restart the terminal after installing a tool if its executable is not found. Docker images and Python downloads need network and disk space; do these before class.

An editor launcher such as `code` is convenient, not a requirement. If it is unavailable, open the product folder through the editor's File menu. Node.js is optional unless your frontend or chosen CLI needs it.

## Connect Git and GitHub

Git stores local history; GitHub hosts repositories; `gh` operates GitHub from your terminal. Signing into one AI tool does not authenticate GitHub.

1. Create your own GitHub account. Use an email you can keep accessing and enable account security offered by GitHub.
2. Set the author identity for commits. Replace both example values:

   ```bash
   git config --global user.name "Your Name"
   git config --global user.email "your-verified-email@example.com"
   gh auth login
   gh auth status
   ```

   A GitHub-provided private/noreply email is fine. Follow [`gh auth login`](https://cli.github.com/manual/gh_auth_login)'s browser flow for GitHub.com; never paste an authentication code or token into an AI chat.
3. Follow [Lecture 1's repository exercise](../lectures/01-environment-git-docker-ai.md#live-demo). Verify that your commit and practice PR appear on your own repository. Keep `.env`, databases, and `.venv` out of Git.
4. If a private product repository is used, arrange grader access through the instructor's submission instructions. Do not grant an assistant broad access to unrelated repositories.

For education benefits, GitHub's [student activation guide](https://docs.github.com/en/copilot/how-tos/copilot-on-github/set-up-copilot/enable-copilot/set-up-for-students) separates verification from activating Copilot Student. Approval may take time. Use another route while waiting; a payment page is not a course requirement.

## Choose and configure one assistant

Documentation checked **16 October 2026**. Features, model access, eligibility, and quotas vary by account and can change. Use official installers and your own account. These are setup routes, not promises of unlimited free use.

### Cursor

Follow the [Cursor quickstart](https://cursor.com/docs/get-started/quickstart): install, sign in, and open your product folder. Begin by asking it to explain the entry point. Inspect proposed edits in the diff and run the checks in the integrated terminal. Review [Privacy Mode and data handling](https://cursor.com/data-use) before supplying code. Check the current plan in your account rather than assuming student access or every model is included.

### GitHub Copilot in VS Code

Install VS Code and Python support, then follow [Copilot setup](https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-extension). Sign into the GitHub account whose entitlement you intend to use. Start with an explanation in chat; distinguish inline completion from a mode that edits files or runs commands. Review the changes yourself. The current [Free and Student plans](https://docs.github.com/en/copilot/get-started/plans) use automatic model selection; a missing manual model picker does not mean your setup failed.

### Codex

Use the official [Codex IDE extension](https://learn.chatgpt.com/docs/codex/ide) in VS Code or a supported compatible editor, or install [Codex CLI](https://learn.chatgpt.com/docs/codex/cli). Open your product folder and use the available account sign-in flow. For the CLI, run `codex` from that folder. Inspect the workspace and permissions before your first edit. Start with an explanation, then one scoped change. Account sign-in and API-key access are different routes; API billing is not required for this course.

### ChatGPT and browser chat alternatives

Follow the [ChatGPT quickstart](https://learn.chatgpt.com/docs/quickstart), or use the official [Gemini](https://gemini.google.com/), [Claude](https://claude.ai/), or [Z.ai](https://chat.z.ai/) chat product available to you. Supply a small code excerpt, file path, exact error, and desired behavior. In a plain chat without workspace tools, the assistant has only the context you provide and cannot verify your local test run. Apply the proposal locally and run the check. A chat subscription does not automatically grant API credits or another company's coding-tool subscription.

### Gemini CLI

Follow [installation](https://geminicli.com/docs/get-started/installation/) and [authentication](https://geminicli.com/docs/get-started/authentication/). If using its documented npm route, first install a supported Node.js version, then `npm install -g @google/gemini-cli`. Run `gemini` in your product folder. Personal Google-account login is one documented route; school-managed accounts can have different requirements. Inspect the applicable permissions and usage allowance. Using Gemini chat, CLI, and the Gemini API are distinct access paths.

### OpenCode and Z.ai

Check whether you use [OpenCode V1](https://opencode.ai/docs/) or [V2](https://opencode.ai/v2/docs/); their default executable name is the same, while installation packages and permission configuration differ. Follow the matching documentation, open your project, connect a supported provider, and inspect the selected model before a task. An open-source client does not make hosted inference free.

For GLM models, follow [Z.ai's OpenCode integration](https://docs.z.ai/devpack/tool/opencode). Its documented V1 route uses `opencode auth login`, the appropriate Z.ai provider, and `/models`. Check compatibility before applying it to V2. Follow the [current key-management rules](https://docs.z.ai/devpack/notice/api-key-management): newly created Standard and Coding Plan keys have different billing types. A Standard key can incur API charges even when a Coding Plan exists. Do not buy a plan to complete a lab.

### Claude Code and other assistants

Follow the [Claude Code quickstart](https://code.claude.com/docs/en/quickstart) for a supported installation and account route. Open the product directory, begin with an explanation, inspect execution permissions, and review the diff from one small change. Other assistants are also acceptable: use official setup, match instructions to the installed version, and perform the same first-task check below.

## Do the same first task in any tool

After creating Lecture 1's backend, ask:

```text
Read backend/app/main.py. Explain how GET /health reaches health().
Do not edit anything. Tell me the exact command to start this service
and the request I can send to check it. State what you have not run.
```

Run those commands yourself. Then, on a practice branch, ask for one small documentation change, read the diff, and keep or revert it with Git. A useful first session proves folder context, command location, change review, and rollback; it need not generate a whole application.

## Permissions, privacy, and cost

- Start in your product folder with the narrowest useful access. Inspect approval prompts and commands; retain control of remote publication and data deletion.
- Use synthetic examples. Do not upload credentials, grades, personal records, classmates' submissions, or private upstream code without permission.
- Read the tool's data settings. A privacy option can affect training or retention while requests still leave your laptop. Running a client locally is different from hosting the model locally.
- Keep keys out of source, prompts, screenshots, and shared session links. Use the tool's documented credential storage; configure application secrets separately in the service that needs them.
- Check the active account, selected model, allowance, and any overage setting. Stop at a quota message or billing prompt and use the manual route.
- Product tests use `TestModel` or `FunctionModel`; they do not need your editor assistant to be signed in.

## When setup fails

| Symptom | First check |
|---|---|
| Command not found | Restart the terminal; confirm installation in this OS/WSL environment |
| Docker daemon unavailable | Start Docker Desktop or the Linux service; check WSL integration |
| Git push denied | `gh auth status`, repository URL, and access rights |
| Editor sees different files from terminal | `pwd`; reopen the same Linux/product folder |
| Assistant cannot see code | Selected workspace and attached files; ask it to name the file it read |
| Wrong model or authentication error | Active account, provider, supported model ID, and key type |
| Quota exhausted | Pause model use; continue with local examples and tests |

Ask for help with [PARD](../lectures/01-environment-git-docker-ai.md#asking-for-help-the-pard-template). Redact secrets first. On a managed laptop without installation rights, contact the instructor early to arrange an approved environment. Browser chat alone cannot run the required Docker stack.

## Ready-for-class checklist

- [ ] The development-tool commands work in the terminal I will use in class.
- [ ] I can open a folder, identify the working directory, edit a file, and read a diff.
- [ ] GitHub authentication works; my repository exercise is accessible to me.
- [ ] Docker's `hello-world` runs.
- [ ] I have one assistant route or the manual fallback; I know its context and limits.
- [ ] I can explain my `/health` request and show its actual response.

<!-- {% endraw %} -->
