#!/usr/bin/env python3
"""Checks for the seasonal-adjustment step in nc_white_collar_index.py, against the published series in public/reports/wc-index.csv.
Run: python3 scripts/employment-report/test_seasonal.py   (also run by src/test/wc-index-script.test.ts)"""
import csv, importlib.util, os, subprocess, sys, tempfile, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
CSV = os.path.join(ROOT, "public", "reports", "wc-index.csv")
SCRIPT = os.path.join(HERE, "nc_white_collar_index.py")
spec = importlib.util.spec_from_file_location("idx", SCRIPT)
idx = importlib.util.module_from_spec(spec); spec.loader.exec_module(idx)

def published():
    with open(CSV, newline="") as f:
        return list(csv.DictReader(f))

class SeasonalAdjustment(unittest.TestCase):
    def setUp(self):
        self.rows = published()
        self.nsa = {r["month"]: float(r["wc_ltu_rate_pct_nsa"]) for r in self.rows}

    def test_fixed_factors_are_the_ones_estimated_from_the_series(self):
        est = idx.estimate_factors(self.nsa)
        for k, (a, b) in enumerate(zip(idx.SEASONAL_FACTORS, est)):
            self.assertAlmostEqual(a, b, places=4, msg=f"month {k + 1}")
        self.assertAlmostEqual(sum(idx.SEASONAL_FACTORS) / 12, 1.0, places=4)

    def test_report_methodology_factors_are_these_rounded(self):
        published3 = [1.104, 1.059, 0.998, 0.949, 0.907, 0.926, 1.039, 1.075, 1.057, 0.995, 0.965, 0.926]
        self.assertEqual([round(x, 3) for x in idx.SEASONAL_FACTORS], published3)

    def test_reproduces_the_published_adjusted_rate_and_index(self):
        sa = idx.adjusted(self.nsa, idx.SEASONAL_FACTORS)
        base = idx.index_base(sa)
        keys = sorted(self.nsa)
        exact = 0
        for i, k in enumerate(keys):
            r = self.rows[i]
            self.assertEqual(r["month"], k)
            d = abs(round(sa[k], 3) - float(r["wc_ltu_rate_pct_sa"]))
            self.assertLessEqual(d, 0.0011 - 1e-9, k)          # the published rates were rounded from unrounded inputs
            exact += d < 1e-9
            ma = idx.moving_avg(sa, keys, i)
            self.assertAlmostEqual(ma, float(r["wc_ltu_rate_3mma_sa"]), delta=0.0011, msg=k)
            self.assertAlmostEqual(100 * ma / base, float(r["wc_index_2019_100"]), delta=0.11, msg=k)
        self.assertGreaterEqual(exact / len(keys), 0.99)

    def test_october_2025_is_skipped_not_interpolated(self):
        self.assertNotIn("2025-10", self.nsa)
        sa = idx.adjusted(self.nsa, idx.SEASONAL_FACTORS)
        keys = sorted(sa)
        i = keys.index("2025-11")
        self.assertAlmostEqual(idx.moving_avg(sa, keys, i), (sa["2025-08"] + sa["2025-09"] + sa["2025-11"]) / 3)

    def test_index_needs_all_of_2019(self):
        self.assertIsNone(idx.index_base({"2019-01": 0.4}))

class UpdateMode(unittest.TestCase):
    def test_adds_the_next_month_from_a_public_cps_file(self):
        # One white-collar unemployed person out 30 weeks (weight 10) in a white-collar labor force of weight 1000: a rate of 1.0%.
        head = "PWCMPWGT,PEMLR,PRUNEDUR,PRMJOCC1,PRTAGE,PRUNTYPE,PEEDUCA"
        recs = ["10,4,30,1,50,2,43", "990,1,-1,2,40,-1,43", "100,1,-1,10,40,-1,39"]
        with tempfile.TemporaryDirectory() as d, tempfile.TemporaryDirectory() as data:
            cps = os.path.join(data, "oct26pub.csv")
            with open(cps, "w") as f:
                f.write("\n".join([head] + recs) + "\n")
            with open(CSV, newline="") as f:
                keep = [l for l in f.read().splitlines(keepends=True) if not l.startswith("2026-09")]
            out = os.path.join(d, "wc-index.csv")
            with open(out, "w", newline="") as f:
                f.write("".join(keep))
            end = "2026-10"
            r = subprocess.run([sys.executable, "-I", SCRIPT, "--update", out, "--cps-dir", data, "--end", end], capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            with open(out, newline="") as f:
                rows = list(csv.DictReader(f))
            self.assertEqual([x["month"] for x in rows][-2:], ["2026-08", "2026-10"])   # September's file was not given
            last = rows[-1]
            self.assertEqual(last["wc_ltu_rate_pct_nsa"], "1.0")
            self.assertAlmostEqual(float(last["wc_ltu_rate_pct_sa"]), 1.0 / idx.SEASONAL_FACTORS[9], places=3)
            self.assertEqual(last["wc_ltu_share_pct_nsa"], "100.0")
            # Old rows are kept as they were.
            self.assertEqual(rows[-2], published()[-2])

if __name__ == "__main__":
    unittest.main()
