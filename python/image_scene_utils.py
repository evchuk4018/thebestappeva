from __future__ import annotations

import base64
import io
from collections import Counter
from typing import Iterable

import numpy as np
from PIL import Image


def rgb_to_hex(color: Iterable[int]) -> str:
    red, green, blue = [max(0, min(255, int(channel))) for channel in color]
    return f"#{red:02x}{green:02x}{blue:02x}"


def bbox_center(bbox: list[int]) -> tuple[float, float]:
    return ((bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2)


def dominant_colors(image: np.ndarray, limit: int = 3) -> list[str]:
    if image.size == 0:
        return ["#000000"]
    pixels = image.reshape(-1, image.shape[-1])
    sampled = pixels[:: max(1, len(pixels) // 5000)]
    counts = Counter(tuple(int(channel) for channel in pixel[:3]) for pixel in sampled)
    return [rgb_to_hex(color) for color, _count in counts.most_common(limit)] or ["#000000"]


def encode_png(image: Image.Image) -> str:
    output = io.BytesIO()
    image.save(output, format="PNG", optimize=True)
    return base64.b64encode(output.getvalue()).decode("ascii")


def crop_name_for_bbox(bbox: list[int], canvas_width: int) -> list[str]:
    center_x, _ = bbox_center(bbox)
    section = "center"
    if center_x < canvas_width / 3:
        section = "left"
    elif center_x > canvas_width * 2 / 3:
        section = "right"
    return ["full", section]
