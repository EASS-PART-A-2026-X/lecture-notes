"""Check built HTML for broken local links, anchors and assets, without network requests.

    python3 .github/scripts/check_site.py _site https://eass-part-a-2026-x.github.io/lecture-notes
"""

import argparse
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit


class Page(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.ids = Counter()
        self.references = []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            self.ids[attrs["id"]] += 1
        for attr in ("href", "src"):
            if attrs.get(attr):
                self.references.append(attrs[attr])


def check_site(site, public):
    site = Path(site).resolve()
    public = public.rstrip("/") + "/"
    origin = urlsplit(public)
    base = origin.path.rstrip("/")
    pages = {p: Page(p.read_text(encoding="utf-8")) for p in sorted(site.rglob("*.html"))}
    errors = []
    if not pages:
        return ["No HTML pages found; build the site first."]

    for path, page in pages.items():
        relative = path.relative_to(site).as_posix()
        for anchor, count in page.ids.items():
            if count > 1:
                errors.append(f"{relative}: duplicate id {anchor!r}")

        for reference in page.references:
            target = urlsplit(urljoin(public + relative, reference))
            if target.scheme not in ("http", "https") or target.netloc != origin.netloc:
                continue
            pathname = unquote(target.path)
            if base and pathname != base and not pathname.startswith(base + "/"):
                errors.append(f"{relative}: link outside site base path: {reference}")
                continue
            destination = (site / pathname[len(base):].lstrip("/")).resolve()
            if not destination.is_relative_to(site):
                errors.append(f"{relative}: link outside site directory: {reference}")
                continue
            if destination.is_dir():
                destination /= "index.html"
            if not destination.is_file():
                errors.append(f"{relative}: missing file: {reference}")
            elif target.fragment and destination in pages:
                anchor = unquote(target.fragment)
                if anchor not in pages[destination].ids:
                    errors.append(f"{relative}: missing anchor: {reference}")
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("site", type=Path)
    parser.add_argument("public", help="Public site URL, including its base path")
    args = parser.parse_args()
    errors = check_site(args.site, args.public)
    if errors:
        for error in errors:
            print(error)
        return 1
    print(f"Checked {len(list(args.site.rglob('*.html')))} HTML pages: local links, anchors and assets pass.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
