import pandas as pd
import json
import re

# Load crawled VN aggregated prices
df_vn = pd.read_csv('d:/Documents/Website/tools_dt/phone_dss/data/05_device_aggregated_prices.csv')
print(f"Tổng số SKU đang bán tại VN: {len(df_vn)}")
print("Sample VN SKUs:")
print(df_vn[['brand', 'product_name', 'ram_gb', 'rom_gb', 'min_price', 'best_retailer']].head(10))

# Load GSMArena devices and specs
df_devices = pd.read_csv('d:/Documents/Website/tools_dt/phone_dss/data/01_devices.csv')
df_specs = pd.read_csv('d:/Documents/Website/tools_dt/phone_dss/data/02_device_specs.csv')
df_benchmarks = pd.read_csv('d:/Documents/Website/tools_dt/phone_dss/data/04_device_benchmarks.csv')

print(f"\nTổng số máy GSMArena: {len(df_devices)}")

# Normalize helper for matching
def clean_for_match(text):
    if not text or not isinstance(text, str):
        return ""
    t = text.lower()
    t = re.sub(r'chính hãng|vn\/a|máy cũ|đổi trả|99%|like new|trưng bày|giá rẻ|\b5g\b|\b4g\b|\b\d+gb\b|\b\d+tb\b', '', t)
    t = re.sub(r'[^a-z0-9]', ' ', t)
    return " ".join(t.split())

# Create lookup index from GSMArena
gsm_lookup = {}
for _, row in df_devices.iterrows():
    b = str(row['brand']).lower()
    dname = str(row['device_name']).lower()
    clean_d = clean_for_match(dname)
    key = f"{b}_{clean_d}"
    gsm_lookup[key] = row['device_id']

# Test matching
matched = 0
unmatched = []

for _, row in df_vn.iterrows():
    b = str(row['brand']).lower()
    pname = str(row['product_name']).lower()
    clean_p = clean_for_match(pname)
    
    # direct match or partial match
    found_dev_id = None
    for k, dev_id in gsm_lookup.items():
        k_brand = k.split('_')[0]
        if k_brand == b:
            k_name = k.replace(f"{k_brand}_", "")
            if k_name and (k_name in clean_p or clean_p in k_name):
                found_dev_id = dev_id
                break
    
    if found_dev_id:
        matched += 1
    else:
        unmatched.append((row['brand'], row['product_name']))

print(f"\n✅ Số SKU khớp thành công với GSMArena: {matched} / {len(df_vn)} ({matched/len(df_vn)*100:.1f}%)")
print(f"❌ Số SKU chưa khớp trực tiếp: {len(unmatched)}")
if unmatched:
    print("Mẫu chưa khớp:")
    for u in unmatched[:5]:
        print("  -", u)
