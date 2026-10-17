"""Regression cases for publication failures caught by check_site.py."""

import tempfile
import unittest
from pathlib import Path

from check_site import check_site

PUBLIC = "https://example.com/lecture-notes"


class SiteLinksTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.site = Path(self.directory.name)

    def write(self, name, text=""):
        path = self.site / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")

    def test_relative_base_path_and_encoded_links(self):
        self.write(
            "lectures/one.html",
            """<h1 id="setup">Setup</h1>
            <a href="../#top">Home</a><a href="#setup">Section</a>
            <a href="https://example.com/lecture-notes/files/course%20notes.pdf">PDF</a>
            <script src="/lecture-notes/assets/course.js?v=1"></script>
            <a href="https://elsewhere.example/">External</a><a href="mailto:t@example.com">Email</a>""",
        )
        self.write(
            "index.html",
            '<h1 id="top">Home</h1><a href="lectures/one.html#setup">Start</a>',
        )
        self.write("files/course notes.pdf")
        self.write("assets/course.js")
        self.assertEqual(check_site(self.site, PUBLIC), [])

    def test_missing_file_asset_and_fragment_fail(self):
        self.write(
            "index.html",
            """<a href="gone.html">Gone</a>
            <img src="/lecture-notes/missing.png" alt="Example" width="100" height="100">
            <a href="other.html#removed-heading">Section</a>""",
        )
        self.write("other.html", '<h1 id="actual-heading">Other</h1>')
        errors = check_site(self.site, PUBLIC)
        self.assertEqual(len(errors), 3)
        self.assertTrue(any("missing anchor" in error for error in errors))

    def test_duplicate_ids_fail(self):
        self.write("index.html", '<h1 id="same">One</h1><h2 id="same">Two</h2>')
        self.assertIn("duplicate id", check_site(self.site, PUBLIC)[0])

    def test_links_cannot_escape_the_base_path(self):
        self.write("index.html", '<a href="/lectures/one.html">Missing base path</a>')
        self.assertIn("outside site base path", check_site(self.site, PUBLIC)[0])

    def test_empty_site_fails(self):
        self.assertIn("No HTML pages", check_site(self.site, PUBLIC)[0])

    def test_accessible_diagram_and_decorative_image_pass(self):
        self.write(
            "index.html",
            """<img src="assets/diagrams/map.svg" alt="Request path" width="640" height="500">
            <img src="assets/decoration.png" alt="" width="20" height="20">""",
        )
        self.write("assets/decoration.png")
        self.write(
            "assets/diagrams/map.svg",
            """<svg xmlns="http://www.w3.org/2000/svg"
            role="img" aria-labelledby="title desc" viewBox="0 0 640 500">
            <title id="title">Request path</title><desc id="desc">A request crosses a boundary.</desc></svg>""",
        )
        self.assertEqual(check_site(self.site, PUBLIC), [])

    def test_missing_image_description_and_size_fail(self):
        self.write(
            "index.html", '<img src="assets/diagrams/map.svg" width="0" height="auto">'
        )
        self.write(
            "assets/diagrams/map.svg", '<svg xmlns="http://www.w3.org/2000/svg"/>'
        )
        errors = check_site(self.site, PUBLIC)
        for expected in (
            "missing alt",
            "positive width",
            "positive height",
            "nonempty title",
            "nonempty desc",
            "viewBox",
        ):
            with self.subTest(expected=expected):
                self.assertTrue(any(expected in error for error in errors), errors)

    def test_broken_svg_and_unlinked_description_fail(self):
        self.write(
            "index.html",
            """<img src="assets/diagrams/map.svg" alt="Map" width="640" height="500">""",
        )
        self.write("assets/diagrams/map.svg", "<svg>")
        self.assertTrue(
            any("malformed SVG" in error for error in check_site(self.site, PUBLIC))
        )
        self.write(
            "assets/diagrams/map.svg",
            """<svg xmlns="http://www.w3.org/2000/svg"
            role="img" aria-labelledby="title" viewBox="0 0 640 500">
            <title id="title">Map</title><desc id="desc">Request path.</desc></svg>""",
        )
        self.assertTrue(
            any(
                "reference its desc" in error for error in check_site(self.site, PUBLIC)
            )
        )


if __name__ == "__main__":
    unittest.main()
