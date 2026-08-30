import sqlite3
import json
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
db_path = os.path.join(script_dir, "..", "database", "tds_database.db")
output_path = os.path.join(script_dir, "..", "frontend", "data.json")

def export_data():
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Query all documents with applications metadata concatenated
    query = """
    SELECT DISTINCT d.*, 
           (SELECT GROUP_CONCAT(category, '; ') FROM (SELECT DISTINCT category FROM tds_applications WHERE document_id = d.id)) as applications_category,
           (SELECT GROUP_CONCAT(subcategory, '; ') FROM (SELECT DISTINCT subcategory FROM tds_applications WHERE document_id = d.id)) as applications_subcategory,
           (SELECT GROUP_CONCAT(tag_category, '; ') FROM (SELECT DISTINCT tag_category FROM tds_applications WHERE document_id = d.id)) as applications_tag
    FROM tds_documents d
    LEFT JOIN tds_applications a ON d.id = a.document_id
    """
    docs = [dict(r) for r in cursor.execute(query).fetchall()]

    # Query applications for detailed mapping
    apps = [dict(r) for r in cursor.execute("SELECT * FROM tds_applications").fetchall()]
    
    # Map applications to documents
    apps_by_doc = {}
    for app in apps:
        doc_id = app["document_id"]
        if doc_id not in apps_by_doc:
            apps_by_doc[doc_id] = []
        apps_by_doc[doc_id].append(app)

    for doc in docs:
        doc["applications_list"] = apps_by_doc.get(doc["id"], [])

    # Filter dropdown lists
    companies = [r[0] for r in cursor.execute("SELECT DISTINCT company FROM tds_documents WHERE company IS NOT NULL AND company != '' ORDER BY company").fetchall()]
    brands = [r[0] for r in cursor.execute("SELECT DISTINCT brand FROM tds_documents WHERE brand IS NOT NULL AND brand != '' ORDER BY brand").fetchall()]
    categories = [r[0] for r in cursor.execute("SELECT DISTINCT category FROM tds_applications WHERE category IS NOT NULL AND category != '' ORDER BY category").fetchall()]
    subcategories = [r[0] for r in cursor.execute("SELECT DISTINCT subcategory FROM tds_applications WHERE subcategory IS NOT NULL AND subcategory != '' ORDER BY subcategory").fetchall()]
    tag_categories = [r[0] for r in cursor.execute("SELECT DISTINCT tag_category FROM tds_applications WHERE tag_category IS NOT NULL AND tag_category != '' ORDER BY tag_category").fetchall()]

    # Query audit logs / history if table exists
    history = []
    try:
        history = [dict(r) for r in cursor.execute("SELECT * FROM tds_history ORDER BY timestamp DESC").fetchall()]
    except Exception as e:
        print("No history table or error reading history:", e)

    data = {
        "documents": docs,
        "filters": {
            "companies": companies,
            "brands": brands,
            "categories": categories,
            "subcategories": subcategories,
            "tag_categories": tag_categories
        },
        "history": history
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Successfully exported data to {output_path} ({len(docs)} documents)")

if __name__ == "__main__":
    export_data()
