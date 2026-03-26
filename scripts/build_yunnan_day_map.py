from __future__ import annotations

import json
import re
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
SOURCE_DIR = BASE_DIR / "static" / "guide" / "source" / "yunnan_trip_v4"
MANIFEST_PATH = SOURCE_DIR / "manifest.json"
DOCUMENT_MD_PATH = SOURCE_DIR / "document.md"
DOCUMENT_TXT_PATH = SOURCE_DIR / "document.txt"
OUTPUT_PATH = SOURCE_DIR / "day-map.json"

DAY_RE = re.compile(r"^Day(?P<num>\d+)（(?P<date>[^）]+)）：(?P<headline>.+)$")
IMAGE_RE = re.compile(r"^\[Image (?P<seq>\d{3}) -> (?P<path>\./images/[^\]]+)\]$")


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def split_before_summary(text: str) -> list[str]:
    lines = text.splitlines()
    try:
        cutoff = lines.index("行程汇总：")
    except ValueError:
        cutoff = len(lines)
    return lines[:cutoff]


def parse_markdown_headings(text: str) -> dict[str, dict[str, str]]:
    headings: dict[str, dict[str, str]] = {}
    for raw_line in split_before_summary(text):
        line = raw_line.strip()
        match = DAY_RE.match(line)
        if not match:
            continue

        day_id = f"day{match.group('num')}"
        headings.setdefault(
            day_id,
            {
                "heading": line,
                "date": match.group("date"),
                "headline": match.group("headline"),
            },
        )
    return headings


def parse_day_sections(text: str) -> list[dict]:
    days: list[dict] = []
    current_day: dict | None = None
    buffer: list[str] = []

    def flush_buffer() -> None:
        nonlocal buffer, current_day
        if not current_day:
            buffer = []
            return

        joined = "\n".join(buffer).strip()
        buffer = []
        if not joined:
            return

        current_day["source_blocks"].append({"type": "text", "text": joined})

    def finalize_current() -> None:
        nonlocal current_day
        if not current_day:
            return
        flush_buffer()
        days.append(current_day)
        current_day = None

    for raw_line in split_before_summary(text):
        line = raw_line.strip()

        match = DAY_RE.match(line)
        if match:
            finalize_current()
            current_day = {
                "id": f"day{match.group('num')}",
                "day": f"Day {match.group('num')}",
                "date": match.group("date"),
                "heading": line,
                "headline": match.group("headline"),
                "source_blocks": [],
            }
            continue

        if line in {"注意事项：", "其他注意事项："}:
            if current_day and current_day["id"] != "day11":
                finalize_current()
                continue

        if not current_day:
            continue

        image_match = IMAGE_RE.match(line)
        if image_match:
            flush_buffer()
            current_day["source_blocks"].append(
                {
                    "type": "image",
                    "image_sequence": int(image_match.group("seq")),
                    "relative_path": image_match.group("path"),
                }
            )
            continue

        if not line:
            flush_buffer()
            continue

        buffer.append(line)

    finalize_current()
    return days


def choose_excerpt(reference: dict) -> str:
    before = (reference.get("previous_text") or "").strip()
    after = (reference.get("next_text") or "").strip()

    if after and len(after) >= 8:
        return after
    if before and len(before) >= 8:
        return before
    return after or before


def build_day_map() -> dict:
    manifest = load_json(MANIFEST_PATH)
    markdown_headings = parse_markdown_headings(DOCUMENT_MD_PATH.read_text(encoding="utf-8"))
    day_sections = parse_day_sections(DOCUMENT_TXT_PATH.read_text(encoding="utf-8"))
    references = {
        reference["image_sequence"]: reference
        for reference in manifest.get("references", [])
    }

    days = []
    for section in day_sections:
        heading_info = markdown_headings.get(section["id"], {})
        source_blocks = section["source_blocks"]
        images = []

        for block in source_blocks:
            if block["type"] != "image":
                continue

            reference = references.get(block["image_sequence"])
            if not reference:
                continue

            images.append(
                {
                    "sequence": block["image_sequence"],
                    "relative_path": reference["relative_path"],
                    "paragraph_index": reference.get("paragraph_index"),
                    "reference_excerpt": choose_excerpt(reference),
                    "reference_before": (reference.get("previous_text") or "").strip(),
                    "reference_after": (reference.get("next_text") or "").strip(),
                    "original_name": reference.get("original_name", ""),
                    "extracted_name": reference.get("extracted_name", ""),
                }
            )

        paragraphs = [block["text"] for block in source_blocks if block["type"] == "text"]

        days.append(
            {
                "id": section["id"],
                "day": section["day"],
                "date": section["date"],
                "heading": heading_info.get("heading", section["heading"]),
                "headline": heading_info.get("headline", section["headline"]),
                "cover_image_sequence": images[0]["sequence"] if images else None,
                "image_sequences": [image["sequence"] for image in images],
                "images": images,
                "source_blocks": source_blocks,
                "paragraphs": paragraphs,
                "text_blob": " ".join(paragraphs + [image["reference_excerpt"] for image in images]).strip(),
            }
        )

    return {
        "source_docx": manifest.get("source_docx"),
        "generated_at_utc": manifest.get("generated_at_utc"),
        "source_files": {
            "manifest": str(MANIFEST_PATH.relative_to(BASE_DIR)),
            "document_md": str(DOCUMENT_MD_PATH.relative_to(BASE_DIR)),
            "document_txt": str(DOCUMENT_TXT_PATH.relative_to(BASE_DIR)),
        },
        "day_count": len(days),
        "days": days,
    }


def main() -> None:
    day_map = build_day_map()
    OUTPUT_PATH.write_text(
        json.dumps(day_map, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
