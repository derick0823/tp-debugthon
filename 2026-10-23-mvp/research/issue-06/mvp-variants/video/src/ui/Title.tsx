import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { STREET_BEFORE_SVG } from "./streetSvg";
import { FONT, useTheme } from "./theme";

export type TitleProps = {
  /** Main title. Default 「老房子，怎麼辦？」 */
  title?: string;
  /** Small line above the title. */
  kicker?: string;
  /** Length of this card in frames (for the fade-out). Default 180 = 6 s at 30 fps. */
  durationInFrames?: number;
  /** Picture under the title: "street" = tin-roof street (hackathon), "none" = big icon instead. Default "street". */
  art?: "street" | "none";
  /** Big emoji shown when art is "none". */
  icon?: string;
};

/** Opening card, 6 s (180 frames at 30 fps): warm background, title springs in, tin-roof street rises. */
const Title: React.FC<TitleProps> = ({ title = "老房子，怎麼辦？", kicker = "市政 debug松・第 6 題", durationInFrames = 180, art = "street", icon = "😮‍💨" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const C = useTheme();
  const tIn = spring({ frame, fps, config: { damping: 12 } });
  const kIn = spring({ frame: frame - 6, fps, config: { damping: 14 } });
  const sIn = spring({ frame: frame - 14, fps, config: { damping: 16, mass: 1.2 } });
  const zoom = interpolate(frame, [0, durationInFrames], [1, 1.06]);
  const out = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  // One line only: a 1280 px frame fits about 12 full-width glyphs at 92 px, so longer titles shrink (floor 52 px).
  const glyphs = Array.from(title).length;
  const titleSize = Math.max(52, Math.min(92, Math.floor(1180 / Math.max(glyphs, 1)) - 2));

  return (
    <AbsoluteFill style={{ background: C.surface, fontFamily: FONT, opacity: out }}>
      <div style={{ position: "absolute", top: 70, width: "100%", textAlign: "center" }}>
        <div style={{ display: "inline-block", padding: "4px 18px", borderRadius: 999, background: C.pill, color: C.ink,
          fontSize: 26, fontWeight: 700, opacity: kIn, transform: `translateY(${(1 - kIn) * 16}px)` }}>{kicker}</div>
        <div style={{ marginTop: 14, fontSize: titleSize, lineHeight: 1.2, whiteSpace: "nowrap", fontWeight: 900, color: C.ink, letterSpacing: 2,
          transform: `scale(${interpolate(tIn, [0, 1], [0.6, 1])})`, opacity: tIn }}>{title}</div>
      </div>
      {art === "street" ? (
      <div style={{ position: "absolute", left: 140, right: 140, bottom: 0, height: 400,
          transform: `translateY(${(1 - sIn) * 220}px) scale(${zoom})`, transformOrigin: "50% 100%",
          borderRadius: "28px 28px 0 0", overflow: "hidden", boxShadow: "0 -6px 30px rgba(33,29,29,.12)" }}>
          <svg viewBox="0 0 800 480" width="100%" height="100%" preserveAspectRatio="xMidYMax slice"
            dangerouslySetInnerHTML={{ __html: STREET_BEFORE_SVG }} />
        </div>
      ) : (
        <div style={{ position: "absolute", left: 0, right: 0, top: 330, textAlign: "center", fontSize: 200, lineHeight: 1,
          transform: `translateY(${(1 - sIn) * 120}px) scale(${zoom})`, opacity: sIn }}>{icon}</div>
      )}
    </AbsoluteFill>
  );
};

export default Title;
