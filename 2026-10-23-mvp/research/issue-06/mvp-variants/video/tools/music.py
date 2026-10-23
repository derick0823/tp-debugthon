"""Synthesize a soft chord loop for the demo video background (no external audio files).

Purpose: C - Am - F - G, 4 s per chord, sine tones with a few harmonics, slow attack and
         release, a gentle one-pole low-pass, peak -12 dBFS. 112 s = 7 full cycles and no
         fades, so it loops without a seam (the video editor does the fade in and out).
Usage:   uv run python -X utf8 research/issue-06/mvp-variants/video/tools/music.py
Input:   none
Output:  research/issue-06/mvp-variants/video/assets/music.wav  (44.1 kHz, 16-bit, mono, about 9.9 MB)
Network: no
"""

import wave
from pathlib import Path

import numpy as np

OUT = Path(__file__).resolve().parents[1] / "assets" / "music.wav"
SR = 44100
LENGTH = 112.0  # 28 bars = 7 cycles of the 4-chord progression
BAR = 4.0
PEAK_DB = -12.0
# MIDI notes: bass + triad an octave up
CHORDS = {"C": [48, 60, 64, 67], "Am": [45, 57, 60, 64], "F": [41, 57, 60, 65], "G": [43, 55, 59, 62]}
PROGRESSION = ["C", "Am", "F", "G"]
HARMONICS = [(1, 1.0), (2, 0.35), (3, 0.12), (4, 0.05)]


def freq(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def chord(notes, dur):
    t = np.arange(int(dur * SR)) / SR
    sig = np.zeros_like(t)
    for i, m in enumerate(notes):
        level = 0.8 if i == 0 else 0.5  # bass a little louder
        for h, a in HARMONICS:
            sig += level * a * np.sin(2 * np.pi * freq(m) * h * t + i)  # phase offset avoids a hard click
    # Slow attack and release, with overlap handled by the caller
    attack, release = 1.2, 1.5
    env = np.minimum(1.0, t / attack) * np.minimum(1.0, (dur - t) / release)
    return sig * np.clip(env, 0, 1)


def lowpass(x, cutoff=1800.0):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):  # one-pole filter; 110 s of audio runs in a few seconds
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return y


def main():
    n = int(LENGTH * SR)
    tail = 1.5  # each chord rings 1.5 s into the next one for a smooth crossfade
    mix = np.zeros(n)
    for k in range(round(LENGTH / BAR)):
        start = int(k * BAR * SR)
        c = chord(CHORDS[PROGRESSION[k % 4]], BAR + tail)
        idx = (start + np.arange(len(c))) % n  # the last chord's tail wraps to the start
        np.add.at(mix, idx, c)
    # Filter two copies and keep the second, so the filter state also joins at the loop point
    mix = lowpass(np.concatenate([mix, mix]))[n:]
    mix *= 10 ** (PEAK_DB / 20) / np.max(np.abs(mix))
    # Mono keeps the file under the repo's 10 MB per-file limit (stereo would be 19.4 MB)
    pcm = (mix * 32767).astype("<i2")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUT), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    peak_db = 20 * np.log10(np.max(np.abs(pcm)) / 32767)
    print(f"wrote {OUT} {LENGTH:.0f}s peak {peak_db:.1f} dBFS size {OUT.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
