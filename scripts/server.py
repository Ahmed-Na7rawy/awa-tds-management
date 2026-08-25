import sqlite3
import os
import mimetypes
from flask import Flask, jsonify, request, send_from_directory, make_response, Response

app = Flask(__name__, static_folder="../frontend", static_url_path="")

script_dir = os.path.dirname(os.path.abspath(__file__))
db_path = os.path.abspath(os.path.join(script_dir, "..", "database", "tds_database.db"))

def get_db_connection():
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

# API: Get all documents with filters
@app.route("/api/documents")
def get_documents():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Extract query params
    search = request.args.get("search", "").strip()
    company = request.args.get("company", "").strip()
    brand = request.args.get("brand", "").strip()
    category = request.args.get("category", "").strip()
    subcategory = request.args.get("subcategory", "").strip()
    tag_category = request.args.get("tag_category", "").strip()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = """
    SELECT DISTINCT d.*, 
           (SELECT GROUP_CONCAT(category, '; ') FROM (SELECT DISTINCT category FROM tds_applications WHERE document_id = d.id)) as applications_category,
           (SELECT GROUP_CONCAT(subcategory, '; ') FROM (SELECT DISTINCT subcategory FROM tds_applications WHERE document_id = d.id)) as applications_subcategory,
           (SELECT GROUP_CONCAT(tag_category, '; ') FROM (SELECT DISTINCT tag_category FROM tds_applications WHERE document_id = d.id)) as applications_tag
    FROM tds_documents d
    LEFT JOIN tds_applications a ON d.id = a.document_id
    WHERE 1=1
    """
    params = []
    
    if search:
        query += " AND (d.filename LIKE ? OR d.type LIKE ? OR d.ingredients LIKE ? OR d.application LIKE ? OR d.brand LIKE ?)"
        like_search = f"%{search}%"
        params.extend([like_search, like_search, like_search, like_search, like_search])
        
    if company:
        query += " AND d.company = ?"
        params.append(company)

    if brand:
        query += " AND d.brand = ?"
        params.append(brand)
        
    if category:
        query += " AND a.category = ?"
        params.append(category)
        
    if subcategory:
        query += " AND a.subcategory = ?"
        params.append(subcategory)
        
    if tag_category:
        query += " AND a.tag_category = ?"
        params.append(tag_category)
        
    query += " ORDER BY d.id ASC"
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    results = []
    for r in rows:
        results.append(dict(r))
        
    # Get distinct filters for dropdowns
    cursor.execute("SELECT DISTINCT company FROM tds_documents WHERE company IS NOT NULL AND company != '' ORDER BY company")
    companies = [row[0] for row in cursor.fetchall()]
    
    cursor.execute("SELECT DISTINCT brand FROM tds_documents WHERE brand IS NOT NULL AND brand != '' ORDER BY brand")
    brands = [row[0] for row in cursor.fetchall()]
    
    cursor.execute("SELECT DISTINCT category FROM tds_applications ORDER BY category")
    categories = [row[0] for row in cursor.fetchall()]
    
    cursor.execute("SELECT DISTINCT subcategory FROM tds_applications ORDER BY subcategory")
    subcategories = [row[0] for row in cursor.fetchall()]
    
    cursor.execute("SELECT DISTINCT tag_category FROM tds_applications ORDER BY tag_category")
    tag_categories = [row[0] for row in cursor.fetchall()]
    
    conn.close()
    
    return jsonify({
        "documents": results,
        "filters": {
            "companies": companies,
            "brands": brands,
            "categories": categories,
            "subcategories": subcategories,
            "tag_categories": tag_categories
        }
    })

def init_version_control():
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS tds_document_versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            document_id INTEGER NOT NULL,
            version_number INTEGER NOT NULL,
            edited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            edited_by TEXT DEFAULT 'R&D Auditor',
            change_summary TEXT,
            snapshot_json TEXT NOT NULL,
            FOREIGN KEY (document_id) REFERENCES tds_documents(id)
        )
        """)
        conn.commit()
        conn.close()
    except Exception as e:
        print("Version DB init error:", e)

init_version_control()

def sync_db_to_csv():
    try:
        db_file = os.path.abspath(os.path.join(script_dir, "..", "database", "tds_database.db"))
        csv_file = os.path.abspath(os.path.join(script_dir, "..", "database", "tds_database.csv"))
        resolved_file = os.path.abspath(os.path.join(script_dir, "..", "database", "TDS_resolved.csv"))
        
        conn = sqlite3.connect(db_file)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM tds_documents ORDER BY id")
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
        
        if rows:
            headers = list(rows[0].keys())
            with open(csv_file, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=headers)
                writer.writeheader()
                writer.writerows(rows)
            with open(resolved_file, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=headers)
                writer.writeheader()
                writer.writerows(rows)
    except Exception as e:
        print("CSV sync error:", e)

import json

# API: Get version history of a document
@app.route("/api/documents/<int:doc_id>/versions")
def get_document_versions(doc_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, document_id, version_number, edited_at, edited_by, change_summary, snapshot_json 
        FROM tds_document_versions 
        WHERE document_id = ? 
        ORDER BY version_number DESC
    """, (doc_id,))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify({"versions": rows})

# API: Update a document entry (Allow R&D sector audit edits with version control)
@app.route("/api/documents/<int:doc_id>", methods=["PUT"])
def update_document(doc_id):
    data = request.get_json() or {}
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM tds_documents WHERE id = ?", (doc_id,))
    old_row = cursor.fetchone()
    if not old_row:
        conn.close()
        return jsonify({"error": "Document not found"}), 404
    
    old_doc = dict(old_row)
        
    fields = [
        "company", "brand", "type", "application", "shelf_life", "dosage", 
        "concentration", "ingredients", "packaging", "storage_conditions", 
        "allergens", "appearance", "description", "audit", "recommendation"
    ]
    
    changed_fields = []
    update_parts = []
    params = []
    for f in fields:
        if f in data and data[f] != old_doc.get(f):
            update_parts.append(f"{f} = ?")
            params.append(data[f])
            changed_fields.append(f)
            
    if update_parts:
        params.append(doc_id)
        sql = f"UPDATE tds_documents SET {', '.join(update_parts)} WHERE id = ?"
        cursor.execute(sql, params)
        conn.commit()

        # Save snapshot into version control table
        cursor.execute("SELECT MAX(version_number) FROM tds_document_versions WHERE document_id = ?", (doc_id,))
        max_ver = cursor.fetchone()[0]
        next_ver = 1 if max_ver is None else max_ver + 1

        change_summary = f"Updated fields: {', '.join(changed_fields)}" if changed_fields else "Updated record"

        cursor.execute("SELECT * FROM tds_documents WHERE id = ?", (doc_id,))
        updated_row = dict(cursor.fetchone())

        cursor.execute("""
            INSERT INTO tds_document_versions (document_id, version_number, edited_by, change_summary, snapshot_json)
            VALUES (?, ?, ?, ?, ?)
        """, (doc_id, next_ver, data.get("edited_by", "R&D Auditor"), change_summary, json.dumps(updated_row)))
        conn.commit()
    else:
        cursor.execute("SELECT * FROM tds_documents WHERE id = ?", (doc_id,))
        updated_row = dict(cursor.fetchone())
        
    conn.close()
    
    sync_db_to_csv()
    
    return jsonify({"success": True, "document": updated_row})

# API: Get database schema and relations
@app.route("/api/schema")
def get_schema():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    schema_info = {}
    tables = ["tds_documents", "tds_applications"]
    
    for t in tables:
        cursor.execute(f"PRAGMA table_info({t})")
        cols = cursor.fetchall()
        schema_info[t] = [dict(c) for c in cols]
        
    conn.close()
    
    # Define relationships hardcoded for front-end diagram
    relationships = [
        {
            "from_table": "tds_documents",
            "from_column": "id",
            "to_table": "tds_applications",
            "to_column": "document_id",
            "type": "one-to-many"
        }
    ]
    
    return jsonify({
        "schema": schema_info,
        "relationships": relationships
    })

# Serve frontend main index
@app.route("/")
def serve_index():
    return send_from_directory(app.static_folder, "index.html")

# Cache for recursive document lookup
doc_path_cache = {}

def get_document_filepath(filename):
    global doc_path_cache
    fl = filename.lower()
    documents_dir = os.path.abspath(os.path.join(script_dir, "..", "documents"))
    
    # 1. Direct check
    direct_path = os.path.join(documents_dir, filename)
    if os.path.exists(direct_path):
        return direct_path
        
    # 2. Cache lookup
    if fl in doc_path_cache and os.path.exists(doc_path_cache[fl]):
        return doc_path_cache[fl]
        
    # 3. Refresh cache via recursive search
    new_cache = {}
    for root, dirs, files in os.walk(documents_dir):
        for f in files:
            new_cache[f.lower()] = os.path.join(root, f)
    doc_path_cache = new_cache
    
    return doc_path_cache.get(fl, None)

# Serve PDF/image documents from documents/
@app.route("/documents/<path:filename>")
def serve_document(filename):
    filepath = get_document_filepath(filename)
    if not filepath or not os.path.exists(filepath):
        return "File not found", 404
        
    mime_type, _ = mimetypes.guess_type(filepath)
    if not mime_type:
        mime_type = 'application/octet-stream'
        
    with open(filepath, "rb") as f:
        data = f.read()
        
    return Response(
        data,
        mimetype=mime_type,
        headers={"Content-Disposition": "inline"}
    )

# API: Get info about a document (page count, etc.)
@app.route("/api/pdf-info")
@app.route("/api/pdf-info/<path:filename>")
def pdf_info(filename=None):
    if not filename:
        filename = request.args.get("filename") or request.args.get("file")
        
    doc_id = request.args.get("doc_id")
    if doc_id:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT filename FROM tds_documents WHERE id = ?", (doc_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            filename = row[0]
            
    if not filename:
        return jsonify({"error": "Missing filename parameter"}), 400

    filepath = get_document_filepath(filename)
    if not filepath or not os.path.exists(filepath):
        return jsonify({"error": "File not found"}), 404
        
    fn_lower = filename.lower()
    if fn_lower.endswith(('.jpg', '.jpeg', '.png', '.gif')):
        return jsonify({"is_pdf": False, "page_count": 1})
        
    try:
        import fitz
        doc = fitz.open(filepath)
        count = len(doc)
        doc.close()
        return jsonify({"is_pdf": True, "page_count": count})
    except Exception as e:
        return jsonify({"is_pdf": False, "error": str(e), "page_count": 1})

# API: Render a specific PDF page to a PNG image using Python
@app.route("/api/pdf-page")
@app.route("/api/pdf-page/<path:filename>/<int:page_num>")
def render_pdf_page(filename=None, page_num=None):
    if not filename:
        filename = request.args.get("filename") or request.args.get("file")
    if not page_num:
        page_num = int(request.args.get("page", 1))
        
    doc_id = request.args.get("doc_id")
    if doc_id:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT filename FROM tds_documents WHERE id = ?", (doc_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            filename = row[0]

    if not filename:
        return "Missing filename", 400

    filepath = get_document_filepath(filename)
    if not filepath or not os.path.exists(filepath):
        return "File not found", 404
        
    try:
        import fitz
        doc = fitz.open(filepath)
        page_idx = max(0, page_num - 1)
        if page_idx >= len(doc):
            doc.close()
            return "Page out of bounds", 400
            
        page = doc.load_page(page_idx)
        pix = page.get_pixmap(dpi=150)
        img_bytes = pix.tobytes("png")
        doc.close()
        
        return Response(img_bytes, mimetype="image/png")
    except Exception as e:
        return f"Error rendering page: {str(e)}", 500

# Serve other static files
@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory(app.static_folder, path)

# Disable caching for all responses during development
@app.after_request
def add_header(r):
    r.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    r.headers["Pragma"] = "no-cache"
    r.headers["Expires"] = "0"
    return r

if __name__ == "__main__":
    print("Starting local TDS visual dashboard API on http://127.0.0.1:5000")
    app.run(host="127.0.0.1", port=5000, debug=True)
