import React from "react";
import { Composition } from "remotion";
import { manifest } from "./manifest";
import { Video } from "./Video";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="TwoSquares"
    component={Video}
    durationInFrames={manifest.totalFrames}
    fps={manifest.fps}
    width={1920}
    height={1080}
  />
);
