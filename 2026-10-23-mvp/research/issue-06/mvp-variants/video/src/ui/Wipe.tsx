import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { useTheme } from "./theme";

export type WipeProps = {
  /** Length in frames. Default 12. The screen is fully covered at the middle frame. */
  frames?: number;
  /** Main block color. Default: theme primary; the theme trail color follows it. */
  color?: string;
};

/** Segment transition: a primary block sweeps left to right across the screen, then nothing renders. */
const Wipe: React.FC<WipeProps> = ({ frames = 12, color }) => {
  const frame = useCurrentFrame();
  const C = useTheme();
  if (frame >= frames) return null;
  const x = interpolate(frame, [0, frames], [-110, 110]);
  const y = interpolate(frame, [0, frames], [-130, 100]);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: C.trail, transform: `translateX(${y}%) skewX(-12deg)` }} />
      <div style={{ position: "absolute", inset: "0 -10%", background: color ?? C.primary, transform: `translateX(${x}%) skewX(-12deg)` }} />
    </AbsoluteFill>
  );
};

export default Wipe;
