import numpy as np
import matplotlib.pyplot as plt

def triangular(x, a, b, c):
    y = np.zeros_like(x, dtype=float)
    # rising
    idx = (x >= a) & (x <= b)
    y[idx] = (x[idx] - a) / (b - a) if b != a else 1.0
    # falling
    idx = (x >= b) & (x <= c)
    y[idx] = np.maximum(y[idx], (c - x[idx]) / (c - b) if c != b else 1.0)
    # outside
    y[(x < a) | (x > c)] = 0.0
    return np.clip(y, 0.0, 1.0)

# Axis domain
s = np.linspace(0, 100, 1001)

# Parameters (can be adjusted to match your paper)
low_params = (0, 25, 50)
med_params = (40, 60, 70)
high_params = (65, 80, 100)

low = triangular(s, *low_params)
med = triangular(s, *med_params)
high = triangular(s, *high_params)

# Publication-ish sizing: single-column IEEE ~3.5in wide
fig = plt.figure(figsize=(3.5, 3), dpi=200)
ax = fig.add_subplot(111)

ax.plot(s, low, linewidth=2, label="Low")
ax.plot(s, med, linewidth=2, label="Medium")
ax.plot(s, high, linewidth=2, label="High")

ax.set_xlim(0, 100)
ax.set_ylim(0, 1.02)

ax.set_xlabel(r"Learner axis score, $x \in [0,100]$ (%)")
ax.set_ylabel(r"Membership degree, $\mu(x) \in [0,1]$")
 
ax.grid(True, linestyle="--", linewidth=0.6, alpha=0.4)
ax.legend(frameon=True, fontsize=8, loc="upper right")

fig.tight_layout()

png_path = "dm_tarl_membership_functions_ieee.png"
pdf_path = "dm_tarl_membership_functions_ieee.pdf"
fig.savefig(png_path, dpi=600, bbox_inches="tight")
fig.savefig(pdf_path, bbox_inches="tight")

plt.close(fig)

png_path, pdf_path
