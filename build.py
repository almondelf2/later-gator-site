#!/usr/bin/env python3
"""
build.py — Later Gator marketing site builder

Stitches shared partials (head, nav, footer, modal/scripts) together with
each page's unique body content to produce the final, standalone HTML files
that get deployed.

Usage:
    python build.py

Run this from the `dev` (or `main`) folder after editing anything in
src/partials/ or src/pages/. It overwrites index.html, how.html,
roadmap.html, faq.html, and contact.html in the current directory.

Do NOT hand-edit the generated files directly — edits there will be lost
the next time this script runs. Edit the files in src/ instead.
"""

import pathlib

ROOT = pathlib.Path(__file__).parent
PARTIALS = ROOT / "src" / "partials"
PAGES = ROOT / "src" / "pages"

# Maps output filename -> source page-content filename
PAGE_MAP = {
    "index.html": "page-index.html",
    "how.html": "page-how.html",
    "roadmap.html": "page-roadmap.html",
    "faq.html": "page-faq.html",
    "contact.html": "page-contact.html",
}


def read(path: pathlib.Path) -> str:
    if not path.exists():
        raise FileNotFoundError(f"Missing required file: {path}")
    return path.read_text(encoding="utf-8")


def build():
    head = read(PARTIALS / "head.html").rstrip()
    nav = read(PARTIALS / "nav.html").rstrip()
    footer = read(PARTIALS / "footer.html").rstrip()
    end = read(PARTIALS / "end.html").rstrip()

    for output_name, page_file in PAGE_MAP.items():
        page_content = read(PAGES / page_file).strip()

        warning = (
            f"<!-- GENERATED FILE \u2014 do not edit directly.\n"
            f"     Source: src/partials/*.html + src/pages/{page_file}\n"
            f"     Edit those, then run `python build.py` to regenerate this file. -->\n"
        )

        final = warning + "\n\n".join([
            head,
            nav,
            page_content,
            footer,
            end,
        ]) + "\n"

        out_path = ROOT / output_name
        out_path.write_text(final, encoding="utf-8")
        print(f"built {output_name}  ({len(final):,} chars)")

    print("\nDone. 5 pages built from src/partials + src/pages.")


if __name__ == "__main__":
    build()
