import sys
from recommender import recommend


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

if hasattr(sys.stdin, "reconfigure"):
    sys.stdin.reconfigure(encoding="utf-8")


def main():
    print("=" * 60)
    print("📱 HỆ TRỢ GIÚP QUYẾT ĐỊNH LỰA CHỌN ĐIỆN THOẠI (PHONE DSS)")
    print("=" * 60)

    try:
        min_budget_input = input("Ngân sách tối thiểu (triệu đồng, VD: 5): ").strip()
        min_budget = float(min_budget_input) if min_budget_input else 5.0

        max_budget_input = input("Ngân sách tối đa (triệu đồng, VD: 10): ").strip()
        max_budget = float(max_budget_input) if max_budget_input else 10.0
    except ValueError:
        print("Vui lòng nhập ngân sách là số hợp lệ.")
        return

    print("\nTình trạng máy:")
    print("1. Máy mới (100% Brand-new)")
    print("2. Máy cũ (Like-new / Đã qua sử dụng)")

    condition_choice = input("Chọn 1 hoặc 2 (mặc định 1): ").strip()
    condition = "used" if condition_choice == "2" else "new"

    print("\nCác tiêu chí ưu tiên:")
    print("1. Camera (Chụp ảnh / Quay video / OIS / Zoom)")
    print("2. Gaming (Hiệu năng Chip / RAM / 120Hz)")
    print("3. Pin (Dung lượng mAh / Sạc nhanh W)")
    print("4. Màn hình (Độ phân giải / Tấm nền / Tần số quét)")
    print("5. Mỏng nhẹ (Trọng lượng / Độ dày)")

    priority_mapping = {
        "1": "camera",
        "2": "gaming",
        "3": "battery",
        "4": "display",
        "5": "thin_light"
    }

    priority_1 = input("\nTiêu chí ưu tiên số 1 (1-5, mặc định 2): ").strip()
    priority_1 = priority_mapping.get(priority_1, "gaming")

    use_second = input("Có tiêu chí ưu tiên thứ 2 không? (y/n, mặc định n): ").strip().lower()
    priorities = [priority_1]

    if use_second == "y":
        priority_2_choice = input("Tiêu chí ưu tiên số 2 (1-5): ").strip()
        priority_2 = priority_mapping.get(priority_2_choice)
        if priority_2 and priority_2 != priority_1:
            priorities.append(priority_2)

    print(f"\n⏳ Đang tìm kiếm và chấm điểm điện thoại phù hợp...")
    results = recommend(
        min_budget=min_budget,
        max_budget=max_budget,
        condition=condition,
        priorities=priorities,
        top_n=5,
        min_year=2021
    )

    print("\n" + "=" * 60)
    print("🏆 KẾT QUẢ GỢI Ý PHÙ HỢP NHẤT CHO BẠN")
    print("=" * 60)

    if results.empty:
        print("Không tìm thấy điện thoại phù hợp với ngân sách và yêu cầu của bạn.")
    else:
        for index, (_, row) in enumerate(results.iterrows(), start=1):
            name = row.get("device_name", row.get("model_name", "Unknown Device"))
            variant = row.get("variant_name", row.get("variant", "Standard"))
            brand = row.get("brand", "")
            price = int(row.get("price", 0))
            year = row.get("release_year", "")
            year_str = f" ({year})" if year else ""
            img = row.get("image_url", "")

            print(f"\n🥇 TOP {index}: {brand} {name}{year_str}")
            print(f"  • Phiên bản cấu hình: {variant}")
            print(f"  • Giá bán: {price:,} VNĐ ({'Máy mới' if condition == 'new' else 'Máy cũ'})")
            print(f"  • Điểm phù hợp (Final Score): {row['final_score']}/100")
            print(
                f"  • Chi tiết: Gaming: {row['gaming_score']} | "
                f"Camera: {row['camera_score']} | "
                f"Pin: {row['battery_score']} | "
                f"Màn hình: {row['display_score']} | "
                f"Đáng tiền (P/P): {row['value_score']:.1f}"
            )
            print(f"  • Lý do: {row['reason']}")
            if img and str(img).startswith("http"):
                print(f"  • Ảnh sản phẩm: {img}")


if __name__ == "__main__":
    main()
