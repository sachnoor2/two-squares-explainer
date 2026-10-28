#!/usr/bin/env python3
"""Verify the rendered chunks, stitch them in numeric order, then verify the result.

This is the safety net for long videos. It answers three questions with numbers
rather than assumptions:

  1. Are all the chunks present, and are they numbered 1..N without gaps?
  2. Does every chunk start and end where the manifest says, with audio exactly
     as long as its video (no audio lag)?
  3. Does the stitched file have the expected duration and a matching audio
     track (no time lag)?

If the stitched file fails verification, the stitch is simply redone — first
with a stream copy, then with a full re-encode — and verified again after each
attempt. If a *chunk* is broken (its own audio and video disagree), stitching
cannot repair it: the script names the chunk and, with --rerender-bad-chunks,
re-renders it before trying again.

Usage
    python3 scripts/stitch.py
    python3 scripts/stitch.py --out out/video.mp4 --max-attempts 4
    python3 scripts/stitch.py --rerender-bad-chunks
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

from render_chunks import load_manifest, plan_chunks, probe

ROOT = Path(__file__).resolve().parent.parent
CHUNK_DIR = ROOT / "out" / "chunks"
DEFAULT_OUT = ROOT / "out" / "video.mp4"
REPORT = ROOT / "out" / "stitch-report.json"

CHUNK_RE = re.compile(r"^chunk-(\d+)\.(mp4|mov|mkv)$")


def rel(path: Path) -> str:
    """Path relative to the project root when possible, else as given."""
    try:
        return str(path.resolve().relative_to(ROOT))
    except ValueError:
        return str(path)


# --------------------------------------------------------------------------- #
# discovery
# --------------------------------------------------------------------------- #

def discover(chunk_dir: Path) -> list[dict]:
    """Return chunks sorted by their number, and complain about gaps."""
    if not chunk_dir.exists():
        sys.exit(f"no chunk directory at {chunk_dir} — render the chunks first")

    found: dict[int, Path] = {}
    for path in chunk_dir.iterdir():
        m = CHUNK_RE.match(path.name)
        if not m:
            continue
        number = int(m.group(1))
        if number in found:
            sys.exit(f"two files claim chunk number {number}: "
                     f"{found[number].name} and {path.name}")
        found[number] = path

    if not found:
        sys.exit(f"no chunk-*.mp4 files in {chunk_dir}")

    numbers = sorted(found)
    missing = [n for n in range(1, numbers[-1] + 1) if n not in found]
    if missing:
        sys.exit(f"chunk numbering has gaps: missing {missing} "
                 f"(have {numbers}) — a missing chunk means missing video")

    return [{"index": n, "path": found[n]} for n in numbers]


# --------------------------------------------------------------------------- #
# verification helpers
# --------------------------------------------------------------------------- #

def check_chunk(chunk: dict, expected_frames: int, fps: int, tol_len: float, tol_av: float) -> list[str]:
    """Return a list of problems. An empty list means the chunk is clean."""
    path = chunk["path"]
    try:
        info = probe(path)
    except Exception as exc:  # noqa: BLE001 - report, do not crash
        return [f"unreadable: {exc}"]

    chunk["info"] = info
    problems: list[str] = []
    if not info["has_video"]:
        problems.append("no video stream")
    if not info["has_audio"]:
        problems.append("no audio stream")
    if problems:
        return problems

    expected = expected_frames / fps
    video, audio = info["video_seconds"], info["audio_seconds"]

    if abs(video - expected) > tol_len:
        problems.append(f"length {video:.3f}s vs expected {expected:.3f}s "
                        f"({(video - expected) * 1000:+.0f} ms)")
    if abs(video - audio) > tol_av:
        problems.append(f"audio lag: video {video:.3f}s vs audio {audio:.3f}s "
                        f"({(audio - video) * 1000:+.0f} ms)")
    chunk["drift_ms"] = round((audio - video) * 1000)
    chunk["expected"] = round(expected, 3)
    return problems


def verify_stitched(path: Path, expected_frames: int, fps: int,
                    tol_len: float, tol_av: float) -> list[str]:
    if not path.exists():
        return ["output file missing"]
    try:
        info = probe(path)
    except Exception as exc:  # noqa: BLE001
        return [f"unreadable: {exc}"]

    problems: list[str] = []
    if not info["has_video"]:
        problems.append("no video stream")
    if not info["has_audio"]:
        problems.append("no audio stream")
    if problems:
        return problems

    expected = expected_frames / fps
    video, audio = info["video_seconds"], info["audio_seconds"]
    if abs(video - expected) > tol_len:
        problems.append(f"duration {video:.3f}s vs expected {expected:.3f}s "
                        f"({(video - expected) * 1000:+.0f} ms)")
    if abs(video - audio) > tol_av:
        problems.append(f"audio lag: video {video:.3f}s vs audio {audio:.3f}s "
                        f"({(audio - video) * 1000:+.0f} ms)")
    return problems


# --------------------------------------------------------------------------- #
# stitching
# --------------------------------------------------------------------------- #

def stitch(chunks: list[dict], out: Path, fps: int, mode: str) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    list_file = out.parent / "chunks.txt"
    # -safe 0 plus absolute paths: the concat demuxer must never reorder anything
    list_file.write_text("".join(f"file '{c['path'].resolve()}'\n" for c in chunks))

    if mode == "copy":
        cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
               "-f", "concat", "-safe", "0", "-i", str(list_file),
               "-c", "copy", "-movflags", "+faststart", str(out)]
    else:
        cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
               "-f", "concat", "-safe", "0", "-i", str(list_file),
               "-c:v", "libx264", "-crf", "18", "-preset", "veryfast",
               "-pix_fmt", "yuv420p", "-r", str(fps), "-fps_mode", "cfr",
               "-c:a", "aac", "-ar", "48000", "-b:a", "192k",
               "-movflags", "+faststart", str(out)]

    print(f"  ffmpeg stitch ({mode}) → {rel(out)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        tail = " / ".join(result.stderr.strip().splitlines()[-3:])
        raise RuntimeError(f"ffmpeg exit {result.returncode}: {tail}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", default=str(ROOT / "src" / "manifest.json"))
    ap.add_argument("--chunks", default=str(CHUNK_DIR))
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--chunk-seconds", type=int, default=600)
    ap.add_argument("--max-attempts", type=int, default=3,
                    help="how many times to redo the stitch before giving up")
    ap.add_argument("--tol-length", type=float, default=0.25, help="seconds allowed per chunk/total")
    ap.add_argument("--tol-av", type=float, default=0.15, help="seconds allowed between video and audio")
    ap.add_argument("--rerender-bad-chunks", action="store_true",
                    help="re-render a chunk whose own audio and video disagree")
    args = ap.parse_args()

    manifest = load_manifest(Path(args.manifest))
    fps = int(manifest["fps"])
    plan = plan_chunks(manifest, args.chunk_seconds)
    out = Path(args.out).resolve()

    chunks = discover(Path(args.chunks))
    print(f"found {len(chunks)} chunk(s): " + ", ".join(f"{c['index']:03d}" for c in chunks))

    if len(chunks) != len(plan):
        sys.exit(f"expected {len(plan)} chunk(s) from the manifest, found {len(chunks)} — "
                 f"re-render the missing ones (scripts/render_chunks.py --plan)")

    for chunk, planned in zip(chunks, plan):
        chunk["expected_frames"] = planned["frames"]
        chunk["scenes"] = planned["scenes"]

    # ---- 1. per-chunk verification ------------------------------------- #
    print("\nverifying chunks")
    bad: list[dict] = []
    for chunk in chunks:
        problems = check_chunk(chunk, chunk["expected_frames"], fps,
                               args.tol_length, args.tol_av)
        info = chunk.get("info", {})
        if problems:
            bad.append({"chunk": chunk, "problems": problems})
            print(f"  ✗ chunk-{chunk['index']:03d}  " + "; ".join(problems))
        else:
            print(f"  ✓ chunk-{chunk['index']:03d}  {info['video_seconds']:7.3f}s "
                  f"(audio {info['audio_seconds']:7.3f}s, drift {chunk['drift_ms']:+d} ms)")

    if bad and args.rerender_bad_chunks:
        print("\nre-rendering the broken chunk(s)")
        for item in list(bad):
            index = item["chunk"]["index"]
            rc = subprocess.run(
                [sys.executable, str(Path(__file__).with_name("render_chunks.py")),
                 "--only", str(index), "--chunk-seconds", str(args.chunk_seconds)],
                cwd=ROOT)
            if rc.returncode == 0:
                again = check_chunk(item["chunk"], item["chunk"]["expected_frames"], fps,
                                    args.tol_length, args.tol_av)
                if not again:
                    bad.remove(item)
                    print(f"  ✓ chunk-{index:03d} re-rendered cleanly")
                else:
                    print(f"  ✗ chunk-{index:03d} still bad: " + "; ".join(again))

    if bad:
        REPORT.parent.mkdir(parents=True, exist_ok=True)
        REPORT.write_text(json.dumps(
            {"stage": "chunks", "problems": [
                {"chunk": b["chunk"]["index"], "problems": b["problems"]} for b in bad]}, indent=2))
        print("\nrefusing to stitch: a chunk cannot be repaired by stitching. "
              "Re-render the chunk(s) above (or pass --rerender-bad-chunks).", file=sys.stderr)
        return 2

    # ---- 2. stitch, verify, and redo if it is not clean ----------------- #
    expected_frames = sum(c["expected_frames"] for c in chunks)
    modes = ["copy", "reencode", "reencode"]
    problems: list[str] = []

    for attempt in range(1, args.max_attempts + 1):
        mode = modes[min(attempt - 1, len(modes) - 1)]
        print(f"\nstitch attempt {attempt}/{args.max_attempts}")
        try:
            stitch(chunks, out, fps, mode)
        except Exception as exc:  # noqa: BLE001
            problems = [f"ffmpeg error: {exc}"]
            print(f"  ✗ {problems[0]}")
            continue

        problems = verify_stitched(out, expected_frames, fps, args.tol_length, args.tol_av)
        if not problems:
            info = probe(out)
            report = {
                "stage": "done",
                "attempt": attempt,
                "mode": mode,
                "file": rel(out),
                "chunks": [
                    {"index": c["index"], "seconds": c["info"]["video_seconds"],
                     "drift_ms": c.get("drift_ms", 0), "scenes": c["scenes"]}
                    for c in chunks
                ],
                "total_seconds": info["video_seconds"],
                "audio_seconds": info["audio_seconds"],
                "drift_ms": round((info["audio_seconds"] - info["video_seconds"]) * 1000),
                "expected_seconds": round(expected_frames / fps, 3),
            }
            REPORT.write_text(json.dumps(report, indent=2) + "\n")
            print(f"\n✓ stitched cleanly on attempt {attempt} ({mode})")
            print(f"  {info['video_seconds']:.3f}s video · {info['audio_seconds']:.3f}s audio · "
                  f"drift {(info['audio_seconds'] - info['video_seconds']) * 1000:+.0f} ms")
            print(f"  report: {REPORT.relative_to(ROOT)}")
            return 0

        print("  ✗ " + "; ".join(problems))
        print("  redoing the stitch")

    REPORT.write_text(json.dumps({"stage": "stitch", "problems": problems}, indent=2) + "\n")
    print(f"\n✗ stitching failed verification {args.max_attempts} time(s): "
          + "; ".join(problems), file=sys.stderr)
    return 3


if __name__ == "__main__":
    raise SystemExit(main())
