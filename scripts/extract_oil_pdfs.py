import os
import pymupdf
import re

script_dir = os.path.dirname(os.path.abspath(__file__))
documents_dir = os.path.abspath(os.path.join(script_dir, "..", "documents"))

catalog_files = [
    ("Oleoresins (TDS)s.pdf", "Oleoresins"),
    ("Essential Oils (TDS)s.pdf", "Essential Oils"),
    ("Natural Anti-Oxidants (TDS)s.pdf", "Natural Anti-Oxidants"),
    ("Liquid Spice Blends (TDS)s.pdf", "Liquid Spice Blends")
]

extracted_count = 0

for catalog_filename, category_tag in catalog_files:
    catalog_path = os.path.join(documents_dir, catalog_filename)
    if not os.path.exists(catalog_path):
        print(f"Catalog file not found: {catalog_path}")
        continue
        
    print(f"Processing catalog: {catalog_filename}...")
    doc = pymupdf.open(catalog_path)
    num_pages = len(doc)
    
    for i in range(0, num_pages, 2):
        if i + 1 < num_pages:
            # Extract text from page 1 and page 2
            text_p1 = doc[i].get_text() or ""
            text_p2 = doc[i+1].get_text() or ""
            full_text = text_p1 + "\n" + text_p2
            
            # Extract Product Name
            prod_name_match = re.search(r"Product Name\s*:\s*(.*)", full_text, re.IGNORECASE)
            if not prod_name_match:
                prod_name_match = re.search(r"Product Name\s+(.*)", full_text, re.IGNORECASE)
                
            prod_name = prod_name_match.group(1).strip() if prod_name_match else f"Product Page {i+1}"
            prod_name = re.sub(r"\s+", " ", prod_name).strip()
            
            unique_filename = f"{prod_name} ({category_tag}).pdf"
            output_path = os.path.join(documents_dir, unique_filename)
            
            # Create a new 2-page PDF document
            new_doc = pymupdf.open()
            new_doc.insert_pdf(doc, from_page=i, to_page=i+1)
            new_doc.save(output_path)
            new_doc.close()
            
            extracted_count += 1
            print(f"  Created standalone PDF: {unique_filename}")
            
    doc.close()

print(f"\nSuccessfully extracted {extracted_count} individual PDF document files into {documents_dir}!")
