"""Rendered-site checks for _plugins/course_components.rb (callouts, glance, panels, home, pager,
table labels and phone cards) and for the time plan that opens every lecture lab.

Run after the Jekyll build, from the repository root:
    python3 -m unittest discover -s .github/scripts -p 'test_*.py'
SITE_DIR selects the built site (default: _site); the tests skip when it does not exist.
Every lecture 1-10 must open with one "At a glance" card; COURSE_GLANCE=optional relaxes that to
"at most one" while a lecture is being rewritten.
"""

import html as htmllib
import os
import re
import unittest
from html.parser import HTMLParser
from pathlib import Path

SITE = Path(os.environ.get("SITE_DIR", "_site"))
PLUGIN = Path(__file__).resolve().parents[2] / "_plugins" / "course_components.rb"
GLANCE_REQUIRED = os.environ.get("COURSE_GLANCE") != "optional"

CALLOUT_KINDS = {"objectives", "prereq", "predict", "explain", "checkpoint", "pitfall", "optional", "note"}
PANELS = {
    "before-you-start": "prereq",
    "learning-checkpoint": "objectives",
    "completion-check": "checkpoint",
    "stretch-goals": "optional",
    "common-pitfalls": "pitfall",
    "instructor-notes": "instructor",
}


def plugin_labels():
    """Label -> kind, read from the plugin so the test and the build share one vocabulary."""
    source = PLUGIN.read_text(encoding="utf-8")
    block = re.search(r"CALLOUT_LABELS = \{(.*?)\}\.freeze", source, re.S).group(1)
    labels = {}
    for kind, items in re.findall(r'"(\w+)" => \[(.*?)\]', block, re.S):
        for label in re.findall(r'"([^"]+)"', items):
            labels[label] = kind
    return labels


class LabelParagraphs(HTMLParser):
    """Collect paragraphs and blockquotes that open with a bold label, and whether each is top level.

    A blockquote's label is the <strong> that opens its first paragraph. "Top level" means not
    inside a list item or another blockquote, which is where the plugin recognises callouts.
    """

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []  # open li / blockquote / p elements
        self.found = []  # dicts: tag, class, top, strong_class, text
        self._pending = None  # element whose first child we are waiting for
        self._capture = None  # label being read

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        pending, self._pending = self._pending, None
        if tag == "strong" and pending is not None:
            self._capture = {**pending, "strong_class": attrs.get("class") or "", "text": ""}
        if tag in ("li", "blockquote", "p"):
            top = not any(t in ("li", "blockquote") for t in self.stack)
            if tag == "p" and pending is not None and pending["tag"] == "blockquote" and not pending.get("via_p"):
                self._pending = {**pending, "via_p": True}
            elif tag in ("p", "blockquote"):
                self._pending = {"tag": tag, "class": attrs.get("class") or "", "top": top}
            self.stack.append(tag)

    def handle_startendtag(self, tag, attrs):
        self._pending = None

    def handle_data(self, data):
        if self._capture is not None:
            self._capture["text"] += data
        elif data.strip():
            self._pending = None

    def handle_endtag(self, tag):
        if tag == "strong" and self._capture is not None:
            self.found.append(self._capture)
            self._capture = None
        if tag in ("li", "blockquote", "p") and tag in self.stack:
            while self.stack and self.stack.pop() != tag:
                pass


def main_of(html):
    match = re.search(r"<main\b[^>]*>(.*)</main>", html, re.S)
    return match.group(1) if match else ""


def plain(fragment):
    """Text of an HTML fragment as the plugin computes it: tags stripped, entities decoded, spaces
    collapsed."""
    return re.sub(r"\s+", " ", htmllib.unescape(re.sub(r"<[^>]+>", "", fragment))).strip()


def plugin_constant(name):
    return int(re.search(rf"{name} = (\d+)", PLUGIN.read_text(encoding="utf-8")).group(1))


@unittest.skipUnless(SITE.is_dir(), f"no built site at {SITE}")
class CourseComponentsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pages = {
            path.relative_to(SITE).as_posix(): path.read_text(encoding="utf-8")
            for pattern in ("index.html", "lectures/*.html", "guides/*.html")
            for path in sorted(SITE.glob(pattern))
        }
        cls.lectures = {
            name: html for name, html in cls.pages.items() if re.match(r"lectures/(0[1-9]|10)-", name)
        }

    def test_site_has_the_course_pages(self):
        self.assertIn("index.html", self.pages)
        self.assertEqual(len(self.lectures), 10, sorted(self.lectures))

    def test_plugin_vocabulary_uses_the_eight_callout_kinds(self):
        self.assertEqual(set(plugin_labels().values()), CALLOUT_KINDS)

    def test_lecture_pages_have_scope_panels_and_one_top_nav(self):
        for name, html in self.lectures.items():
            with self.subTest(page=name):
                self.assertEqual(html.count('<main class="lecture-page">'), 1)
                panels = re.findall(r'class="section-panel section-panel--(\w+)"', html)
                self.assertEqual(sorted(panels), sorted(PANELS.values()))
                for section, kind in PANELS.items():
                    pattern = rf'<h2 id="{section}".*?</h2><div class="section-panel section-panel--{kind}">'
                    self.assertRegex(html, re.compile(pattern, re.S))
                self.assertEqual(html.count('<p class="page-nav">'), 1)

    def test_lecture_glance_cards(self):
        for name, html in self.lectures.items():
            with self.subTest(page=name):
                count = html.count('<blockquote class="glance">')
                self.assertLessEqual(count, 1, "one At a glance card per lecture")
                if GLANCE_REQUIRED:
                    self.assertEqual(count, 1, "every lecture opens with an At a glance card")
                    self.assertIn('<p class="glance-title"><strong>At a glance</strong></p>', html)
        if not GLANCE_REQUIRED:
            self.skipTest("COURSE_GLANCE=optional: the At a glance card is not required")

    def test_lecture_labs_open_with_the_time_plan(self):
        """Every lab starts with one sentence ending "Plan your time:" and a list that runs from
        "Core today:" to "Extension (optional):"; any item between names a later time."""
        for name, html in self.lectures.items():
            with self.subTest(page=name):
                lab = html.partition('<h2 id="hands-on-lab"')[2].partition("</h2>")[2]
                match = re.match(r"\s*<p>((?:(?!</p>).)*)</p>\s*<ul>((?:(?!</ul>).)*)</ul>", lab, re.S)
                self.assertIsNotNone(match, "the lab opens with a sentence and the time-plan list")
                self.assertTrue(match.group(1).endswith("Plan your time:"), match.group(1)[-200:])
                labels = re.findall(r"<li><strong>([^<]+)</strong>", match.group(2))
                self.assertGreaterEqual(len(labels), 2, labels)
                self.assertEqual(labels[0], "Core today:")
                self.assertEqual(labels[-1], "Extension (optional):")
                for label in labels[1:-1]:
                    self.assertRegex(label, r"^(Before |During |May finish )")

    def test_top_level_labels_become_callouts(self):
        labels = plugin_labels()
        for name, html in self.pages.items():
            parser = LabelParagraphs()
            parser.feed(main_of(html))
            for item in parser.found:
                kind = labels.get(item["text"])
                if not kind:
                    continue
                with self.subTest(page=name, label=item["text"]):
                    if item["top"]:
                        self.assertIn(f"callout callout--{kind}", item["class"])
                        self.assertEqual(item["strong_class"], "callout-label")
                    else:
                        self.assertNotIn("callout", item["class"], "nested labels stay plain")

    def test_no_unclassed_top_level_predict_first(self):
        for name, html in self.pages.items():
            parser = LabelParagraphs()
            parser.feed(main_of(html))
            for item in parser.found:
                if item["text"] == "Predict first:" and item["top"] and item["tag"] == "p":
                    with self.subTest(page=name):
                        self.assertIn("callout--predict", item["class"])

    def test_callout_kinds_are_known_and_labelled(self):
        for name, html in self.pages.items():
            with self.subTest(page=name):
                kinds = set(re.findall(r'class="callout callout--([\w-]+)"', html))
                self.assertLessEqual(kinds, CALLOUT_KINDS)
                opened = len(re.findall(r'class="callout callout--', html))
                self.assertEqual(html.count('class="callout-label"'), opened)

    def test_theme_styles_have_a_release_fingerprint(self):
        for name, html in self.pages.items():
            styles = re.findall(r'href="([^" ]*/assets/css/just-the-docs-(?:default|head-nav)\.css[^" ]*)"', html)
            with self.subTest(page=name):
                self.assertEqual(len(styles), 2)
                for href in styles:
                    self.assertRegex(href, r"\.css\?v=[0-9a-f]{12}$")

    def test_home_page_hooks(self):
        html = self.pages["index.html"]
        for hook in ('<div class="home-hero">', '<ul class="home-facts">', '<p class="home-actions">',
                     '<ol class="start-path">', '<table class="schedule stack">', '<table class="deadlines stack">'):
            with self.subTest(hook=hook):
                self.assertEqual(html.count(hook), 1)
        hero = re.search(r'<div class="home-hero">(.*?)<p class="home-actions">', html, re.S)
        self.assertIsNotNone(hero)
        self.assertEqual(hero.group(1).count("<h1"), 1, "the page title sits inside the hero")
        self.assertEqual(html.count("<h1"), 1)
        self.assertNotIn('class="pager"', html, "the home page has no previous/next pager")

    def test_home_tables_keep_the_columns_course_js_reads(self):
        html = self.pages["index.html"]
        for table, columns in (("schedule", ["#", "Date", "Focus", "Deliverable"]),
                               ("deadlines", ["Assignment", "Deadline"])):
            with self.subTest(table=table):
                body = re.search(rf'<table class="{table}\b[^"]*">(.*?)</table>', html, re.S)
                self.assertIsNotNone(body)
                headers = [re.sub(r"<[^>]+>", "", cell).strip()
                           for cell in re.findall(r"<th\b[^>]*>(.*?)</th>", body.group(1), re.S)]
                self.assertEqual(headers[:len(columns)], columns)

    def test_tables_name_every_cell_and_stack_from_three_columns(self):
        """Every body cell carries its column name (data-label, the header text); a table with
        three or more columns has the class "stack", which phones show as labelled cards; and
        "stack--numbered" marks exactly the stacked tables whose first cells are all numbers."""
        minimum = plugin_constant("STACK_MIN_COLUMNS")
        self.assertEqual(minimum, 3)
        for name, html in self.pages.items():
            tables = re.findall(r"<table\b([^>]*)>(.*?)</table>", main_of(html), re.S)
            for index, (attrs, inner) in enumerate(tables):
                with self.subTest(page=name, table=index):
                    match = re.search(r'class="([^"]*)"', attrs)
                    classes = match.group(1).split() if match else []
                    head = re.search(r"<thead>(.*?)</thead>", inner, re.S)
                    self.assertIsNotNone(head, "every table needs a header row (it names the card fields)")
                    headers = [plain(h) for h in re.findall(r"<th\b[^>]*>(.*?)</th>", head.group(1), re.S)]
                    self.assertEqual("stack" in classes, len(headers) >= minimum, headers)
                    firsts = []
                    for row in re.findall(r"<tr>(.*?)</tr>", inner.partition("<tbody>")[2], re.S):
                        cells = re.findall(r"<td\b([^>]*)>(.*?)</td>", row, re.S)
                        for column, (cell_attrs, content) in enumerate(cells):
                            label = re.search(r'data-label="([^"]*)"', cell_attrs)
                            self.assertIsNotNone(label, f"cell without data-label: {content[:60]}")
                            expected = headers[column] if column < len(headers) else ""
                            self.assertEqual(htmllib.unescape(label.group(1)), expected)
                        if cells:
                            firsts.append(plain(cells[0][1]))
                    numbered = (len(headers) >= minimum and headers[0] not in ("", "#") and bool(firsts)
                                and all(re.fullmatch(r"\d{1,3}", text) for text in firsts))
                    self.assertEqual("stack--numbered" in classes, numbered, firsts[:3])

    def test_pager_on_lecture_pages(self):
        for name, html in self.pages.items():
            if not name.startswith("lectures/"):
                continue
            with self.subTest(page=name):
                pager = re.search(r'<nav class="pager"[^>]*>(.*?)</nav>', html, re.S)
                self.assertIsNotNone(pager, "lectures end with nav.pager")
                links = re.findall(r'<a class="pager-(prev|next)"', pager.group(1))
                self.assertTrue(links)
                self.assertEqual(len(links), len(set(links)))


if __name__ == "__main__":
    unittest.main()
