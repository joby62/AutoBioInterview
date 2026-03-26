#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import shutil
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import xml.etree.ElementTree as ET


W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
NS = {
    "w": W_NS,
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": R_NS,
    "pr": PKG_REL_NS,
}


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def normalize_spaces(value: str) -> str:
    return re.sub(r"[ \t\r\f\v]+", " ", value).replace("\u00a0", " ")


def tidy_paragraph_text(value: str) -> str:
    lines = [normalize_spaces(line).strip() for line in value.split("\n")]
    return "\n".join(line for line in lines if line)


def extract_relationships(docx_path: Path) -> dict[str, str]:
    with zipfile.ZipFile(docx_path) as zf:
        rel_xml = zf.read("word/_rels/document.xml.rels")
    root = ET.fromstring(rel_xml)
    rels: dict[str, str] = {}
    for rel in root.findall("pr:Relationship", NS):
        rel_id = rel.attrib.get("Id")
        target = rel.attrib.get("Target")
        if rel_id and target:
            rels[rel_id] = target
    return rels


def natural_media_sort_key(name: str) -> tuple[int, str]:
    match = re.search(r"image(\d+)", Path(name).stem, re.IGNORECASE)
    if match:
        return (int(match.group(1)), name)
    return (10**9, name)


def collect_referenced_targets_in_order(docx_path: Path, rels: dict[str, str]) -> list[str]:
    with zipfile.ZipFile(docx_path) as zf:
        document_xml = zf.read("word/document.xml")
    root = ET.fromstring(document_xml)
    ordered_targets: list[str] = []
    seen: set[str] = set()
    for blip in root.findall(".//a:blip", NS):
        rel_id = blip.attrib.get(f"{{{R_NS}}}embed") or blip.attrib.get(f"{{{R_NS}}}link")
        target = rels.get(rel_id or "")
        if target and target.startswith("media/") and target not in seen:
            ordered_targets.append(target)
            seen.add(target)
    return ordered_targets


def extract_media(
    docx_path: Path,
    images_dir: Path,
    ordered_targets: list[str],
) -> dict[str, dict[str, str]]:
    images_dir.mkdir(parents=True, exist_ok=True)
    media_map: dict[str, dict[str, str]] = {}
    with zipfile.ZipFile(docx_path) as zf:
        media_names = sorted(
            [name for name in zf.namelist() if name.startswith("word/media/") and not name.endswith("/")],
            key=natural_media_sort_key,
        )
        referenced_names = [f"word/{target}" for target in ordered_targets]
        remaining_names = [name for name in media_names if name not in referenced_names]
        ordered_media_names = referenced_names + remaining_names
        for index, media_name in enumerate(ordered_media_names, start=1):
            if media_name not in media_names:
                continue
            original_name = Path(media_name).name
            ext = Path(original_name).suffix.lower()
            extracted_name = f"image-{index:03d}{ext}"
            extracted_path = images_dir / extracted_name
            with zf.open(media_name) as src, extracted_path.open("wb") as dst:
                shutil.copyfileobj(src, dst)
            media_map[media_name.replace("word/", "", 1)] = {
                "original_name": original_name,
                "extracted_name": extracted_name,
                "relative_path": f"./images/{extracted_name}",
            }
    return media_map


def tokens_from_run(run: ET.Element, rels: dict[str, str], media_map: dict[str, dict[str, str]]) -> list[dict[str, Any]]:
    tokens: list[dict[str, Any]] = []
    for node in run.iter():
        tag = local_name(node.tag)
        if tag == "t":
            tokens.append({"type": "text", "value": node.text or ""})
        elif tag == "tab":
            tokens.append({"type": "text", "value": "\t"})
        elif tag in {"br", "cr"}:
            tokens.append({"type": "text", "value": "\n"})
        elif tag == "blip":
            rel_id = node.attrib.get(f"{{{R_NS}}}embed") or node.attrib.get(f"{{{R_NS}}}link")
            target = rels.get(rel_id or "")
            if rel_id and target and target in media_map:
                tokens.append(
                    {
                        "type": "image",
                        "relationship_id": rel_id,
                        "target": target,
                        "relative_path": media_map[target]["relative_path"],
                        "original_name": media_map[target]["original_name"],
                        "extracted_name": media_map[target]["extracted_name"],
                    }
                )
    return tokens


def tokens_from_node(node: ET.Element, rels: dict[str, str], media_map: dict[str, dict[str, str]]) -> list[dict[str, Any]]:
    if local_name(node.tag) == "r":
        return tokens_from_run(node, rels, media_map)
    tokens: list[dict[str, Any]] = []
    for child in list(node):
        tokens.extend(tokens_from_node(child, rels, media_map))
    return tokens


def extract_document(docx_path: Path, rels: dict[str, str], media_map: dict[str, dict[str, str]]) -> dict[str, Any]:
    with zipfile.ZipFile(docx_path) as zf:
        document_xml = zf.read("word/document.xml")
    root = ET.fromstring(document_xml)
    body = root.find("w:body", NS)
    if body is None:
        raise RuntimeError("DOCX document.xml missing body")

    paragraphs: list[dict[str, Any]] = []
    references: list[dict[str, Any]] = []
    image_sequence = 0

    for raw_index, paragraph in enumerate(body.findall("w:p", NS), start=1):
        tokens: list[dict[str, Any]] = []
        for child in list(paragraph):
            tokens.extend(tokens_from_node(child, rels, media_map))

        if not tokens:
            continue

        text_parts: list[str] = []
        image_refs: list[dict[str, Any]] = []
        for token in tokens:
            if token["type"] == "text":
                text_parts.append(token["value"])
            elif token["type"] == "image":
                image_sequence += 1
                image_ref = {
                    "image_sequence": image_sequence,
                    "relationship_id": token["relationship_id"],
                    "source_media_path": f"word/{token['target']}",
                    "original_name": token["original_name"],
                    "extracted_name": token["extracted_name"],
                    "relative_path": token["relative_path"],
                }
                token["image_sequence"] = image_sequence
                image_refs.append(image_ref)

        paragraph_text = tidy_paragraph_text("".join(text_parts))
        if not paragraph_text and not image_refs:
            continue

        paragraph_record = {
            "paragraph_index": len(paragraphs) + 1,
            "raw_paragraph_index": raw_index,
            "text": paragraph_text,
            "tokens": tokens,
            "images": image_refs,
        }
        paragraphs.append(paragraph_record)

    for index, paragraph in enumerate(paragraphs):
        prev_text = next((p["text"] for p in reversed(paragraphs[:index]) if p["text"]), "")
        next_text = next((p["text"] for p in paragraphs[index + 1 :] if p["text"]), "")
        for image_ref in paragraph["images"]:
            references.append(
                {
                    **image_ref,
                    "paragraph_index": paragraph["paragraph_index"],
                    "paragraph_text": paragraph["text"],
                    "previous_text": prev_text,
                    "next_text": next_text,
                }
            )

    return {"paragraphs": paragraphs, "references": references}


def build_markdown(docx_name: str, document: dict[str, Any]) -> str:
    lines = [
        f"# {docx_name} 提取稿",
        "",
        f"- 段落数：{len(document['paragraphs'])}",
        f"- 图片引用数：{len(document['references'])}",
        "",
        "## 正文与图片引用",
        "",
    ]

    for paragraph in document["paragraphs"]:
        emitted_text = False
        text_buffer: list[str] = []
        for token in paragraph["tokens"]:
            if token["type"] == "text":
                text_buffer.append(token["value"])
                continue

            text_value = tidy_paragraph_text("".join(text_buffer))
            if text_value:
                lines.append(text_value)
                lines.append("")
                emitted_text = True
            text_buffer = []

            image_sequence = token["image_sequence"]
            lines.append(f"![Image {image_sequence:03d}]({token['relative_path']})")
            lines.append(
                f"> 引用：Image {image_sequence:03d} · {token['original_name']} · 段落 {paragraph['paragraph_index']}"
            )
            lines.append("")

        tail_text = tidy_paragraph_text("".join(text_buffer))
        if tail_text:
            lines.append(tail_text)
            lines.append("")
            emitted_text = True

        if not emitted_text and paragraph["images"]:
            lines.append(f"> 段落 {paragraph['paragraph_index']} 仅包含图片")
            lines.append("")

    return "\n".join(lines).strip() + "\n"


def build_plain_text(document: dict[str, Any]) -> str:
    lines: list[str] = []
    for paragraph in document["paragraphs"]:
        if paragraph["text"]:
            lines.append(paragraph["text"])
        for image_ref in paragraph["images"]:
            lines.append(
                f"[Image {image_ref['image_sequence']:03d} -> {image_ref['relative_path']}]"
            )
        lines.append("")
    return "\n".join(lines).strip() + "\n"


def write_output(source_docx: Path, output_dir: Path, media_map: dict[str, dict[str, str]], document: dict[str, Any]) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)

    manifest = {
        "source_docx": str(source_docx),
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "paragraph_count": len(document["paragraphs"]),
        "image_count": len(document["references"]),
        "media_files": [
            {
                "source_media_path": f"word/{source_media}",
                **payload,
            }
            for source_media, payload in sorted(media_map.items())
        ],
        "references": document["references"],
    }

    (output_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (output_dir / "document.md").write_text(
        build_markdown(source_docx.stem, document),
        encoding="utf-8",
    )
    (output_dir / "document.txt").write_text(
        build_plain_text(document),
        encoding="utf-8",
    )
    (output_dir / "README.md").write_text(
        "\n".join(
            [
                f"# {source_docx.stem} 素材包",
                "",
                "- `images/`：从 docx 提取出的原始图片，已按顺序重命名。",
                "- `document.md`：正文与图片引用按阅读顺序穿插。",
                "- `document.txt`：纯文本版本，图片以占位引用表示。",
                "- `manifest.json`：图片与段落上下文的机器可读引用清单。",
                "",
            ]
        )
        + "\n",
        encoding="utf-8",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract text, images, and references from a DOCX file.")
    parser.add_argument("--source", required=True, help="Path to the source DOCX file")
    parser.add_argument("--output", required=True, help="Directory to write extracted assets into")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source_docx = Path(args.source).expanduser().resolve()
    output_dir = Path(args.output).expanduser().resolve()
    images_dir = output_dir / "images"

    rels = extract_relationships(source_docx)
    ordered_targets = collect_referenced_targets_in_order(source_docx, rels)
    media_map = extract_media(source_docx, images_dir, ordered_targets)
    document = extract_document(source_docx, rels, media_map)
    write_output(source_docx, output_dir, media_map, document)

    print(
        json.dumps(
            {
                "output_dir": str(output_dir),
                "paragraph_count": len(document["paragraphs"]),
                "image_count": len(document["references"]),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
