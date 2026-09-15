import os
import shutil
import sqlite3
import pandas as pd

def sync_database():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(base_dir, "data")
    excel_path = os.path.join(data_dir, "phone_dss_master_database.xlsx")
    
    if not os.path.exists(excel_path):
        print(f"❌ Master Excel not found at {excel_path}")
        return

    xl = pd.ExcelFile(excel_path)
    print(f"🔄 Syncing from Master Excel: {excel_path}")
    print(f"   Sheets: {xl.sheet_names}")

    sheets_to_csv = {
        "devices": "01_devices.csv",
        "device_specs": "02_device_specs.csv",
        "device_variants": "03_device_variants.csv",
        "device_benchmarks": "04_device_benchmarks.csv",
        "device_retailer_prices": "05_device_retailer_prices.csv",
        "device_aggregated_prices": "05_device_aggregated_prices.csv"
    }

    db_path = os.path.join(data_dir, "phone_database.db")
    conn = sqlite3.connect(db_path)

    for sheet_name, csv_name in sheets_to_csv.items():
        if sheet_name in xl.sheet_names:
            df = xl.parse(sheet_name)
            csv_path = os.path.join(data_dir, csv_name)
            df.to_csv(csv_path, index=False, encoding="utf-8")
            df.to_sql(sheet_name, conn, if_exists="replace", index=False)
            print(f"   ✅ {sheet_name} -> {csv_name} & SQLite table ({len(df)} rows)")

    conn.close()
    print("🎉 Database synchronization completed successfully!")

if __name__ == "__main__":
    sync_database()

