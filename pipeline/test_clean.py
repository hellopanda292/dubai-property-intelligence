"""Unit tests for the cleaning rules.  Run:  python -m unittest discover pipeline"""
import unittest

import numpy as np
import pandas as pd

from clean import bedrooms, clean_sales, slugify, tidy_area, tidy_place


def sale(**over):
    row = {"TRANSACTION_NUMBER": "1", "INSTANCE_DATE": "2026-03-01 10:00:00", "PROCEDURE_EN": "Sale",
           "IS_OFFPLAN_EN": "Ready", "USAGE_EN": "Residential", "AREA_EN": "BUSINESS BAY", "PROP_TYPE_EN": "Unit",
           "PROP_SB_TYPE_EN": "Flat", "TRANS_VALUE": 1_500_000.0, "ACTUAL_AREA": 80.0, "ROOMS_EN": "1 B/R",
           "NEAREST_METRO_EN": "Business Bay Metro Station", "NEAREST_MALL_EN": None, "NEAREST_LANDMARK_EN": None,
           "PROJECT_EN": "OXFORD COVE"}
    row.update(over)
    return row


class TidyNames(unittest.TestCase):
    def test_area_names(self):
        self.assertEqual(tidy_area("BUSINESS BAY"), "Business Bay")
        self.assertEqual(tidy_area("ARABIAN RANCHES III"), "Arabian Ranches III")
        self.assertEqual(tidy_area("DMCC-EZ2"), "DMCC-EZ2")
        self.assertEqual(tidy_area("Al Yelayiss 1"), "Al Yelayiss 1")
        self.assertEqual(tidy_area("International City Ph 2 & 3"), "International City Ph 2 & 3")

    def test_places_only_fix_all_caps(self):
        self.assertEqual(tidy_place("OXFORD COVE"), "Oxford Cove")
        self.assertEqual(tidy_place("Binghatti Apex"), "Binghatti Apex")
        self.assertIsNone(tidy_place(None))
        self.assertIsNone(tidy_place("   "))

    def test_slug(self):
        self.assertEqual(slugify("International City Ph 2 & 3"), "international-city-ph-2-3")


class Bedrooms(unittest.TestCase):
    def test_parsing(self):
        self.assertEqual(bedrooms("Studio"), 0)
        self.assertEqual(bedrooms("3 B/R"), 3)
        self.assertTrue(np.isnan(bedrooms("Office")))
        self.assertTrue(np.isnan(bedrooms(None)))


class CleanSales(unittest.TestCase):
    def test_keeps_a_normal_sale_and_derives_columns(self):
        rows = [sale(TRANSACTION_NUMBER=str(i), TRANS_VALUE=1_500_000.0 + i * 1000) for i in range(300)]
        df, log = clean_sales(pd.DataFrame(rows))
        self.assertGreater(len(df), 290)  # only the 0.5% tails can be trimmed
        first = df.iloc[0]
        self.assertEqual(first.area, "Business Bay")
        self.assertEqual(first.project, "Oxford Cove")
        self.assertAlmostEqual(first.sqft, 80 * 10.7639, places=3)
        self.assertEqual(log[0], ("All sales transactions", 300))

    def test_removes_non_market_and_impossible_rows(self):
        good = [sale(TRANSACTION_NUMBER=str(i)) for i in range(50)]
        bad = [
            sale(TRANSACTION_NUMBER="office", PROP_SB_TYPE_EN="Office"),
            sale(TRANSACTION_NUMBER="lease", PROCEDURE_EN="Lease to Own Registration"),
            sale(TRANSACTION_NUMBER="tiny", ACTUAL_AREA=5.0),
            sale(TRANSACTION_NUMBER="gift", TRANS_VALUE=1_000.0),
            sale(TRANSACTION_NUMBER="norooms", ROOMS_EN=None),
        ]
        df, _ = clean_sales(pd.DataFrame(good + bad))
        self.assertFalse(set(df.TRANSACTION_NUMBER) & {"office", "lease", "tiny", "gift", "norooms"})

    def test_villas_are_buildings_in_dld_data(self):
        rows = [sale(TRANSACTION_NUMBER=str(i), PROP_TYPE_EN="Building", PROP_SB_TYPE_EN="Villa", ACTUAL_AREA=250.0, ROOMS_EN="4 B/R",
                     TRANS_VALUE=4_000_000.0) for i in range(20)]
        df, _ = clean_sales(pd.DataFrame(rows))
        self.assertTrue((df.type == "Villa").all())


if __name__ == "__main__":
    unittest.main()
