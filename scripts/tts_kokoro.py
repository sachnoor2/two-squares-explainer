#!/usr/bin/env python3
"""Generate the narration with Kokoro-82M (Apache-2.0) instead of Piper.

Same contract as scripts/tts.py: reads narration.json, writes one WAV per scene
into public/audio/, measures each one and writes src/manifest.json, so the
Remotion timeline is built from the real audio exactly as before.

Kokoro is 82M parameters and sounds markedly more human than Piper, at the cost
of roughly 6 core-seconds of CPU per second of audio (measured on 2 vCPUs).

    pip install kokoro-onnx
    curl -L -o kokoro-v1.0.onnx  https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
    curl -L -o voices-v1.0.bin   https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
    python3 scripts/tts_kokoro.py --model kokoro-v1.0.onnx --voices voices-v1.0.bin

narration.json (Kokoro flavour):

    {
      "fps": 30, "engine": "kokoro", "voice": "af_heart", "lang": "en-us",
      "pad": 0.7, "minSeconds": 4.0, "speed": 1.0,
      "scenes": [
        {"id": "01-title", "text": "..."},
        {"id": "02-problem", "text": "...", "voice": "am_michael", "lang": "en-us"}
      ]
    }

Voices: af_heart / af_bella / am_michael / bf_emma (English), hf_alpha / hm_omega
(Hindi), ff_siwis (French), if_sara (Italian), jf_alpha (Japanese), pf_dora
(Portuguese), zf_xiaobei (Mandarin). Full list: hexgrad/Kokoro-82M VOICES.md.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
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
    ap.add_argument("--model", default="kokoro-v1.0.onnx")
    ap.add_argument("--voices", default="voices-v1.0.bin")
    ap.add_argument("--narration", default=str(NARRATION))
    ap.add_argument("--speed", type=float, default=None,
                    help="override the script's speed (1.0 = natural, 0.9 = slower)")
    args = ap.parse_args()

    model, voices = Path(args.model), Path(args.voices)
    for p in (model, voices):
        if not p.exists():
            sys.exit(f"missing {p} — see the download lines in this file's docstring")

    try:
        from kokoro_onnx import Kokoro
    except ImportError:
        sys.exit("kokoro-onnx is not installed: pip install kokoro-onnx")

    script = json.loads(Path(args.narration).read_text())
    fps = int(script.get("fps", 30))
    pad = float(script.get("pad", 0.7))
    min_seconds = float(script.get("minSeconds", 4.0))
    default_voice = script.get("voice", "af_heart")
    default_lang = script.get("lang", "en-us")
    default_speed = float(args.speed if args.speed is not None else script.get("speed", 1.0))

    kokoro = Kokoro(str(model), str(voices))
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    scenes = []
    total_frames = 0
    total_seconds = 0.0

    for item in script["scenes"]:
        scene_id = item["id"]
        text = " ".join(item["text"].split())
        voice = item.get("voice", default_voice)
        lang = item.get("lang", default_lang)
        speed = float(item.get("speed", default_speed))
        out = AUDIO_DIR / f"{scene_id}.wav"

        started = time.time()
        try:
            samples, sample_rate = kokoro.create(text, voice=voice, speed=speed, lang=lang)
        except Exception as exc:  # noqa: BLE001 - name the scene that broke
            sys.exit(f"kokoro failed on scene {scene_id}: {exc}")

        import numpy as np  # local import: only needed once the model loads

        pcm = (np.clip(np.asarray(samples, dtype="float32"), -1.0, 1.0) * 32767).astype("int16")
        with wave.open(str(out), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(int(sample_rate))
            w.writeframes(pcm.tobytes())

        seconds = wav_seconds(out)
        frames = max(int(round(min_seconds * fps)), int(round((seconds + pad) * fps)))
        scenes.append({
            "id": scene_id,
            "audio": f"audio/{scene_id}.wav",
            "seconds": round(seconds, 3),
            "frames": frames,
            "voice": voice,
        })
        total_frames += frames
        total_seconds += seconds
        elapsed = time.time() - started
        print(f"  {scene_id:<14} {seconds:6.2f}s audio in {elapsed:6.1f}s "
              f"-> {frames:4d} frames ({frames / fps:5.2f}s on screen)  voice={voice}")

    manifest = {
        "fps": fps,
        "engine": "kokoro",
        "voice": default_voice,
        "lang": default_lang,
        "totalSeconds": round(total_seconds, 3),
        "totalFrames": total_frames,
        "scenes": scenes,
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    (AUDIO_DIR / "list.txt").write_text("".join(f"file '{s['id']}.wav'\n" for s in scenes))

    print(f"\nnarration: {total_seconds:.1f}s of speech")
    print(f"video:     {total_frames} frames at {fps}fps = {total_frames / fps:.1f}s")
    print(f"manifest:  {MANIFEST.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
