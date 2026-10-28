import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Board, Cell, MiniBoard } from "./components/Board";
import {
  Body,
  CalcRow,
  Eyebrow,
  Formula,
  Heading,
  LineFigure,
  NC,
  Pill,
  Rise,
  SharedLineFigure,
  Stage,
} from "./components/Bits";
import { inter, theme } from "./theme";

export type SceneProps = { dur: number };

const ROWS = [2, 6];
const COLS = [1, 4];
const blockCells: Cell[] = ROWS.flatMap((r) => COLS.map((c) => ({ r, c })));

const allPairs = (cells: Cell[]): [Cell, Cell][] => {
  const out: [Cell, Cell][] = [];
  for (let i = 0; i < cells.length; i++)
    for (let j = i + 1; j < cells.length; j++) out.push([cells[i], cells[j]]);
  return out;
};

const verdictOf = (p: [Cell, Cell]) => (p[0].r === p[1].r ? "same row" : p[0].c === p[1].c ? "same column" : "allowed");
const cellLabel = (c: Cell) => `(${c.r + 1}, ${c.c + 1})`;

const PAIRS = allPairs(blockCells);
const VALID = PAIRS.filter((p) => verdictOf(p) === "allowed");

/* ------------------------------------------------------------------ */
/* 1. title                                                            */
/* ------------------------------------------------------------------ */

export const TitleScene: React.FC<SceneProps> = () => (
  <AbsoluteFill
    style={{
      background: theme.bg,
      alignItems: "center",
      justifyContent: "center",
      padding: "0 140px",
      fontFamily: inter,
    }}
  >
    <Rise delay={4}>
      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: theme.faint,
          textAlign: "center",
        }}
      >
        Permutations &amp; combinations
      </div>
    </Rise>
    <Rise delay={14}>
      <h1
        style={{
          fontSize: 92,
          fontWeight: 800,
          color: theme.ink,
          letterSpacing: "-0.03em",
          lineHeight: 1.06,
          textAlign: "center",
          margin: "30px 0 0",
        }}
      >
        Two squares, never sharing
        <br />a row or a column
      </h1>
    </Rise>
    <Rise delay={32}>
      <div style={{ fontSize: 36, color: theme.muted, marginTop: 40, textAlign: "center" }}>
        …and the one factor everybody forgets
      </div>
    </Rise>
  </AbsoluteFill>
);

/* ------------------------------------------------------------------ */
/* 2. the problem                                                      */
/* ------------------------------------------------------------------ */

export const ProblemScene: React.FC<SceneProps> = () => (
  <Stage board={<Board cell={70} />}>
    <Eyebrow>The problem</Eyebrow>
    <Heading>An 8 × 8 board, two squares</Heading>
    <Body delay={22}>
      Two unit squares are picked. They must not share a <strong>row</strong> and must not share a{" "}
      <strong>column</strong>.
    </Body>
    <Body delay={40} muted size={30}>
      There are 64 cells, so <Formula size={30}>2016</Formula> pairs in total — and the illegal ones are
      exactly the pairs that sit in one row or one column.
    </Body>
    <Body delay={58} muted size={30}>
      We could count everything and subtract. Instead, let&apos;s build the answer directly, in three moves.
    </Body>
  </Stage>
);

/* ------------------------------------------------------------------ */
/* 3. rows                                                             */
/* ------------------------------------------------------------------ */

export const RowsScene: React.FC<SceneProps> = () => (
  <Stage board={<Board rows={ROWS} mode="rows" />}>
    <Eyebrow delay={6}>Move 1 of 3</Eyebrow>
    <Heading delay={12}>Choose two of the eight rows</Heading>
    <Body delay={24}>
      Every square sits in exactly one row. Decide which two rows your two squares will live in.
    </Body>
    <Rise delay={38}>
      <div style={{ display: "flex", alignItems: "center", gap: 22, marginTop: 34 }}>
        <NC n={8} k={2} size={54} />
        <Formula size={44} color={theme.faint}>
          =
        </Formula>
        <Formula size={54} color={theme.accent}>
          28
        </Formula>
      </div>
    </Rise>
    <Rise delay={52}>
      <div style={{ marginTop: 26 }}>
        <Pill tone="accent">rows 3 and 7, for example</Pill>
      </div>
    </Rise>
  </Stage>
);

/* ------------------------------------------------------------------ */
/* 4. columns                                                          */
/* ------------------------------------------------------------------ */

export const ColumnsScene: React.FC<SceneProps> = () => (
  <Stage board={<Board rows={ROWS} cols={COLS} mode="cols" />}>
    <Eyebrow delay={6}>Move 2 of 3</Eyebrow>
    <Heading delay={12}>Choose two of the eight columns</Heading>
    <Body delay={24}>
      Same count across the board: <NC n={8} k={2} size={32} /> = 28 ways again.
    </Body>
    <Body delay={40}>
      Two rows and two columns make a <strong>frame</strong>.
    </Body>
    <Rise delay={54}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 30 }}>
        <Formula size={48}>28 × 28</Formula>
        <Formula size={44} color={theme.faint}>
          =
        </Formula>
        <Formula size={48} color={theme.accent}>
          784
        </Formula>
        <span style={{ fontSize: 28, color: theme.faint, fontWeight: 600 }}>frames</span>
      </div>
    </Rise>
  </Stage>
);

/* ------------------------------------------------------------------ */
/* 5. the block                                                        */
/* ------------------------------------------------------------------ */

export const BlockScene: React.FC<SceneProps> = () => (
  <Stage board={<Board rows={ROWS} cols={COLS} mode="block" />}>
    <Eyebrow delay={6}>Move 3 of 3</Eyebrow>
    <Heading delay={12}>The frame cuts out four cells</Heading>
    <Body delay={26}>
      Those two rows and two columns cross in exactly <strong>four</strong> cells — the amber ones.
    </Body>
    <Rise delay={42}>
      <div style={{ marginTop: 28, display: "flex", gap: 14, flexWrap: "wrap" }}>
        {blockCells.map((c, i) => (
          <Rise key={i} delay={44 + i * 5}>
            <div
              style={{
                fontFamily: "inherit",
                fontSize: 30,
                fontWeight: 700,
                color: theme.ink,
                background: theme.block,
                border: `2px solid ${theme.blockLine}`,
                borderRadius: 12,
                padding: "10px 18px",
              }}
            >
              {cellLabel(c)}
            </div>
          </Rise>
        ))}
      </div>
    </Rise>
    <Body delay={70} muted size={29}>
      Both squares must come from this block — and even inside it, they still may not share a row or a
      column.
    </Body>
  </Stage>
);

/* ------------------------------------------------------------------ */
/* 6. why the x2  (the centrepiece)                                    */
/* ------------------------------------------------------------------ */

export const WhyTwoScene: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const marks = [0.3, 0.37, 0.44, 0.51, 0.58, 0.65].map((f) => Math.round(f * dur));
  const shown = marks.filter((m) => frame >= m).length;
  const conclusionAt = Math.round(0.72 * dur);
  const current = shown > 0 ? PAIRS[shown - 1] : null;
  const done = shown === PAIRS.length;

  return (
    <Stage board={<Board rows={ROWS} cols={COLS} mode="pairs" pair={current} extra={done ? VALID : []} cell={68} />}>
      <Eyebrow delay={4}>The step everyone trips on</Eyebrow>
      <Heading delay={10} size={56}>
        Why the ×2?
      </Heading>
      <Body delay={20} size={29}>
        The block holds four cells, so there are <NC n={4} k={2} size={30} /> = 6 ways to pick two of
        them. Check them one by one:
      </Body>

      <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 9 }}>
        {PAIRS.map((p, i) => {
          const isShown = i < shown;
          const v = verdictOf(p);
          const ok = v === "allowed";
          return (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
                padding: "9px 18px",
                borderRadius: 12,
                border: `2px solid ${isShown ? (ok ? "#a7d9c2" : "#f2c4ab") : theme.line}`,
                background: isShown ? (ok ? theme.okSoft : theme.badSoft) : "#fcfbf8",
                opacity: isShown ? 1 : 0.45,
                fontSize: 26,
                fontWeight: 600,
                color: isShown && !ok ? "#8a4b2a" : theme.ink,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <span
                style={{
                  textDecoration: isShown && !ok ? "line-through" : "none",
                  textDecorationColor: theme.bad,
                  textDecorationThickness: 3,
                }}
              >
                {isShown ? `${cellLabel(p[0])} & ${cellLabel(p[1])}` : `pair ${i + 1}`}
              </span>
              <span
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  padding: "5px 14px",
                  borderRadius: 999,
                  background: isShown ? (ok ? theme.ok : theme.bad) : "#f1eee6",
                  color: isShown ? "#fff" : theme.faint,
                }}
              >
                {isShown ? v : "?"}
              </span>
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 20,
          opacity: interpolate(frame, [conclusionAt, conclusionAt + 14], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          transform: `translateY(${interpolate(frame, [conclusionAt, conclusionAt + 14], [16, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}px)`,
          background: theme.okSoft,
          border: "2px solid #a7d9c2",
          borderRadius: 14,
          padding: "14px 20px",
          fontSize: 27,
          fontWeight: 600,
          color: "#14532d",
        }}
      >
        Four fail, <strong>two survive</strong> — the two diagonals of the block. That is the ×2.
      </div>
    </Stage>
  );
};

/* ------------------------------------------------------------------ */
/* 7. total                                                            */
/* ------------------------------------------------------------------ */

export const TotalScene: React.FC<SceneProps> = () => (
  <Stage board={<Board rows={ROWS} cols={COLS} mode="pairs" extra={VALID} cell={66} />}>
    <Eyebrow delay={6}>Put it together</Eyebrow>
    <Heading delay={12}>The total</Heading>
    <CalcRow
      delay={24}
      items={[
        { big: "28", cap: "choose rows" },
        { big: "28", cap: "choose columns" },
        { big: "2", cap: "diagonal" },
        { big: "1568", cap: "pairs", accent: true },
      ]}
      ops={["×", "×", "="]}
    />
    <Body delay={44} muted size={29}>
      784 frames, each contributing two pairs: 784 × 2 = 1568.
    </Body>
    <Rise delay={60}>
      <div style={{ marginTop: 26, display: "flex", alignItems: "center", gap: 16 }}>
        <Pill tone="bad">forget the ×2 → 784</Pill>
        <span style={{ fontSize: 26, color: theme.muted }}>exactly half — one diagonal per block</span>
      </div>
    </Rise>
  </Stage>
);

/* ------------------------------------------------------------------ */
/* 8. sanity check                                                     */
/* ------------------------------------------------------------------ */

export const CheckScene: React.FC<SceneProps> = () => (
  <Stage board={<MiniBoard cell={150} delay={10} highlights={[0, 3]} />} boardWidth={520}>
    <Eyebrow delay={6}>Sanity check</Eyebrow>
    <Heading delay={12}>Try it on a 2 × 2 board</Heading>
    <Body delay={24} size={30}>
      Same formula: <NC n={2} k={2} size={32} /> × <NC n={2} k={2} size={32} /> × 2 = 1 × 1 × 2 ={" "}
      <strong>2</strong>.
    </Body>
    <Body delay={42} muted size={29}>
      A 2 × 2 board has four cells and six pairs of cells. Four of them share a row or a column. The two
      that do not are the diagonals — which is exactly what the ×2 counts.
    </Body>
  </Stage>
);

/* ------------------------------------------------------------------ */
/* 9. the pitfall                                                      */
/* ------------------------------------------------------------------ */

export const PitfallScene: React.FC<SceneProps> = () => (
  <Stage
    boardWidth={660}
    board={
      <div style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 10 }}>
          <LineFigure gap={1} ok width={290} />
          <LineFigure gap={2} ok={false} width={290} />
        </div>
        <SharedLineFigure width={300} />
      </div>
    }
  >
    <Eyebrow delay={6}>The tempting wrong method</Eyebrow>
    <Heading delay={12} size={54}>
      Nine lines, two of each
    </Heading>
    <Body delay={24} size={28}>
      Picking 2 of the 9 lines each way gives <NC n={9} k={2} size={30} /> = 36, and it fails twice over.
    </Body>
    <Body delay={40} size={28}>
      <strong>One:</strong> the lines must be <em>adjacent</em> — a unit square needs consecutive lines,
      not lines two units apart.
    </Body>
    <Body delay={54} size={28}>
      <strong>Two:</strong> you forbid the same row and the same column, not the lines. Two squares may
      share a line and still be in different rows.
    </Body>
  </Stage>
);

/* ------------------------------------------------------------------ */
/* 10. recap                                                           */
/* ------------------------------------------------------------------ */

export const RecapScene: React.FC<SceneProps> = () => (
  <AbsoluteFill
    style={{
      background: theme.bg,
      alignItems: "center",
      justifyContent: "center",
      padding: "0 160px",
      fontFamily: inter,
    }}
  >
    <Rise delay={4}>
      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: theme.faint,
        }}
      >
        Recap
      </div>
    </Rise>
    <Rise delay={14}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 26, marginTop: 34 }}>
        <Formula size={86}>28</Formula>
        <Formula size={56} color={theme.faint}>
          ×
        </Formula>
        <Formula size={86}>28</Formula>
        <Formula size={56} color={theme.faint}>
          ×
        </Formula>
        <Formula size={86} color={theme.accent}>
          2
        </Formula>
        <Formula size={56} color={theme.faint}>
          =
        </Formula>
        <Formula size={86}>1568</Formula>
      </div>
    </Rise>
    <Rise delay={30}>
      <div style={{ fontSize: 34, color: theme.muted, marginTop: 34, textAlign: "center" }}>
        two rows, two columns, two diagonals
      </div>
    </Rise>
    <Rise delay={44}>
      <div style={{ fontSize: 26, color: theme.faint, marginTop: 18, textAlign: "center" }}>
        the ×2 is not a formula — it is the number of legal pairs inside a 2 × 2 block
      </div>
    </Rise>
  </AbsoluteFill>
);

/* ------------------------------------------------------------------ */

export const SCENES: Record<string, React.FC<SceneProps>> = {
  "01-title": TitleScene,
  "02-problem": ProblemScene,
  "03-rows": RowsScene,
  "04-columns": ColumnsScene,
  "05-block": BlockScene,
  "06-why-two": WhyTwoScene,
  "07-total": TotalScene,
  "08-check": CheckScene,
  "09-pitfall": PitfallScene,
  "10-recap": RecapScene,
};
