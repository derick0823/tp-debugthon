"""Shared loaders and plot helpers for the R1 data-pattern scripts.

Usage:   imported by the h*.py scripts in this folder
Input:   data/marts/village_indicators.{csv,geojson}, data/staged/**
Output:  none
Network: no
"""

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
sys.path.insert(0, str(ROOT))

import geopandas as gpd  # noqa: E402
import matplotlib  # noqa: E402

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402

from pipelines.common import MARTS, STAGED  # noqa: E402,F401

OUT = HERE.parent / "out"
OUT.mkdir(exist_ok=True)
RESULTS = OUT / "results.json"

plt.rcParams["font.sans-serif"] = ["Microsoft JhengHei", "Noto Sans CJK TC", "sans-serif"]
plt.rcParams["axes.unicode_minus"] = False
plt.rcParams["figure.dpi"] = 110


def mart():
    return pd.read_csv(MARTS / "village_indicators.csv", dtype={"village_code": str, "town_code": str})


def mart_geo():
    return gpd.read_file(MARTS / "village_indicators.geojson")


def spearman(a, b):
    d = pd.concat([a, b], axis=1).dropna()
    return round(d.iloc[:, 0].rank().corr(d.iloc[:, 1].rank()), 3), len(d)


def _plain(o):
    """Turn numpy keys and values into plain Python so json can write them."""
    if isinstance(o, dict):
        return {(k.item() if hasattr(k, "item") else k): _plain(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_plain(v) for v in o]
    return o.item() if hasattr(o, "item") else o


def save_result(key, value):
    """Merge one result block into out/results.json so the report can cite numbers."""
    data = json.loads(RESULTS.read_text(encoding="utf-8")) if RESULTS.exists() else {}
    data[key] = _plain(value)
    RESULTS.write_text(json.dumps(data, ensure_ascii=False, indent=1, default=str), encoding="utf-8")


_TOWNS = None


def towns():
    """District outlines dissolved from the unsimplified village boundary."""
    global _TOWNS
    if _TOWNS is None:
        v = gpd.read_file(STAGED / "base" / "village-boundary-nlsc.geojson")
        _TOWNS = v.dissolve("town_name")
    return _TOWNS


def choropleth(g, col, title, path, cmap="OrRd", ax=None, legend=True):
    own = ax is None
    if own:
        fig, ax = plt.subplots(figsize=(6, 7))
    g.plot(column=col, cmap=cmap, linewidth=0.1, edgecolor="#888", ax=ax, legend=legend,
           missing_kwds={"color": "#eee"}, legend_kwds={"shrink": 0.5})
    tw = towns()
    tw.boundary.plot(ax=ax, color="#333", linewidth=0.6)
    for name, r in tw.iterrows():
        p = r.geometry.representative_point()
        ax.annotate(name, (p.x, p.y), ha="center", fontsize=7, color="#222")
    ax.set_title(title, fontsize=10)
    ax.set_axis_off()
    if own:
        fig.tight_layout()
        fig.savefig(path, dpi=110)
        plt.close(fig)
