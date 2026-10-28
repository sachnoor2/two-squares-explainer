import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadLora } from "@remotion/google-fonts/Lora";

const interLoad = loadInter("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

const loraLoad = loadLora("normal", {
  weights: ["500", "600", "700"],
  subsets: ["latin"],
});

export const inter = interLoad.fontFamily;
export const lora = loraLoad.fontFamily;

export const theme = {
  bg: "#faf8f3",
  ink: "#1c2430",
  body: "#3b4553",
  muted: "#5b6472",
  faint: "#a8a294",
  line: "#e7e2d6",
  card: "#ffffff",
  accent: "#4f46e5",
  accentDark: "#4338ca",
  accentSoft: "#efeafc",
  mint: "#e7f4ee",
  block: "#fde9c8",
  blockLine: "#e9b872",
  ok: "#0f766e",
  okSoft: "#e8f6ef",
  bad: "#c2410c",
  badSoft: "#fdf0ea",
} as const;
