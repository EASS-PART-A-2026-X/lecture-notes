# Updating the course site

Keep the Markdown useful both on GitHub and on the website. Follow the existing course requirements and dates; verify changes to technical guidance against official documentation. Never commit credentials or student information.

## Preview locally

Use Ruby 3.4, Bundler 2.6.9 (from `Gemfile.lock`), Node.js 18 or newer, and uv with Python 3.12 or newer available:

```bash
bundle install
bundle exec jekyll serve
```

Open <http://127.0.0.1:4000/lecture-notes/>. The configured `url` and `baseurl` match GitHub Pages; keep the base path when testing links and assets.

## Verify before opening a PR

```bash
JEKYLL_ENV=production bundle exec jekyll build --strict_front_matter
node --test .github/scripts/test_search.cjs
uv run --locked .github/scripts/check_examples.py
python3 .github/scripts/check_compose.py
docker build -f .github/examples/Dockerfile -t eass-course-checkpoints:local .
docker run --rm --network none --cap-drop ALL --security-opt no-new-privileges --memory 1g --cpus 2 --pids-limit 128 eass-course-checkpoints:local
uv run .github/scripts/build_pdf.py install
uv run .github/scripts/build_pdf.py _site https://eass-part-a-2026-x.github.io/lecture-notes
python3 -m unittest discover -s .github/scripts -p 'test_*.py'
python3 .github/scripts/check_site.py _site https://eass-part-a-2026-x.github.io/lecture-notes
```

The example checker extracts the complete Lecture 2 API, Lecture 3 persistence, and Lecture 6 AI-service code and tests directly from Markdown into temporary projects. It follows the printed continuation/import edits, also extracts the standalone Lecture 9 grader clinic and runs all 34 tests, lint, and formatting, then removes the projects. It does not reconstruct later partial-file excerpts or measure real-model quality. Python 3.14 and the committed script lockfile make the check repeatable; update dependencies deliberately with `uv lock --script .github/scripts/check_examples.py --upgrade`, then rerun the checker and review API changes against official documentation. Never make a broken example pass by silently rewriting its behavior in the checker.

The Compose checker parses the actual Lecture 8 YAML and validates its topology without starting services or printing resolved environment values. The verification image copies only the three complete lecture examples, the grader clinic, and their checker/lockfile, prepares dependencies during build, and runs the checks offline as a non-root user. This does not reconstruct the later partial application or replace the student product’s full Compose/browser/persistence checks.

The PDF must be built before the link check because every page links to it. The checker makes no network requests: it verifies local destinations, heading fragments, assets and duplicate IDs. Check changed external links separately in their official source.

The rendered search-handler tests use Node.js's built-in test runner (Node 18 or newer). A small Jekyll hook guards a null focus target in Just the Docs 0.12.0 and adds a content fingerprint to its script URL, so refreshed pages fetch the corrected asset. It preserves the theme's search behavior and fails the build if the expected handler changes; review and remove the compatibility guard when upgrading to a theme that fixes this upstream.

For content edits, check the previous/next lecture links and the collapsible section list. Keep section links in sync when renaming a heading. For UI edits, check desktop and a narrow mobile viewport, keyboard focus, the mobile menu, search, table scrolling and a quiz disclosure. Keep tables scrollable without creating horizontal overflow on the whole page. Lecture section links, quiz disclosures and course text must remain usable without JavaScript; the small course script only adds keyboard access to overflowing tables.

Open a focused PR with the problem, resulting behavior and checks run. Pull requests build the site and PDF and check internal links. Only `main` publishes to GitHub Pages. Coordinate with other agents by fetching the latest `main` before starting and before finalizing your branch; never overwrite their work.
