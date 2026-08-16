#!/usr/bin/env python3
"""Create app icons by center-cropping and resizing a source image.

No image generation, filters, overlays, or rounded-corner masks are applied.
The operating system/browser is responsible for the final icon shape.

Usage:
    python3 tools/make_icons.py IMG_7816.jpeg
"""

from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

SIZES = (32, 180, 192, 512)
ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = ROOT / "icons"


def make_with_pillow(source: Path) -> bool:
    try:
        from PIL import Image, ImageOps
    except ImportError:
        return False

    with Image.open(source) as opened:
        image = ImageOps.exif_transpose(opened).convert("RGB")
        width, height = image.size
        side = min(width, height)
        left = (width - side) // 2
        top = (height - side) // 2
        square = image.crop((left, top, left + side, top + side))
        for size in SIZES:
            icon = square.resize((size, size), Image.Resampling.LANCZOS)
            icon.save(OUTPUT_DIR / f"icon-{size}.png", "PNG", optimize=True)
    return True


def run(command: list[str]) -> str:
    result = subprocess.run(command, check=True, text=True, capture_output=True)
    return result.stdout.strip()


def make_with_imagemagick(source: Path) -> bool:
    convert = shutil.which("magick") or shutil.which("convert")
    identify = shutil.which("identify")
    if not convert or not identify:
        return False

    with tempfile.TemporaryDirectory() as temporary_directory:
        oriented = Path(temporary_directory) / "oriented.png"
        command = [convert]
        if Path(convert).name == "magick":
            command.append("convert")
        run(command + [str(source), "-auto-orient", str(oriented)])
        width_text, height_text = run(
            [identify, "-format", "%w %h", str(oriented)]
        ).split()
        side = min(int(width_text), int(height_text))

        for size in SIZES:
            command = [convert]
            if Path(convert).name == "magick":
                command.append("convert")
            run(
                command
                + [
                    str(oriented),
                    "-gravity",
                    "center",
                    "-crop",
                    f"{side}x{side}+0+0",
                    "+repage",
                    "-resize",
                    f"{size}x{size}",
                    "-strip",
                    str(OUTPUT_DIR / f"icon-{size}.png"),
                ]
            )
    return True


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python3 tools/make_icons.py <source-image>", file=sys.stderr)
        return 2

    source = Path(sys.argv[1]).expanduser().resolve()
    if not source.is_file():
        print(f"Source image not found: {source}", file=sys.stderr)
        return 2

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    if not make_with_pillow(source) and not make_with_imagemagick(source):
        print(
            "Icon generation requires Pillow (python3 -m pip install Pillow) "
            "or ImageMagick.",
            file=sys.stderr,
        )
        return 1

    print(f"Created {len(SIZES)} icons in {OUTPUT_DIR.relative_to(ROOT)}/")
    for size in SIZES:
        print(f"  icon-{size}.png ({size}x{size})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
