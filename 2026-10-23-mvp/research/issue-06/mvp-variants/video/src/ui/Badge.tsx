import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT, useTheme } from "./theme";

export type BadgeProps = {
  /** Role shown in the yellow pill, e.g. 住戶、里長、市府. */
  role: string;
  /** Current step, 1-based. Steps before it are ticked; this one fills in with a spring. */
  step: number;
  /** Number of steps (dots). */
  total: number;
  /** Optional tool name after the counter, e.g. 試算器. */
  label?: string;
};

/** Top-left quest badge in the style of theme-puma .q-bar: role pill, progress track, N/M, one dot per step. */
const Badge: React.FC<BadgeProps> = ({ role, step, total, label }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const C = useTheme();
  const inn = spring({ frame, fps, config: { damping: 14 } });
  const grow = spring({ frame: frame - 8, fps, config: { damping: 16 } });
  const fill = interpolate(grow, [0, 1], [Math.max(0, step - 1) / total, step / total]) * 100;

  return (
    <div style={{ position: "absolute", top: 22, left: 22, display: "flex", alignItems: "center", gap: 14, padding: "10px 18px",
      borderRadius: 999, background: "rgba(255,255,255,.94)", boxShadow: "0 4px 16px rgba(33,29,29,.15)", fontFamily: FONT,
      fontSize: 24, color: C.ink, opacity: inn, transform: `translateX(${(1 - inn) * -40}px)` }}>
      <span style={{ padding: "2px 14px", borderRadius: 999, background: C.pill, fontWeight: 800 }}>🎖️ {role}</span>
      <div style={{ width: 180, height: 14, borderRadius: 999, background: C.track, overflow: "hidden" }}>
        <div style={{ width: `${fill}%`, height: "100%", borderRadius: 999, background: C.primary }} />
      </div>
      <b style={{ color: C.deep, minWidth: "3ch" }}>{step}/{total}</b>
      <div style={{ display: "flex", gap: 6 }}>
        {Array.from({ length: total }, (_, i) => {
          const done = i < step - 1, now = i === step - 1;
          const s = now ? interpolate(grow, [0, 1], [1, 1.15]) : done ? 1.15 : 1;
          return (
            <span key={i} style={{ width: 32, height: 32, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 18, fontWeight: 800,
              background: done || (now && grow > 0.5) ? C.positive : C.track, color: done || (now && grow > 0.5) ? C.onPositive : C.ink, transform: `scale(${s})` }}>
              {done || (now && grow > 0.5) ? "✓" : i + 1}
            </span>
          );
        })}
      </div>
      {label && <span style={{ fontWeight: 700, color: C.muted }}>{label}</span>}
    </div>
  );
};

export default Badge;
