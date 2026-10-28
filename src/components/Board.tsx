import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";

export type Cell = { r: number; c: number };
export type Mode = "idle" | "rows" | "cols" | "block" | "pairs";

const N = 8;
const keyOf = (c: Cell) => `${c.r}:${c.c}`;

type BoardProps = {
  rows?: number[];
  cols?: number[];
  mode?: Mode;
  pair?: [Cell, Cell] | null;
  extra?: [Cell, Cell][];
  cell?: number;
  dim?: boolean;
  startDelay?: number;
};

export const Board: React.FC<BoardProps> = ({
  rows = [],
  cols = [],
  mode = "idle",
  pair = null,
  extra = [],
  cell = 74,
  dim = false,
  startDelay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const gap = 6;

  const lit = new Set<string>();
  if (pair) pair.forEach((c) => lit.add(keyOf(c)));
  extra.forEach((p) => p.forEach((c) => lit.add(keyOf(c))));

  const block = new Set<string>();
  rows.forEach((r) => cols.forEach((c) => block.add(`${r}:${c}`)));

  const rowTint = mode !== "idle";
  const colTint = mode === "cols" || mode === "block" || mode === "pairs";
  const showBlock = mode === "block" || mode === "pairs";
  const labelSize = Math.round(cell * 0.3);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      <div style={{ display: "flex", gap, paddingLeft: Math.round(cell * 0.7) }}>
        {Array.from({ length: N }, (_, c) => (
          <div
            key={c}
            style={{
              width: cell,
              textAlign: "center",
              fontFamily: "inherit",
              fontSize: labelSize,
              fontWeight: 700,
              color: cols.includes(c) ? theme.accent : theme.faint,
            }}
          >
            {c + 1}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap }}>
        <div style={{ display: "flex", flexDirection: "column", gap, width: Math.round(cell * 0.7) }}>
          {Array.from({ length: N }, (_, r) => (
            <div
              key={r}
              style={{
                height: cell,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: labelSize,
                fontWeight: 700,
                color: rows.includes(r) ? theme.accent : theme.faint,
              }}
            >
              {r + 1}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap }}>
          {Array.from({ length: N }, (_, r) => (
            <div key={r} style={{ display: "flex", gap }}>
              {Array.from({ length: N }, (_, c) => {
                const key = `${r}:${c}`;
                const appear = spring({
                  frame: frame - startDelay - (r + c) * 1.1,
                  fps,
                  config: { damping: 200 },
                  durationInFrames: 18,
                });
                const isLit = lit.has(key);
                let bg: string = theme.card;
                let border: string = theme.line;
                if (rowTint && rows.includes(r)) bg = theme.accentSoft;
                if (colTint && cols.includes(c)) bg = theme.mint;
                if (showBlock && block.has(key)) {
                  bg = theme.block;
                  border = theme.blockLine;
                }
                if (isLit) {
                  bg = theme.accent;
                  border = theme.accentDark;
                }
                const pop = isLit
                  ? spring({ frame: frame - 2, fps, config: { damping: 11 }, durationInFrames: 22 })
                  : 0;

                return (
                  <div
                    key={key}
                    style={{
                      width: cell,
                      height: cell,
                      borderRadius: 9,
                      background: bg,
                      border: `2px solid ${border}`,
                      boxSizing: "border-box",
                      opacity: appear * (dim && !isLit ? 0.5 : 1),
                      transform: `scale(${isLit ? 1 + 0.05 * Math.min(pop, 1) : 1})`,
                      boxShadow: isLit ? "0 10px 24px -12px rgba(79,70,229,0.9)" : "none",
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const MiniBoard: React.FC<{
  cell?: number;
  delay?: number;
  highlights?: number[];
}> = ({ cell = 130, delay = 0, highlights = [0, 3] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const gap = 8;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(2, ${cell}px)`, gap }}>
      {[0, 1, 2, 3].map((i) => {
        const on = highlights.includes(i);
        const pop = spring({ frame: frame - delay - i * 4, fps, config: { damping: 12 }, durationInFrames: 20 });
        return (
          <div
            key={i}
            style={{
              width: cell,
              height: cell,
              borderRadius: 12,
              background: on ? theme.accent : theme.card,
              border: `2px solid ${on ? theme.accentDark : theme.line}`,
              transform: `scale(${on ? 0.9 + 0.1 * Math.min(pop, 1) : 1})`,
              boxShadow: on ? "0 14px 30px -16px rgba(79,70,229,0.9)" : "none",
            }}
          />
        );
      })}
    </div>
  );
};
