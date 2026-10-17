# Engineering studio: from a request to a safe change

<!-- {% raw %} -->

[Course home](../README.md) · [Learning map](learning-map.md) · [Engineering foundations](engineering-foundations.md) · [System walkthrough](system-walkthrough.md)

**For third-year software engineering students.** A useful professional outcome is the ability to join an existing repository, understand a user problem, ship a small verified change, and explain its operational consequences. Coding assistants can help at every stage; you still own the decisions and evidence.

These are formative studios for the existing product and clinics. Pick the activity that addresses your current gap. The database extension is optional; accounts, extra infrastructure and new submissions are not required. Assignment rules and dates remain in the course README.

<details markdown="1" class="lecture-toc">
<summary>On this page</summary>

- [What professional readiness looks like](#what-professional-readiness-looks-like)
- [One change request across the semester](#one-change-request-across-the-semester)
- [Read an unfamiliar repository](#read-an-unfamiliar-repository)
- [Specify and review a small change](#specify-and-review-a-small-change)
- [Lab: private records and concurrent edits](#lab-private-records-and-concurrent-edits)
- [Evolve data without losing it](#evolve-data-without-losing-it)
- [Measure and operate the user journey](#measure-and-operate-the-user-journey)
- [Check your understanding](#check-your-understanding)
- [Show the work in an individual explanation](#show-the-work-in-an-individual-explanation)
- [Evidence and further reading](#evidence-and-further-reading)

</details>

## What professional readiness looks like

| Capability | Practice in this course | Evidence you can explain |
|---|---|---|
| Turn a need into a contract | Lectures 1–2: narrow user story, examples, boundaries | Acceptance/rejection cases with observable results |
| Read and change existing code | Lectures 2–3 and upstream work | Request path, reproduced fault, small diff and regression test |
| Preserve state and authority | Lectures 3, 7, 10; database lab below | Data owner, permitted caller, transaction and stale-write outcome |
| Build an inclusive user flow | Lectures 4–5 | Labels, keyboard use, loading/error recovery and one automated journey |
| Use and build AI responsibly | Lectures 1, 6, 9 and agent guides | Delegation boundary, enforced tools/budgets, inspected failures and evals |
| Reason about distributed systems | Lectures 7–9 | Service contract, timeout/retry policy, unknown outcomes and recovery |
| Deliver reproducibly | Lectures 8, 10 and clinics | Clean clone, locks/configuration, Compose, checks and release evidence |
| Collaborate and communicate | Weekly PRs and clinics | Review rationale, respectful replies, design tradeoffs and authorship |

This course develops a slice of professional practice; it does not replace databases, algorithms, operating systems, networks, security or software design courses. Revisit those foundations when a system behavior is surprising. Fast code generation cannot substitute for understanding a transaction, HTTP boundary or failing test.

## One change request across the semester

**Original studio scenario:** “When two people edit the same private recipe, one person's changes disappear. Sometimes a colleague can open a recipe they should not see.” Use synthetic users Alice and Bob, never real student data.

1. **Clarify:** Which records are private? May anyone share them? What should a stale editor see? Who establishes identity? What happens if the save response is lost?
2. **Specify:** The owner can read/update; another user receives the same not-found outcome as an absent record; a save carries the version originally read; a stale save preserves the current data and asks the user to reload/compare.
3. **Partition:** Owner/non-owner/absent record; current/stale version; valid/invalid title; two simultaneous writers; missing verified identity. A schema-valid request is not necessarily permitted.
4. **Implement:** Check authority and version in the actual database mutation. Keep ownership outside user-editable fields. Run the small counterexample before and after the repair.
5. **Integrate:** If adding an HTTP adapter, define status/body/UI behavior, authenticated identity propagation and contract compatibility. Version conflicts are not automatically retried as the original write.
6. **Release:** Rehearse migration, retained-data checks and recovery in a disposable clone. Record the exact revision and observed outcomes.

An illustrative decision record has five short fields: **context, options, decision, consequences, reconsider when**. For example: choose one backend-owned SQLite store for this small product; use an atomic version predicate to reject stale edits; accept limited write concurrency; reconsider storage when measurements or operating requirements justify it. Separate services add network and release obligations; they do not improve a design merely by increasing the service count.

## Read an unfamiliar repository

A 20-minute exercise for upstream work or a partner's product:

- Read its README, contribution/AI policy and test commands. Identify the entry point, configuration and data owner before editing.
- Trace one small user action through route → domain function → storage/client → response. Sketch it in five boxes; distinguish a call inside a process from an HTTP call.
- Run one relevant check and reproduce one reported symptom with synthetic input. Record expected versus observed behavior; separate facts from an assistant's guesses.
- Locate the smallest responsible component, propose a change and a regression check, and ask the repository's maintainer-facing questions in your own words.

Ask an assistant to propose a reading order or explain a function, then verify each claim against the actual code and command output. Do not send secrets or private data to a tool. Use a worktree when isolating edits helps; it does not isolate execution permissions.

## Specify and review a small change

Keep one behavior change reviewable. A useful local work order is:

```text
Problem: a stale recipe editor overwrites a newer save.
Acceptance: one version-1 update wins; another version-1 update conflicts.
Authority: only the verified owner may read or update this recipe.
Scope: backend storage boundary and its tests; preserve existing fields.
Checks: permitted/denied access, stale write, real concurrent writers.
Evidence: observed failing case, final commit, test command and result.
```

Before writing code, a partner proposes a counterexample. After writing it, review correctness, design, complexity, meaningful tests, naming and relevant documentation. Label feedback as required, optional or a question, and explain its consequence: “Removing the owner predicate lets Bob alter Alice's record; keep the predicate and show a denied-write test.” A reviewer is not required to rewrite the author's implementation.

**Refactoring** changes structure while preserving behavior. First establish characterization tests around existing behavior; then refactor in a separate small step from the behavior fix. Coverage measures execution, not the strength of assertions. A test that fails when the owner predicate is removed supplies stronger evidence for this risk than a larger coverage percentage alone.

## Lab: private records and concurrent edits

**Optional, 35–45 minutes after Lecture 3, or a clinic station.** This is a standalone storage-boundary exercise, not a replacement for the course's SQLModel API. It uses Python 3.12+ and the standard-library SQLite module, with no server or model. Run it locally during edits; the course verification image also runs the printed files offline in Linux. Use Compose when testing the actual separate services, not for these two in-process files.

Authentication establishes identity; authorization checks that identity against an action and resource. The `subject` argument below is assumed to come from a **trusted, already verified identity layer**. Passing `"alice"` in a test is fixture setup. In a real HTTP adapter, a body, query parameter, arbitrary header or model-generated tool argument must not establish the caller's identity. This lab implements no login, credential verification or network access control.

The database mutation includes both `owner = ?` and `version = ?`. SQLite serializes writes; the conditional mutation ensures only one update starting from version 1 can win. A check-then-write sequence without the version in the mutation can still lose updates. A timeout or unavailable database is a different failure and must not be mislabeled as a version conflict.

Read the race as a sequence; either editor may win:

| Step | Editor A | Backend-owned record | Editor B |
|---|---|---|---|
| Read | Receives version 1 | Title Hummus, version 1 | Receives version 1 |
| First save | Sends title A, expected version 1 | Conditional update commits title A, version 2 | Still holds version 1 |
| Second save | Has a successful save | Expected version 1 no longer matches; no overwrite | Receives conflict; draft retained in a suitable UI |
| Reconcile | — | Current version remains authoritative | Reloads, compares and deliberately resubmits or cancels |

### Storage boundary

Create `store.py` in an empty scratch folder:

```python
# store.py
import sqlite3
from contextlib import contextmanager


class NotFound(Exception):
    pass


class Conflict(Exception):
    pass


@contextmanager
def database(path):
    connection = sqlite3.connect(path, timeout=5, autocommit=False)
    try:
        with connection:  # commit on success; roll back on exception
            yield connection
    finally:
        connection.close()  # the transaction context does not close it


def prepare(path):
    with database(path) as connection:
        connection.execute(
            "CREATE TABLE IF NOT EXISTS recipes ("
            "id INTEGER PRIMARY KEY, owner TEXT NOT NULL, "
            "title TEXT NOT NULL, version INTEGER NOT NULL CHECK (version > 0))"
        )
        connection.executemany(
            "INSERT OR IGNORE INTO recipes VALUES (?, ?, ?, ?)",
            [(1, "alice", "Hummus", 1), (2, "bob", "Soup", 1)],
        )


def require_subject(subject):
    if not isinstance(subject, str) or not subject.strip():
        raise PermissionError("Verified identity required")


def read(path, subject, recipe_id):
    require_subject(subject)
    with database(path) as connection:
        row = connection.execute(
            "SELECT title, version FROM recipes WHERE id = ? AND owner = ?",
            (recipe_id, subject),
        ).fetchone()
        if row is None:
            raise NotFound("Recipe not found")
        return row


def rename(path, subject, recipe_id, version, title):
    require_subject(subject)
    if type(version) is not int or version < 1:
        raise ValueError("Positive integer version required")
    if not isinstance(title, str) or not 1 <= len(title.strip()) <= 120:
        raise ValueError("Title must contain 1 to 120 characters")
    with database(path) as connection:
        cursor = connection.execute(
            "UPDATE recipes SET title = ?, version = version + 1 "
            "WHERE id = ? AND owner = ? AND version = ?",
            (title.strip(), recipe_id, subject, version),
        )
        if cursor.rowcount == 1:
            return version + 1
        exists = connection.execute(
            "SELECT 1 FROM recipes WHERE id = ? AND owner = ?",
            (recipe_id, subject),
        ).fetchone()
        if exists is None:
            raise NotFound("Recipe not found")
        raise Conflict("Recipe changed; reload and compare")
```

`prepare` initializes synthetic fixtures without overwriting an existing row; it is not a schema migration tool. Each call opens and closes its own connection. Transactions commit before a successful call returns. Parameters bind values as data rather than constructing SQL from strings. The domain policy is deliberately simple ownership; a real shared/team product needs its own policy for sharing, roles and revoked access.

### Ten checks, including a real race

Create `test_store.py` alongside `store.py`:

```python
# test_store.py
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Barrier

from store import Conflict, NotFound, prepare, read, rename


class StoreChecks(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.path = Path(folder.name) / "studio.db"
        prepare(self.path)

    def test_owner_can_read(self):
        self.assertEqual(read(self.path, "alice", 1), ("Hummus", 1))

    def test_non_owner_cannot_read(self):
        with self.assertRaises(NotFound):
            read(self.path, "bob", 1)

    def test_non_owner_cannot_write(self):
        with self.assertRaises(NotFound):
            rename(self.path, "bob", 1, 1, "Changed")
        self.assertEqual(read(self.path, "alice", 1), ("Hummus", 1))

    def test_missing_record_has_same_outcome(self):
        with self.assertRaises(NotFound):
            read(self.path, "alice", 999)
        with self.assertRaises(NotFound):
            rename(self.path, "alice", 999, 1, "Changed")

    def test_success_commits_and_advances_version(self):
        self.assertEqual(rename(self.path, "alice", 1, 1, "Tahini"), 2)
        self.assertEqual(read(self.path, "alice", 1), ("Tahini", 2))
        self.assertEqual(read(self.path, "bob", 2), ("Soup", 1))

    def test_stale_save_preserves_current_data(self):
        rename(self.path, "alice", 1, 1, "First save")
        with self.assertRaises(Conflict):
            rename(self.path, "alice", 1, 1, "Stale save")
        self.assertEqual(read(self.path, "alice", 1), ("First save", 2))

    def test_invalid_input_does_not_mutate(self):
        for version, title in ((True, "OK"), (0, "OK"), (1, " "), (1, "x" * 121)):
            with (
                self.subTest(version=version, title=title),
                self.assertRaises(ValueError),
            ):
                rename(self.path, "alice", 1, version, title)
        self.assertEqual(read(self.path, "alice", 1), ("Hummus", 1))

    def test_sql_looking_title_is_only_data(self):
        title = "'); DROP TABLE recipes; --"
        rename(self.path, "alice", 1, 1, title)
        self.assertEqual(read(self.path, "alice", 1), (title, 2))
        self.assertEqual(read(self.path, "bob", 2), ("Soup", 1))

    def test_missing_identity_is_denied(self):
        with self.assertRaises(PermissionError):
            read(self.path, "", 1)
        with self.assertRaises(PermissionError):
            rename(self.path, None, 1, 1, "Changed")

    def test_two_writers_have_exactly_one_winner(self):
        version = read(self.path, "alice", 1)[1]
        barrier = Barrier(2)

        def writer(title):
            barrier.wait(timeout=5)
            try:
                rename(self.path, "alice", 1, version, title)
                return "saved"
            except Conflict:
                return "conflict"

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(writer, ["Editor A", "Editor B"]))
        self.assertCountEqual(results, ["saved", "conflict"])
        title, final_version = read(self.path, "alice", 1)
        self.assertIn(title, ["Editor A", "Editor B"])
        self.assertEqual(final_version, 2)
```

Run `python3 -m unittest -v test_store` in that folder. Expected: **10 tests pass**. The two workers use separate real connections to the same temporary file; the test does not assume which editor wins. No paid calls, host database, shared user data or sleep-based race timing is involved.

**Prove the checks matter:** in this scratch copy, remove `AND owner = ?` and its matching parameter from the read query. The denied-read test must fail. Restore it. Then remove `AND version = ?` and its matching parameter from the update query; the stale-save and race checks must fail. Restore it. This is an example of mutation testing: deliberately break a property to see whether the relevant check detects it.

### Connect the lab to an HTTP product

Map `NotFound` to the same `404` for missing and inaccessible records under this policy. Map `Conflict` to a documented `409` with actionable UI text. Preserve the user's unsaved draft; fetch the current record and let them compare before submitting against its new version. If instead designing with HTTP `ETag`/`If-Match`, define and test that precondition contract (typically `412` when it fails); do not mix the two protocols accidentally.

Keep the verified subject in trusted request/dependency context. The AI service may suggest an edit; the backend still authorizes and commits it. Do not let the model choose which authenticated user it represents. A shared service token identifies a service caller; it does not by itself establish the end user's right to a particular record.

These checks establish the storage contract in the tested SQLite runtime. They do not test login/session expiry, HTTP identity propagation, a browser conflict screen, PostgreSQL concurrency, a distributed transaction or every access policy. Add adapter and product-flow tests when integrating. Version checks prevent this overwrite pattern; they do not deduplicate a retried create or tell a caller whether a response lost after commit actually succeeded.

## Evolve data without losing it

For an optional schema change such as adding a recipe description, rehearse this sequence on **disposable synthetic data**:

| Stage | Question to answer before proceeding |
|---|---|
| Preserve and restore | Can I restore a database backup into a separate scratch location and verify the expected records? A volume alone is not a backup |
| Expand | Can old and new code tolerate the added nullable/defaulted field? What schema version is installed? |
| Backfill | Can existing records be updated in bounded batches with validation and a restartable plan? |
| Switch | Can the new code read/write the field without breaking old clients during the transition? |
| Contract | Only after dependent code/data is ready, can the old representation or constraint be removed safely? |
| Recover | Is rolling back code compatible with the current data? If restoring a backup, which newer writes would be lost? |

`create_all()` creates missing tables; it does not safely evolve populated ones. A generated migration is a candidate to review, not permission to execute it against valuable data. Renames, data transformations and destructive changes deserve particular attention. SQLite has different migration capabilities from other engines. No Alembic installation is required here; if using it, follow its current documentation, inspect generated SQL and test the upgrade on a restored copy.

Never copy a live database file and assume a consistent backup while writes continue; use the database's supported backup method or a documented safe stop/snapshot procedure. SQLite provides a backup API. Keep the instructor's required persistence/restart checks, and add a restore rehearsal when your product needs it.

## Measure and operate the user journey

A product is experienced as a journey, not a collection of healthy containers. Define an observation window, eligible events and a denominator before reporting a number. For example: “On 20 synthetic attempts through the fake-model user flow, 19 reached the expected persisted state.” Include the failed attempt; report this as a small local observation, not production availability or real-model accuracy.

- **Performance:** fix the dataset, environment and concurrent-user count. Measure end-to-end latency plus service stages; distinguish cold start from warm requests. Inspect slow database queries and indexes with representative data before adding a cache. A tiny sample's p95 is unstable; preserve raw timings and sample size.
- **User experience:** complete the core action with keyboard only, visible focus and useful labels. Show loading and error states. Check whether the user can recover without losing a draft, including the conflict scenario above.
- **Operations:** state what `/health` actually establishes. Choose useful status/duration/error/usage signals and a request identifier; exclude credentials and private text. Logs support a hypothesis; a controlled reproduction tests it.
- **Recovery:** follow the release runbook from a clean clone, stop the AI service, observe the documented response/UI, restore it and check retained data. Choose a release owner and a rollback/roll-forward plan before an urgent change.

Work in small batches and measure outcomes. Number of generated lines, prompt length, agent count, test count and PR count alone are not evidence of product quality. The required three accepted upstream PRs demonstrate contribution practice; explain each change's actual value and your own verification.

## Check your understanding

<details markdown="1" class="studio-quiz">
<summary>Can an HTTP client claim to be Alice by passing subject="alice"?</summary>

Not in a correctly integrated product. The fixture calls a storage function directly. The HTTP adapter must obtain identity from its verified authentication context and must not accept a client-selected subject as proof of identity. Ownership checks depend on that trust boundary; this storage lab does not test the identity layer.

</details>

<details markdown="1" class="studio-quiz">
<summary>Why include the expected version in UPDATE rather than only checking it beforehand?</summary>

Another writer can commit between an earlier check and a later unconditional update. The predicate makes matching the expected version a condition of the mutation itself. After one writer advances the version, the stale writer changes zero rows. The race test checks this property with separate real connections.

</details>

<details markdown="1" class="studio-quiz">
<summary>Should a conflict handler fetch the latest version and retry the old edit automatically?</summary>

That can overwrite a change the user has not reviewed. Keep the draft, show the current record, and let the user reconcile or cancel according to the product contract. Distinguish a stale-write conflict from a transport failure and from a response lost after commit.

</details>

## Show the work in an individual explanation

A five-minute rehearsal with a partner:

1. Explain the user problem and acceptance criteria without opening the code.
2. Trace the changed request, state owner and permission boundary through the implementation.
3. Show one meaningful failure before the repair and the passing regression check afterwards.
4. Defend one tradeoff and name one thing the tests do not prove.
5. Hand over the exact run command, revision and brief AI-use note so the partner can reproduce the result.

An assistant may draft test cases or critique the diff. Predict the result first, then inspect the actual behavior. If you cannot explain a generated function, slow down and trace it with a small input before accepting more generated code. Use these rehearsals in Meetings 11–12; they do not add a new oral-exam policy or grading rubric.

## Evidence and further reading

Reviewed **17 October 2026**. These are primary sources for the practices used here, not a ranking of employers, tools or courses. The scenario, code, synthetic data and studio activities are original.

- [DORA, March 2026](https://dora.dev/insights/balancing-ai-tensions/) discusses verification, small batches, production readiness and maintaining expertise. Its observational findings do not guarantee individual productivity.
- Google's [review criteria](https://google.github.io/eng-practices/review/reviewer/looking-for.html) and [review comments](https://google.github.io/eng-practices/review/reviewer/comments.html) inform the review exercise; [OWASP API1:2023](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/) motivates tested record authorization.
- [Python 3.14 SQLite](https://docs.python.org/3.14/library/sqlite3.html), [SQLite transactions](https://www.sqlite.org/lang_transaction.html) and [UPDATE](https://www.sqlite.org/lang_update.html) document the lab's database behavior. [Alembic limitations](https://alembic.sqlalchemy.org/en/latest/autogenerate.html) and [MDN conditional requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Conditional_requests) support the optional migration and HTTP designs.
- The [MIT/Stanford references and conference-to-experiment routine](learning-map.md#teaching-references) connect specifications, evaluation and engineering judgment.

---

[Course home](../README.md) · [Learning map](learning-map.md) · [Lecture 3](../lectures/03-persistence-and-first-pr.md) · [Lecture 10](../lectures/10-ci-security-release.md)
<!-- {% endraw %} -->
