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
uv run .github/scripts/build_pdf.py install
uv run .github/scripts/build_pdf.py _site https://eass-part-a-2026-x.github.io/lecture-notes
python3 -m unittest discover -s .github/scripts -p 'test_*.py'
python3 .github/scripts/check_site.py _site https://eass-part-a-2026-x.github.io/lecture-notes
```

The PDF must be built before the link check because every page links to it. The checker makes no network requests: it verifies local destinations, heading fragments, assets and duplicate IDs. Check changed external links separately in their official source.

The rendered search-handler tests use Node.js's built-in test runner (Node 18 or newer). A small Jekyll hook guards a null focus target in Just the Docs 0.12.0. It preserves the theme's search behavior and fails the build if the expected handler changes; review and remove the hook when upgrading to a theme that fixes this upstream.

For content edits, check the previous/next lecture links and the collapsible section list. Keep section links in sync when renaming a heading. For UI edits, check desktop and a narrow mobile viewport, keyboard focus, the mobile menu, search, table scrolling and a quiz disclosure. Keep tables scrollable without creating horizontal overflow on the whole page. Lecture section links, quiz disclosures and course text must remain usable without JavaScript; the small course script only adds keyboard access to overflowing tables.

Open a focused PR with the problem, resulting behavior and checks run. Pull requests build the site and PDF and check internal links. Only `main` publishes to GitHub Pages. Coordinate with other agents by fetching the latest `main` before starting and before finalizing your branch; never overwrite their work.
