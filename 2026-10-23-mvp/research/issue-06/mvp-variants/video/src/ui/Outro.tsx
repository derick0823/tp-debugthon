import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT, useTheme } from "./theme";

export type OutroCard = { icon: string; label: string };

export type OutroProps = {
  /** Six small cards. Default: the six tools in the demo. */
  cards?: OutroCard[];
  /** Two lines under the cards. */
  lines?: [string, string];
  /** Length of this card in frames (for the fade-out). Default 180 = 6 s at 30 fps. */
  durationInFrames?: number;
};

const DEFAULT_CARDS: OutroCard[] = [
  { icon: "🩺", label: "健檢排序" },
  { icon: "🚒", label: "救災演練地圖" },
  { icon: "🏠", label: "都更試算器" },
  { icon: "🧱", label: "容積翻譯機" },
  { icon: "📋", label: "同意書進度板" },
  { icon: "👥", label: "同意模擬器" },
];

/** Closing card, 6 s: six cards fly in one by one, then two text lines. Background is transparent so a clip can show behind. */
const Outro: React.FC<OutroProps> = ({
  cards = DEFAULT_CARDS,
  lines = ["全部是公開資料的推估，不是鑑定", "市政 debug松・第 6 題"],
  durationInFrames = 180,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const C = useTheme();
  const out = interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const l1 = spring({ frame: frame - 40, fps, config: { damping: 14 } });
  const l2 = spring({ frame: frame - 52, fps, config: { damping: 14 } });

  return (
    <AbsoluteFill style={{ fontFamily: FONT, color: C.ink, opacity: out, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 310px)", gap: 22 }}>
        {cards.slice(0, 6).map((c, i) => {
          const s = spring({ frame: frame - i * 5, fps, config: { damping: 12, mass: 0.8 } });
          const fromX = (i % 3 - 1) * 320, fromY = i < 3 ? -320 : 320;
          return (
            <div key={i} style={{ height: 120, borderRadius: 22, background: C.surface, border: `3px solid ${C.border}`,
              boxShadow: "0 8px 24px rgba(33,29,29,.14)", display: "flex", alignItems: "center", gap: 14, padding: "0 22px",
              opacity: s, transform: `translate(${(1 - s) * fromX}px, ${(1 - s) * fromY}px) rotate(${(1 - s) * (i % 2 ? 14 : -14)}deg)` }}>
              <span style={{ fontSize: 54 }}>{c.icon}</span>
              <span style={{ fontSize: 30, fontWeight: 800, whiteSpace: "nowrap" }}>{c.label}</span>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 40, textAlign: "center" }}>
        <div style={{ fontSize: 40, fontWeight: 900, opacity: l1, transform: `translateY(${(1 - l1) * 14}px)` }}>{lines[0]}</div>
        <div style={{ marginTop: 8, fontSize: 30, fontWeight: 700, color: C.deep, opacity: l2, transform: `translateY(${(1 - l2) * 14}px)` }}>{lines[1]}</div>
      </div>
    </AbsoluteFill>
  );
};

export default Outro;
