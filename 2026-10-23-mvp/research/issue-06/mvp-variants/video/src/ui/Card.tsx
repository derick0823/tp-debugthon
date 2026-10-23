import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT, useTheme } from "./theme";

export type CardProps = {
  /** Big label in the middle, e.g. 這次怎麼做. */
  label: string;
  /** Optional role pill above the label, e.g. 學員. */
  role?: string;
  /** 1-based number of this card among the cards, shown in a circle. */
  step?: number;
  /** Number of cards, shown as dots under the label. */
  total?: number;
};

/** Text card for a segment with no recording: label springs in, step dots fill. Captions are drawn by the caller. */
const Card: React.FC<CardProps> = ({ label, role, step, total }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const C = useTheme();
  const inn = spring({ frame, fps, config: { damping: 14 } });
  const pop = spring({ frame: frame - 6, fps, config: { damping: 10 } });

  return (
    <AbsoluteFill style={{ background: C.surface, fontFamily: FONT, color: C.ink, alignItems: "center", justifyContent: "center", paddingBottom: 140 }}>
      {role && (
        <div style={{ padding: "4px 18px", borderRadius: 999, background: C.pill, fontSize: 26, fontWeight: 700, marginBottom: 22,
          opacity: inn, transform: `translateY(${(1 - inn) * 12}px)` }}>🎖️ {role}</div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 28, opacity: inn, transform: `scale(${interpolate(pop, [0, 1], [0.85, 1])})` }}>
        {step != null && (
          <div style={{ width: 104, height: 104, borderRadius: "50%", background: C.primary, color: "#fff", display: "grid", placeItems: "center",
            fontSize: 56, fontWeight: 900 }}>{step}</div>
        )}
        <div style={{ fontSize: 76, fontWeight: 900, letterSpacing: 2 }}>{label}</div>
      </div>
      {total != null && total > 1 && step != null && (
        <div style={{ display: "flex", gap: 12, marginTop: 34 }}>
          {Array.from({ length: total }, (_, i) => (
            <span key={i} style={{ width: i === step - 1 ? 44 : 16, height: 16, borderRadius: 999,
              background: i < step ? C.primary : C.track }} />
          ))}
        </div>
      )}
    </AbsoluteFill>
  );
};

export default Card;
