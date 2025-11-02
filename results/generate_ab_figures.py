# DM-TaRL A/B Simulation: plotting utility
# This script will load two CSV files (Static vs Dynamic) produced by your run_ab pipeline,
# compute comparison metrics, and generate publication-ready figures.
#
# How to use locally:
# 1) Set STATIC_CSV and DYNAMIC_CSV paths to your files, e.g.:
#    ./results/static/results.csv and ./results/dynamic/results.csv
# 2) Run this script with Python 3 (no internet required).
# 3) Find the saved figures in /mnt/data (or adjust OUTPUT_DIR).
#
# Notes for plotting:
# - Uses matplotlib only (no seaborn).
# - Each chart is a single figure (no subplots).
# - Does not set explicit colors; defaults are used.

import os
import math
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

OUT_DIR = "ab/figures"
CANDIDATES = [
    ("static/results.csv", "dynamic/results.csv"),
]


def load_pair():
    for s, d in CANDIDATES:
        if os.path.exists(s) and os.path.exists(d):
            return pd.read_csv(s), pd.read_csv(d), s, d
    # tiny demo if nothing provided
    rng = np.random.default_rng(7)
    n = 5000
    ids = np.arange(1, n+1)
    inferred_A = rng.normal(4.3, 1.0, size=n).clip(1, 6)
    inferred_B = (inferred_A + rng.normal(0.0, 0.35, size=n)).clip(1, 6)
    conf_A = np.clip(0.35 + 0.65 * rng.random(n), 0, 1)
    conf_B = np.clip(conf_A + rng.normal(0, 0.02, size=n), 0, 1)
    cov = np.clip(0.5 + 0.5 * rng.random(n), 0, 1)
    cols = ["id","inferredGrade","confidence","coverageMean"]
    s = pd.DataFrame(np.c_[ids, inferred_A, conf_A, cov], columns=cols)
    d = pd.DataFrame(np.c_[ids, inferred_B, conf_B, cov], columns=cols)
    s_path = "/mnt/data/static_results.csv"
    d_path = "/mnt/data/dynamic_results.csv"
    s.to_csv(s_path, index=False)
    d.to_csv(d_path, index=False)
    return s, d, s_path, d_path

static_df, dynamic_df, S_PATH, D_PATH = load_pair()

def normalize(df):
    mapping = {}
    for c in df.columns:
        lc = c.lower()
        if lc == "id": mapping[c] = "id"
        elif lc in ("inferredgrade", "grade", "g_hat", "ĝ", "g"):
            mapping[c] = "inferredGrade"
        elif lc in ("confidence", "conf"):
            mapping[c] = "confidence"
        elif lc in ("coveragemean", "coverage_mean", "coverage"):
            mapping[c] = "coverageMean"
    df = df.rename(columns=mapping)
    if "id" in df: df["id"] = pd.to_numeric(df["id"], errors="coerce").astype("Int64")
    for col in ("inferredGrade","confidence","coverageMean"):
        if col in df: df[col] = pd.to_numeric(df[col], errors="coerce")
    return df

static_df = normalize(static_df)
dynamic_df = normalize(dynamic_df)

# Merge for paired metrics
merged = pd.merge(static_df[["id","inferredGrade","confidence","coverageMean"]],
                  dynamic_df[["id","inferredGrade","confidence","coverageMean"]],
                  on="id", suffixes=("_A","_B"))

# ---------- Metrics ----------
def mean_abs_diff(a, b): return float(np.nanmean(np.abs(a - b)))
def variance(a): return float(np.nanvar(a, ddof=1))
def slope_xy(x, y):
    x = np.asarray(x); y = np.asarray(y)
    mask = np.isfinite(x) & np.isfinite(y)
    x = x[mask]; y = y[mask]
    if x.size < 2: return float("nan")
    mx, my = x.mean(), y.mean()
    num = ((x - mx) * (y - my)).sum()
    den = ((x - mx) ** 2).sum()
    if den == 0: return float("nan")
    return float(num / den)
def spearman_rho(a, b, max_n=None):
    a = np.asarray(a); b = np.asarray(b)
    mask = np.isfinite(a) & np.isfinite(b)
    a = a[mask]; b = b[mask]
    if max_n is not None and a.size > max_n:
        a = a[:max_n]; b = b[:max_n]
    ra = a.argsort().argsort()
    rb = b.argsort().argsort()
    n = a.size
    if n < 3: return float("nan")
    d = ra - rb
    d2 = (d * d).sum()
    return float(1 - (6 * d2) / (n * (n*n - 1)))

mad_g = mean_abs_diff(merged["inferredGrade_A"], merged["inferredGrade_B"])
varA = variance(static_df["inferredGrade"])
varB = variance(dynamic_df["inferredGrade"])
slopeA = slope_xy(static_df["coverageMean"], static_df["confidence"])
slopeB = slope_xy(dynamic_df["coverageMean"], dynamic_df["confidence"])
rho = spearman_rho(merged["inferredGrade_A"], merged["inferredGrade_B"], max_n=100000)

def band_var(df, center):
    g = df["inferredGrade"].to_numpy()
    band = g[(g >= center - 0.25) & (g <= center + 0.25)]
    if band.size < 3: return float("nan")
    return float(np.var(band, ddof=1))

bands = {g: (band_var(static_df, g), band_var(dynamic_df, g)) for g in [3,4,5,6]}

metrics_csv = os.path.join(OUT_DIR, "ab_metrics_overlay.csv")
pd.DataFrame([{
    "mean_abs_grade_diff": round(mad_g, 3),
    "var_grade_static": round(varA, 3),
    "var_grade_dynamic": round(varB, 3),
    "slope_conf_cov_static": round(slopeA, 3),
    "slope_conf_cov_dynamic": round(slopeB, 3),
    "spearman_rho": round(rho, 3),
    "var_band_G3_static": round(bands[3][0], 4),
    "var_band_G3_dynamic": round(bands[3][1], 4),
    "var_band_G4_static": round(bands[4][0], 4),
    "var_band_G4_dynamic": round(bands[4][1], 4),
    "var_band_G5_static": round(bands[5][0], 4),
    "var_band_G5_dynamic": round(bands[5][1], 4),
    "var_band_G6_static": round(bands[6][0], 4),
    "var_band_G6_dynamic": round(bands[6][1], 4),
    "static_path": S_PATH,
    "dynamic_path": D_PATH
}]).to_csv(metrics_csv, index=False)

# ---------- Plot helpers ----------
def savefig(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    plt.tight_layout()
    plt.savefig(path, dpi=300, bbox_inches="tight")
    plt.close()

# (1) Overlay histogram of inferred grades (A vs B), normalized
plt.figure()
plt.hist(static_df["inferredGrade"].dropna(), bins=30, density=True, alpha=0.5, label="Static (A)")
plt.hist(dynamic_df["inferredGrade"].dropna(), bins=30, density=True, alpha=0.5, label="Dynamic (B)")
plt.xlabel("Inferred grade (ĝ)")
plt.ylabel("Density")
plt.title("Grade distribution (overlay) – Static (A) vs Dynamic (B)")
plt.legend()
savefig(os.path.join(OUT_DIR, "overlay_grade_hist_AB.png"))

# (2) Overlay coverage vs confidence scatter
plt.figure()
plt.scatter(static_df["coverageMean"], static_df["confidence"], s=3, alpha=0.25, label="Static (A)")
plt.scatter(dynamic_df["coverageMean"], dynamic_df["confidence"], s=3, alpha=0.25, label="Dynamic (B)")
plt.xlabel("Coverage (mean across axes)")
plt.ylabel("Confidence")
plt.title("Coverage vs Confidence (overlay) – A vs B")
plt.legend()
savefig(os.path.join(OUT_DIR, "overlay_cov_conf_AB.png"))

# (3) Bland–Altman: Δgrade vs mean grade (B − A)
gA = merged["inferredGrade_A"].to_numpy()
gB = merged["inferredGrade_B"].to_numpy()
mean_g = (gA + gB) / 2.0
diff_g = (gB - gA)
m = np.nanmean(diff_g)
sd = np.nanstd(diff_g, ddof=1)
plt.figure()
plt.scatter(mean_g, diff_g, s=3, alpha=0.3, label="B − A")
plt.axhline(m, linestyle="--")
plt.axhline(m + 1.96*sd, linestyle="--")
plt.axhline(m - 1.96*sd, linestyle="--")
plt.xlabel("Mean grade (A,B)")
plt.ylabel("Δgrade (B − A)")
plt.title("Agreement plot – Static vs Dynamic")
plt.legend()
savefig(os.path.join(OUT_DIR, "overlay_bland_altman_AB.png"))

# (4) Overlay CDFs of inferred grades (A vs B)
def empirical_cdf(data):
    data = np.sort(np.asarray(data))
    y = np.arange(1, data.size + 1) / data.size
    return data, y

xA = static_df["inferredGrade"].dropna().to_numpy()
xB = dynamic_df["inferredGrade"].dropna().to_numpy()
XA, YA = empirical_cdf(xA)
XB, YB = empirical_cdf(xB)
plt.figure()
plt.plot(XA, YA, label="Static (A)")
plt.plot(XB, YB, label="Dynamic (B)")
plt.xlabel("Inferred grade (ĝ)")
plt.ylabel("CDF")
plt.title("Cumulative distributions (overlay) – A vs B")
plt.legend()
savefig(os.path.join(OUT_DIR, "overlay_cdf_grade_AB.png"))

# (5) Scatter inferred grade: A vs B with 45° reference
plt.figure()
plt.scatter(merged["inferredGrade_A"], merged["inferredGrade_B"], s=3, alpha=0.3, label="Pairs (A,B)")
# 45-degree line
gmin = float(np.nanmin([merged["inferredGrade_A"], merged["inferredGrade_B"]]))
gmax = float(np.nanmax([merged["inferredGrade_A"], merged["inferredGrade_B"]]))
plt.plot([gmin, gmax], [gmin, gmax], linestyle="--", label="Identity")
plt.xlabel("Inferred grade – Static (A)")
plt.ylabel("Inferred grade – Dynamic (B)")
plt.title("Grade agreement – A vs B")
plt.legend()
savefig(os.path.join(OUT_DIR, "overlay_grade_scatter_AB.png"))

# (6) Boundary band variance bars (A vs B)
labels = ["G3", "G4", "G5", "G6"]
x = np.arange(len(labels))
width = 0.35
valsA = [bands[g][0] for g in [3,4,5,6]]
valsB = [bands[g][1] for g in [3,4,5,6]]

plt.figure()
plt.bar(x - width/2, valsA, width, label="Static (A)")
plt.bar(x + width/2, valsB, width, label="Dynamic (B)")
plt.xticks(x, labels)
plt.ylabel("Variance of ĝ within ±0.25 band")
plt.title("Boundary stability – Static (A) vs Dynamic (B)")
plt.legend()
savefig(os.path.join(OUT_DIR, "overlay_band_variance_AB.png"))

print("Overlay figures and metrics saved to:", OUT_DIR)
print("Static CSV:", S_PATH)
print("Dynamic CSV:", D_PATH)