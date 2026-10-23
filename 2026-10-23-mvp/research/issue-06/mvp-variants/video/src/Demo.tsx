import React from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import Title from "./ui/Title";
import Caption from "./ui/Caption";
import Wipe from "./ui/Wipe";
import Outro, { OutroCard } from "./ui/Outro";
import Card from "./ui/Card";
import { ThemeProvider, useTheme } from "./ui/theme";

export type CaptionT = { text: string; file: string; from: number; frames: number };
export type SegmentT = {
  beat: number; kind: "title" | "clip" | "card" | "outro" | "outro-clip"; name: string | null; role: string; label: string;
  from: number; frames: number; src: string | null; playbackRate: number; captions: CaptionT[];
  /** Seconds to skip at the start of the recording (lessons). Missing = play from 0. */
  clipStart?: number;
};
export type TimelineT = {
  fps: number; width: number; height: number; totalFrames: number; music: string | null; segments: SegmentT[];
  /** "puma" (hackathon demo, default) or "plain" (lessons). */
  theme?: string;
  /** Title card text. Missing fields keep the Title defaults; art defaults to "none" for the plain theme. */
  title?: { title?: string; kicker?: string; art?: "street" | "none"; icon?: string };
  /** Outro card text. Missing fields keep the Outro defaults. */
  outro?: { cards?: OutroCard[]; lines?: [string, string] };
};

/** Recording trim in composition frames; undefined when the segment has no clipStart (keeps Demo as before). */
const trim = (seg: SegmentT, fps: number) => (seg.clipStart ? Math.round(seg.clipStart * fps) : undefined);

const MUSIC_DB = -18;
const DUCK_DB = -6;
const db = (x: number) => Math.pow(10, x / 20);

/** Music volume at a composition frame: base level, ducked while any voice-over plays. */
function musicVolume(tl: TimelineT, frame: number) {
  let duck = 0;
  for (const s of tl.segments) {
    for (const c of s.captions) {
      const a = s.from + c.from, b = a + c.frames;
      if (frame >= a - 6 && frame <= b + 10) duck = 1;
    }
  }
  const fadeIn = interpolate(frame, [0, 45], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [tl.totalFrames - 60, tl.totalFrames], [1, 0], { extrapolateLeft: "clamp" });
  return db(MUSIC_DB + duck * DUCK_DB) * fadeIn * fadeOut;
}

const Clip: React.FC<{ seg: SegmentT; total: number }> = ({ seg, total }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  const t = useTheme();
  return (
    <AbsoluteFill style={{ background: t.surface }}>
      <AbsoluteFill style={{ opacity: fadeIn }}>
        {seg.src && <OffthreadVideo src={staticFile(seg.src)} trimBefore={trim(seg, fps)} playbackRate={seg.playbackRate} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
      </AbsoluteFill>
      {/* The pages carry their own quest bar (design-kit/quest.js), so no second badge on clips. */}
      {seg.captions.map((c, i) => (
        <Sequence key={i} from={c.from} durationInFrames={c.frames + 10} layout="none">
          <Caption text={c.text} from={0} durationInFrames={c.frames + 10} />
          <Audio src={staticFile(c.file)} />
        </Sequence>
      ))}
      <Wipe />
    </AbsoluteFill>
  );
};

export const Demo: React.FC<{ timeline: TimelineT }> = ({ timeline }) => {
  const frame = useCurrentFrame();
  const clips = timeline.segments.filter((s) => s.kind === "clip").length;
  const plain = timeline.theme === "plain";
  const titleProps = { art: plain ? ("none" as const) : ("street" as const), ...(timeline.title ?? {}) };
  return (
    <ThemeProvider name={timeline.theme}>
    <Body timeline={timeline} frame={frame} clips={clips} titleProps={titleProps} />
    </ThemeProvider>
  );
};

/** Voice-over captions with their audio, placed inside a segment. */
const Captions: React.FC<{ seg: SegmentT }> = ({ seg }) => (
  <>
    {seg.captions.map((c, i) => (
      <Sequence key={i} from={c.from} durationInFrames={c.frames + 10} layout="none">
        <Caption text={c.text} from={0} durationInFrames={c.frames + 10} />
        <Audio src={staticFile(c.file)} />
      </Sequence>
    ))}
  </>
);

const Body: React.FC<{ timeline: TimelineT; frame: number; clips: number; titleProps: NonNullable<TimelineT["title"]> }> = ({ timeline, frame, clips, titleProps }) => {
  const t = useTheme();
  const cards = timeline.segments.filter((s) => s.kind === "card");
  return (
    <AbsoluteFill style={{ background: t.surface, fontFamily: '"Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif' }}>
      {timeline.music && <Audio src={staticFile(timeline.music)} volume={() => musicVolume(timeline, frame)} loop />}
      {timeline.segments.map((seg) => (
        <Sequence key={seg.beat} from={seg.from} durationInFrames={seg.frames} name={`beat ${seg.beat} ${seg.name ?? seg.kind}`}>
          {seg.kind === "title" ? (
            <>
              <Title durationInFrames={seg.frames} {...titleProps} />
              {seg.captions.map((c, i) => (
                <Sequence key={i} from={c.from} durationInFrames={c.frames + 10} layout="none">
                  <Caption text={c.text} from={0} durationInFrames={c.frames + 10} />
                  <Audio src={staticFile(c.file)} />
                </Sequence>
              ))}
            </>
          ) : seg.kind === "card" ? (
            <>
              <Card label={seg.label} role={seg.role || undefined} step={cards.indexOf(seg) + 1} total={cards.length} />
              <Captions seg={seg} />
              <Wipe />
            </>
          ) : seg.kind === "outro" || seg.kind === "outro-clip" ? (
            <>
              {seg.src && <OffthreadVideo src={staticFile(seg.src)} trimBefore={trim(seg, timeline.fps)} playbackRate={seg.playbackRate} muted style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.35 }} />}
              <Outro durationInFrames={seg.frames} {...(timeline.outro ?? {})} />
              {seg.captions.map((c, i) => (
                <Sequence key={i} from={c.from} durationInFrames={c.frames + 10} layout="none">
                  <Caption text={c.text} from={0} durationInFrames={c.frames + 10} />
                  <Audio src={staticFile(c.file)} />
                </Sequence>
              ))}
            </>
          ) : (
            <Clip seg={seg} total={clips} />
          )}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export default Demo;
