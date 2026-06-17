from __future__ import annotations

import base64
import io
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


def _area(bbox: list[int]) -> int:
    return max(0, bbox[2] - bbox[0]) * max(0, bbox[3] - bbox[1])


def _contains(parent: list[int], child: list[int]) -> bool:
    return parent[0] <= child[0] and parent[1] <= child[1] and parent[2] >= child[2] and parent[3] >= child[3]


def _overlap_ratio(left: list[int], right: list[int]) -> float:
    width = max(0, min(left[2], right[2]) - max(left[0], right[0]))
    height = max(0, min(left[3], right[3]) - max(left[1], right[1]))
    return (width * height) / max(1, min(_area(left), _area(right)))


def _role_for(shape_type: str, bbox: list[int], canvas: tuple[int, int]) -> str:
    width = max(1, bbox[2] - bbox[0])
    height = max(1, bbox[3] - bbox[1])
    if shape_type == "line":
        return "divider" if width > height * 6 or height > width * 6 else "connector"
    if width > canvas[0] * 0.45 and height > canvas[1] * 0.2:
        return "panel"
    if width < canvas[0] * 0.18 and height < canvas[1] * 0.12:
        return "control"
    return "shape"


def _add_object(objects: list[dict[str, Any]], candidate: dict[str, Any]) -> None:
    for existing in objects:
        if _overlap_ratio(existing["bbox"], candidate["bbox"]) > 0.88:
            if candidate["confidence"] > existing["confidence"]:
                existing.update(candidate)
            return
    objects.append(candidate)


def _object_from_bbox(image_rgb: np.ndarray, bbox: list[int], shape_type: str, source: str, confidence: float) -> dict[str, Any]:
    height, width = image_rgb.shape[:2]
    x1, y1, x2, y2 = bbox
    region = image_rgb[max(0, y1): min(height, y2), max(0, x1): min(width, x2)]
    palette = dominant_colors(region)
    obj: dict[str, Any] = {
        "id": "",
        "type": shape_type,
        "role": _role_for(shape_type, bbox, (width, height)),
        "bbox": bbox,
        "dominantColors": palette,
        "fill": palette[0],
        "stroke": palette[1] if len(palette) > 1 else palette[0],
        "crops": crop_name_for_bbox(bbox, width),
        "confidence": confidence,
        "source": source,
    }
    if shape_type == "line":
        obj["line"] = bbox
    return obj


def _contact_sheet(image: Image.Image, debug_images: dict[str, str]) -> str:
    crops = []
    for name in ["full", "left", "center", "right", "text-ocr"]:
        if name not in debug_images:
            continue
        crops.append(Image.open(io.BytesIO(base64.b64decode(debug_images[name]))).convert("RGB"))
    if not crops:
        return encode_png(image)
    thumb_width = max(160, min(360, image.width // 2))
    thumbs = []
    for crop in crops:
        working = crop.copy()
        working.thumbnail((thumb_width, thumb_width), Image.Resampling.LANCZOS)
        thumbs.append(working)
    sheet = Image.new("RGB", (thumb_width * 2, thumb_width * ((len(thumbs) + 1) // 2)), "#ffffff")
    for index, thumb in enumerate(thumbs):
        sheet.paste(thumb, ((index % 2) * thumb_width, (index // 2) * thumb_width))
    return encode_png(sheet)


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
    objects: list[dict[str, Any]] = []
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)
    edges = cv2.dilate(cv2.Canny(blurred, 35, 130), np.ones((2, 2), np.uint8), iterations=1)
    contours, _hierarchy = cv2.findContours(edges, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

    for contour in sorted(contours, key=cv2.contourArea, reverse=True):
        area = float(cv2.contourArea(contour))
        if area < max(24, image.width * image.height * 0.00012):
            continue
        perimeter = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.03 * perimeter, True)
        x, y, width, height = cv2.boundingRect(contour)
        bbox = [int(x), int(y), int(x + width), int(y + height)]
        shape_type, line = _classify_shape(len(approx), bbox)
        obj = _object_from_bbox(image_rgb, bbox, shape_type, "contour", min(0.98, 0.5 + area / max(1, image.width * image.height)))
        polygon = [[int(point[0][0]), int(point[0][1])] for point in approx]
        if len(polygon) >= 3:
            obj["polygon"] = polygon
        if line is not None:
            obj["line"] = line
        _add_object(objects, obj)

    mask = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 25, 8)
    component_count, labels, stats, _centroids = cv2.connectedComponentsWithStats(mask, 8)
    for label in range(1, component_count):
        x, y, width, height, area = [int(value) for value in stats[label]]
        if area < max(18, image.width * image.height * 0.00008):
            continue
        bbox = [x, y, x + width, y + height]
        _add_object(objects, _object_from_bbox(image_rgb, bbox, "rectangle", "component", min(0.9, 0.4 + area / max(1, image.width * image.height))))

    hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)
    color_mask = cv2.inRange(hsv, np.array([0, 25, 30]), np.array([179, 255, 245]))
    color_contours, _ = cv2.findContours(color_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for contour in color_contours:
        area = float(cv2.contourArea(contour))
        if area < max(40, image.width * image.height * 0.0002):
            continue
        x, y, width, height = cv2.boundingRect(contour)
        _add_object(objects, _object_from_bbox(image_rgb, [x, y, x + width, y + height], "rectangle", "color", 0.72))

    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, 32, minLineLength=max(18, image.width // 18), maxLineGap=5)
    for line in lines.reshape(-1, 4).tolist() if lines is not None else []:
        x1, y1, x2, y2 = [int(value) for value in line]
        bbox = [min(x1, x2), min(y1, y2), max(x1, x2) + 1, max(y1, y2) + 1]
        _add_object(objects, _object_from_bbox(image_rgb, bbox, "line", "hough", 0.82))

    objects.sort(key=lambda item: (_area(item["bbox"]), item["bbox"][1], item["bbox"][0]), reverse=True)
    for index, obj in enumerate(objects):
        obj["id"] = f"obj_{index + 1}"
        obj["zIndex"] = index
    for child in objects:
        parents = [obj for obj in objects if obj is not child and _contains(obj["bbox"], child["bbox"])]
        if parents:
            child["parentId"] = min(parents, key=lambda item: _area(item["bbox"]))["id"]

    background = rgb_to_hex(image_rgb.reshape(-1, 3)[0]) if image_rgb.size else "#ffffff"
    scene_graph = {
        "canvas": {"width": image.width, "height": image.height, "background": background},
        "objects": objects,
        "text": [],
        "relationships": [],
        "uncertain": [],
        "diagnostics": {
            "analysisVersion": "scene-graph-v2",
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
    debug_images["contact"] = _contact_sheet(image, debug_images)
    return scene_graph, debug_images


def add_text_debug_images(image: Image.Image, scene_graph: dict[str, Any], debug_images: dict[str, str]) -> dict[str, str]:
    debug_images["full"] = _annotated_crop(image, scene_graph["objects"], scene_graph["text"], None)
    debug_images["left"] = _annotated_crop(image, [obj for obj in scene_graph["objects"] if "left" in obj["crops"]], [item for item in scene_graph["text"] if "left" in item["crops"]], (0, 0, max(1, image.width // 3), image.height))
    debug_images["center"] = _annotated_crop(image, [obj for obj in scene_graph["objects"] if "center" in obj["crops"]], [item for item in scene_graph["text"] if "center" in item["crops"]], (image.width // 3, 0, max(image.width // 3 + 1, image.width * 2 // 3), image.height))
    debug_images["right"] = _annotated_crop(image, [obj for obj in scene_graph["objects"] if "right" in obj["crops"]], [item for item in scene_graph["text"] if "right" in item["crops"]], (image.width * 2 // 3, 0, image.width, image.height))
    debug_images["text-ocr"] = _annotated_crop(image, scene_graph["objects"], scene_graph["text"], None)
    debug_images["contact"] = _contact_sheet(image, debug_images)
    return debug_images
