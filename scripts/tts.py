#!/usr/bin/env python3
"""Generate the narration with Piper (voice hosted on Hugging Face) and write
the timing manifest that Remotion uses to lay out the scenes.

Each scene gets its own WAV file, so the scene length in the video is derived
from the real length of its narration. Nothing is hard-coded.

Usage:
    python3 scripts/tts.py --piper .piper/piper/piper \
        --voice .piper/en_US-lessac-medium.onnx
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AUDIO_DIR = ROOT / "public" / "audio"
MANIFEST = ROOT / "src" / "manifest.json"
NARRATION = ROOT / "narration.json"


def wav_seconds(path: Path) -> float:
    with wave.open(str(path), "rb") as f:
        return f.getnframes() / float(f.getframerate())


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--piper", default=".piper/piper/piper", help="path to the piper binary")
    ap.add_argument("--voice", default=".piper/en_US-lessac-medium.onnx", help="path to the .onnx voice")
    ap.add_argument("--length-scale", default="1.03", help=">1 speaks slower")
    ap.add_argument("--noise-scale", default="0.667")
    ap.add_argument("--noise-w", default="0.8")
    args = ap.parse_args()

    piper = Path(args.piper).resolve()
    voice = Path(args.voice).resolve()
    if not piper.exists():
        sys.exit(f"piper binary not found at {piper}")
    if not voice.exists():
        sys.exit(f"voice not found at {voice}")

    config = NARRATION
    script = json.loads(config.read_text())
    fps = int(script.get("fps", 30))
    pad = float(script.get("pad", 0.7))
    min_seconds = float(script.get("minSeconds", 4.0))

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    # piper needs its bundled shared libraries on the loader path
    env = dict(os.environ)
    lib_dir = str(piper.parent)
    env["LD_LIBRARY_PATH"] = lib_dir + (":" + env["LD_LIBRARY_PATH"] if env.get("LD_LIBRARY_PATH") else "")

    scenes = []
    total_frames = 0
    total_seconds = 0.0

    for item in script["scenes"]:
        scene_id = item["id"]
        text = " ".join(item["text"].split())
        out = AUDIO_DIR / f"{scene_id}.wav"

        cmd = [
            str(piper),
            "--model", str(voice),
            "--config", f"{voice}.json",
            "--length_scale", str(args.length_scale),
            "--noise_scale", str(args.noise_scale),
            "--noise_w", str(args.noise_w),
            "--output_file", str(out),
        ]
        proc = subprocess.run(cmd, input=text.encode("utf-8"), env=env,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if proc.returncode != 0 or not out.exists():
            sys.stderr.write(proc.stderr.decode("utf-8", "replace"))
            sys.exit(f"piper failed for scene {scene_id}")

        seconds = wav_seconds(out)
        frames = max(int(round(min_seconds * fps)), int(round((seconds + pad) * fps)))
        scenes.append({
            "id": scene_id,
            "audio": f"audio/{scene_id}.wav",
            "seconds": round(seconds, 3),
            "frames": frames,
        })
        total_frames += frames
        total_seconds += seconds
        print(f"  {scene_id:<14} {seconds:6.2f}s audio -> {frames:4d} frames "
              f"({frames / fps:5.2f}s on screen)")

    manifest = {
        "fps": fps,
        "voice": script.get("voice", "en_US-lessac-medium"),
        "totalSeconds": round(total_seconds, 3),
        "totalFrames": total_frames,
        "scenes": scenes,
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")

    # a concat list, so the narration can also be stitched into one track with ffmpeg
    (AUDIO_DIR / "list.txt").write_text(
        "".join(f"file '{s['id']}.wav'\n" for s in scenes)
    )

    print(f"\nnarration: {total_seconds:.1f}s of speech")
    print(f"video:     {total_frames} frames at {fps}fps = {total_frames / fps:.1f}s")
    print(f"manifest:  {MANIFEST.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
