"""Private raster upload library for the portfolio CMS.

Uploads are unpublished by default. The public endpoint serves an image only
once its URL appears in the published portfolio document; signed-in editors can
preview drafts. No SVG, scripts, or user-supplied filenames are served.
"""
from __future__ import annotations

import re
import secrets
from pathlib import Path

MAX_IMAGE_BYTES = 5 * 1024 * 1024
FILE_NAME = re.compile(r"^[a-f0-9]{32}\.(png|jpg|webp)$")


def detect_raster(data):
    if len(data) < 20:
        raise ValueError("Image data is incomplete.")
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        if data[12:16] != b"IHDR" or b"IEND" not in data[-32:]:
            raise ValueError("Invalid PNG image.")
        width = int.from_bytes(data[16:20], "big")
        height = int.from_bytes(data[20:24], "big")
        ext, mimetype = "png", "image/png"
    elif data.startswith(b"\xff\xd8\xff") and data.endswith(b"\xff\xd9"):
        width, height = 1, 1  # JPEG parser is left to the browser, size capped.
        ext, mimetype = "jpg", "image/jpeg"
    elif data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        width, height = 1, 1  # Container header and byte length are validated.
        if int.from_bytes(data[4:8], "little") + 8 != len(data):
            raise ValueError("Invalid WebP container length.")
        ext, mimetype = "webp", "image/webp"
    else:
        raise ValueError("Only PNG, JPEG, and WebP screenshots are supported.")
    if not (0 < width <= 15000 and 0 < height <= 15000):
        raise ValueError("Invalid image dimensions.")
    return ext, mimetype


class ImageLibrary:
    def __init__(self, directory):
        self.directory = Path(directory)

    def upload(self, file):
        if file is None or not getattr(file, "filename", ""):
            raise ValueError("Please choose an image file.")
        data = file.stream.read(MAX_IMAGE_BYTES + 1)
        if len(data) > MAX_IMAGE_BYTES:
            raise ValueError("Image must be smaller than 5 MB.")
        ext, _ = detect_raster(data)
        self.directory.mkdir(parents=True, exist_ok=True)
        filename = secrets.token_hex(16) + "." + ext
        path = self.directory / filename
        with path.open("xb") as handle:
            handle.write(data)
        return {"filename": filename, "url": "/content/media/" + filename, "size": len(data)}

    def path_for(self, filename):
        if not FILE_NAME.fullmatch(filename):
            return None
        path = self.directory / filename
        return path if path.is_file() else None

    def list_images(self):
        if not self.directory.is_dir():
            return []
        images = []
        for path in self.directory.iterdir():
            if path.is_file() and FILE_NAME.fullmatch(path.name):
                images.append({
                    "filename": path.name,
                    "url": "/content/media/" + path.name,
                    "size": path.stat().st_size
                })
        return sorted(images, key=lambda x: x["filename"], reverse=True)[:300]


def published_image_urls(document):
    references = set()
    for project in document.get("projects", []):
        if project.get("image"):
            references.add(project["image"])
    for section in document.get("sections", []):
        if section.get("image"):
            references.add(section["image"])
    return references
