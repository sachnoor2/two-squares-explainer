# Video Agent Playbook — title in, narrated video out

A knowledge-base document for an agent whose only job is making videos: the user types a title
or a one-line brief, and the agent ships a finished, narrated MP4 — explainer, adventure, fantasy,
documentary, promo, whatever the brief asks for — in whichever language the user wants.

Everything here is derived from a working reference build: `sachnoor2/two-squares-explainer`
(a 2 min 38 s explainer on the "two squares on a chessboard" problem, English narration, rendered
end to end in GitHub Actions). Treat that repo as the template.

---

## 0. Agent brief (paste this as the agent's system instructions)

> You are a video producer. The user gives you a title or a short brief. You turn it into a finished
> narrated video by (1) choosing a genre and a design system, (2) writing a scene-by-scene narration
> script, (3) building a Remotion + TypeScript project from the template, (4) generating the voice with
> Piper using the voice for the requested language, (5) rendering on GitHub Actions — in numbered chunks
> if the video will run longer than ten minutes, then stitched and verified — and (6) delivering the MP4. You never render video in the chat sandbox — always on the runner. You ask at most two
> questions (language and target length) and only if the brief does not imply them; otherwise you pick
> sensible defaults and say what you picked. You verify the output with ffprobe and by looking at one
> frame per scene before you call it done.

---

## 1. Intake

The user may give you nothing but a title: *"The Water Cycle"*, *"The Last Lighthouse"*,
*"Why 0! = 1"*. Infer everything else. Ask only when a wrong guess would waste the whole render.

| Field | Default if unstated | Ask? |
|---|---|---|
| Topic / story | from the title | no |
| Genre | infer from title; default **explainer** | no |
| Language | the language the user wrote in | no |
| Length | 2–3 min (10 scenes) for a bare title; otherwise whatever the brief needs — there is no maximum | no, unless the brief is genuinely ambiguous |
| Aspect ratio | 16:9 1920×1080 | no |
| Voice gender/tone | neutral, mid-pitch | no |
| Brand colour | from the genre preset | no |
| Music | none (silence between lines) | no |

Two questions maximum, and only if they change the deliverable materially — usually just
**language** and **length**. Never ask about fonts, frame rate, codec or palettes; those are yours.

Confirm your inference in one line before you build: *"Explainer, English, ~2.5 minutes, 16:9 —
building now."* That single line prevents almost every misunderstanding.

---

## 2. Reference implementation

```
video-<slug>/
├── package.json            remotion 4.0.539, react 18.3.1, @remotion/google-fonts
├── tsconfig.json           jsx: react-jsx, resolveJsonModule: true
├── remotion.config.ts      h264, crf 20, yuv420p, jpeg frames, concurrency 2
├── narration.json          THE SCRIPT — one entry per scene, plus voice + fps + pad
├── scripts/tts.py          Piper → public/audio/<scene>.wav, then writes src/manifest.json
├── scripts/tts_kokoro.py   same contract, Kokoro-82M voice (more human, Apache-2.0)
├── scripts/render_chunks.py  splits the timeline into numbered chunks and renders them
├── scripts/stitch.py         verifies the chunks, stitches them by number, re-stitches if unclean
├── src/manifest.json       generated: per-scene seconds → frames; total frames
├── src/manifest.ts         typed wrapper around the JSON
├── src/theme.ts            palette + fonts (loadFont from @remotion/google-fonts)
├── src/components/Board.tsx  domain visual primitives
├── src/components/Bits.tsx   Rise / Stage / Heading / Body / Formula / figures
├── src/scenes.tsx          one component per scene, exported as SCENES
├── src/Video.tsx           sequences scenes back to back, drops each scene's audio underneath
├── src/Root.tsx            <Composition id="Video" width=1920 height=1080 fps=30>
├── src/index.ts            registerRoot
└── .github/workflows/render.yml   TTS → typecheck → render → ffmpeg stitch → upload artifact
```

**The one idea that makes this work:** scene length is *derived from the audio*, never hand-typed.
`tts.py` speaks each scene, measures the WAV, and writes `frames = round((seconds + pad) * fps)` into
the manifest. The animation therefore always fits the voice, in any language, at any speaking rate.
Never hard-code durations.

---

## 3. Build steps

### 3.1 Scaffold

Create a new repo per video named `video-<slug>`, copying the template's files. Do not reuse a repo
across videos — each render's manifest and audio belong to one script.

```bash
# from the template repo
npm ci
```

### 3.2 Write the script (`narration.json`)

```json
{
  "fps": 30,
  "voice": "en_US-lessac-medium",
  "pad": 0.7,
  "minSeconds": 4.0,
  "scenes": [
    { "id": "01-title",   "text": "..." },
    { "id": "02-problem", "text": "..." }
  ]
}
```

Scene `id` must sort in the order you want them shown; the prefix (`01-`, `02-`) guarantees it and
also names the WAV file. `pad` is the breath after the voice stops (0.6–0.8 s); `minSeconds` stops a
two-word scene from flashing past.

### 3.3 Generate the voice

Two engines, one contract — see §4 for which to pick. Piper is the fast default; Kokoro-82M
(`scripts/tts_kokoro.py`) is the human-sounding one.

```bash
# engine (~26 MB, CPU only)
mkdir -p .piper
curl -fsSL -o .piper/piper.tar.gz \
  https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz
tar -xzf .piper/piper.tar.gz -C .piper

# voice (Hugging Face: rhasspy/piper-voices)
ID=hi_IN-pratham-medium
curl -fsSL -o .piper/$ID.onnx      "https://huggingface.co/rhasspy/piper-voices/resolve/main/hi/hi_IN/pratham/medium/$ID.onnx"
curl -fsSL -o .piper/$ID.onnx.json "https://huggingface.co/rhasspy/piper-voices/resolve/main/hi/hi_IN/pratham/medium/$ID.onnx.json"

python3 scripts/tts.py --piper .piper/piper/piper --voice .piper/$ID.onnx
```

The URL path is always `{lang}/{lang_REGION}/{name}/{quality}/{voice_id}.onnx`. Verify any voice id
against `https://huggingface.co/rhasspy/piper-voices/resolve/main/voices.json` before using it — a
wrong path is a 404, and a 404 in the runner wastes a four-minute job.

`tts.py` takes `--length-scale` (default 1.03; raise to 1.10 for slower, clearer delivery, lower to
0.95 for a brisker read).

### 3.4 Build the scenes

One React component per scene, all exported from `SCENES` keyed by the same `id`. Each receives
`{ dur }` in frames so it can schedule reveals as fractions of its own length
(`Math.round(0.3 * dur)`), which keeps animation in step with narration of any duration.

### 3.5 Render on GitHub Actions — always

Render in the workflow, never in the agent sandbox. Push, wait, pull the artifact.

```yaml
- uses: actions/setup-node@v4
  with: { node-version: "20", cache: npm }
- run: npm ci
- run: |
    # ffmpeg (ubuntu-latest usually has it)
    command -v ffmpeg || (sudo apt-get update && sudo apt-get install -y ffmpeg)
- run: |  # piper + voice, see 3.3
- run: python3 scripts/tts.py --piper .piper/piper/piper --voice .piper/$ID.onnx
- run: npx tsc --noEmit
- run: npx remotion render src/index.ts Video out/video.mp4 --gl=swangle --concurrency=3 --log=info
- run: |
    ffmpeg -y -f concat -safe 0 -i public/audio/list.txt -c copy out/narration.wav
    ffprobe -v error -show_entries format=duration -of default=nw=1 out/video.mp4
    ffprobe -v error -show_entries stream=codec_type,codec_name,width,height -of default=nw=1 out/video.mp4
- uses: actions/upload-artifact@v4
  with:
    name: video
    path: |
      out/video.mp4
      out/narration.wav
    retention-days: 14
```

Budget: **~4 minutes of runner time per 2.5 minutes of finished video** (4 vCPU, `--concurrency=3`).
Double it for image-heavy scenes, halve it for text-only cards. That is a planning estimate for how long
to wait, not a limit on how long a video may be: a longer video gets chunked (§3.6), never trimmed.

### 3.6 Long videos — chunked render, then stitch by number

There is no maximum video length. The only rule is this: **if the finished video would run longer than
ten minutes, render it in chunks and stitch afterwards.** Chunk boundaries are placed between scenes, so
a sentence is never cut in half, and every chunk is numbered — that number, and nothing else, decides
where the chunk goes in the final file.

**Plan and render** — `scripts/render_chunks.py`

```bash
python3 scripts/render_chunks.py --plan          # the chunk list: frame range, length, scene ids
python3 scripts/render_chunks.py --only 2        # render one chunk (for a CI matrix job)
python3 scripts/render_chunks.py --all           # all of them, in order
python3 scripts/render_chunks.py --plan --json   # the plan as JSON, for a workflow matrix
```

Each chunk is written as `out/chunks/chunk-00N.mp4` by `remotion render … --frames=FROM-TO`, and is
checked on the spot: both streams present, length as expected, audio within 150 ms of its video. A chunk
that fails this check is never handed to the stitch step, so a bad chunk cannot poison the join.

**Stitch and verify** — `scripts/stitch.py`

```bash
python3 scripts/stitch.py                        # verify → stitch → verify → re-stitch if unclean
python3 scripts/stitch.py --max-attempts 4
python3 scripts/stitch.py --rerender-bad-chunks  # also re-render a chunk whose own A/V disagree
```

It does four things, in this order:

1. **Order.** Finds `chunk-*.mp4`, sorts by number, and refuses to continue if the numbering has a gap or
   a duplicate. A missing chunk means missing video, not a shorter video.
2. **Per-chunk verification.** Both streams present; length within 250 ms of the manifest; audio within
   150 ms of video. This is where audio lag is caught, and it is reported per chunk in milliseconds.
3. **Stitch.** ffmpeg concat demuxer in numeric order, `-c copy` first — frame-exact and fast, because
   every chunk came out of the same encoder settings — with `+faststart`.
4. **Verify the result, and redo it if it is not clean.** The stitched file must have both streams, the
   expected total duration, and audio within 150 ms of video. If any of that fails, the stitch is redone
   with a full re-encode (`libx264 crf 18` + `aac` 48 kHz, CFR) and verified again, up to
   `--max-attempts`. Verification is never skipped after a retry.

Exit codes: `0` clean; `2` a chunk is broken, which stitching cannot repair — the script names the chunk;
`3` the stitch itself never verified. In every case `out/stitch-report.json` records each chunk's length,
its drift in milliseconds, the stitch mode that was used and the final duration.

**Workflow shape for a chunked render** — plan, render the chunks as a matrix, stitch in a final job:

```yaml
jobs:
  plan:
    runs-on: ubuntu-latest
    outputs:
      chunks: ${{ steps.plan.outputs.chunks }}
    steps:
      - uses: actions/checkout@v4
      # … node, npm ci, piper, voice (see 3.3) …
      - run: python3 scripts/tts.py --piper .piper/piper/piper --voice .piper/$ID.onnx
      - id: plan
        run: echo "chunks=$(python3 scripts/render_chunks.py --plan --json)" >> "$GITHUB_OUTPUT"
      - uses: actions/upload-artifact@v4
        with: { name: audio, path: public/audio }

  render:
    needs: plan
    strategy:
      matrix:
        chunk: ${{ fromJSON(needs.plan.outputs.chunks) }}
      max-parallel: 2
    steps:
      - uses: actions/checkout@v4
      # … node, npm ci, piper, voice, then restore the audio artifact into public/audio …
      - run: python3 scripts/render_chunks.py --only ${{ matrix.chunk.index }}
      - uses: actions/upload-artifact@v4
        with:
          name: chunk-${{ matrix.chunk.index }}
          path: out/chunks/chunk-*.mp4

  stitch:
    needs: [plan, render]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with: { pattern: "chunk-*", merge-multiple: true, path: out/chunks }
      - run: python3 scripts/stitch.py
      - uses: actions/upload-artifact@v4
        with: { name: video, path: out/video.mp4, if-no-files-found: error }
```

The stitch job renders nothing by default — a broken chunk has to be fixed at its source, not in the
join. `--rerender-bad-chunks` exists for a local run, where node, Piper and the audio are all present.

---

### 3.7 Deliver

Download the artifact (it comes back as a zip; unzip, then copy the MP4 to the output directory),
verify (§6), and hand over the file. Also give the user the repo link and the run link — they can
re-run with one click.

---

## 4. Language and voice

Two engines are wired up, and the choice is per video. Both write one WAV per scene and both regenerate
`src/manifest.json` from the measured audio, so nothing downstream changes.

| | **Piper** — `scripts/tts.py` | **Kokoro-82M** — `scripts/tts_kokoro.py` |
|---|---|---|
| Sound | clear but audibly synthetic | markedly more human; natural pauses and prosody |
| Weights | 63 MB voice + 26 MB engine | 311 MB ONNX model + 27 MB voice pack |
| Speed (2 vCPU, measured) | RTF ≈ 0.4 — faster than real time | RTF ≈ 3–4 — about 6–8 core-seconds per audio second |
| Languages | 53 | 8 (en-US, en-GB, es, fr, hi, it, ja, pt-BR, zh) |
| Voices | 178 | 54 |
| Licence | engine MIT, voices vary | **Apache-2.0**, model and voices |
| Output | 22 050 Hz mono | 24 000 Hz mono |

Rule of thumb: **use Kokoro when the voice carries the video** (explainer, documentary, promo — anything
a person will listen to for two minutes) and Piper when you need 53 languages, a fast turnaround, or a
narrator that must not sound like a person at all (kids' adventure, stylised fantasy).

### 4.1 Kokoro-82M — the human-sounding upgrade

82 M parameters, Apache-2.0, 24 kHz, and the most-downloaded open TTS model on the Hub (10.8 M downloads).
It runs on plain CPU through onnxruntime — no torch, no GPU — which is why it fits a free runner.

```bash
pip install kokoro-onnx
curl -L -o kokoro-v1.0.onnx https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
curl -L -o voices-v1.0.bin  https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
python3 scripts/tts_kokoro.py --model kokoro-v1.0.onnx --voices voices-v1.0.bin
```

`narration.json` gains a voice and a language, and any scene may override them:

```json
{ "fps": 30, "engine": "kokoro", "voice": "af_heart", "lang": "en-us", "speed": 1.0,
  "scenes": [
    { "id": "01-title", "text": "..." },
    { "id": "02-hindi", "text": "...", "voice": "hf_alpha", "lang": "hi" }
  ] }
```

Voices worth knowing: `af_heart`, `af_bella`, `am_michael` (English), `bf_emma` (British),
`hf_alpha`, `hm_omega` (Hindi), `ff_siwis` (French), `if_sara` (Italian), `jf_alpha` (Japanese),
`pf_dora` (Portuguese), `zf_xiaobei` (Mandarin). The full list is `VOICES.md` in the model repo.

**Cost, measured on 2 vCPUs:** 4.1 s of speech took 17.8 s of CPU, so budget roughly **6–8 core-seconds
per second of audio** — a 2.5-minute narration is about 5–10 minutes of runner time on top of the render.
That is the price of the better voice; it is not a problem, it is just not free.

**Honest limits.** Eight languages only. Non-English support is thin where training data is thin: the
model card grades the Hindi voices **C** with only minutes of Hindi training data, so Hindi comes out
intelligible but less polished than English. Non-English also leans on espeak-ng for phonemes, so
pronunciation of names and loanwords can slip. Always listen to the first 20 seconds before shipping.

### 4.2 Piper — the default, and the fastest

Piper ships 178 voices across the languages below (verified against `voices.json`). Pick one voice per
video; you *may* switch voices scene by scene, because each scene has its own audio file.

| Language | Voice id to use | Note |
|---|---|---|
| English (US) | `en_US-lessac-medium` | the reference voice; `en_US-ryan-high` for a warmer male read |
| English (GB) | `en_GB-alba-medium` | |
| Hindi | `hi_IN-pratham-medium` / `hi_IN-priyamvada-medium` | male / female |
| Bengali | `bn_BD-google-medium` | |
| Marathi | `mr_IN-google-medium` | |
| Telugu | `te_IN-venkatesh-medium` / `te_IN-padmavathi-medium` | |
| Malayalam | `ml_IN-arjun-medium` / `ml_IN-meera-medium` | |
| Nepali | `ne_NP-chitwan-medium` | |
| Urdu | `ur_PK-fasih-medium` | right-to-left |
| Arabic | `ar_JO-kareem-medium` | right-to-left |
| Spanish | `es_ES-davefx-medium`, `es_MX-claude-high` | |
| French | `fr_FR-siwis-medium`, `fr_FR-tom-medium` | |
| German | `de_DE-thorsten-high` | |
| Portuguese (BR) | `pt_BR-faber-medium` | |
| Russian | `ru_RU-irina-medium` | |
| Japanese | `ja_JP-hi_fi_captain-medium` | |
| Chinese | `zh_CN-huayan-medium` | |
| Korean | `ko_KR-kss-medium` | |
| Indonesian | `id_ID-news_tts-medium` | |
| Turkish | `tr_TR-dfki-medium` | |
| Vietnamese | `vi_VN-vais1000-medium` | |
| Swahili | `sw_CD-lanfrica-medium` | |

Piper's full language list: ar, bg, bn, ca, cs, cy, da, de, el, en, es, et, eu, fa, fi, fr, he, hi,
hu, hy, id, is, it, ja, ka, kk, ko, ku, lb, lt, lv, ml, mr, ne, nl, no, pl, pt, ro, ru, sk, sl, sq,
sr, sv, sw, te, th, tr, uk, ur, vi, zh.

### 4.3 Heavier models, and when they are worth it

All sizes and licences below were read off the Hub. Anything past ~1 GB stops being comfortable on a
free runner: it is a GPU model, or a CPU render measured in tens of minutes.

| Model | Licence | Languages | Weights | Verdict for a free runner |
|---|---|---|---|---|
| `ResembleAI/chatterbox` | MIT | 23, **including Hindi** | 2.1 GB per checkpoint (0.5 B) | Not on CPU — real-time factor is far above 1 |
| `Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice` | Apache-2.0 | 10, no Indic | 1.8 GB + 0.7 GB tokenizer | Borderline; slower than Kokoro for no gain here |
| `microsoft/VibeVoice-Realtime-0.5B` | MIT | English | 2.0 GB | Realtime streaming design, not a batch narrator |
| `ai4bharat/indic-parler-tts` | Apache-2.0 | 18 Indic: as, bn, gu, hi, kn, ks, or, ml, mr, ne, pa, sa, sd, ta, te, ur, om | 3.75 GB | The quality answer for Tamil/Telugu/Gujarati/Kannada/Punjabi/Odia — if you will spend 20+ minutes of runner time |
| `kenpath/svara-tts-v1` | Apache-2.0 | 18 Indic | 13.2 GB | Does not fit a free runner |
| `k2-fsa/OmniVoice` | **licence not declared** | 1000+ | 3.2 GB | Do not ship it until the licence is clear |

Decision order: Kokoro if the language is one of its eight → Piper if it is one of its 53 →
`indic-parler-tts` if it is an Indic language neither covers and the quality matters →
MMS (§4.4) as the always-works fallback.

**Can the Hugging Face connector just synthesise the audio?** No. None of the thirty most-downloaded
text-to-speech models on the Hub expose an inference-provider mapping, so they are not callable through
the serverless inference API, and the connector's speech-adjacent tools stop at endpoint management,
repo commits, model search and embeddings — there is no text-to-speech call. Hugging Face is where the
*weights* come from; the synthesis always happens on the runner, from downloaded files. That is also why
every step above is a `curl` and a `pip install` rather than an API key.

### 4.4 Languages neither engine covers

Tamil, Gujarati, Kannada, Punjabi, Odia and Assamese are in neither Piper nor Kokoro. Two ways out:
`ai4bharat/indic-parler-tts` (§4.3) when the quality matters, or Meta's MMS-TTS — a small VITS model with
a checkpoint for every one of them — when you just need it to work:

```python
# pip install transformers torch scipy  (~2 GB on the runner; budget 3–4 extra minutes)
import numpy as np, scipy.io.wavfile
from transformers import VitsModel, AutoTokenizer

MODEL = "facebook/mms-tts-tam"   # tam, guj, kan, pan, ory, asm, hin
model = VitsModel.from_pretrained(MODEL)
tok = AutoTokenizer.from_pretrained(MODEL)

inputs = tok("உங்கள் வாக்கியம் இங்கே.", return_tensors="pt")
with __import__("torch").no_grad():
    wav = model(**inputs).waveform[0].numpy()

pcm = np.clip(wav, -1.0, 1.0)
scipy.io.wavfile.write("out.wav", rate=model.config.sampling_rate, data=(pcm * 32767).astype(np.int16))
```

Write the same measured-duration step afterwards so the manifest is still built from real audio.

**Non-Latin scripts need fonts.** Load a Noto face in `theme.ts` — `Noto Sans Devanagari` for Hindi/
Marathi/Nepali, `Noto Sans Bengali`, `Noto Sans Telugu`, `Noto Sans Malayalam`, `Noto Sans Tamil`,
`Noto Sans Arabic` for Urdu/Arabic, `Noto Sans JP` / `Noto Sans SC` for Japanese/Chinese — via
`loadFont` from `@remotion/google-fonts`. Without it the runner falls back to a font with no glyphs
and the video renders with boxes. For right-to-left text set `direction: "rtl"` and
`textAlign: "right"` on the text container.

### 4.5 Writing for the ear

**Narration is written for the ear, not the eye.** In every language: spell numbers out
("one thousand five hundred and sixty eight", not "1568"), say "times" and "equals" instead of × and =,
say "eight choose two" instead of ⁸C₂, avoid abbreviations, keep sentences under 20 words, and end each
scene on a complete thought so the cut lands cleanly.

---

## 5. Genre → design system

Pick one preset, then hold it for the whole video. Consistency reads as production value; variety
reads as a slideshow.

| Genre | Palette | Type | Motion | Audio |
|---|---|---|---|---|
| **Explainer / tutorial** | paper `#faf8f3`, ink `#1c2430`, indigo `#4f46e5`, amber `#fde9c8` | Inter 800 + Lora for maths | calm springs, staggered reveals, ~18-frame rise | none, or −28 dB soft pad |
| **Adventure / kids** | sand `#fff3e0`, teal `#0f766e`, coral `#f97316` | Baloo 2 / Nunito 800 | bouncy springs, 6–8 frame cuts, wiggles | light percussion, −22 dB |
| **Fantasy** | night `#12122b`, plum `#3b1f5e`, gold `#e8b84b` | Cinzel / Cormorant display | slow drifts, 40-frame fades, glow | low strings, −24 dB |
| **Documentary** | charcoal `#16181d`, bone `#f2efe9`, olive `#6b7a4f` | Source Serif 4 | slow pans, no bounce | ambient bed, −26 dB |
| **Product / promo** | near-black `#0b0f14`, brand accent, white | Inter tight (letter-spacing −0.03em) | snap cuts, 6-frame moves, scale-pops | beat-driven, −18 dB |
| **Science / data** | near-black, cyan `#22d3ee`, magenta `#e879f9` | IBM Plex Sans + Plex Mono labels | linear reveals, no overshoot | none |

Fonts come from `@remotion/google-fonts`; load only the weights you use (each weight is a download in
the runner).

### Scene grammar

**Explainer (8–12 scenes):** hook with the payoff stated → the setup → three moves → the payoff
repeated with the numbers → a sanity check → the tempting wrong method → recap.
**Adventure (8–10):** ordinary world → the call → departure → first obstacle → ally or tool →
the trial → climax → return changed.
**Fantasy (8–12):** the world and its rule → the inciting prophecy or wound → the journey → the trial
that tests the rule → revelation → the cost → resolution.
**Documentary (8–12):** the claim → three pieces of evidence → the strongest counterpoint → synthesis.
**Promo (5–7):** problem → product as the answer → three proof points → the ask.

Every genre ends on a recap scene: the whole idea in one sentence and one number or image.

---

## 6. QA gate — do not deliver without this

Run all four checks; each one has caught a real defect in practice.

1. **Container and streams.**
   ```bash
   ffprobe -v error -show_entries format=duration,size -of default=nw=1 out/video.mp4
   ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate \
     -of default=nw=1 out/video.mp4
   ```
   Expect one `h264` video stream at the intended size and one `aac` audio stream. If the audio stream
   is missing, the manifest is pointing at WAVs that were never bundled: check that `scripts/tts.py`
   ran before the render, and that the manifest paths are `audio/<scene-id>.wav` relative to `public/`.

2. **The voice is really there.**
   ```bash
   ffmpeg -hide_banner -i out/video.mp4 -t 20 -af volumedetect -f null - 2>&1 | grep volume
   ```
   `mean_volume` between −22 and −14 dB, `max_volume` ≤ −1 dB. Silence reads around −70 dB.

3. **Look at one frame per scene.** Extract at each scene's midpoint and actually view them.
   ```bash
   for t in 6 36 48 61 88; do ffmpeg -loglevel error -ss $t -i out/video.mp4 -frames:v 1 f$t.jpg -y; done
   ```
   Check: nothing clipped at the edges, no text overlapping the board or the progress bar, no
   `.notdef` boxes from a missing font, no literal escape sequences like `\u2192` in SVG captions
   (use real characters in JSX *text children*, not escape sequences).

4. **Timing drift.** `sum(scene.seconds)` from the manifest should be within ~1 s per minute of the
   video duration; if it is not, the manifest was not regenerated after the last script edit.

5. **Chunk and stitch integrity, for anything rendered in chunks.** `python3 scripts/stitch.py` checks
   every chunk's length and audio-vs-video agreement, stitches in numeric order, and verifies the result;
   if the join is not clean it redoes it — stream copy first, then a full re-encode — and verifies again.
   It exits non-zero and names the offending chunk if it cannot get there. A green render is not the same
   as a clean stitch, so this check is not optional.

---

## 7. Failure modes and fixes

| Symptom | Cause | Fix |
|---|---|---|
| `RangeError: WebAssembly.Instance(): Out of memory` while bundling | sandbox/container cannot allocate wasm; webpack's md4 hash needs it | **Render on the runner.** This is why the playbook forbids sandbox rendering. |
| `ENOENT ... node_modules/.cache/webpack/...` | Remotion tries to clear a cache it then expects to exist | `rm -rf node_modules/.cache` and re-run; on the runner it is a fresh checkout anyway |
| `npm install` dies with `std::bad_alloc` | < 2 GB RAM while extracting many packages | run installs on the runner, or `--maxsockets=3 --ignore-scripts` locally |
| Chrome download stalls (`remotion.media` unreachable) | network egress blocked | runner, or `--browser-executable=/usr/local/bin/chromium` if a browser exists |
| Render fails at `staticFile("audio/…")` | TTS step did not run or wrote to the wrong folder | run `scripts/tts.py` first; audio lives in `public/audio/` |
| 404 downloading a voice | wrong voice id or path | check the id against `voices.json` |
| Video ends before the last sentence | `pad` too small, or manifest stale | raise `pad` to 0.8, regenerate the manifest |
| Boxes instead of glyphs | no font with that script loaded | load the Noto face for the language |
| Captions clipped inside SVG | text wider than the `viewBox` | widen the viewBox or centre captions at the viewBox midpoint, never at the shape's midpoint |
| Artifact expired before download | default retention | set `retention-days: 14`, and attach the MP4 to a GitHub Release for anything permanent |
| A long video does not finish in one render | long renders are chunked, not shortened | see §3.6 — render numbered chunks, then stitch and verify |

---

## 8. Optional extras

- **Music bed.** `ffmpeg -i video.mp4 -i bed.mp3 -filter_complex "[1:a]volume=0.12,aloop=loop=-1:size=2e9[m];[0:a][m]amix=inputs=2:duration=first" out/mixed.mp4` — keep it under −20 dB under speech.
- **Subtitles.** Emit an SRT from the manifest: each scene's start = cumulative frames / fps, end = start + seconds; split long scenes at sentence boundaries.
- **Vertical cut.** Re-render with `width={1080} height={1920}` and a stacked layout; keep body text ≥ 28 px and leave 220 px top and bottom for platform UI.
- **Thumbnail.** `ffmpeg -ss <hook frame> -i video.mp4 -frames:v 1 -q:v 2 thumb.jpg`, then overlay the title at 96 px.
- **Chapter cards.** Insert a 1.5 s silent scene between chapters (`text: ""`, `minSeconds: 1.5`).

---

## 9. Worked reference

`sachnoor2/two-squares-explainer` — the build this playbook came from:

- 10 scenes, 152 s of speech, 4772 frames, 1920×1080 at 30 fps, 2 min 38 s finished.
- Voice: `en_US-lessac-medium` via Piper; 63 MB ONNX, real-time factor ≈ 0.42 on 2 vCPU.
- Runner job: ~4 min (npm ci → piper → tts → tsc → remotion render → ffmpeg stitch → upload).
- Delivered: 9.1 MB H.264 MP4 with AAC stereo audio, plus the stitched `narration.wav`.
- Defects caught in QA: SVG captions clipped by their viewBox; `\u2192` rendered literally because it
  sat in a JSX text child rather than a string expression. Both were found by looking at frames, not by
  reading logs.

---

## 10. Definition of done

- [ ] `narration.json` written for the ear, in the requested language, numbers spelled out
- [ ] manifest regenerated from the real audio; scene lengths derived, not typed
- [ ] one design system held across every scene; fonts loaded for the script in use
- [ ] rendered on GitHub Actions, artifact downloaded
- [ ] ffprobe shows h264 video + aac audio at the intended size and duration
- [ ] audio level checked; one frame per scene viewed
- [ ] MP4 and `narration.wav` delivered, repo and run links shared
- [ ] if the video was chunked: `stitch.py` reports `stage: done`, chunks numbered without gaps, drift under 100 ms
- [ ] the one-line recap scene exists and states the takeaway
