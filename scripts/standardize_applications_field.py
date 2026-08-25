import sqlite3
import csv
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
db_path = os.path.abspath(os.path.join(script_dir, "..", "database", "tds_database.db"))
csv_db_path = os.path.abspath(os.path.join(script_dir, "..", "database", "tds_database.csv"))
csv_resolved_path = os.path.abspath(os.path.join(script_dir, "..", "database", "TDS_resolved.csv"))

if os.path.exists(db_path):
    print(f"Connecting to database: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 1. Fetch all category and subcategory records from tds_applications
    cursor.execute("SELECT document_id, category, subcategory FROM tds_applications")
    rows = cursor.fetchall()
    
    # Group them in Python
    app_mappings = {}
    for doc_id, category, subcategory in rows:
        if doc_id not in app_mappings:
            app_mappings[doc_id] = set()
        # Pair them as "Category - Subcategory"
        pairing = f"{category} - {subcategory}"
        app_mappings[doc_id].add(pairing)
        
    # Convert sets to sorted, semicolon-separated strings
    standardized_apps = {}
    for doc_id, pairings in app_mappings.items():
        standardized_apps[doc_id] = "; ".join(sorted(list(pairings)))
        
    # 2. Update the 'application' column in 'tds_documents' table
    print("Updating 'application' column in 'tds_documents' database table...")
    updated_count = 0
    for doc_id, std_app in standardized_apps.items():
        cursor.execute("UPDATE tds_documents SET application = ? WHERE id = ?", (std_app, doc_id))
        updated_count += 1
        
    conn.commit()
    conn.close()
    print(f"Database updated. Standardized applications for {updated_count} documents.\n")
    
    # 3. Update CSV files
    def update_csv_applications(csv_path):
        if not os.path.exists(csv_path):
            print(f"CSV file not found: {csv_path}")
            return
            
        print(f"Updating CSV file: {csv_path}")
        updated_rows = []
        headers = []
        
        with open(csv_path, mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames
            for row in reader:
                doc_id_str = row.get("id", "")
                if doc_id_str:
                    doc_id = int(doc_id_str)
                    std_app = standardized_apps.get(doc_id, "")
                    row["application"] = std_app
                updated_rows.append(row)
                
        with open(csv_path, mode='w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            writer.writerows(updated_rows)
            
        print(f"CSV {csv_path} update complete.\n")
        
    update_csv_applications(csv_db_path)
    update_csv_applications(csv_resolved_path)
    
    print("Main application columns in SQLite DB and CSVs successfully standardized!")
else:
    print(f"Database not found: {db_path}")
