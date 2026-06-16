from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

from image_scene_geometry import add_text_debug_images, extract_geometry
from image_scene_ocr import run_ocr


def analyze_image(file_path: Path):
    image = Image.open(file_path).convert("RGB")
    scene_graph, debug_images = extract_geometry(image)
    text_items, ocr_engine, uncertain = run_ocr(np.array(image), scene_graph["objects"])
    scene_graph["text"] = text_items
    scene_graph["uncertain"].extend(uncertain)
    scene_graph["diagnostics"]["generatedAt"] = ""
    scene_graph["diagnostics"]["ocrEngine"] = ocr_engine
    debug_images = add_text_debug_images(image, scene_graph, debug_images)
    return {"sceneGraph": scene_graph, "debugImages": debug_images}


def build_health_payload():
    try:
        import cv2  # type: ignore
        import rapidocr_onnxruntime  # type: ignore

        return {
            "available": True,
            "message": "Image analysis sidecar dependencies are available.",
            "details": f"opencv={cv2.__version__}; rapidocr={getattr(rapidocr_onnxruntime, '__version__', 'unknown')}",
        }
    except Exception as error:
        return {
            "available": False,
            "message": "Image analysis sidecar dependencies are unavailable.",
            "details": str(error),
        }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--health", action="store_true")
    parser.add_argument("--analyze")
    args = parser.parse_args()

    if args.health:
        print(json.dumps(build_health_payload()))
        return 0

    if not args.analyze:
        print("Missing --analyze file path.", file=sys.stderr)
        return 1

    file_path = Path(args.analyze)
    if not file_path.exists():
        print(f"Input file does not exist: {file_path}", file=sys.stderr)
        return 1

    try:
        print(json.dumps(analyze_image(file_path)))
        return 0
    except Exception as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
