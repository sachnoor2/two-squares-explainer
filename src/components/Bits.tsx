import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { inter, lora, theme } from "../theme";

/* ---------------- motion helpers ---------------- */

export const Rise: React.FC<{
  delay?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
  from?: number;
}> = ({ delay = 0, children, style, from = 22 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 20 });
  return (
    <div style={{ opacity: p, transform: `translateY(${(1 - p) * from}px)`, ...style }}>{children}</div>
  );
};

/* ---------------- layout ---------------- */

export const Stage: React.FC<{
  board: React.ReactNode;
  children: React.ReactNode;
  boardWidth?: number;
}> = ({ board, children, boardWidth = 700 }) => (
  <AbsoluteFill
    style={{
      background: theme.bg,
      padding: "64px 80px 96px",
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      gap: 72,
      fontFamily: inter,
    }}
  >
    <div
      style={{
        width: boardWidth,
        flex: "0 0 auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {board}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
  </AbsoluteFill>
);

export const Eyebrow: React.FC<{ children: React.ReactNode; delay?: number }> = ({
  children,
  delay = 0,
}) => (
  <Rise delay={delay}>
    <div
      style={{
        fontFamily: inter,
        fontSize: 24,
        fontWeight: 700,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: theme.faint,
        marginBottom: 20,
      }}
    >
      {children}
    </div>
  </Rise>
);

export const Heading: React.FC<{ children: React.ReactNode; delay?: number; size?: number }> = ({
  children,
  delay = 8,
  size = 62,
}) => (
  <Rise delay={delay}>
    <h1
      style={{
        fontFamily: inter,
        fontSize: size,
        fontWeight: 800,
        lineHeight: 1.08,
        letterSpacing: "-0.025em",
        color: theme.ink,
        margin: 0,
      }}
    >
      {children}
    </h1>
  </Rise>
);

export const Body: React.FC<{
  children: React.ReactNode;
  delay?: number;
  size?: number;
  muted?: boolean;
  style?: React.CSSProperties;
}> = ({ children, delay = 20, size = 33, muted = false, style }) => (
  <Rise delay={delay}>
    <p
      style={{
        fontFamily: inter,
        fontSize: size,
        lineHeight: 1.5,
        color: muted ? theme.muted : theme.body,
        margin: "24px 0 0",
        ...style,
      }}
    >
      {children}
    </p>
  </Rise>
);

/* ---------------- math bits ---------------- */

export const Formula: React.FC<{
  children: React.ReactNode;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}> = ({ children, size = 40, color = theme.ink, style }) => (
  <span
    style={{
      fontFamily: lora,
      fontSize: size,
      fontWeight: 600,
      color,
      whiteSpace: "nowrap",
      ...style,
    }}
  >
    {children}
  </span>
);

export const NC: React.FC<{ n: number; k: number; size?: number; color?: string }> = ({
  n,
  k,
  size = 40,
  color = theme.ink,
}) => (
  <span style={{ fontFamily: lora, fontSize: size, fontWeight: 600, color, whiteSpace: "nowrap" }}>
    <sup style={{ fontSize: "0.62em" }}>{n}</sup>C<sub style={{ fontSize: "0.62em" }}>{k}</sub>
  </span>
);

export const Pill: React.FC<{
  children: React.ReactNode;
  tone?: "default" | "accent" | "ok" | "bad";
}> = ({ children, tone = "default" }) => {
  const tones = {
    default: { bg: "#f1eee6", fg: "#8a7f6a" },
    accent: { bg: theme.accentSoft, fg: theme.accentDark },
    ok: { bg: theme.okSoft, fg: theme.ok },
    bad: { bg: theme.badSoft, fg: theme.bad },
  }[tone];
  return (
    <span
      style={{
        display: "inline-block",
        background: tones.bg,
        color: tones.fg,
        fontFamily: inter,
        fontSize: 26,
        fontWeight: 700,
        letterSpacing: "0.04em",
        padding: "10px 22px",
        borderRadius: 999,
      }}
    >
      {children}
    </span>
  );
};

export const CalcRow: React.FC<{
  items: { big: string; cap: string; accent?: boolean }[];
  ops: string[];
  delay?: number;
}> = ({ items, ops, delay = 24 }) => (
  <Rise delay={delay}>
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 26,
        flexWrap: "wrap",
        background: "#f7f5ef",
        border: `2px solid ${theme.line}`,
        borderRadius: 20,
        padding: "26px 30px",
        marginTop: 30,
      }}
    >
      {items.map((it, i) => (
        <React.Fragment key={i}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span
              style={{
                fontFamily: inter,
                fontSize: 58,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                lineHeight: 1,
                color: it.accent ? theme.accent : theme.ink,
              }}
            >
              {it.big}
            </span>
            <span
              style={{
                fontFamily: inter,
                fontSize: 17,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: theme.faint,
              }}
            >
              {it.cap}
            </span>
          </div>
          {i < items.length - 1 ? (
            <span
              style={{
                fontFamily: inter,
                fontSize: 40,
                color: theme.faint,
                lineHeight: 1,
                paddingBottom: 22,
              }}
            >
              {ops[i]}
            </span>
          ) : null}
        </React.Fragment>
      ))}
    </div>
  </Rise>
);

/* ---------------- figures ---------------- */

export const LineFigure: React.FC<{ gap: 1 | 2; ok: boolean; width?: number }> = ({
  gap,
  ok,
  width = 300,
}) => {
  const x0 = 40;
  const unit = 64;
  const top = 26;
  const bottom = 132;
  const xs = [0, 1, 2, 3].map((i) => x0 + i * unit);
  return (
    <svg viewBox="0 0 300 200" style={{ width }} role="img">
      <rect
        x={xs[0]}
        y={top}
        width={xs[gap] - xs[0]}
        height={bottom - top}
        fill={ok ? "#d7f2e4" : "#fbe0d8"}
      />
      {xs.map((x, i) => (
        <line key={i} x1={x} y1={top} x2={x} y2={bottom} stroke="#a8a294" strokeWidth={3} />
      ))}
      <text
        x={150}
        y={bottom + 40}
        textAnchor="middle"
        fontSize="17"
        fontFamily={inter}
        fontWeight="700"
        fill={ok ? theme.ok : theme.bad}
      >
        {ok ? "adjacent → square ✓" : "2 apart → rectangle ✗"}
      </text>
    </svg>
  );
};

export const SharedLineFigure: React.FC<{ width?: number }> = ({ width = 300 }) => (
  <svg viewBox="0 0 300 320" style={{ width }} role="img">
    <rect x={45} y={30} width={210} height={210} fill={theme.card} stroke={theme.line} strokeWidth={2} />
    <line x1={45} y1={135} x2={255} y2={135} stroke={theme.line} strokeWidth={2} />
    <line x1={150} y1={30} x2={150} y2={240} stroke={theme.line} strokeWidth={2} />
    <rect x={49} y={34} width={98} height={98} rx={10} fill={theme.accent} />
    <rect x={153} y={139} width={98} height={98} rx={10} fill={theme.accent} />
    <line x1={35} y1={135} x2={265} y2={135} stroke="#f59e0b" strokeWidth={7} />
    <text x={150} y={282} textAnchor="middle" fontSize="16" fontFamily={inter} fontWeight="700" fill={theme.faint}>
      {"shared line,"}
    </text>
    <text x={150} y={306} textAnchor="middle" fontSize="16" fontFamily={inter} fontWeight="700" fill={theme.faint}>
      {"different rows → allowed"}
    </text>
  </svg>
);
