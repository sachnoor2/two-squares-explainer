import raw from "./manifest.json";

export type SceneTiming = {
  id: string;
  audio: string;
  seconds: number;
  frames: number;
};

export type Manifest = {
  fps: number;
  voice: string;
  totalSeconds: number;
  totalFrames: number;
  scenes: SceneTiming[];
};

export const manifest = raw as Manifest;
