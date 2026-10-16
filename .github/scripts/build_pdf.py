# /// script
# requires-python = ">=3.12"
# dependencies = ["playwright==1.63.0", "pypdf==6.19.0"]
# ///
"""Print the built site to one course PDF: sidebar pages in course order, answers opened, one bookmark
per page, page numbers in the footer, links pointing at the public site.

    uv run .github/scripts/build_pdf.py install        # once: Chromium for Playwright
    uv run .github/scripts/build_pdf.py _site https://eass-part-a-2026-x.github.io/lecture-notes
"""

import functools
import http.server
import io
import subprocess
import sys
import threading
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright
from pypdf import PdfReader, PdfWriter

PDF_NAME = "EASS-Class-X-course.pdf"
MARGIN = {"top": "15mm", "bottom": "18mm", "left": "14mm", "right": "14mm"}
FOOTER = (
    '<div style="width:100%;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:8pt;color:#555">'
    'EASS · Class X · <span class="pageNumber"></span> / <span class="totalPages"></span></div>'
)
OPEN_AND_RELINK = """([local, pub]) => {
    document.querySelectorAll("details").forEach(d => d.open = true);
    document.querySelectorAll("a[href]").forEach(a => {
        if (a.href.startsWith(local)) a.href = pub + a.href.slice(local.length);
    });
    return document.fonts.ready.then(() => true);
}"""

if sys.argv[1:] == ["install"]:
    deps = ["--with-deps"] if sys.platform == "linux" else []
    sys.exit(subprocess.call([sys.executable, "-m", "playwright", "install", *deps, "--only-shell", "chromium"]))

site, public = Path(sys.argv[1]).resolve(), sys.argv[2].rstrip("/")
base = urlsplit(public).path  # the baseurl, e.g. "/lecture-notes"


class Handler(http.server.SimpleHTTPRequestHandler):
    """Serve _site under the baseurl, as GitHub Pages does."""

    def translate_path(self, path):
        path = urlsplit(path).path
        return super().translate_path(path.removeprefix(base) if path.startswith(base + "/") else "/missing")

    def log_message(self, *args):
        pass


server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Handler, directory=site))
threading.Thread(target=server.serve_forever, daemon=True).start()
local = f"http://127.0.0.1:{server.server_port}{base}"

with sync_playwright() as p:
    page = p.chromium.launch().new_page()
    page.goto(local + "/")
    # The theme drops the href of the current page's link, hence `|| location.href`.
    urls = page.eval_on_selector_all(
        ".site-nav a.nav-list-link:not(.external)", "as => as.map(a => a.href || location.href)"
    )
    if not urls:
        sys.exit("No sidebar pages found: is this a Just the Docs _site?")
    writer = PdfWriter()
    for i, url in enumerate(urls):
        page.goto(url, wait_until="networkidle")
        page.evaluate(OPEN_AND_RELINK, [local, public])
        title = "Course guide" if i == 0 else page.inner_text("main h1").strip()
        pdf = page.pdf(format="A4", margin=MARGIN, print_background=True)
        writer.append(PdfReader(io.BytesIO(pdf)), outline_item=title, import_outline=False)
        print(f"{len(writer.pages):4d} pages after {title}")

    # Page numbers run across the whole book: print them on blank pages, then stamp those on.
    page.set_content('<p style="break-after:page">&nbsp;</p>' * (len(writer.pages) - 1) + "<p>&nbsp;</p>")
    blank = "<span></span>"  # an empty header (the default one prints the date and title)
    numbers = page.pdf(
        format="A4", margin=MARGIN, display_header_footer=True, header_template=blank, footer_template=FOOTER
    )
    for content, number in zip(writer.pages, PdfReader(io.BytesIO(numbers)).pages, strict=True):
        content.merge_page(number)
        content.compress_content_streams()  # merging leaves the page uncompressed
server.shutdown()

writer.add_metadata({"/Title": "EASS · Class X · Course notes", "/Author": "Yossi Eliaz"})
writer.page_mode = "/UseOutlines"  # open with the bookmarks panel
writer.compress_identical_objects()
writer.write(site / PDF_NAME)
print(f"Wrote {site / PDF_NAME}: {len(writer.pages)} pages, {(site / PDF_NAME).stat().st_size // 1024} KiB")
