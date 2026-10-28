#!/usr/bin/env python3
"""Split the timeline into render chunks and render them one at a time.

There is no maximum video length. The only rule is: if the finished video would
run longer than CHUNK_THRESHOLD (default 10 minutes), render it in chunks and
stitch afterwards. A chunk boundary is always placed between scenes, never
inside one, so a sentence is never cut in half.

Chunks are numbered from 1 and written to out/chunks/chunk-001.mp4,
chunk-002.mp4, ... The stitch step reads that number to decide the order.

Usage
    python3 scripts/render_chunks.py --plan                 # show the plan
    python3 scripts/render_chunks.py --plan --json          # for a CI matrix
    python3 scripts/render_chunks.py --only 2               # render one chunk
    python3 scripts/render_chunks.py --all                  # render every chunk
"""

from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "src" / "manifest.json"
CHUNK_DIR = ROOT / "out" / "chunks"
ENTRY = "src/index.ts"
COMPOSITION = "Video"

CHUNK_THRESHOLD_SECONDS = 600  # 10 minutes — a chunking threshold, not a length limit


def load_manifest(path: Path) -> dict:
    if not path.exists():
        sys.exit(f"manifest not found: {path} (run scripts/tts.py first)")
    return json.loads(path.read_text())


def plan_chunks(manifest: dict, chunk_seconds: int) -> list[dict]:
    """Group consecutive scenes into chunks of at least `chunk_seconds`."""
    fps = int(manifest["fps"])
    target = chunk_seconds * fps

    groups: list[list[dict]] = []
    current: list[dict] = []
    frames = 0
    for scene in manifest["scenes"]:
        current.append(scene)
        frames += int(scene["frames"])
        if frames >= target:
            groups.append(current)
            current, frames = [], 0
    if current:
        groups.append(current)

    plan: list[dict] = []
    offset = 0
    for index, group in enumerate(groups, start=1):
        total = sum(int(s["frames"]) for s in group)
        plan.append(
            {
                "index": index,
                "from": offset,
                "to": offset + total - 1,
                "frames": total,
                "seconds": round(total / fps, 3),
                "scenes": [s["id"] for s in group],
                "file": f"out/chunks/chunk-{index:03d}.mp4",
            }
        )
        offset += total
    return plan


def chunk_needed(manifest: dict, chunk_seconds: int) -> bool:
    fps = int(manifest["fps"])
    total = int(manifest["totalFrames"])
    return total > chunk_seconds * fps


def probe(path: Path) -> dict:
    cmd = [
        "ffprobe", "-v", "error", "-print_format", "json",
        "-show_format", "-show_streams", str(path),
    ]
    out = subprocess.run(cmd, capture_output=True, text=True)
    if out.returncode != 0:
        raise RuntimeError(out.stderr.strip() or f"ffprobe failed on {path}")
    data = json.loads(out.stdout)
    video = next((s for s in data["streams"] if s["codec_type"] == "video"), None)
    audio = next((s for s in data["streams"] if s["codec_type"] == "audio"), None)

    def duration(stream, fallback=None):
        if stream and stream.get("duration"):
            return float(stream["duration"])
        if stream and stream.get("nb_frames") and stream.get("avg_frame_rate"):
            num, den = stream["avg_frame_rate"].split("/")
            if float(den):
                return float(stream["nb_frames"]) / (float(num) / float(den))
        return fallback

    return {
        "has_video": video is not None,
        "has_audio": audio is not None,
        "width": int(video["width"]) if video else None,
        "height": int(video["height"]) if video else None,
        "fps": video.get("avg_frame_rate") if video else None,
        "video_seconds": duration(video, float(data["format"].get("duration", 0))),
        "audio_seconds": duration(audio),
        "seconds": float(data["format"].get("duration", 0)),
    }


def render_chunk(chunk: dict, fps: int) -> bool:
    CHUNK_DIR.mkdir(parents=True, exist_ok=True)
    out = ROOT / chunk["file"]
    cmd = [
        "npx", "remotion", "render", ENTRY, COMPOSITION, str(out.relative_to(ROOT)),
        f"--frames={chunk['from']}-{chunk['to']}",
        "--gl=swangle",
        "--concurrency=3",
        "--log=info",
    ]
    print(f"\n▸ chunk {chunk['index']:03d}: frames {chunk['from']}-{chunk['to']} "
          f"({chunk['seconds']:.1f}s, {len(chunk['scenes'])} scenes)")
    result = subprocess.run(cmd, cwd=ROOT)
    if result.returncode != 0 or not out.exists():
        print(f"✗ chunk {chunk['index']:03d} failed to render", file=sys.stderr)
        return False

    # a chunk that is missing audio, or is the wrong length, must not reach the stitch step
    info = probe(out)
    expected = chunk["frames"] / fps
    problems = []
    if not info["has_video"]:
        problems.append("no video stream")
    if not info["has_audio"]:
        problems.append("no audio stream")
    if abs(info["video_seconds"] - expected) > 0.25:
        problems.append(f"video {info['video_seconds']:.2f}s, expected {expected:.2f}s")
    if info["audio_seconds"] is not None and abs(info["video_seconds"] - info["audio_seconds"]) > 0.15:
        problems.append(f"audio {info['audio_seconds']:.2f}s vs video {info['video_seconds']:.2f}s")
    if problems:
        print(f"✗ chunk {chunk['index']:03d}: " + "; ".join(problems), file=sys.stderr)
        return False

    print(f"✓ chunk {chunk['index']:03d}: {info['video_seconds']:.2f}s "
          f"(audio {info['audio_seconds']:.2f}s)")
    return True


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", default=str(MANIFEST))
    ap.add_argument("--chunk-seconds", type=int, default=CHUNK_THRESHOLD_SECONDS,
                    help="minimum length of a chunk (default 600 = 10 minutes)")
    ap.add_argument("--plan", action="store_true", help="print the chunk plan and exit")
    ap.add_argument("--json", action="store_true", help="print the plan as JSON (for a CI matrix)")
    ap.add_argument("--only", type=int, help="render a single chunk by its number")
    ap.add_argument("--all", action="store_true", help="render every chunk, in order")
    args = ap.parse_args()

    manifest = load_manifest(Path(args.manifest))
    fps = int(manifest["fps"])
    plan = plan_chunks(manifest, args.chunk_seconds)

    if args.json:
        print(json.dumps(plan))
        return 0

    if args.plan or not (args.only or args.all):
        total = manifest["totalFrames"] / fps
        print(f"video: {total:.1f}s ({manifest['totalFrames']} frames at {fps}fps)")
        print(f"chunking {'needed' if chunk_needed(manifest, args.chunk_seconds) else 'not needed'} "
              f"(threshold {args.chunk_seconds}s)")
        for c in plan:
            print(f"  chunk-{c['index']:03d}  frames {c['from']:>6}-{c['to']:<6} "
                  f"{c['seconds']:>7.1f}s  {', '.join(c['scenes'])}")
        if not (args.only or args.all):
            return 0

    todo = [c for c in plan if args.only == c["index"]] if args.only else plan
    if args.only and not todo:
        sys.exit(f"no chunk numbered {args.only}; plan has {len(plan)}")

    ok = all([render_chunk(c, fps) for c in todo])
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
