import React from "react";
import { Composition, getStaticFiles, staticFile } from "remotion";
import Demo, { TimelineT } from "./Demo";

const EMPTY: TimelineT = { fps: 30, width: 1280, height: 720, totalFrames: 150, music: null, segments: [] };

/** Load a timeline from public/ and size the composition from it. */
const fromTimeline = (file: string, lessonId?: string) => async () => {
  const res = await fetch(staticFile(file));
  const timeline = (await res.json()) as TimelineT;
  if (lessonId) {
    // Lessons must never fall back to the hackathon texts in Title/Outro: fill neutral defaults.
    const series = "公務 AI 減壓課";
    timeline.theme ??= "plain";
    timeline.title = { title: lessonId, kicker: series, ...(timeline.title ?? {}) };
    const labels = timeline.segments.filter((s) => s.kind === "card" || s.kind === "clip").map((s) => s.label).filter((v, i, a) => v && a.indexOf(v) === i);
    timeline.outro = {
      cards: labels.slice(0, 6).map((label) => ({ icon: "📌", label })),
      lines: ["以本會與行政院最新規定為準", `${series}・${lessonId}`],
      ...(timeline.outro ?? {}),
    };
  }
  return { durationInFrames: Math.max(30, timeline.totalFrames), fps: timeline.fps, width: timeline.width, height: timeline.height, props: { timeline } };
};

/**
 * Lessons: every public/<folder>/timeline.json becomes one composition, id = folder name
 * (characters other than a-z, A-Z, 0-9 and "-" become "-", because Remotion ids allow only those).
 * Media paths inside a lesson timeline are relative to public/, the same as for Demo.
 * Lessons default to the "plain" theme and to neutral Title/Outro texts; a timeline's own "title"/"outro" fields win.
 */
const lessons = getStaticFiles()
  .map((f) => f.name.replace(/\\/g, "/"))
  .filter((n) => /^[^/]+\/timeline\.json$/.test(n))
  .map((n) => ({ file: n, id: n.split("/")[0].replace(/[^a-zA-Z0-9-]/g, "-") }))
  .filter((l) => l.id !== "Demo");

export const Root: React.FC = () => (
  <>
    <Composition
      id="Demo"
      component={Demo}
      fps={30}
      width={1280}
      height={720}
      durationInFrames={150}
      defaultProps={{ timeline: EMPTY }}
      calculateMetadata={fromTimeline("timeline.json")}
    />
    {lessons.map((l) => (
      <Composition
        key={l.id}
        id={l.id}
        component={Demo}
        fps={30}
        width={1280}
        height={720}
        durationInFrames={150}
        defaultProps={{ timeline: { ...EMPTY, theme: "plain" } }}
        calculateMetadata={fromTimeline(l.file, l.id)}
      />
    ))}
  </>
);
