import os
import re
import sys

import pandas as pd

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.append(CURRENT_DIR)

from recommender import recommend


def normalize_variant_id(variant_id):
    text = str(variant_id).lower()
    condition_suffixes = [
        "_c_p",
        "_c_tr_y_x_c",
        "_c_x_c_c_n",
        "_k_ch_ho_t",
        "_cu_dep",
        "_cu_tray_xuoc",
        "_cu_xuoc_can",
        "_da_kich_hoat",
    ]
    for suffix in condition_suffixes:
        text = re.sub(f"{suffix}(?=_[0-9])", "", text)
    return text


def print_profile_result(label, result, priority_column):
    print(f"\n[{label}] rows={len(result)}")
    if result.empty:
        print("No recommendation found.")
        return

    columns = [
        "brand",
        "device_name",
        "variant_name",
        "price",
        "final_score",
        "ml_score",
        "mcda_score",
        priority_column,
    ]
    print(result[columns].head(5).to_string(index=False))


def assert_ml_columns(result):
    required = {"final_score", "ml_score", "mcda_score"}
    missing = required - set(result.columns)
    assert not missing, f"Missing ML/DSS score columns: {missing}"
    blended = (result["mcda_score"] * 0.70 + result["ml_score"] * 0.30).round(2)
    diff = (result["final_score"] - blended).abs().max()
    assert diff <= 0.01, "final_score must equal 70% MCDA + 30% ML score."


def run_profile_checks():
    profiles = [
        ("Budget 5-7m, battery first", 5, 7, "new", ["battery"], "battery_score"),
        ("Budget 7-12m, camera first", 7, 12, "new", ["camera"], "camera_score"),
        ("Budget 7-15m, gaming first", 7, 15, "new", ["gaming"], "gaming_score"),
        ("Budget 10-15m, display first", 10, 15, "new", ["display"], "display_score"),
        ("Budget 5-10m, used, battery first", 5, 10, "used", ["battery"], "battery_score"),
    ]

    for label, min_budget, max_budget, condition, priorities, score_col in profiles:
        result = recommend(
            min_budget=min_budget,
            max_budget=max_budget,
            condition=condition,
            priorities=priorities,
            top_n=5,
            min_year=2020,
        )
        print_profile_result(label, result, score_col)
        assert not result.empty, f"{label} returned no result."
        assert_ml_columns(result)

    empty_result = recommend(
        min_budget=0.1,
        max_budget=0.2,
        condition="new",
        priorities=["battery"],
        top_n=3,
        min_year=2020,
        enable_relaxation=False,
    )
    print(f"\n[Boundary budget 0.1-0.2m] rows={len(empty_result)}")
    assert empty_result.empty, "Very low budget should return an empty result, not fake data."

    pin_result = recommend(7, 15, "new", ["battery"], top_n=5, min_year=2020)
    camera_result = recommend(7, 15, "new", ["camera"], top_n=5, min_year=2020)
    pin_order = pin_result["device_name"].head(5).tolist()
    camera_order = camera_result["device_name"].head(5).tolist()
    print("\n[Priority switch]")
    print("Battery order:", pin_order)
    print("Camera order :", camera_order)
    assert pin_order != camera_order, "Changing priority should change recommendation order."


def run_price_consistency_check():
    price_path = os.path.join(CURRENT_DIR, "data", "05_device_aggregated_prices.csv")
    prices = pd.read_csv(price_path)
    prices["normalized_variant_id"] = prices["variant_id"].apply(normalize_variant_id)

    comparable = (
        prices.pivot_table(
            index="normalized_variant_id",
            columns="condition_type",
            values="min_price",
            aggfunc="min",
        )
        .dropna(subset=["new", "used"])
    )
    suspicious = comparable[comparable["used"] >= comparable["new"]]

    print("\n[Used vs new price consistency]")
    print(f"Comparable variants: {len(comparable)}")
    print(f"Used price >= new price: {len(suspicious)}")
    if not suspicious.empty:
        print(suspicious.sort_values("used", ascending=False).head(20).to_string())
    assert suspicious.empty, "Some used variants are not cheaper than their comparable new variant."


if __name__ == "__main__":
    run_profile_checks()
    run_price_consistency_check()
    print("\nAll DSS validation checks passed.")
