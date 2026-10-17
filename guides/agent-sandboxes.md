# Agent sandboxes: run tools with explicit boundaries

<!-- {% raw %} -->

[Course home](../README.md) · [Agent-driven engineering](agent-driven-development.md) · [Local inference](local-inference.md) · [Docker Compose](../lectures/08-docker-compose.md)

**Use with Lectures 1, 6, 8, and 10.** Everyone should be able to explain the boundaries. The disposable-container lab is formative; gVisor, microVMs, and managed sandbox services are optional architecture exploration. No new cloud account or infrastructure is required.

<details markdown="1" class="lecture-toc">
<summary>On this page</summary>

- [Learning checkpoint](#learning-checkpoint)
- [What a sandbox controls](#what-a-sandbox-controls)
- [Choose the right boundary](#choose-the-right-boundary)
- [Design a bounded agent run](#design-a-bounded-agent-run)
- [Disposable-container lab](#disposable-container-lab)
- [Network and model access](#network-and-model-access)
- [Review and release](#review-and-release)
- [Quick quiz](#quick-quiz)
- [Sources](#sources)

</details>

## Learning checkpoint

Explain the difference between dependency isolation, a Git worktree, containers, and execution sandboxes. Identify filesystem, network, credential, process, and resource boundaries for an agent. Demonstrate one enforced denial and state what it does **not** prove.

**Predict first:** if an agent runs in Docker with your home directory mounted writable and your provider key in the environment, which of those resources has the container actually protected from the agent?

## What a sandbox controls

A sandbox is an **enforced execution boundary** with an explicit policy. Ask what a process can read, change, connect to, execute, consume, and retain. A “safe mode” label or a prompt saying “do not touch secrets” does not answer those questions.

There are two separate attack paths: generated code can behave unexpectedly, and untrusted content can persuade an agent to call a powerful legitimate tool. Isolation limits consequences; it does not make the model's decisions correct. Validate the tool name, argument schema, target resource, user authorization, and output before continuing.

Local inference changes where model computation runs. It does not restrict a shell tool. A sandbox with outbound access can still transmit mounted data to a remote endpoint. A process without network access can still corrupt a writable workspace. Match controls to the assets and task.

## Choose the right boundary

| Mechanism | Useful property | Limit to understand |
|---|---|---|
| Python virtual environment / `uv` | Separates package dependencies | Code still runs with the user's OS permissions |
| Git branch or worktree | Separates candidate files/history for review | No OS isolation; can access other reachable files and the network |
| Development container | Repeatable development environment | Mounts, credentials, user privileges, and network may still be broad |
| Restricted container | Namespaces, resource limits, filesystem policy, capability reduction | Ordinary Linux containers share the kernel of their Linux host; configuration matters |
| OS process sandbox | Policy can restrict file/process/network operations | Coverage and defaults vary by OS and harness; inspect actual enforcement |
| [gVisor](https://gvisor.dev/docs/) | Interposes an application kernel for sandboxed containers | Different syscall compatibility and performance; requires a supported runtime setup |
| VM / [Firecracker microVM](https://firecracker-microvm.github.io/) | Guest-kernel boundary using virtualization | Host management, images, network, devices, and credentials remain responsibilities |
| Managed execution sandbox | Provider operates disposable execution environments | Verify isolation, tenancy, egress, mounts, retention, region, quotas, and billing |

Docker Desktop commonly runs Linux containers inside a Linux VM. That does not create a separate VM per ordinary container. Compose declares and coordinates containers; it does not automatically add a stronger isolation boundary. Read [Docker's security model](https://docs.docker.com/engine/security/) before treating an image as a place to execute arbitrary hostile code.

For the course, use trusted project dependencies and a disposable workspace. Running arbitrary Internet code or adversarial multi-tenant submissions requires a stronger, reviewed design than this classroom lab.

## Design a bounded agent run

Use the same plan for a coding assistant and for a product agent, adapting the allowed operations:

| Control | Coding task example | Product extraction example |
|---|---|---|
| Outcome and stopping rule | Fix one reproduced bug; stop with diff and checks | Return one validated draft or a bounded failure |
| Filesystem | One disposable checkout; export reviewed changes | No shell or repository mount needed |
| Tools | Read/edit scoped files and run selected checks | Read allowed domain tags only |
| Credentials | No production secrets or Git push credential | Only the inference credential needed for this service |
| Network | Offline checks, or narrowly brokered dependencies | Only the intended inference/domain endpoints |
| Resources | CPU/RAM/PID and wall-clock limits | Request, token, tool-call, and latency budgets |
| Retention | Remove temporary execution state; keep needed evidence | Keep only data allowed by the product's retention policy |
| Verification | Inspect final diff and rerun trusted checks | Validate shape, semantics, authorization, and result ownership |

Separate **approvals** from **enforcement**. A person approving an operation authorizes it; a sandbox limits how it can execute. If a harness offers “run outside sandbox,” accepting that route changes the protection for that operation. Inspect the actual tool's settings instead of assuming approval prompts imply containment.

Do not mount a Docker daemon socket, SSH agent, home directory, cloud credentials, or production database into a generated-code runner. Docker daemon access can confer broad host control. Use narrowly scoped, short-lived credentials only when a task truly needs them, and keep release credentials outside the candidate execution environment.

## Disposable-container lab

This lab runs a small **known script**, with no host mounts or secrets. It demonstrates specific controls, not proof against container escape. Docker must already work from Lecture 1. Commands are for the course's Linux/macOS/WSL terminal; use an instructor demonstration if local policy prevents container use.

Save this as `sandbox_probe.py` in a scratch directory:

```python
from pathlib import Path
import socket
import errno

assert not Path('/workspace').exists()  # this exercise mounts no workspace
print('PASS: no workspace is mounted')
try:
    Path('/etc/eass-probe').write_text('should not be written')
except PermissionError:
    print('PASS: unprivileged user cannot write /etc')
except OSError as exc:
    if exc.errno != 30:  # EROFS: read-only filesystem
        raise
    print('PASS: root filesystem is read-only')
else:
    raise AssertionError('unexpected write access')

Path('/tmp/eass-probe').write_text('temporary scratch')
print('PASS: designated temporary scratch is writable')
with socket.socket() as connection:
    connection.settimeout(1)
    try:
        connection.connect(('192.0.2.1', 443))  # documentation-only address
    except OSError as exc:
        if exc.errno != errno.ENETUNREACH:
            raise
        print('PASS: external IPv4 route is unavailable')
    else:
        raise AssertionError('unexpected external route')
```

Use the course image; pulling it needs network **before** the restricted process starts:

```bash
docker pull python:3.14-slim
docker run --rm -i \
  --network none --read-only --user 65534:65534 \
  --cap-drop ALL --security-opt no-new-privileges \
  --memory 256m --cpus 1 --pids-limit 64 \
  --tmpfs /tmp:rw,noexec,nosuid,size=16m,mode=1777 \
  python:3.14-slim python - < sandbox_probe.py
```

Expected output: four `PASS` lines, followed by normal exit. `--rm` removes this container after exit; the image remains cached. The floating image tag follows the course baseline; record the actual image ID/digest for reproducible evidence as discussed in Lecture 10. No host directory is mounted, and the script is supplied over standard input.

**Read the controls:** the process has an unprivileged UID, a read-only root filesystem, writable temporary scratch, no external network route for this probe, reduced Linux capabilities, and resource limits. `noexec` on `/tmp` blocks direct execution from that mount; it does not prevent an interpreter from reading a script there. Resource limits are not a wall-clock deadline; an agent runner also needs an external timeout and reliable child-process termination.

**Explain the limits:** this script observes file/network properties in this run. It does not test kernel vulnerabilities, all possible exfiltration paths, or arbitrary hostile code. `--network none` still allows loopback communication inside the container; inactive tunnel interfaces may also be listed. The probe checks a denied IPv4 route, not a fixed interface list. No published port or network bridge is added by this command.

**Controlled variation, discussion only:** what changes if you add a writable repository mount? The runner can then damage that mounted checkout despite its read-only root. Prefer a disposable copy and explicit artifact export. A worktree is useful for review, but shared Git metadata and host paths need attention before mounting it into a runner.

## Network and model access

A useful execution architecture can keep the **agent controller** outside the restricted tool runner:

```text
user → controller/harness → inference endpoint
              |
              └─ validated tool request → restricted execution sandbox
                                         → bounded result / proposed diff
              ← inspect result, enforce budgets, continue or stop
```

This lets an offline test container run without needing the model-provider key. Keep controller secrets out of the tool runner and redact logs. If tools legitimately need network access, define allowed destinations, credentials, timeouts, redirects, response-size limits, and audit evidence. Package installation is code execution too: use locked dependencies and a controlled preparation stage, then execute checks offline where feasible.

Compose's [`internal` network setting](https://docs.docker.com/reference/compose-file/networks/#internal) provides external isolation for that network; it is not a per-domain allowlist or application authorization system. A container attached to another network can have a different route. Containers sharing an allowed network may still reach each other. An unpublished model endpoint is not automatically private from peer containers.

A locally bound inference server and a container's network namespace are different places. Keep the local-request lab on the host unless you deliberately design the connection. For a shared serving machine, use authenticated access, restricted ingress, quotas, and a documented owner. Avoid giving a generated-code runner broad Internet access just so it can query a model; the controller can broker that request.

## Review and release

Treat sandbox output as a **candidate artifact**: inspect paths and diff, reject unexpected files, review dependency changes, and run trusted verification on the final revision. Keep trusted verifier definitions and acceptance criteria outside the candidate's writable scope where practical. Otherwise, an agent can make CI green by weakening the check rather than fixing the behavior.

A passing test does not authorize a push, merge, deployment, or data mutation. Use a separate release stage with the appropriate human/course authorization and scoped credentials. Check destination and revision, record what happened, and retain a rollback path. This is the execution boundary behind the [software factory lab](software-factory-lab.md).

**Completion evidence:** draw your agent/controller/tool boundaries, list what each can read/write/contact, run the known probe or analyze its expected results, and identify one remaining risk. Show which check and person decide that a candidate is ready for release.

## Quick quiz

<details markdown="1">
<summary>Q1. Does a virtual environment or Git worktree sandbox generated Python?</summary>

No. They isolate dependencies or candidate changes, not the process's OS authority. Filesystem/network restrictions need runtime enforcement.

</details>

<details markdown="1">
<summary>Q2. Can a read-only container change a writable host mount?</summary>

Yes, if that mount is writable and permissions allow it. Read-only root does not make every separately mounted path read-only.

</details>

<details markdown="1">
<summary>Q3. Does Docker Compose mean arbitrary agent code is safe?</summary>

No. Compose configures containers and connectivity. Assess the runtime, mounts, privileges, secrets, network, resource limits, and threat model.

</details>

## Sources

Reviewed **17 October 2026**: [Docker Engine security](https://docs.docker.com/engine/security/), [container-run controls](https://docs.docker.com/reference/cli/docker/container/run/), [Compose networks](https://docs.docker.com/reference/compose-file/networks/), [gVisor architecture](https://gvisor.dev/docs/), and [Firecracker](https://firecracker-microvm.github.io/). The lab is an original classroom exercise; optional infrastructure is not required course work.

<!-- {% endraw %} -->
