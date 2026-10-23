import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT, useTheme } from "./theme";

export type CaptionProps = {
  /** One subtitle line. Wrap keywords in 【】 to color them and pop them to 1.15x, e.g. "賺【539 萬】". */
  text: string;
  /** Optional English line shown under the Chinese one (bilingual version). */
  en?: string;
  /** First frame (relative to the parent Sequence) when the caption shows. */
  from: number;
  /** How many frames it stays, fade-out included. */
  durationInFrames: number;
};

/** Bottom subtitle: fades in while moving up 12 px; 【keyword】 turns primary and springs to 1.15x. */
const Caption: React.FC<CaptionProps> = ({ text, en, from, durationInFrames }) => {
  const frame = useCurrentFrame() - from;
  const { fps } = useVideoConfig();
  const t = useTheme();
  if (frame < 0 || frame >= durationInFrames) return null;
  const opacity = interpolate(frame, [0, 8, durationInFrames - 6, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(frame, [0, 10], [12, 0], { extrapolateRight: "clamp" });
  const pop = spring({ frame: frame - 6, fps, config: { damping: 7, stiffness: 160 } });
  const parts = text.split(/(【[^】]*】)/).filter(Boolean);

  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 44, display: "flex", justifyContent: "center", opacity, transform: `translateY(${y}px)` }}>
      <div style={{ maxWidth: 1120, padding: "12px 30px", borderRadius: 28, background: "rgba(33,29,29,.86)", color: "#fff",
        fontFamily: FONT, fontSize: 40, fontWeight: 700, lineHeight: 1.35, textAlign: "center" }}>
        {parts.map((p, i) =>
          p.startsWith("【") ? (
            <span key={i} style={{ display: "inline-block", margin: "0 4px", color: t.keyword, fontWeight: 900, // theme keyword color, chosen to read on the dark pill
              transform: `scale(${interpolate(pop, [0, 1], [1, 1.15])})` }}>{p.slice(1, -1)}</span>
          ) : (
            <span key={i}>{p}</span>
          ),
        )}
        {en && <div style={{ marginTop: 4, fontSize: 26, fontWeight: 500, lineHeight: 1.3, color: "#f1e6e1" }}>{en}</div>}
      </div>
    </div>
  );
};

export default Caption;
