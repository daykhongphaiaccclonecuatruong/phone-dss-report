import os
import sys
import pandas as pd

if sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

from recommender import recommend, get_buying_advice, load_data, add_price_data

def evaluate_case(case_name, params):
    print("=" * 80)
    print(f"🔍 EVALUATION SCENARIO: {case_name}")
    print(f"   Input: Budget={params.get('min_budget')} - {params.get('max_budget')}M | Cond={params.get('condition')} | Prios={params.get('priorities')}")
    if params.get('brand'):
        print(f"   Filter Brand: {params.get('brand')}")
    if params.get('has_5g'):
        print(f"   Filter 5G: {params.get('has_5g')}")
    if params.get('has_ip68'):
        print(f"   Filter IP68: {params.get('has_ip68')}")

    results = recommend(**params)

    if results.empty:
        print("   ❌ NO RESULTS RETURNED!")
        return False, "Empty result"

    print(f"   ✅ Returned {len(results)} distinct models:")
    
    device_ids = results["device_id"].tolist()
    if len(device_ids) != len(set(device_ids)):
        print(f"   🚨 ERROR: DUPLICATE DEVICES DETECTED! {device_ids}")
        return False, "Duplicate devices"

    for idx, (_, row) in enumerate(results.iterrows(), start=1):
        dev_name = f"{row['brand']} {row['device_name']}"
        var_name = row['variant_name']
        price = row['price']
        min_b = params.get('min_budget', 0) * 1_000_000
        max_b = params.get('max_budget', 100) * 1_000_000

        # Check budget fit (including 7% margin)
        within_strict = (min_b <= price <= max_b)
        within_relaxed = (min_b * 0.93 <= price <= max_b * 1.07)

        status_str = "Strict Fit" if within_strict else ("Relaxed Fit (±7%)" if within_relaxed else "Out of Budget")

        print(f"\n   [{idx}] {dev_name} | {var_name}")
        print(f"       💵 Giá: {price:,} đ ({status_str}) | Điểm DSS: {row['final_score']} (Value P/P: {row['value_score']})")
        print(f"       📊 Subscores: Gaming={row['gaming_score']} | Camera={row['camera_score']} | Pin={row['battery_score']} | Screen={row['display_score']}")
        print(f"       🧠 Lý do: {row['reason']}")

        advice = get_buying_advice(row['variant_id'])
        if advice:
            best_s = advice[0]
            print(f"       🏪 Nơi mua rẻ nhất: {best_s['retailer']} ({best_s['price']:,} đ) | URL: {best_s['product_url'][:70]}...")
            print(f"          -> Tổng cộng có {len(advice)} chuỗi bán lẻ báo giá")
        else:
            print(f"       ⚠️ Không tìm thấy breakdown giá cửa hàng chi tiết!")

    return True, "Passed"

def main():
    scenarios = [
        (
            "Scenario 1: Sinh viên mua máy phổ thông (3 - 6 Triệu, Máy Mới, Ưu tiên Pin & Màn hình)",
            {
                "min_budget": 3.0,
                "max_budget": 6.0,
                "condition": "new",
                "priorities": ["battery", "display"],
                "top_n": 3,
                "min_year": 2021
            }
        ),
        (
            "Scenario 2: Game thủ di động (9 - 16 Triệu, Máy Mới, Ưu tiên Gaming & Màn hình 120Hz)",
            {
                "min_budget": 9.0,
                "max_budget": 16.0,
                "condition": "new",
                "priorities": ["gaming", "display"],
                "top_n": 3,
                "min_year": 2022
            }
        ),
        (
            "Scenario 3: Sáng tạo nội dung / TikToker (14 - 26 Triệu, Máy Mới, Ưu tiên Camera & Dung lượng ROM lớn)",
            {
                "min_budget": 14.0,
                "max_budget": 26.0,
                "condition": "new",
                "priorities": ["camera", "gaming"],
                "top_n": 3,
                "min_year": 2022
            }
        ),
        (
            "Scenario 4: Khách hàng mua Flagship Cũ Tiết Kiệm (15 - 28 Triệu, Máy Cũ, Ưu tiên Camera & Màn hình)",
            {
                "min_budget": 15.0,
                "max_budget": 28.0,
                "condition": "used",
                "priorities": ["camera", "display"],
                "top_n": 3
            }
        ),
        (
            "Scenario 5: Flagship Doanh Nhân (20 - 45 Triệu, Máy Mới, Có 5G, Chống nước IP68, Ưu tiên Mỏng nhẹ & Màn hình)",
            {
                "min_budget": 20.0,
                "max_budget": 45.0,
                "condition": "new",
                "priorities": ["thin_light", "display"],
                "top_n": 3,
                "has_5g": True,
                "has_ip68": True
            }
        ),
        (
            "Scenario 6: Edge Case - Khoảng giá rất hẹp (7.5 - 8.2 Triệu, Máy Mới, Ưu tiên Gaming)",
            {
                "min_budget": 7.5,
                "max_budget": 8.2,
                "condition": "new",
                "priorities": ["gaming", "battery"],
                "top_n": 3
            }
        )
    ]

    print("================================================================================")
    print("🚀 BẮT ĐẦU CHẠY ĐÁNH GIÁ CHUYÊN SÂU THUẬT TOÁN PHONE DSS TRÊN DỮ LIỆU THỰC TẾ VN")
    print("================================================================================")

    results_summary = []
    for name, p in scenarios:
        ok, msg = evaluate_case(name, p)
        results_summary.append((name, ok, msg))

    print("\n" + "=" * 80)
    print("📋 BẢNG TỔNG KẾT ĐÁNH GIÁ THUẬT TOÁN")
    print("=" * 80)
    for name, ok, msg in results_summary:
        status_icon = "✅ ĐẠT" if ok else "❌ LỖI"
        print(f"{status_icon} | {name} -> {msg}")

if __name__ == "__main__":
    main()

