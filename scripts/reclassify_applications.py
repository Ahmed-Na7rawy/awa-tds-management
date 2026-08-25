import sqlite3
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
db_path = os.path.abspath(os.path.join(script_dir, "..", "database", "tds_database.db"))

def get_standard_mappings(filename, type_str, app_str, ingredients_str):
    fl = filename.lower()
    tl = (type_str or "").lower()
    al = (app_str or "").lower()
    il = (ingredients_str or "").lower()
    
    # We will determine (category, subcategory) and functional (tag_category, tag)
    # Results can contain multiple mappings
    mappings = []
    
    # Helpers to identify properties
    is_sweet = "sweetex" in fl or "sweetener" in tl or "sweetener" in il or "sweet" in tl
    is_color = "nrc" in fl or "nre" in fl or "color" in fl or "color" in tl or "color" in il or "colorant" in tl or "colorant" in il
    is_preservative = "nataseen" in fl or "niseen" in fl or "preservative" in tl or "preservative" in il or "solvarin" in fl
    is_antifoam = "antifoam" in tl or "antifoam" in fl
    is_agrochemical = "agrochemical" in al or "agrochemicals" in al or "agrochemicals" in tl
    is_oil = "oil" in fl or "oleoresin" in fl or "spice blend" in fl or "anti-oxidant" in fl or "tocopherol" in fl
    
    # 1. Sweeteners (Sweetex)
    if is_sweet:
        # Standard Category & Subcategory: Beverage/Confectionery/Dairy
        mappings.append(("Confectionery", "Hard-boiled candy", "Sweeteners", "sweetener"))
        mappings.append(("Beverages", "Non alcoholic drink", "Sweeteners", "sweetener"))
        mappings.append(("Dairy", "Ice cream", "Sweeteners", "sweetener"))
        mappings.append(("Bakery & snacks", "Sweet biscuit & cookie", "Sweeteners", "sweetener"))
        return mappings

    # 2. Colors (NRC, NRE, colors)
    if is_color:
        tag_cat = "Colors"
        tag = "natural color" if "natural" in al or "nrc" in fl else "colorant"
        if "meat" in al:
            mappings.append(("Savory", "Meat", tag_cat, tag))
        else:
            mappings.append(("Savory", "Seasoning", tag_cat, tag))
        return mappings

    # 3. Preservatives (Nataseen, Niseen, Solvarin)
    if is_preservative:
        tag_cat = "Preservatives"
        tag = "preservative, shelf life extender"
        mappings.append(("Savory", "Meat", tag_cat, tag))
        mappings.append(("Dairy", "Cheese", tag_cat, tag))
        return mappings

    # 4. Antifoam / Agrochemicals
    if is_antifoam:
        if is_agrochemical:
            mappings.append(("Agrochemicals", "antifoam for agrochemicals", "Processing Aids", "antifoam"))
        else:
            mappings.append(("Processing Aids", "antifoam", "Processing Aids", "antifoam"))
        return mappings

    # 5. Essential Oils / Oleoresins / Spice Blends
    if is_oil:
        tag_cat = "Flavors"
        # Determine specific tag
        if "oleoresin" in fl:
            tag = "oleoresin, flavoring"
        elif "spice blend" in fl:
            tag = "spice blend, flavoring"
        else:
            tag = "essential oil, flavoring"
            
        # Determine subcategories
        if "burger" in fl or "hot dog" in fl or "luncheon" in fl or "kofta" in fl or "sausage" in fl or "pastrami" in fl or "beef" in fl:
            mappings.append(("Savory", "Meat", tag_cat, tag))
        elif "pizza" in fl:
            mappings.append(("Savory", "Seasoning", tag_cat, tag))
            mappings.append(("Bakery & snacks", "Salty snacks", tag_cat, tag))
        elif "ketchup" in fl:
            mappings.append(("Savory", "Sauce", tag_cat, tag))
        else:
            mappings.append(("Savory", "Seasoning", tag_cat, tag))
        return mappings

    # 6. Bakery products (Croissant, cake, baking, starch)
    if "baking" in fl or "bake" in fl or "croissant" in al or "bakery" in al:
        tag_cat = "Stabilizers & Emulsifiers"
        tag = "stabilizer, thickener"
        if "croissant" in al or "pastry" in al:
            mappings.append(("Bakery & snacks", "Cake and pastry", tag_cat, tag))
        elif "cake" in al:
            mappings.append(("Bakery & snacks", "Cake and pastry", tag_cat, tag))
        elif "biscuits" in al or "cookies" in al:
            mappings.append(("Bakery & snacks", "Sweet biscuit & cookie", tag_cat, tag))
        else:
            mappings.append(("Bakery & snacks", "Sweet biscuit & cookie", tag_cat, tag))
            mappings.append(("Bakery & snacks", "Cake and pastry", tag_cat, tag))
        return mappings

    # 7. Dairy & Cheese
    # Ice Cream
    if "ice cream" in al or "ice cream" in tl or "sorbet" in al:
        tag_cat = "Stabilizers & Emulsifiers"
        tag = "stabilizer, emulsifier, texturizer"
        mappings.append(("Dairy", "Ice cream", tag_cat, tag))
        if "plant-based" in al or "fruits" in al:
            mappings.append(("Dairy", "Plant-based ice cream", tag_cat, tag))
        return mappings

    # Cheese
    if "cheese" in al or "feta" in al or "talaga" in al or "spreadable" in al or "cheese" in tl or "feta" in fl or "talaga" in fl or "fell" in fl:
        tag_cat = "Stabilizers & Emulsifiers"
        tag = "stabilizer, thickener"
        mappings.append(("Dairy", "Cheese", tag_cat, tag))
        return mappings

    # Cream
    if "cream" in al or "cream" in fl:
        tag_cat = "Stabilizers & Emulsifiers"
        tag = "stabilizer, emulsifier"
        mappings.append(("Dairy", "Cream & Coffee Creamers", tag_cat, tag))
        return mappings

    # Milk
    if "milk" in al:
        tag_cat = "Stabilizers & Emulsifiers"
        tag = "stabilizer, thickener"
        mappings.append(("Dairy", "Dairy dessert & yogurt", tag_cat, tag))
        return mappings

    # 8. Savory (Meat products, dressing, sauce, noodle, pasta)
    if "meat" in al or "poultry" in al or "meat" in tl:
        tag_cat = "Stabilizers & Emulsifiers"
        tag = "stabilizer, binder"
        mappings.append(("Savory", "Meat", tag_cat, tag))
        return mappings
    if "sauce" in al or "ketchup" in al:
        tag_cat = "Stabilizers & Emulsifiers"
        tag = "stabilizer, thickener"
        mappings.append(("Savory", "Sauce", tag_cat, tag))
        return mappings
    if "dressing" in al or "mayonnaise" in al:
        tag_cat = "Stabilizers & Emulsifiers"
        tag = "stabilizer, emulsifier"
        mappings.append(("Savory", "Dressing & mayonnaise", tag_cat, tag))
        return mappings

    # 9. Default Phos / general products
    if "phos" in fl:
        tag_cat = "Stabilizers & Emulsifiers"
        tag = "stabilizer, emulsifier, water binder"
        mappings.append(("Dairy", "Cheese", tag_cat, tag))
        mappings.append(("Savory", "Meat", tag_cat, tag))
        mappings.append(("Bakery & snacks", "Cake and pastry", tag_cat, tag))
        return mappings

    # General fallback
    return [("Savory", "Seasoning", "Stabilizers & Emulsifiers", "stabilizer")]

# Run Database Update
if os.path.exists(db_path):
    print(f"Connecting to database: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 1. Drop existing table
    cursor.execute("DROP TABLE IF EXISTS tds_applications")
    print("Dropped existing tds_applications table.")
    
    # 2. Recreate table with new schema
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tds_applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        original_application TEXT,
        category TEXT NOT NULL,
        subcategory TEXT NOT NULL,
        tag_category TEXT NOT NULL,
        tag TEXT NOT NULL,
        FOREIGN KEY (document_id) REFERENCES tds_documents (id)
    )
    """)
    print("Recreated tds_applications table with expanded schema (category, subcategory, tag_category, tag).")
    
    # 3. Load all document records
    cursor.execute("SELECT id, filename, type, application, ingredients FROM tds_documents")
    docs = cursor.fetchall()
    
    # 4. Insert reclassified mappings
    insert_sql = """
    INSERT INTO tds_applications (document_id, filename, original_application, category, subcategory, tag_category, tag)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """
    
    inserted_count = 0
    for doc in docs:
        doc_id, filename, type_str, app_str, ingredients_str = doc
        mappings = get_standard_mappings(filename, type_str, app_str, ingredients_str)
        for cat, subcat, tag_cat, tag in mappings:
            cursor.execute(insert_sql, (doc_id, filename, app_str, cat, subcat, tag_cat, tag))
            inserted_count += 1
            
    conn.commit()
    
    # Verify the results
    cursor.execute("SELECT COUNT(*) FROM tds_applications")
    total_rows = cursor.fetchone()[0]
    print(f"Successfully populated table. Total rows inserted: {total_rows}")
    
    cursor.execute("SELECT DISTINCT category FROM tds_applications")
    cats = [r[0] for r in cursor.fetchall()]
    cursor.execute("SELECT DISTINCT subcategory FROM tds_applications")
    subcats = [r[0] for r in cursor.fetchall()]
    cursor.execute("SELECT DISTINCT tag_category FROM tds_applications")
    tag_cats = [r[0] for r in cursor.fetchall()]
    
    print("\nVerification Summary:")
    print("  Distinct Categories:", cats)
    print("  Distinct Subcategories:", subcats)
    print("  Distinct Tag Categories:", tag_cats)
    
    # Print a sample of 5 rows
    cursor.execute("SELECT id, filename, category, subcategory, tag_category, tag FROM tds_applications LIMIT 5")
    print("\nSample Rows:")
    for row in cursor.fetchall():
        print(f"  ID {row[0]} | File: {row[1]} | Classification: {row[2]} -> {row[3]} | Function: {row[4]} -> {row[5]}")
        
    # 5. Retrieve and group mappings for CSV export
    cursor.execute("SELECT document_id, category, subcategory, tag_category, tag FROM tds_applications")
    all_app_rows = cursor.fetchall()
    
    app_lookup = {}
    for doc_id, cat, subcat, tag_cat, tag in all_app_rows:
        if doc_id not in app_lookup:
            app_lookup[doc_id] = {
                "category": set(),
                "subcategory": set(),
                "tag_category": set(),
                "tag": set()
            }
        app_lookup[doc_id]["category"].add(cat)
        app_lookup[doc_id]["subcategory"].add(subcat)
        app_lookup[doc_id]["tag_category"].add(tag_cat)
        for t in tag.split(","):
            app_lookup[doc_id]["tag"].add(t.strip())
            
    # Convert sets to sorted, comma-separated strings
    for doc_id, data in app_lookup.items():
        app_lookup[doc_id] = {
            "category": ", ".join(sorted(data["category"])),
            "subcategory": ", ".join(sorted(data["subcategory"])),
            "tag_category": ", ".join(sorted(data["tag_category"])),
            "tag": ", ".join(sorted(data["tag"]))
        }
        
    conn.close()
    
    # 6. Update CSV files with new columns
    import csv
    csv_db_path = os.path.abspath(os.path.join(script_dir, "..", "database", "tds_database.csv"))
    csv_resolved_path = os.path.abspath(os.path.join(script_dir, "..", "database", "TDS_resolved.csv"))
    
    def update_csv_classifications(csv_path):
        if not os.path.exists(csv_path):
            print(f"CSV file not found: {csv_path}")
            return
            
        print(f"Updating CSV file: {csv_path}")
        updated_rows = []
        headers = []
        
        with open(csv_path, mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            original_headers = reader.fieldnames
            
            # Ensure new columns exist in headers
            headers = list(original_headers)
            new_cols = ["category", "subcategory", "tag_category", "tag"]
            for col in new_cols:
                if col not in headers:
                    # Insert after 'type' or 'company' if present, otherwise append
                    if "company" in headers:
                        idx = headers.index("company") + 1
                        headers.insert(idx, col)
                    elif "type" in headers:
                        idx = headers.index("type") + 1
                        headers.insert(idx, col)
                    else:
                        headers.append(col)
                        
            for row in reader:
                doc_id_str = row.get("id", "")
                if doc_id_str:
                    doc_id = int(doc_id_str)
                    data = app_lookup.get(doc_id, {"category": "", "subcategory": "", "tag_category": "", "tag": ""})
                    row["category"] = data["category"]
                    row["subcategory"] = data["subcategory"]
                    row["tag_category"] = data["tag_category"]
                    row["tag"] = data["tag"]
                else:
                    row["category"] = ""
                    row["subcategory"] = ""
                    row["tag_category"] = ""
                    row["tag"] = ""
                updated_rows.append(row)
                
        with open(csv_path, mode='w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            writer.writerows(updated_rows)
            
        print(f"CSV {csv_path} update complete.\n")
        
    update_csv_classifications(csv_db_path)
    update_csv_classifications(csv_resolved_path)
    print("CSV files successfully updated with classification columns!")
else:
    print(f"Database not found: {db_path}")
