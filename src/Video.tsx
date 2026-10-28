import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { manifest } from "./manifest";
import { SCENES } from "./scenes";
import { theme } from "./theme";

const ProgressBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = Math.min(1, frame / Math.max(1, durationInFrames - 1));
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 8,
          background: "#efece3",
        }}
      >
        <div style={{ width: `${p * 100}%`, height: "100%", background: theme.accent }} />
      </div>
    </AbsoluteFill>
  );
};

export const Video: React.FC = () => {
  let from = 0;

  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      {manifest.scenes.map((scene) => {
        const start = from;
        from += scene.frames;
        const Scene = SCENES[scene.id];

        if (!Scene) {
          return null;
        }

        return (
          <Sequence
            key={scene.id}
            from={start}
            durationInFrames={scene.frames}
            name={`${scene.id} · ${scene.seconds.toFixed(1)}s`}
          >
            <Scene dur={scene.frames} />
            <Audio src={staticFile(scene.audio)} />
          </Sequence>
        );
      })}

      <ProgressBar />
    </AbsoluteFill>
  );
};
