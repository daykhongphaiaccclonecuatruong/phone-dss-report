def clamp(value, minimum=0.0, maximum=100.0):
    """Giới hạn điểm trong thang 0 - 100."""
    return max(minimum, min(float(value), maximum))


def scale(value, low, high):
    """
    Chuẩn hóa giá trị về thang điểm 0 - 100 theo khoảng Min - Max.
    """
    if high <= low:
        return 0.0
    score = (float(value) - low) / (high - low) * 100.0
    return clamp(score)


def panel_score(display_type):
    """Đánh giá chất lượng tấm nền màn hình."""
    display_type = str(display_type).lower()

    if "dynamic ltpo" in display_type or "foldable dynamic" in display_type or "ltpo amoled" in display_type or "ltpo oled" in display_type or "super retina xdr" in display_type:
        return 100.0
    if "dynamic amoled" in display_type:
        return 98.0
    if "super amoled" in display_type:
        return 95.0
    if "amoled" in display_type or "oled" in display_type:
        return 92.0
    if "ips" in display_type:
        return 70.0
    if "tft" in display_type:
        return 45.0
    return 60.0


def calculate_camera_score(row):
    """
    Tính điểm camera: Kết hợp thông số phần cứng (MP, OIS, Zoom, Khẩu độ, ROM)
    và Điểm Benchmark / DxOMark thực tế từ chuyên gia (score_camera).
    """
    mp_score = scale(row.get("main_camera_mp", 12), 12, 200)

    ois_val = row.get("has_ois", row.get("ois", 0))
    ois_score = 100.0 if str(ois_val) in ["1", "1.0", "True", "true", "yes"] else 0.0

    zoom_score = scale(row.get("optical_zoom_x", 0), 0, 5)

    # Khẩu độ: càng nhỏ thu sáng càng tốt (f/1.4 - f/2.5)
    aperture = float(row.get("main_camera_aperture", 1.8) or 1.8)
    aperture_score = scale(2.5 - aperture, 0, 1.1)

    # ROM bonus cho lưu trữ ảnh/video (128GB: 60đ, 256GB: 85đ, 512GB+: 100đ)
    rom_gb = float(row.get("rom_gb", 128) or 128)
    rom_bonus = scale(rom_gb, 64, 512)

    spec_score = (
        mp_score * 0.25
        + ois_score * 0.30
        + zoom_score * 0.25
        + aperture_score * 0.10
        + rom_bonus * 0.10
    )

    # Hòa trộn với điểm Benchmark / DxOMark chuyên gia nếu có
    bench_score = float(row.get("score_camera", 0) or 0)
    if bench_score > 0:
        final_score = spec_score * 0.50 + bench_score * 0.50
    else:
        final_score = spec_score

    return round(clamp(final_score), 2)


def calculate_gaming_score(row):
    """
    Tính điểm hiệu năng & chơi game (AnTuTu, RAM thực tế, Tần số quét, Tấm nền).
    """
    antutu = float(row.get("estimated_antutu", row.get("antutu_score", row.get("antutu_base", 300000))) or 300000)
    benchmark_score = scale(antutu, 250000, 2500000)

    ram_gb = float(row.get("ram_gb", 8) or 8)
    ram_score = scale(ram_gb, 4, 16)

    refresh_hz = float(row.get("refresh_rate_hz", 60) or 60)
    refresh_score = scale(refresh_hz, 60, 144)

    screen_score = panel_score(row.get("display_type", "AMOLED"))

    score = (
        benchmark_score * 0.50
        + ram_score * 0.25
        + refresh_score * 0.15
        + screen_score * 0.10
    )
    return round(clamp(score), 2)


def calculate_battery_score(row):
    """
    Tính điểm pin và sạc nhanh: Kết hợp dung lượng mAh, công suất sạc W và điểm Benchmark pin.
    """
    mah = float(row.get("battery_mah", 5000) or 5000)
    capacity_score = scale(mah, 3000, 6500)

    watts = float(row.get("charging_w", 25) or 25)
    charging_score = scale(watts, 15, 120)

    spec_score = (
        capacity_score * 0.60
        + charging_score * 0.40
    )

    bench_score = float(row.get("score_battery", 0) or 0)
    if bench_score > 0:
        final_score = spec_score * 0.60 + bench_score * 0.40
    else:
        final_score = spec_score

    return round(clamp(final_score), 2)


def calculate_display_score(row):
    """
    Tính điểm màn hình: Tần số quét, Độ phân giải, Tấm nền và Điểm chất lượng hiển thị.
    """
    refresh_hz = float(row.get("refresh_rate_hz", 60) or 60)
    refresh_score = scale(refresh_hz, 60, 144)

    w = float(row.get("resolution_width", 1080) or 1080)
    h = float(row.get("resolution_height", 2400) or 2400)
    pixels = w * h
    resolution_score = scale(pixels, 1500000, 4500000)

    screen_score = panel_score(row.get("display_type", "AMOLED"))

    spec_score = (
        refresh_score * 0.35
        + resolution_score * 0.35
        + screen_score * 0.30
    )

    bench_score = float(row.get("score_display", 0) or 0)
    if bench_score > 0:
        final_score = spec_score * 0.60 + bench_score * 0.40
    else:
        final_score = spec_score

    return round(clamp(final_score), 2)


def calculate_thin_light_score(row):
    """
    Tính điểm mỏng nhẹ, cảm giác cầm nắm.
    """
    weight_g = float(row.get("weight_g", 190.0) or 190.0)
    weight_score = scale(235.0 - weight_g, 0, 85.0)

    thick_mm = float(row.get("thickness_mm", 8.0) or 8.0)
    thickness_score = scale(10.0 - thick_mm, 0, 3.5)

    score = (
        weight_score * 0.60
        + thickness_score * 0.40
    )
    return round(clamp(score), 2)


def calculate_used_condition_score(row):
    """
    Tính điểm chất lượng máy cũ (Pin còn lại, Ngoại hình, Tình trạng bảo hành).
    """
    battery_score = float(row.get("battery_health_percent", 90) or 90)

    exterior_mapping = {
        "brand-new": 100.0,
        "like-new": 96.0,
        "good": 82.0,
        "fair": 65.0
    }
    ext_val = str(row.get("exterior_condition", "good")).lower().strip()
    exterior_score = exterior_mapping.get(ext_val, 80.0)

    w_val = str(row.get("warranty_status", "yes")).lower()
    warranty_score = 100.0 if "yes" in w_val or "tháng" in w_val or "còn" in w_val else 40.0

    score = (
        battery_score * 0.45
        + exterior_score * 0.35
        + warranty_score * 0.20
    )
    return round(clamp(score), 2)


def calculate_all_scores(row):
    """Tính toán toàn bộ các điểm thành phần."""
    return {
        "camera_score": calculate_camera_score(row),
        "gaming_score": calculate_gaming_score(row),
        "battery_score": calculate_battery_score(row),
        "display_score": calculate_display_score(row),
        "thin_light_score": calculate_thin_light_score(row)
    }
