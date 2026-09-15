import sys
from recommender import recommend

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def run_test_cases():
    test_scenarios = [
        {
            "name": "Case 1: Ngân sách 5 - 10 triệu, Máy mới, Ưu tiên Gaming",
            "min_b": 5.0,
            "max_b": 10.0,
            "cond": "new",
            "prio": ["gaming"],
        },
        {
            "name": "Case 2: Ngân sách 7 - 15 triệu, Máy mới, Ưu tiên Camera + Mỏng nhẹ",
            "min_b": 7.0,
            "max_b": 15.0,
            "cond": "new",
            "prio": ["camera", "thin_light"],
        },
        {
            "name": "Case 3: Ngân sách 3 - 6 triệu, Máy cũ, Ưu tiên Pin + Gaming",
            "min_b": 3.0,
            "max_b": 6.0,
            "cond": "used",
            "prio": ["battery", "gaming"],
        },
        {
            "name": "Case 4: Ngân sách 15 - 30 triệu, Máy mới, Flagship toàn diện (Gaming + Camera)",
            "min_b": 15.0,
            "max_b": 30.0,
            "cond": "new",
            "prio": ["gaming", "camera"],
        }
    ]

    for tc in test_scenarios:
        print("\n" + "=" * 70)
        print(f"🧪 {tc['name']}")
        print("=" * 70)

        results = recommend(
            min_budget=tc["min_b"],
            max_budget=tc["max_b"],
            condition=tc["cond"],
            priorities=tc["prio"],
            top_n=3,
            min_year=2021
        )

        if results.empty:
            print("❌ Không có kết quả phù hợp.")
        else:
            for idx, (_, row) in enumerate(results.iterrows(), start=1):
                name = row.get("device_name", row.get("model_name", "Unknown"))
                variant = row.get("variant_name", row.get("variant", ""))
                brand = row.get("brand", "")
                price = int(row.get("price", 0))
                print(
                    f"TOP {idx}: {brand} {name} [{variant}] - "
                    f"Giá: {price:,}đ | "
                    f"Final Score: {row['final_score']} | "
                    f"Gaming: {row['gaming_score']} | "
                    f"Camera: {row['camera_score']} | "
                    f"Pin: {row['battery_score']}"
                )
                print(f"   ↳ Lý do: {row['reason']}")


if __name__ == "__main__":
    run_test_cases()
