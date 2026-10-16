"""Checks the fixed-effects shortcut against a plain regression with one dummy per group.
Run:  python -m unittest discover -s pipeline"""
import unittest

import numpy as np
import pandas as pd

from insights import within_ols


class WithinOLS(unittest.TestCase):
    def test_matches_dummy_variable_regression(self):
        rng = np.random.default_rng(0)
        n, groups = 600, 12
        g = rng.integers(0, groups, n)
        x1 = rng.normal(size=n) + g * 0.3          # correlated with the group, like size with area
        x2 = rng.integers(0, 2, n).astype(float)    # like off-plan yes/no
        y = 2.0 * x1 - 0.5 * x2 + g * 1.7 + rng.normal(scale=0.1, size=n)
        d = pd.DataFrame({"g": g.astype(str), "x1": x1, "x2": x2, "y": y})

        fast = within_ols(d, d.y, d[["x1", "x2"]], d.g)

        dummies = pd.get_dummies(d.g, dtype=float)
        full = np.column_stack([d[["x1", "x2"]].to_numpy(), dummies.to_numpy()])
        slow, *_ = np.linalg.lstsq(full, d.y.to_numpy(), rcond=None)

        np.testing.assert_allclose(fast.to_numpy(), slow[:2], atol=1e-8)
        self.assertAlmostEqual(fast["x1"], 2.0, places=1)
        self.assertAlmostEqual(fast["x2"], -0.5, places=1)


if __name__ == "__main__":
    unittest.main()
