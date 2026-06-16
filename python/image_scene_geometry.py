from __future__ import annotations

from typing import Any

import cv2  # type: ignore
import numpy as np
from PIL import Image, ImageDraw

from image_scene_utils import crop_name_for_bbox, dominant_colors, encode_png, rgb_to_hex


def _classify_shape(points: int, bbox: list[int]) -> tuple[str, list[int] | None]:
    width = max(1, bbox[2] - bbox[0])
    height = max(1, bbox[3] - bbox[1])
    if width > height * 6 or height > width * 6:
        return "line", bbox
    if points == 3:
        return "triangle", None
    if points == 4:
        return "rectangle", None
    if points == 6:
        return "hexagon", None
    return "polygon", None


def _annotated_crop(image: Image.Image, objects: list[dict[str, Any]], text_items: list[dict[str, Any]], bounds: tuple[int, int, int, int] | None) -> str:
    working = image.copy() if bounds is None else image.crop(bounds)
    origin_x = 0 if bounds is None else bounds[0]
    origin_y = 0 if bounds is None else bounds[1]
    draw = ImageDraw.Draw(working)
    for obj in objects:
        left, top, right, bottom = obj["bbox"]
        draw.rectangle((left - origin_x, top - origin_y, right - origin_x, bottom - origin_y), outline="#00ffff", width=2)
        draw.text((left - origin_x + 2, top - origin_y + 2), obj["id"], fill="#00ffff")
    for item in text_items:
        left, top, right, bottom = item["bbox"]
        draw.rectangle((left - origin_x, top - origin_y, right - origin_x, bottom - origin_y), outline="#ffff00", width=1)
        draw.text((left - origin_x + 2, bottom - origin_y + 2), item["value"], fill="#ffff00")
    return encode_png(working)


def extract_geometry(image: Image.Image) -> tuple[dict[str, Any], dict[str, str]]:
    image_rgb = np.array(image.convert("RGB"))
    image_bgr = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 40, 140)
    edges = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=1)
    contours, _hierarchy = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    objects: list[dict[str, Any]] = []
    for contour in sorted(contours, key=cv2.contourArea, reverse=True):
        area = float(cv2.contourArea(contour))
        if area < max(120, image.width * image.height * 0.0008):
            continue
        perimeter = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.03 * perimeter, True)
        x, y, width, height = cv2.boundingRect(contour)
        bbox = [int(x), int(y), int(x + width), int(y + height)]
        region = image_rgb[y : y + height, x : x + width]
        shape_type, line = _classify_shape(len(approx), bbox)
        palette = dominant_colors(region)
        polygon = [[int(point[0][0]), int(point[0][1])] for point in approx]
        objects.append(
            {
                "id": f"obj_{len(objects) + 1}",
                "type": shape_type,
                "bbox": bbox,
                "polygon": polygon if len(polygon) >= 3 else None,
                "line": line,
                "dominantColors": palette,
                "fill": palette[0],
                "stroke": palette[1] if len(palette) > 1 else palette[0],
                "crops": crop_name_for_bbox(bbox, image.width),
                "confidence": min(0.98, 0.45 + area / max(1, image.width * image.height)),
            }
        )

    background = rgb_to_hex(image_rgb.reshape(-1, 3)[0]) if image_rgb.size else "#ffffff"
    scene_graph = {
        "canvas": {"width": image.width, "height": image.height, "background": background},
        "objects": objects,
        "text": [],
        "relationships": [],
        "uncertain": [],
        "diagnostics": {
            "analysisVersion": "scene-graph-v1",
            "generatedAt": "",
            "ocrEngine": "",
            "vlmModel": "",
            "passes": ["full", "left", "center", "right", "text-ocr"],
        },
    }
    third = image.width // 3
    debug_images = {
        "full": _annotated_crop(image, objects, [], None),
        "left": _annotated_crop(image, [obj for obj in objects if "left" in obj["crops"]], [], (0, 0, max(1, third), image.height)),
        "center": _annotated_crop(image, [obj for obj in objects if "center" in obj["crops"]], [], (third, 0, max(third + 1, third * 2), image.height)),
        "right": _annotated_crop(image, [obj for obj in objects if "right" in obj["crops"]], [], (third * 2, 0, image.width, image.height)),
    }
    return scene_graph, debug_images


def add_text_debug_images(image: Image.Image, scene_graph: dict[str, Any], debug_images: dict[str, str]) -> dict[str, str]:
    debug_images["full"] = _annotated_crop(image, scene_graph["objects"], scene_graph["text"], None)
    debug_images["left"] = _annotated_crop(image, [obj for obj in scene_graph["objects"] if "left" in obj["crops"]], [item for item in scene_graph["text"] if "left" in item["crops"]], (0, 0, max(1, image.width // 3), image.height))
    debug_images["center"] = _annotated_crop(image, [obj for obj in scene_graph["objects"] if "center" in obj["crops"]], [item for item in scene_graph["text"] if "center" in item["crops"]], (image.width // 3, 0, max(image.width // 3 + 1, image.width * 2 // 3), image.height))
    debug_images["right"] = _annotated_crop(image, [obj for obj in scene_graph["objects"] if "right" in obj["crops"]], [item for item in scene_graph["text"] if "right" in item["crops"]], (image.width * 2 // 3, 0, image.width, image.height))
    debug_images["text-ocr"] = _annotated_crop(image, scene_graph["objects"], scene_graph["text"], None)
    return debug_images
