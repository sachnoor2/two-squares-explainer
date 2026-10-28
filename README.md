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
