import os
import sys
import pandas as pd

if sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Add current directory to path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

from recommender import recommend, get_buying_advice

def run_tests():
    print("=================================================================")
    print("🚀 RUNNING PHONE DSS ENGINE TEST SUITE (6-STAGE PIPELINE)")
    print("=================================================================")

    # Test Case 1: Gaming Budget 7 - 14 Triệu (New)
    print("\n--- TEST CASE 1: Gaming & Màn hình đẹp (7 - 14 Triệu, Máy Mới) ---")
    res1 = recommend(
        min_budget=7.0,
        max_budget=14.0,
        condition="new",
        priorities=["gaming", "display"],
        top_n=3,
        min_year=2021
    )
    assert not res1.empty, "Test Case 1 returned empty dataframe!"
    assert len(res1["device_id"].unique()) == len(res1), "Duplicate device_ids found in recommendations!"
    
    for idx, (_, r) in enumerate(res1.iterrows(), start=1):
        dev_name = f"{r['brand']} {r['device_name']}"
        print(f"🥇 Top {idx}: {dev_name} [{r['variant_name']}]")
        print(f"   💰 Giá min: {r['price']:,} đ | Điểm DSS: {r['final_score']} (Gaming: {r['gaming_score']}, Display: {r['display_score']})")
        print(f"   💡 Lý do: {r['reason']}")
        advice = get_buying_advice(r["variant_id"])
        print(f"   🏪 So sánh giá {len(advice)} cửa hàng:")
        for shop in advice:
            print(f"      - {shop['retailer']}: {shop['price']:,} đ ({shop['stock_status']}) -> {shop['product_url']}")

    # Test Case 2: Camera & Pin trâu (15 - 25 Triệu, Máy Cũ)
    print("\n--- TEST CASE 2: Camera & Pin Trâu (15 - 25 Triệu, Máy Cũ / Like-New) ---")
    res2 = recommend(
        min_budget=15.0,
        max_budget=25.0,
        condition="used",
        priorities=["camera", "battery"],
        top_n=3,
        min_year=2021
    )
    assert not res2.empty, "Test Case 2 returned empty dataframe!"
    assert len(res2["device_id"].unique()) == len(res2), "Duplicate device_ids found in recommendations!"
    
    for idx, (_, r) in enumerate(res2.iterrows(), start=1):
        dev_name = f"{r['brand']} {r['device_name']}"
        print(f"🏆 Top {idx}: {dev_name} [{r['variant_name']}]")
        print(f"   💰 Giá min: {r['price']:,} đ | Điểm DSS: {r['final_score']} (Camera: {r['camera_score']}, Pin: {r['battery_score']})")
        print(f"   💡 Lý do: {r['reason']}")

    # Test Case 3: Nhu cầu giá rẻ dưới 5 triệu (New)
    print("\n--- TEST CASE 3: Giá rẻ < 5 Triệu, Pin Trâu & Mỏng Nhẹ (Máy Mới) ---")
    res3 = recommend(
        min_budget=1.0,
        max_budget=5.0,
        condition="new",
        priorities=["battery", "thin_light"],
        top_n=3
    )
    assert not res3.empty, "Test Case 3 returned empty dataframe!"
    for idx, (_, r) in enumerate(res3.iterrows(), start=1):
        print(f"⭐ Top {idx}: {r['brand']} {r['device_name']} [{r['variant_name']}] - {r['price']:,} đ | Điểm: {r['final_score']}")

    print("\n=================================================================")
    print("✅ ALL 3 TEST CASES PASSED WITH 100% SUCCESS!")
    print("=================================================================")

if __name__ == "__main__":
    run_tests()
