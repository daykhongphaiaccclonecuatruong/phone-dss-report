import os
import sys
import json
import re
import sqlite3
import pandas as pd

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def generate_device_id(brand, name, url):
    if url and isinstance(url, str):
        # Extract slug from url e.g. apple_iphone_15_pro_max-12548.php
        slug = url.split("/")[-1].replace(".php", "")
        slug = re.sub(r"[^\w\-]", "_", slug).lower().replace("-", "_")
        if slug:
            return slug
    # Fallback to name
    clean_name = re.sub(r"[^\w\s]", "", f"{brand}_{name}").strip()
    return re.sub(r"\s+", "_", clean_name).lower()


def parse_release_year(announced_str):
    if not announced_str or not isinstance(announced_str, str):
        return None
    m = re.search(r"\b(19\d\d|20\d\d)\b", announced_str)
    if m:
        return int(m.group(1))
    return None


def parse_screen_size(size_str):
    if not size_str or not isinstance(size_str, str):
        return 0.0
    m = re.search(r"(\d+\.?\d*)\s*inches", size_str, re.IGNORECASE)
    if m:
        return float(m.group(1))
    return 0.0


def parse_resolution(res_str):
    if not res_str or not isinstance(res_str, str):
        return 1080, 2400
    m = re.search(r"(\d{3,4})\s*x\s*(\d{3,4})", res_str)
    if m:
        w, h = int(m.group(1)), int(m.group(2))
        return min(w, h), max(w, h)
    return 1080, 2400


def parse_refresh_rate(display_str):
    if not display_str or not isinstance(display_str, str):
        return 60
    m = re.search(r"\b(90|120|144|165|240)\s*Hz\b", display_str, re.IGNORECASE)
    if m:
        return int(m.group(1))
    return 60


def parse_camera_specs(cam_dict):
    if not cam_dict or not isinstance(cam_dict, dict):
        return 50, 1.8, 0, 0.0

    cam_text = ""
    for k in ["single", "dual", "triple", "quad", "five", "features", "main"]:
        if k in cam_dict and cam_dict[k]:
            cam_text += " " + str(cam_dict[k])

    # MP
    mp = 12
    m_mp = re.search(r"(\d+)\s*MP", cam_text, re.IGNORECASE)
    if m_mp:
        mp = int(m_mp.group(1))

    # Aperture f/1.8
    aperture = 1.8
    m_ap = re.search(r"f/(\d+\.?\d*)", cam_text, re.IGNORECASE)
    if m_ap:
        aperture = float(m_ap.group(1))

    # OIS
    has_ois = 1 if re.search(r"\bois\b", cam_text, re.IGNORECASE) else 0

    # Optical zoom
    zoom = 0.0
    m_zoom = re.search(r"(\d+(?:\.\d+)?)\s*x\s*optical\s*zoom", cam_text, re.IGNORECASE)
    if m_zoom:
        zoom = float(m_zoom.group(1))

    return mp, aperture, has_ois, zoom


def parse_battery(battery_dict):
    if not battery_dict or not isinstance(battery_dict, dict):
        return 5000, 25

    b_type = str(battery_dict.get("type", ""))
    charging_str = str(battery_dict.get("charging", ""))

    mah = 5000
    m_mah = re.search(r"(\d{3,5})\s*mAh", b_type, re.IGNORECASE)
    if m_mah:
        mah = int(m_mah.group(1))
    else:
        m_mah2 = re.search(r"(\d{3,5})\s*mAh", charging_str, re.IGNORECASE)
        if m_mah2:
            mah = int(m_mah2.group(1))

    watt = 18
    m_w = re.search(r"(\d+)\s*W\b", charging_str, re.IGNORECASE)
    if m_w:
        watt = int(m_w.group(1))

    return mah, watt


def parse_body(body_dict):
    if not body_dict or not isinstance(body_dict, dict):
        return 190.0, 8.0, "None"

    weight_str = str(body_dict.get("weight", ""))
    dim_str = str(body_dict.get("dimensions", ""))
    sim_str = str(body_dict.get("sim", "")) + " " + str(body_dict.get("build", ""))

    weight = 190.0
    m_w = re.search(r"(\d+\.?\d*)\s*g\b", weight_str, re.IGNORECASE)
    if m_w:
        weight = float(m_w.group(1))

    thickness = 8.0
    # e.g. 162.3 x 79 x 8.6 mm
    m_th = re.search(r"x\s*(\d+\.?\d*)\s*mm", dim_str, re.IGNORECASE)
    if m_th:
        thickness = float(m_th.group(1))

    ip = "None"
    m_ip = re.search(r"\b(IP[56][4578])\b", sim_str, re.IGNORECASE)
    if m_ip:
        ip = m_ip.group(1).upper()

    return weight, thickness, ip


def parse_memory_variants(internal_str):
    if not internal_str or not isinstance(internal_str, str):
        return [{"ram_gb": 8, "rom_gb": 128, "variant_name": "8GB/128GB"}]

    text = internal_str.split("\n")[0]
    parts = [p.strip() for p in text.split(",") if p.strip()]
    variants = []

    for p in parts:
        # e.g. 128GB 6GB RAM, 256GB 8GB RAM, 1TB 12GB RAM
        m = re.search(r"(\d+)\s*(GB|MB|TB)\s*(\d+)\s*(GB|MB)\s*RAM", p, re.IGNORECASE)
        if m:
            rom_val, rom_unit, ram_val, ram_unit = m.groups()
            rom_gb = int(rom_val) * (1024 if rom_unit.upper() == "TB" else (1 if rom_unit.upper() == "GB" else 1))
            ram_gb = int(ram_val) * (1 if ram_unit.upper() == "GB" else 1)
            if ram_gb > 0 and rom_gb > 0:
                variants.append({"ram_gb": ram_gb, "rom_gb": rom_gb, "variant_name": f"{ram_gb}GB/{rom_gb}GB"})
            continue

        # e.g. 16GB 2GB RAM
        m2 = re.search(r"(\d+)\s*(GB|MB)\s+(\d+)\s*(GB|MB)", p, re.IGNORECASE)
        if m2:
            rom_val, rom_unit, ram_val, ram_unit = m2.groups()
            rom_gb = int(rom_val) * (1 if rom_unit.upper() == "GB" else 1)
            ram_gb = int(ram_val) * (1 if ram_unit.upper() == "GB" else 1)
            if ram_gb > 0 and rom_gb > 0:
                variants.append({"ram_gb": ram_gb, "rom_gb": rom_gb, "variant_name": f"{ram_gb}GB/{rom_gb}GB"})
            continue

        # e.g. 128GB (no RAM specified, default 6GB RAM)
        m3 = re.search(r"(\d+)\s*GB\b", p, re.IGNORECASE)
        if m3:
            rom_gb = int(m3.group(1))
            variants.append({"ram_gb": 6, "rom_gb": rom_gb, "variant_name": f"6GB/{rom_gb}GB"})

    if not variants:
        variants.append({"ram_gb": 8, "rom_gb": 128, "variant_name": "8GB/128GB"})

    # Deduplicate variants
    unique = []
    seen = set()
    for v in variants:
        key = (v["ram_gb"], v["rom_gb"])
        if key not in seen:
            seen.add(key)
            unique.append(v)
    return unique


def parse_lab_tests(our_tests_dict):
    if not our_tests_dict or not isinstance(our_tests_dict, dict):
        return None, None, None, None, None

    perf_str = str(our_tests_dict.get("performance", ""))
    disp_str = str(our_tests_dict.get("display", ""))
    bat_str = str(our_tests_dict.get("battery", ""))

    # AnTuTu lab: Look for v11, v10, v9 or largest number
    antutu = None
    # match patterns like 2600583 (v10) or 1823822 (v10) or AnTuTu: 1453497
    antutu_matches = re.findall(r"(\d{5,8})\s*(?:\((v\d+)\))?", perf_str)
    if antutu_matches:
        # Sort by version or value
        best_val = 0
        for val_str, ver in antutu_matches:
            val = int(val_str)
            if val > 50000: # realistic antutu
                if val > best_val:
                    best_val = val
        if best_val > 0:
            antutu = best_val

    # Geekbench
    gb_score = None
    m_gb = re.search(r"GeekBench:\s*(\d{3,6})", perf_str, re.IGNORECASE)
    if m_gb:
        gb_score = int(m_gb.group(1))

    # Display nits
    nits = None
    m_nits = re.search(r"(\d{3,5})\s*nits", disp_str, re.IGNORECASE)
    if m_nits:
        nits = int(m_nits.group(1))

    # Battery active hours
    active_h = None
    m_bat = re.search(r"(\d{1,2}):(\d{2})h", bat_str, re.IGNORECASE)
    if m_bat:
        active_h = round(int(m_bat.group(1)) + int(m_bat.group(2)) / 60.0, 2)

    return antutu, gb_score, nits, active_h, perf_str


def parse_raw_price(misc_dict, brand, antutu_est, year):
    # Parse misc.price
    price_vnd = None
    if misc_dict and isinstance(misc_dict, dict):
        price_str = str(misc_dict.get("price", ""))
        # Match USD: $ 547.80 or $ 1,199.99
        m_usd = re.search(r"\$\s*([\d,]+\.?\d*)", price_str)
        if m_usd:
            usd_val = float(m_usd.group(1).replace(",", ""))
            if usd_val > 20:
                price_vnd = int(usd_val * 25400)

        if not price_vnd:
            # Match EUR: About 230 EUR or € 620.00
            m_eur = re.search(r"(?:About\s+)?(?:€\s*|)([\d,]+\.?\d*)\s*(?:EUR|€)", price_str, re.IGNORECASE)
            if m_eur:
                eur_val = float(m_eur.group(1).replace(",", ""))
                if eur_val > 20:
                    price_vnd = int(eur_val * 27500)

    # If still none, estimate based on AnTuTu & Brand & Year
    if not price_vnd or price_vnd < 1000000:
        if antutu_est > 1500000:
            base_p = 22000000
        elif antutu_est > 1000000:
            base_p = 14000000
        elif antutu_est > 600000:
            base_p = 8000000
        elif antutu_est > 350000:
            base_p = 5000000
        else:
            base_p = 3000000

        # Adjust for brand
        if brand.lower() == "apple":
            base_p = int(base_p * 1.35)
        elif brand.lower() == "samsung":
            base_p = int(base_p * 1.15)

        # Adjust for year
        curr_year = 2026
        age = max(0, curr_year - (year if year else 2023))
        base_p = int(base_p * ((1 - 0.15) ** age))
        price_vnd = max(1500000, base_p)

    # Round to nearest 50,000 VND
    price_vnd = round(price_vnd / 50000) * 50000
    return price_vnd


def main():
    print("🚀 Bắt đầu quá trình ETL và chuẩn hóa dữ liệu 14,815 thiết bị...")

    base_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.abspath(os.path.join(base_dir, ".."))
    specs_dir = os.path.join(root_dir, "device_specs")
    benchmark_excel_path = os.path.join(root_dir, "03_benchmark_mo_rong.xlsx")
    output_data_dir = os.path.join(base_dir, "data")
    os.makedirs(output_data_dir, exist_ok=True)

    # 1. Load Excel Benchmark
    print("📖 Đọc dữ liệu từ file Excel benchmark...")
    df_excel = pd.read_excel(benchmark_excel_path)
    
    # Fix 2 shifted rows in Excel where Unnamed: 13 exists
    bad_mask = df_excel["Unnamed: 13"].notnull()
    if bad_mask.any():
        print(f"🔧 Đang sửa lỗi lệch cột tại {bad_mask.sum()} dòng...")
        for idx in df_excel[bad_mask].index:
            # Shift back
            row = df_excel.loc[idx]
            df_excel.loc[idx, "ten_may"] = f"{row['ten_may']}, {row['brand']}"
            df_excel.loc[idx, "brand"] = row["chipset"]
            df_excel.loc[idx, "chipset"] = row["diem_single_core"]
            df_excel.loc[idx, "diem_single_core"] = row["diem_multi_core"]
            df_excel.loc[idx, "diem_multi_core"] = row["diem_antutu"]
            df_excel.loc[idx, "diem_antutu"] = row["diem_man_hinh"]
            df_excel.loc[idx, "diem_man_hinh"] = row["diem_camera"]
            df_excel.loc[idx, "diem_camera"] = row["diem_pin"]
            df_excel.loc[idx, "diem_pin"] = row["nguon_benchmark"]
            df_excel.loc[idx, "nguon_benchmark"] = row["nguon_diem"]
            df_excel.loc[idx, "nguon_diem"] = row["ngay_crawl"]
            df_excel.loc[idx, "device_url"] = row["Unnamed: 13"]

    excel_map = {row["device_url"]: row for _, row in df_excel.iterrows() if pd.notnull(row["device_url"])}

    # 2. Iterate through 126 JSON files
    json_files = [f for f in os.listdir(specs_dir) if f.endswith(".json")]
    print(f"📂 Đang quét {len(json_files)} file JSON trong device_specs/...")

    devices_list = []
    specs_list = []
    variants_list = []
    benchmarks_list = []
    prices_list = []

    total_processed = 0

    for jf in json_files:
        json_path = os.path.join(specs_dir, jf)
        with open(json_path, "r", encoding="utf-8") as fp:
            try:
                data = json.load(fp)
            except Exception as e:
                print(f"Lỗi đọc {jf}: {e}")
                continue

            for dev in data:
                total_processed += 1
                brand = dev.get("brand", "")
                device_name = dev.get("deviceName", "")
                device_url = dev.get("deviceUrl", "")
                thumbnail_url = dev.get("thumbnailUrl", "")
                image_url = dev.get("imageUrl", thumbnail_url)
                specs = dev.get("specs", {})

                device_id = generate_device_id(brand, device_name, device_url)

                # Parse Launch
                launch = specs.get("launch", {})
                announced_str = str(launch.get("announced", "")) if isinstance(launch, dict) else ""
                release_year = parse_release_year(announced_str)
                status = str(launch.get("status", "Available")) if isinstance(launch, dict) else "Available"

                # Parse Display
                display = specs.get("display", {}) if isinstance(specs.get("display"), dict) else {}
                display_type = str(display.get("type", "AMOLED"))
                screen_size_inch = parse_screen_size(str(display.get("size", "")))
                res_w, res_h = parse_resolution(str(display.get("resolution", "")))
                refresh_rate_hz = parse_refresh_rate(display_type)

                # Parse Platform
                platform = specs.get("platform", {}) if isinstance(specs.get("platform"), dict) else {}
                chipset = str(platform.get("chipset", ""))
                cpu = str(platform.get("cpu", ""))
                gpu = str(platform.get("gpu", ""))
                os_name = str(platform.get("os", "Android"))

                # Parse Camera
                main_camera = specs.get("main_camera", {}) if isinstance(specs.get("main_camera"), dict) else {}
                cam_mp, cam_ap, has_ois, opt_zoom = parse_camera_specs(main_camera)

                # Parse Battery
                battery = specs.get("battery", {}) if isinstance(specs.get("battery"), dict) else {}
                battery_mah, charging_w = parse_battery(battery)

                # Parse Body
                body = specs.get("body", {}) if isinstance(specs.get("body"), dict) else {}
                weight_g, thickness_mm, ip_rating = parse_body(body)

                # Parse 5G
                network = specs.get("network", {}) if isinstance(specs.get("network"), dict) else {}
                has_5g = 1 if "5G" in str(network.get("technology", "")) or "5G" in str(network.get("5g_bands", "")) else 0

                # Parse Lab Tests
                our_tests = specs.get("our_tests", {}) if isinstance(specs.get("our_tests"), dict) else {}
                lab_antutu, lab_gb, lab_nits, lab_active_h, _ = parse_lab_tests(our_tests)

                # Match Excel Benchmark
                excel_row = excel_map.get(device_url)
                excel_antutu = int(excel_row["diem_antutu"]) if (excel_row is not None and pd.notnull(excel_row["diem_antutu"])) else 231241
                excel_single = int(excel_row["diem_single_core"]) if (excel_row is not None and str(excel_row["diem_single_core"]).isdigit()) else 0
                excel_multi = int(excel_row["diem_multi_core"]) if (excel_row is not None and pd.notnull(excel_row["diem_multi_core"])) else 0
                excel_score_cam = int(excel_row["diem_camera"]) if (excel_row is not None and pd.notnull(excel_row["diem_camera"])) else 50
                excel_score_disp = int(excel_row["diem_man_hinh"]) if (excel_row is not None and pd.notnull(excel_row["diem_man_hinh"])) else 50
                excel_score_bat = int(excel_row["diem_pin"]) if (excel_row is not None and pd.notnull(excel_row["diem_pin"])) else 50

                # Determine final Base AnTuTu (Priority: Lab > Excel (if not default) > Fallback)
                if lab_antutu and lab_antutu > 50000:
                    final_antutu = lab_antutu
                    antutu_src = "GSMArena Lab"
                elif excel_antutu and excel_antutu != 231241 and excel_antutu > 50000:
                    final_antutu = excel_antutu
                    antutu_src = "Excel Benchmark"
                else:
                    # Fallback estimate
                    if "A17" in chipset or "8 Gen 3" in chipset or "Dimensity 9300" in chipset:
                        final_antutu = 2100000
                    elif "A16" in chipset or "8 Gen 2" in chipset or "Dimensity 9200" in chipset:
                        final_antutu = 1550000
                    elif "A15" in chipset or "8+ Gen 1" in chipset or "Dimensity 8300" in chipset:
                        final_antutu = 1350000
                    elif "8 Gen 1" in chipset or "Dimensity 8200" in chipset:
                        final_antutu = 1000000
                    elif "778G" in chipset or "7 Gen 3" in chipset or "1480" in chipset:
                        final_antutu = 750000
                    elif "695" in chipset or "680" in chipset or "G99" in chipset or "1380" in chipset:
                        final_antutu = 450000
                    else:
                        final_antutu = excel_antutu if excel_antutu > 0 else 300000
                    antutu_src = "Estimated"

                # Parse Variants
                memory = specs.get("memory", {}) if isinstance(specs.get("memory"), dict) else {}
                internal_str = str(memory.get("internal", ""))
                parsed_variants = parse_memory_variants(internal_str)

                # Base price calculation
                misc = specs.get("misc", {}) if isinstance(specs.get("misc"), dict) else {}
                base_price = parse_raw_price(misc, brand, final_antutu, release_year)

                # Build TABLE 1: DEVICES
                devices_list.append({
                    "device_id": device_id,
                    "brand": brand,
                    "device_name": device_name,
                    "release_year": release_year if release_year else 2023,
                    "image_url": image_url,
                    "thumbnail_url": thumbnail_url,
                    "device_url": device_url,
                    "status": status
                })

                # Build TABLE 2: DEVICE_SPECS
                specs_list.append({
                    "device_id": device_id,
                    "chipset": chipset,
                    "cpu": cpu,
                    "gpu": gpu,
                    "os": os_name,
                    "screen_size_inch": screen_size_inch,
                    "resolution_width": res_w,
                    "resolution_height": res_h,
                    "refresh_rate_hz": refresh_rate_hz,
                    "display_type": display_type,
                    "main_camera_mp": cam_mp,
                    "main_camera_aperture": cam_ap,
                    "has_ois": has_ois,
                    "optical_zoom_x": opt_zoom,
                    "battery_mah": battery_mah,
                    "charging_w": charging_w,
                    "weight_g": weight_g,
                    "thickness_mm": thickness_mm,
                    "has_5g": has_5g,
                    "ip_rating": ip_rating
                })

                # Build TABLE 4: DEVICE_BENCHMARKS
                benchmarks_list.append({
                    "device_id": device_id,
                    "antutu_base": final_antutu,
                    "geekbench_single": lab_gb if lab_gb else excel_single,
                    "geekbench_multi": excel_multi,
                    "score_camera": excel_score_cam,
                    "score_display": excel_score_disp,
                    "score_battery": excel_score_bat,
                    "measured_brightness_nits": lab_nits if lab_nits else 0,
                    "measured_battery_active_h": lab_active_h if lab_active_h else 0.0,
                    "benchmark_source": antutu_src
                })

                # Build TABLE 3: DEVICE_VARIANTS & TABLE 5: DEVICE_PRICES
                base_ram = parsed_variants[0]["ram_gb"] if parsed_variants else 8
                base_rom = parsed_variants[0]["rom_gb"] if parsed_variants else 128

                for v_idx, v in enumerate(parsed_variants, start=1):
                    variant_id = f"{device_id}_{v['ram_gb']}_{v['rom_gb']}"
                    
                    # Estimate variant AnTuTu based on RAM diff
                    ram_factor = 1.0 + (0.05 * (v["ram_gb"] - base_ram) / max(base_ram, 1))
                    est_variant_antutu = int(final_antutu * ram_factor)

                    variants_list.append({
                        "variant_id": variant_id,
                        "device_id": device_id,
                        "ram_gb": v["ram_gb"],
                        "rom_gb": v["rom_gb"],
                        "variant_name": v["variant_name"],
                        "estimated_antutu": est_variant_antutu
                    })

                    # Calculate Variant Price
                    # RAM/ROM delta pricing: +500k to 1M per step
                    price_delta = ((v["ram_gb"] - base_ram) * 200000) + ((v["rom_gb"] - base_rom) * 4000)
                    var_price_new = max(1500000, base_price + price_delta)
                    var_price_new = round(var_price_new / 50000) * 50000

                    # Used price: 15% depreciation per year
                    age_years = max(0, 2026 - (release_year if release_year else 2023))
                    depr_rate = (1 - 0.16) ** age_years
                    var_price_used = max(900000, int(var_price_new * depr_rate * 0.78))
                    var_price_used = round(var_price_used / 50000) * 50000

                    # Add New Price record
                    prices_list.append({
                        "price_id": f"P_NEW_{variant_id}",
                        "variant_id": variant_id,
                        "condition": "new",
                        "price": var_price_new,
                        "stock_status": "in_stock",
                        "battery_health_percent": 100,
                        "exterior_condition": "brand-new",
                        "warranty_status": "yes"
                    })

                    # Add Used Price record
                    battery_health = max(80, min(99, 100 - (age_years * 4) + (v_idx % 3)))
                    exterior = "like-new" if age_years <= 1 else ("good" if age_years <= 3 else "fair")
                    warranty = "yes" if age_years <= 1 else "no"

                    prices_list.append({
                        "price_id": f"P_USED_{variant_id}",
                        "variant_id": variant_id,
                        "condition": "used",
                        "price": var_price_used,
                        "stock_status": "in_stock",
                        "battery_health_percent": battery_health,
                        "exterior_condition": exterior,
                        "warranty_status": warranty
                    })

    print(f"\n✅ Đã xử lý thành công: {total_processed} thiết bị.")
    print(f"📦 Tạo {len(devices_list)} dòng bảng Devices")
    print(f"📦 Tạo {len(specs_list)} dòng bảng Specs")
    print(f"📦 Tạo {len(variants_list)} dòng bảng Variants")
    print(f"📦 Tạo {len(benchmarks_list)} dòng bảng Benchmarks")
    print(f"📦 Tạo {len(prices_list)} dòng bảng Prices")

    # 3. Export to CSV
    print("\n💾 Đang xuất ra các file CSV...")
    df_devices = pd.DataFrame(devices_list).drop_duplicates(subset=["device_id"])
    df_specs = pd.DataFrame(specs_list).drop_duplicates(subset=["device_id"])
    df_variants = pd.DataFrame(variants_list).drop_duplicates(subset=["variant_id"])
    df_benchmarks = pd.DataFrame(benchmarks_list).drop_duplicates(subset=["device_id"])
    df_prices = pd.DataFrame(prices_list).drop_duplicates(subset=["price_id"])

    df_devices.to_csv(os.path.join(output_data_dir, "01_devices.csv"), index=False, encoding="utf-8")
    df_specs.to_csv(os.path.join(output_data_dir, "02_device_specs.csv"), index=False, encoding="utf-8")
    df_variants.to_csv(os.path.join(output_data_dir, "03_device_variants.csv"), index=False, encoding="utf-8")
    df_benchmarks.to_csv(os.path.join(output_data_dir, "04_device_benchmarks.csv"), index=False, encoding="utf-8")
    df_prices.to_csv(os.path.join(output_data_dir, "05_device_prices.csv"), index=False, encoding="utf-8")

    # 4. Export to SQLite Database
    db_path = os.path.join(output_data_dir, "phone_database.db")
    print(f"🗄️ Đang lưu vào SQLite Database tại: {db_path}")
    conn = sqlite3.connect(db_path)
    df_devices.to_sql("devices", conn, if_exists="replace", index=False)
    df_specs.to_sql("device_specs", conn, if_exists="replace", index=False)
    df_variants.to_sql("device_variants", conn, if_exists="replace", index=False)
    df_benchmarks.to_sql("device_benchmarks", conn, if_exists="replace", index=False)
    df_prices.to_sql("device_prices", conn, if_exists="replace", index=False)
    conn.close()

    print("🎉 Hoàn tất quá trình chuẩn hóa dữ liệu thành công!")


if __name__ == "__main__":
    main()
