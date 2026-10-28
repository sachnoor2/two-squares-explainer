# Two squares on an 8×8 board — video explainer

A Remotion video that explains why the answer to

> *Two squares are chosen from an 8×8 chessboard so that they are not in the same row and not in the same column. In how many ways?*

is **1568**, and — the point of the whole thing — where the factor of **2** in `8C2 × 8C2 × 2` comes from.

Narration is generated on the runner by [Piper](https://github.com/rhasspy/piper) using the
`rhasspy/piper-voices` → `en_US/lessac/medium` voice hosted on Hugging Face, so the video is
built end to end (text → speech → frames → mp4) inside GitHub Actions.

## How it fits together

```
narration.json        the spoken script, one entry per scene
scripts/tts.py        Piper → public/audio/<scene>.wav, then writes src/manifest.json
src/manifest.json     per-scene audio length → frames; the video timeline is built from it
src/scenes.tsx        the ten scenes (title, problem, rows, columns, block, why-×2, total, check, pitfall, recap)
src/Video.tsx         lays the scenes out back to back and places each scene's audio under it
src/Root.tsx          the Remotion composition (1920×1080, 30 fps)
```

Scene length is **not** hard-coded: `scripts/tts.py` measures each generated WAV and writes the
frame count into the manifest, so the animation always matches the narration. Edit the wording in
`narration.json`, re-run, and the video re-times itself.

## Run it locally

```bash
npm install

# Piper engine + voice (the voice is a Hugging Face model)
mkdir -p .piper
curl -fsSL -o .piper/piper.tar.gz https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz
tar -xzf .piper/piper.tar.gz -C .piper
BASE=https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium
curl -fsSL -o .piper/en_US-lessac-medium.onnx      "$BASE/en_US-lessac-medium.onnx"
curl -fsSL -o .piper/en_US-lessac-medium.onnx.json "$BASE/en_US-lessac-medium.onnx.json"

python3 scripts/tts.py --piper .piper/piper/piper --voice .piper/en_US-lessac-medium.onnx
npm run dev      # Remotion Studio, scrubbable timeline
npm run render   # out/two-squares-explainer.mp4
```

`ffmpeg` is only needed for the optional `out/narration.wav` stitch; Remotion ships its own
encoder.

## Run it on GitHub Actions

Push to `main`, or hit **Run workflow** on the *Render explainer video* workflow. The runner
installs ffmpeg, fetches Piper + the Hugging Face voice, generates the narration, renders with
Remotion and uploads `two-squares-explainer.mp4` plus the stitched `narration.wav` as a build
artifact.

## Long videos

There is no maximum length. If the finished video would run longer than ten minutes, it is rendered in
chunks and stitched afterwards — boundaries always fall between scenes, so no sentence is split.

```bash
python3 scripts/render_chunks.py --plan          # chunk list with frame ranges
python3 scripts/render_chunks.py --only 2        # render one chunk (CI matrix job)
python3 scripts/stitch.py                        # verify → stitch by number → verify → re-stitch
```

`stitch.py` checks that every chunk has both streams, is the expected length, and has audio within
150 ms of its video; it then joins them in numeric order, verifies the result, and redoes the join
(stream copy, then a full re-encode) if it is not clean. It writes `out/stitch-report.json` with the
per-chunk drift in milliseconds, and exits `2` if a chunk itself is broken and `3` if the stitch never
verified. See `PLAYBOOK.md` §3.6 for the full protocol and the workflow shape.

## Voices: Piper or Kokoro-82M

Two engines, one contract — both write one WAV per scene and regenerate `src/manifest.json` from the
measured audio, so the timeline adapts either way.

| | `scripts/tts.py` (Piper) | `scripts/tts_kokoro.py` (Kokoro-82M) |
|---|---|---|
| Sound | clear but synthetic | markedly more human |
| Weights | 63 MB voice | 311 MB ONNX + 27 MB voices |
| Speed on 2 vCPU | faster than real time (RTF ≈ 0.4) | ~6–8 core-seconds per audio second (RTF ≈ 3–4) |
| Languages | 53 | 8 (en, es, fr, hi, it, ja, pt, zh) |
| Licence | MIT engine / varied voices | Apache-2.0 |

```bash
pip install kokoro-onnx
curl -L -o kokoro-v1.0.onnx https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
curl -L -o voices-v1.0.bin  https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
python3 scripts/tts_kokoro.py --model kokoro-v1.0.onnx --voices voices-v1.0.bin
```

`narration.json` takes `"engine": "kokoro"`, a `voice` and a `lang`, and any scene may override the voice.
See `PLAYBOOK.md` §4 for the full comparison, including the heavier models (Chatterbox, Qwen3-TTS,
indic-parler-tts) and why they do not fit a free runner.
