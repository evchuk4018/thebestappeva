from __future__ import annotations

from typing import Any

import numpy as np

from image_scene_utils import bbox_center, crop_name_for_bbox


def _link_object(bbox: list[int], objects: list[dict[str, Any]]) -> str | None:
    center_x, center_y = bbox_center(bbox)
    best_id = None
    best_distance = None
    for obj in objects:
        left, top, right, bottom = obj["bbox"]
        if left <= center_x <= right and top <= center_y <= bottom:
            return obj["id"]
        object_center = bbox_center(obj["bbox"])
        distance = ((object_center[0] - center_x) ** 2 + (object_center[1] - center_y) ** 2) ** 0.5
        if best_distance is None or distance < best_distance:
            best_distance = distance
            best_id = obj["id"]
    return best_id if best_distance is not None and best_distance < 120 else None


def run_ocr(image_rgb: np.ndarray, objects: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], str, list[dict[str, str]]]:
    try:
        from rapidocr_onnxruntime import RapidOCR  # type: ignore
    except Exception as error:
        return [], "rapidocr-unavailable", [{"kind": "text", "message": f"OCR unavailable: {error}"}]

    engine = RapidOCR()
    result, _elapsed = engine(image_rgb)
    text_items: list[dict[str, Any]] = []
    uncertain: list[dict[str, str]] = []

    for item in result or []:
        points, value, confidence = item
        if not value or len(points) < 4:
            continue
        xs = [int(point[0]) for point in points]
        ys = [int(point[1]) for point in points]
        bbox = [min(xs), min(ys), max(xs), max(ys)]
        text_items.append(
            {
                "value": str(value).strip(),
                "bbox": bbox,
                "confidence": float(confidence),
                "objectId": _link_object(bbox, objects),
                "crops": crop_name_for_bbox(bbox, image_rgb.shape[1]),
            }
        )

    if not text_items:
        uncertain.append({"kind": "text", "message": "OCR completed but found no text."})

    return text_items, "rapidocr-onnxruntime", uncertain
