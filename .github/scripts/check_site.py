"""Check built HTML links, assets and teaching-image metadata without network requests.

python3 .github/scripts/check_site.py _site https://eass-part-a-2026-x.github.io/lecture-notes
"""

import argparse
import math
import xml.etree.ElementTree as ET
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit


class Page(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.ids = Counter()
        self.references = []
        self.images = []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "img":
            self.images.append(attrs)
        if attrs.get("id"):
            self.ids[attrs["id"]] += 1
        for attr in ("href", "src"):
            if attrs.get(attr):
                self.references.append(attrs[attr])


def check_diagram(path):
    """Teaching diagrams need a usable standalone SVG as well as HTML alt text."""
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError:
        return ["malformed SVG"]
    namespace = "{http://www.w3.org/2000/svg}"
    errors = []
    if root.tag != namespace + "svg":
        return ["expected an SVG root"]
    labels = root.get("aria-labelledby", "").split()
    if root.get("role") != "img":
        errors.append("SVG needs role=img")
    for tag in ("title", "desc"):
        element = root.find(namespace + tag)
        if element is None or not "".join(element.itertext()).strip():
            errors.append(f"SVG needs a nonempty {tag}")
        elif not element.get("id") or element.get("id") not in labels:
            errors.append(f"SVG aria-labelledby must reference its {tag}")
    try:
        box = [float(value) for value in root.get("viewBox", "").split()]
        valid = (
            len(box) == 4 and all(math.isfinite(v) for v in box) and min(box[2:]) > 0
        )
    except ValueError:
        valid = False
    if not valid:
        errors.append("SVG needs a finite, positive viewBox")
    return errors


def check_site(site, public):
    site = Path(site).resolve()
    public = public.rstrip("/") + "/"
    origin = urlsplit(public)
    base = origin.path.rstrip("/")
    pages = {
        p: Page(p.read_text(encoding="utf-8")) for p in sorted(site.rglob("*.html"))
    }
    errors = []
    checked_diagrams = set()
    if not pages:
        return ["No HTML pages found; build the site first."]

    for path, page in pages.items():
        relative = path.relative_to(site).as_posix()
        for anchor, count in page.ids.items():
            if count > 1:
                errors.append(f"{relative}: duplicate id {anchor!r}")

        for image in page.images:
            source = image.get("src", "(missing src)")
            if "alt" not in image:
                errors.append(f"{relative}: image missing alt: {source}")
            for dimension in ("width", "height"):
                value = image.get(dimension, "")
                if not value.isdecimal() or int(value) <= 0:
                    errors.append(
                        f"{relative}: image needs positive {dimension}: {source}"
                    )
            target = urlsplit(urljoin(public + relative, source))
            prefix = base + "/assets/diagrams/"
            if target.netloc == origin.netloc and unquote(target.path).startswith(
                prefix
            ):
                if not image.get("alt", "").strip():
                    errors.append(
                        f"{relative}: teaching diagram needs descriptive alt: {source}"
                    )
                diagram = (
                    site / unquote(target.path)[len(base) :].lstrip("/")
                ).resolve()
                if (
                    diagram.suffix.lower() == ".svg"
                    and diagram.is_relative_to(site)
                    and diagram.is_file()
                    and diagram not in checked_diagrams
                ):
                    checked_diagrams.add(diagram)
                    errors.extend(
                        f"{diagram.relative_to(site)}: {error}"
                        for error in check_diagram(diagram)
                    )

        for reference in page.references:
            target = urlsplit(urljoin(public + relative, reference))
            if target.scheme not in ("http", "https") or target.netloc != origin.netloc:
                continue
            pathname = unquote(target.path)
            if base and pathname != base and not pathname.startswith(base + "/"):
                errors.append(f"{relative}: link outside site base path: {reference}")
                continue
            destination = (site / pathname[len(base) :].lstrip("/")).resolve()
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
    print(
        f"Checked {len(list(args.site.rglob('*.html')))} HTML pages: links, anchors, assets and image metadata pass."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
