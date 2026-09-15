def clamp(value, minimum=0, maximum=100):
    return max(minimum, min(value, maximum))


def scale(value, low, high):
    """
    Chuẩn hóa một giá trị về thang 0-100.
    """
    if high == low:
        return 0

    score = (value - low) / (high - low) * 100
    return clamp(score)


def panel_score(display_type):
    display_type = str(display_type).lower()

    if "dynamic amoled" in display_type:
        return 100

    if "super amoled" in display_type:
        return 98

    if "amoled" in display_type:
        return 95

    if "oled" in display_type:
        return 95

    if "ips" in display_type:
        return 70

    return 50


def calculate_camera_score(row):
    mp_score = scale(row.get("main_camera_mp", 12), 12, 200)

    ois_val = row.get("has_ois", row.get("ois", 0))
    ois_score = 100 if ois_val == 1 else 0

    zoom_score = scale(row.get("optical_zoom_x", 0), 0, 5)

    # Khẩu độ càng nhỏ càng tốt
    aperture = row.get("main_camera_aperture", 1.8)
    aperture_score = scale(
        2.5 - aperture,
        0,
        1.1
    )

    score = (
        mp_score * 0.30
        + ois_score * 0.30
        + zoom_score * 0.25
        + aperture_score * 0.15
    )

    return round(clamp(score), 2)


def calculate_gaming_score(row):
    antutu = row.get("estimated_antutu", row.get("antutu_score", row.get("antutu_base", 300000)))
    benchmark_score = scale(
        antutu,
        300000,
        2500000
    )

    ram_score = scale(
        row.get("ram_gb", 8),
        4,
        16
    )

    refresh_score = scale(
        row.get("refresh_rate_hz", 60),
        60,
        144
    )

    screen_score = panel_score(row.get("display_type", "AMOLED"))

    score = (
        benchmark_score * 0.55
        + ram_score * 0.20
        + refresh_score * 0.15
        + screen_score * 0.10
    )

    return round(clamp(score), 2)


def calculate_battery_score(row):
    capacity_score = scale(
        row.get("battery_mah", 5000),
        3000,
        6000
    )

    charging_score = scale(
        row.get("charging_w", 18),
        15,
        120
    )

    score = (
        capacity_score * 0.65
        + charging_score * 0.35
    )

    return round(clamp(score), 2)


def calculate_display_score(row):
    refresh_score = scale(
        row.get("refresh_rate_hz", 60),
        60,
        144
    )

    pixels = (
        row.get("resolution_width", 1080)
        * row.get("resolution_height", 2400)
    )

    resolution_score = scale(
        pixels,
        2000000,
        4600000
    )

    screen_score = panel_score(row.get("display_type", "AMOLED"))

    score = (
        refresh_score * 0.35
        + resolution_score * 0.35
        + screen_score * 0.30
    )

    return round(clamp(score), 2)


def calculate_thin_light_score(row):
    # Càng nhẹ càng tốt
    weight_score = scale(
        230 - row.get("weight_g", 190.0),
        0,
        80
    )

    # Càng mỏng càng tốt
    thickness_score = scale(
        10 - row.get("thickness_mm", 8.0),
        0,
        3.5
    )

    score = (
        weight_score * 0.60
        + thickness_score * 0.40
    )

    return round(clamp(score), 2)


def calculate_all_scores(row):
    return {
        "camera_score": calculate_camera_score(row),
        "gaming_score": calculate_gaming_score(row),
        "battery_score": calculate_battery_score(row),
        "display_score": calculate_display_score(row),
        "thin_light_score": calculate_thin_light_score(row)
    }