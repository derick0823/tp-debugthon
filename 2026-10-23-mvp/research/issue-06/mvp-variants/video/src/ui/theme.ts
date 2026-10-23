// Themes for the video UI parts. "puma" follows design-kit/theme-puma.css (hackathon demo);
// "plain" is the slate-blue set for the civil-servant lessons (no event branding).
import React from "react";

export type Theme = {
  primary: string;  // progress fill, wipe block
  deep: string;     // text on light backgrounds; white text on it passes 4.5:1
  keyword: string;  // 【keyword】 color on the dark caption pill
  ink: string;
  surface: string;  // page background
  muted: string;
  border: string;
  positive: string;
  onPositive: string; // text on positive
  pill: string;     // role pill / kicker background
  track: string;
  trail: string;    // second strip in the wipe
};

export const THEMES = {
  puma: {
    primary: "#db6a41", deep: "#ad4d2a", keyword: "#db6a41", ink: "#211d1d", surface: "#fff8f4", muted: "#665b57",
    border: "#efc5ad", positive: "#7dbc91", onPositive: "#211d1d", pill: "#fcea8b", track: "#f3e3d8", trail: "#fcea8b",
  },
  plain: {
    primary: "#3b5b7a", deep: "#2c4660", keyword: "#9cc8ee", ink: "#1f2328", surface: "#f7f9fb", muted: "#5b6670",
    border: "#cfd6dd", positive: "#2f7a52", onPositive: "#ffffff", pill: "#e3eaf1", track: "#e6eaee", trail: "#9aa5b1",
  },
} satisfies Record<string, Theme>;

export type ThemeName = keyof typeof THEMES;

/** Back-compat: the puma tokens as a constant (older imports). */
export const C: Theme = THEMES.puma;

export const FONT = '"Noto Sans TC", "Microsoft JhengHei", "PingFang TC", system-ui, sans-serif';

const ThemeContext = React.createContext<Theme>(THEMES.puma);

/** Wrap a composition: <ThemeProvider name={timeline.theme}>…</ThemeProvider>. Unknown or missing name -> puma. */
export const ThemeProvider: React.FC<{ name?: string | null; children: React.ReactNode }> = ({ name, children }) =>
  React.createElement(ThemeContext.Provider, { value: THEMES[(name as ThemeName) in THEMES ? (name as ThemeName) : "puma"] }, children);

export const useTheme = (): Theme => React.useContext(ThemeContext);
