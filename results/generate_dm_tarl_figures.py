import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np

# === CONFIG ===
sns.set(style="whitegrid", font="serif", rc={"axes.facecolor": "white", "figure.figsize": (8, 5)})
palette = sns.color_palette("viridis", 4)  # adjust if you want blue-green-orange aesthetic


# === Load main results ===
df = pd.read_csv("fuzzy_results_educator.csv")

# --- FIGURE 6a: Confidence vs Coverage (Monotonicity) ---
plt.figure(figsize=(7, 5))
sns.scatterplot(data=df, x="coverageMean", y="confidence", hue="inferredGrade",
                palette="viridis", alpha=0.4)
sns.regplot(data=df, x="coverageMean", y="confidence", scatter=False, color="black")
plt.title("Relationship Between Coverage and Fuzzy Confidence")
plt.xlabel("Coverage Mean")
plt.ylabel("Fuzzy Confidence")
plt.legend(title="Inferred Grade", loc="lower right")
plt.tight_layout()
plt.savefig("fig6a_confidence_vs_coverage.png", dpi=300)
plt.close()


# --- FIGURE 7a: : Boxplot of Cognitive Axes by Proficiency Band ---
axes = ["arithmetic_fluency","number_sense","sequential_thinking",
        "comparison_skill","visual_matching","audio_recognition"]

melted = df.melt(id_vars=["proficiencyBand"], value_vars=axes, var_name="Axis", value_name="Score")
plt.figure(figsize=(10,6))
sns.boxplot(
    data=melted,
    x="Axis",
    y="Score",
    hue="proficiencyBand",
    palette="Set2",
    showmeans=True,
    meanprops={"marker":"o", "markerfacecolor":"white", "markeredgecolor":"black"}
)
plt.title("Mean and Variation per Cognitive Axis across Proficiency Bands")
plt.xlabel("Cognitive Axis")
plt.ylabel("Score (0–100)")
plt.xticks(rotation=25)
plt.legend(title="Proficiency Band", loc="upper left")
plt.tight_layout()
plt.savefig("fig7a_boxplot_axes_by_band.png", dpi=300)
plt.close()


# --- FIGURE 7b: Cluster Interpretability (3D scatter) ---
from mpl_toolkits.mplot3d import Axes3D
from matplotlib import cm

fig = plt.figure(figsize=(8,6))
ax = fig.add_subplot(111, projection='3d')
p = ax.scatter(df['inferredGrade']/6, df['confidence'], df['coverageMean'],
               c=df['cluster'], cmap='viridis', alpha=0.5)
ax.set_xlabel('Normalized Grade')
ax.set_ylabel('Confidence')
ax.set_zlabel('Coverage')
ax.set_title("Cluster Interpretability in 3D Space")
fig.colorbar(p, ax=ax, label="Cluster")
plt.tight_layout()
plt.savefig("fig7b_cluster_interpretability_3D.png", dpi=300)
plt.close()



sns.set(style="whitegrid", font="serif")
plt.rcParams["figure.dpi"] = 300

# ---------- Figure 6b: Cluster sizes ----------
clu = pd.read_csv("clusters_summary.csv")  # columns: cluster, center_gradeNorm, center_confidence, center_coverage, size, dominantBand, meanGradeLabel

plt.figure(figsize=(7,5))
sns.barplot(data=clu, x="cluster", y="size", palette="viridis", hue="cluster", legend=False)
plt.title("Learner Distribution by Cluster")
plt.xlabel("Cluster ID")
plt.ylabel("Number of Learners")
for i, v in enumerate(clu["size"]):
    plt.text(i, v, f"{v:,}", ha="center", va="bottom", fontsize=9)
plt.tight_layout()
plt.savefig("fig6b_cluster_sizes.png")
plt.close()

# ---------- Figure 6c: Radar of cluster centroids ----------
def radar_plot(df, cols, labels, title, outfile):
    angles = np.linspace(0, 2*np.pi, len(cols), endpoint=False)
    angles = np.concatenate([angles, angles[:1]])
    fig, ax = plt.subplots(figsize=(7,7), subplot_kw=dict(polar=True))

    for _, row in df.iterrows():
        values = row[cols].to_numpy(dtype=float)
        values = np.concatenate([values, values[:1]])
        ax.plot(angles, values, linewidth=2, label=f"Cluster {int(row['cluster'])}")
        ax.fill(angles, values, alpha=0.08)

    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(labels)
    ax.set_ylim(0, 1.0)
    ax.set_title(title, pad=20)
    ax.legend(loc="upper right", bbox_to_anchor=(1.25, 1.10))
    plt.tight_layout()
    plt.savefig(outfile)
    plt.close()

radar_cols = ["center_gradeNorm", "center_confidence", "center_coverage"]
radar_labels = ["GradeNorm", "Confidence", "Coverage"]
radar_plot(clu, radar_cols, radar_labels,
           "Cluster Centroids (Radar View)",
           "fig6c_cluster_centroids_radar.png")

# ---------- Figure 7c: Proficiency band distribution + means ----------
prof = pd.read_csv("proficiency_summary.csv")
# columns: Band,Count,Percent,MeanGrade,MeanConfidence,MeanCoverage,TopDominantSkill,TopWeakestSkill

# 7c-1: band distribution
plt.figure(figsize=(7,5))
sns.barplot(data=prof, x="Band", y="Count", palette="crest", hue="Band", legend=False)
plt.title("Learner Counts per Proficiency Band")
plt.xlabel("Proficiency Band")
plt.ylabel("Count")
for i, v in enumerate(prof["Count"]):
    plt.text(i, v, f"{v:,} ({prof.loc[i,'Percent']})", ha="center", va="bottom", fontsize=9)
plt.tight_layout()
plt.savefig("fig7c_band_counts.png")
plt.close()

# 7c-2: mean confidence & coverage by band (side-by-side)
prof_long = prof.melt(id_vars=["Band"], value_vars=["MeanConfidence","MeanCoverage"],
                      var_name="Metric", value_name="Score")
plt.figure(figsize=(8,5))
sns.barplot(data=prof_long, x="Band", y="Score", hue="Metric", palette="viridis")
plt.title("Confidence & Coverage per Proficiency Band")
plt.xlabel("Proficiency Band"); plt.ylabel("Score (0–1)")
plt.legend(title="")
plt.ylim(0,1)
plt.tight_layout()
plt.savefig("fig7d_band_confidence_coverage.png")
plt.close()

# 7c-3: “most frequent dominant/weakest skill” per band (horizontal bars)
dom = prof[["Band","TopDominantSkill"]].value_counts().reset_index(name="Freq").sort_values("Freq", ascending=False)
weak = prof[["Band","TopWeakestSkill"]].value_counts().reset_index(name="Freq").sort_values("Freq", ascending=False)

fig, ax = plt.subplots(1, 2, figsize=(11, 5), sharey=True)

# Use a valid palette and disable legend if redundant
sns.barplot(data=dom, x="Freq", y="TopDominantSkill", hue="Band", ax=ax[0], palette="viridis")
ax[0].set_title("Top Dominant Skill per Band")
ax[0].set_xlabel("Frequency")
ax[0].set_ylabel("Skill")
ax[0].legend(title="Band", loc="lower right")

sns.barplot(data=weak, x="Freq", y="TopWeakestSkill", hue="Band", ax=ax[1], palette="magma")
ax[1].set_title("Top Weakest Skill per Band")
ax[1].set_xlabel("Frequency")
ax[1].set_ylabel("")
ax[1].legend(title="Band", loc="lower right")

plt.tight_layout()
plt.savefig("fig7e_top_skills_per_band.png", dpi=300)
plt.close()

# ---------- Figure 7f: Axis–Axis correlation heatmap (if available) ----------
try:
    corr = pd.read_csv("axis_correlations.csv", index_col=0)
    plt.figure(figsize=(6.5,5.5))
    sns.heatmap(corr, vmin=-1, vmax=1, cmap="coolwarm", annot=False, square=True, cbar_kws={"label":"Pearson r"})
    plt.title("Correlation Between Cognitive Axes")
    plt.tight_layout()
    plt.savefig("fig7f_axis_correlation_heatmap.png")
    plt.close()
except FileNotFoundError:
    print("axis_correlations.csv not found; skipping correlation heatmap.")


print("✅ All figures generated successfully") 


