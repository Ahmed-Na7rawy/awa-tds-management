const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function generateCleanExecutivePDF() {
    const rootDir = path.resolve(__dirname, '..');
    const htmlPath = path.join(rootDir, 'database', 'proposal_template.html');
    const pdfPath = path.join(rootDir, 'database', 'AWA_TDS_Taxonomy_and_Audit_Proposal.pdf');

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>AWA TDS Modernization Proposal</title>
<style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

    @page {
        size: A4 portrait;
        margin: 15mm 15mm 15mm 15mm;
    }

    * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
    }

    body {
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #1e293b;
        background: #ffffff;
        font-size: 9.5pt;
        line-height: 1.45;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }

    .page {
        page-break-after: always;
        height: 100%;
        display: flex;
        flex-direction: column;
    }

    .page:last-child {
        page-break-after: avoid;
    }

    /* Header Banner */
    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 2px solid #0f172a;
        padding-bottom: 12px;
        margin-bottom: 16px;
    }

    .logo-title {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .logo-badge {
        background: #0f172a;
        color: #ffffff;
        font-weight: 800;
        font-size: 14pt;
        padding: 6px 12px;
        border-radius: 6px;
        letter-spacing: 0.5px;
    }

    .header-text h1 {
        font-size: 14pt;
        font-weight: 800;
        color: #0f172a;
        line-height: 1.2;
    }

    .header-text p {
        font-size: 8pt;
        color: #64748b;
        font-weight: 500;
    }

    .doc-meta {
        text-align: right;
        font-size: 7.5pt;
        color: #64748b;
    }

    .doc-meta strong {
        color: #0f172a;
    }

    /* Section Headings */
    .section-title {
        font-size: 10.5pt;
        font-weight: 700;
        color: #0f172a;
        border-left: 4px solid #4338ca;
        padding-left: 8px;
        margin-top: 14px;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
    }

    /* KPI Grid */
    .kpi-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
        margin-bottom: 14px;
    }

    .kpi-card {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 10px 12px;
        text-align: center;
    }

    .kpi-card.blue { border-top: 3px solid #2563eb; }
    .kpi-card.green { border-top: 3px solid #059669; }
    .kpi-card.indigo { border-top: 3px solid #4338ca; }
    .kpi-card.amber { border-top: 3px solid #d97706; }

    .kpi-label {
        font-size: 7pt;
        text-transform: uppercase;
        font-weight: 700;
        color: #64748b;
        letter-spacing: 0.5px;
        margin-bottom: 4px;
    }

    .kpi-value {
        font-size: 15pt;
        font-weight: 800;
        color: #0f172a;
        line-height: 1.1;
    }

    .kpi-sub {
        font-size: 7pt;
        color: #64748b;
        margin-top: 2px;
    }

    /* Two Column Layout */
    .two-col {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-bottom: 12px;
    }

    .card {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 10px 12px;
    }

    .card h3 {
        font-size: 9pt;
        font-weight: 700;
        color: #1e293b;
        margin-bottom: 6px;
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .card p, .card li {
        font-size: 8pt;
        color: #475569;
        line-height: 1.4;
    }

    .card ul {
        padding-left: 14px;
    }

    .card li {
        margin-bottom: 4px;
    }

    /* Clean Tables */
    table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 6px;
        margin-bottom: 12px;
        font-size: 7.8pt;
    }

    th {
        background: #0f172a;
        color: #ffffff;
        font-weight: 700;
        text-align: left;
        padding: 6px 8px;
        font-size: 7.5pt;
        letter-spacing: 0.3px;
    }

    th:first-child { border-top-left-radius: 5px; }
    th:last-child { border-top-right-radius: 5px; }

    td {
        padding: 5px 8px;
        border-bottom: 1px solid #e2e8f0;
        color: #334155;
        vertical-align: top;
    }

    tr:nth-child(even) td {
        background: #f8fafc;
    }

    .badge {
        display: inline-block;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 6.8pt;
        font-weight: 700;
    }

    .badge-green { background: #dcfce7; color: #166534; }
    .badge-blue { background: #dbeafe; color: #1e40af; }
    .badge-amber { background: #fef3c7; color: #92400e; }
    .badge-red { background: #fee2e2; color: #991b1b; }
    .badge-indigo { background: #e0e7ff; color: #3730a3; }

    /* Hierarchy Diagram Box */
    .diagram-box {
        background: #f1f5f9;
        border: 1px dashed #cbd5e1;
        border-radius: 8px;
        padding: 10px;
        margin-bottom: 12px;
        display: flex;
        justify-content: space-around;
        align-items: center;
        text-align: center;
    }

    .diagram-step {
        background: #ffffff;
        border: 1px solid #cbd5e1;
        padding: 6px 12px;
        border-radius: 6px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    .diagram-step .step-title {
        font-weight: 700;
        color: #0f172a;
        font-size: 8pt;
    }

    .diagram-step .step-desc {
        color: #64748b;
        font-size: 6.8pt;
    }

    .diagram-arrow {
        font-size: 12pt;
        font-weight: 800;
        color: #4338ca;
    }

    .footer {
        margin-top: auto;
        border-top: 1px solid #e2e8f0;
        padding-top: 6px;
        display: flex;
        justify-content: space-between;
        font-size: 7pt;
        color: #94a3b8;
    }
</style>
</head>
<body>

<!-- PAGE 1: EXECUTIVE SUMMARY & ARCHITECTURE -->
<div class="page">
    <div class="header">
        <div class="logo-title">
            <div class="logo-badge">AWA</div>
            <div class="header-text">
                <h1>TDS Modernization & Food Science Taxonomy Proposal</h1>
                <p>Enterprise Technical Data Sheet System &bull; R&D & Data Science Sector</p>
            </div>
        </div>
        <div class="doc-meta">
            <div>Version: <strong>3.0 (Meat & Poultry Aligned)</strong></div>
            <div>Date: <strong>August 2026</strong></div>
            <div>Status: <strong>Management Approved</strong></div>
        </div>
    </div>

    <!-- 4 KPI CARDS -->
    <div class="kpi-grid">
        <div class="kpi-card blue">
            <div class="kpi-label">Master Catalog</div>
            <div class="kpi-value">370</div>
            <div class="kpi-sub">Commercial Products</div>
        </div>
        <div class="kpi-card green">
            <div class="kpi-label">Verified TDS</div>
            <div class="kpi-value">175</div>
            <div class="kpi-sub">Authentic Files Linked</div>
        </div>
        <div class="kpi-card indigo">
            <div class="kpi-label">Bridge Mappings</div>
            <div class="kpi-value">807</div>
            <div class="kpi-sub">Normalized Routes</div>
        </div>
        <div class="kpi-card amber">
            <div class="kpi-label">R&D Request Queue</div>
            <div class="kpi-value">195</div>
            <div class="kpi-sub">Priority Lab Items</div>
        </div>
    </div>

    <div class="section-title">1. Executive Overview & Industry Alignment</div>
    <div class="two-col">
        <div class="card">
            <h3>🍗 Meat & Poultry Restructuring</h3>
            <ul>
                <li><strong>Dedicated Protein Sector:</strong> Replaced generic "Savory & Meat" with <strong>Meat & Poultry</strong>, separating red meat processing from whole-muscle poultry injection.</li>
                <li><strong>Targeted Subcategories:</strong> Emulsified Sausages, Burgers/Kofta, Injected Chicken/Turkey Breasts, Cured Meats, and Cellulose Casings.</li>
            </ul>
        </div>
        <div class="card">
            <h3>🍿 Snacks & Savory Seasonings</h3>
            <ul>
                <li><strong>Savory Reallocation:</strong> Seasonings, spice extracts, and dusting flavorings are now organized under <strong>Snacks & Savory Seasonings</strong> (Chips, Crackers, Instant Soups).</li>
                <li><strong>Wet Systems Segregation:</strong> Sauces, mayonnaise, and gravies are unified under <strong>Sauces, Condiments & Dressings</strong>.</li>
            </ul>
        </div>
    </div>

    <div class="section-title">2. Standard 3-Level Taxonomy Architecture</div>
    <div class="diagram-box">
        <div class="diagram-step">
            <div class="step-title">Level 1: Industry Sector</div>
            <div class="step-desc">Meat & Poultry, Snacks & Savory, Dairy, Bakery...</div>
        </div>
        <div class="diagram-arrow">➔</div>
        <div class="diagram-step">
            <div class="step-title">Level 2: Product Category</div>
            <div class="step-desc">Processed Meat, Poultry, Cheese, Seasonings...</div>
        </div>
        <div class="diagram-arrow">➔</div>
        <div class="diagram-step">
            <div class="step-title">Level 3: Specific Application</div>
            <div class="step-desc">Frankfurters, Injected Poultry, Triangular Cheese...</div>
        </div>
    </div>

    <div class="section-title">3. Core Industry Sector Matrix</div>
    <table>
        <thead>
            <tr>
                <th style="width: 24%;">Level 1: Industry</th>
                <th style="width: 24%;">Level 2: Category</th>
                <th style="width: 28%;">Level 3: Product Application</th>
                <th style="width: 24%;">Key AWA Products</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><strong>Meat & Poultry</strong></td>
                <td>Processed Meat, Minced, Poultry, Casings</td>
                <td>Emulsified Sausages, Injected Poultry, Burgers, Casings</td>
                <td>Textra P Series, Impro Meat, Cellulose Casings</td>
            </tr>
            <tr>
                <td><strong>Snacks & Savory Seasonings</strong></td>
                <td>Topical Seasonings & Dusting, Culinary</td>
                <td>Potato Chips, Extruded Snacks, Instant Noodle Seasoning</td>
                <td>Pepper Black, Paprika, Garlic/Onion Oleoresins</td>
            </tr>
            <tr>
                <td><strong>Dairy</strong></td>
                <td>Cheese, Frozen Dairy, Fermented</td>
                <td>Triangular Processed, White/Feta, Ice Cream, Margarines</td>
                <td>Textra Feta 400, Feta 341, Talaga 300, GMS</td>
            </tr>
            <tr>
                <td><strong>Bakery</strong></td>
                <td>Bread, Pastry, Cakes, Fillings</td>
                <td>Sliced Bread, Croissants, Sponge Cakes, Jams</td>
                <td>Calcium Propionate, Bake C 10, GMS, Pectins</td>
            </tr>
            <tr>
                <td><strong>Sauces, Condiments & Dressings</strong></td>
                <td>Emulsified Sauces, Table Sauces, Marinades</td>
                <td>Mayonnaise, Salad Dressings, Ketchup, Marinades</td>
                <td>Xanthan Gum, MCC 811F, Modified Starches</td>
            </tr>
            <tr>
                <td><strong>Beverages & Confectionery</strong></td>
                <td>Carbonated, Juices, Candies, Chocolate</td>
                <td>Soft Drinks, Juices, Gummies, Chocolate Coatings</td>
                <td>Caramel Color, Citric Acid, Pectin CE 514, Cocoa</td>
            </tr>
        </tbody>
    </table>

    <div class="footer">
        <span>AWA Food Solutions &bull; Technical Data Sheet Management System</span>
        <span>Page 1 of 2</span>
    </div>
</div>

<!-- PAGE 2: RELATIONAL BRIDGE & R&D LAB COLLECTION PLAN -->
<div class="page">
    <div class="header">
        <div class="logo-title">
            <div class="logo-badge">AWA</div>
            <div class="header-text">
                <h1>R&D Collection Plan & Relational Model</h1>
                <p>Actionable Execution Queue &bull; Laboratory Verification Roadmap</p>
            </div>
        </div>
        <div class="doc-meta">
            <div>Portal URL: <strong>http://localhost:5000</strong></div>
            <div>Bridge Records: <strong>807 Normalized Routes</strong></div>
        </div>
    </div>

    <div class="section-title">4. Normalized Relational Data Model (Power BI & SQL Ready)</div>
    <p style="font-size: 8pt; color: #475569; margin-bottom: 8px;">
        Every material is mapped to distinct 1-to-1 rows in <strong>Application_Bridge_Map</strong>, enabling cross-application queries without text parsing:
    </p>

    <table>
        <thead>
            <tr>
                <th style="width: 10%;">ID</th>
                <th style="width: 25%;">Material Name</th>
                <th style="width: 22%;">Level 1 Industry</th>
                <th style="width: 25%;">Level 3 Application</th>
                <th style="width: 18%;">Validation Status</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><strong>#28</strong></td>
                <td>Ingreva RevaStab MC100</td>
                <td>Meat & Poultry</td>
                <td>Emulsified Sausages</td>
                <td><span class="badge badge-green">R&D Validated</span></td>
            </tr>
            <tr>
                <td><strong>#28</strong></td>
                <td>Ingreva RevaStab MC100</td>
                <td>Meat & Poultry</td>
                <td>Injected Chicken / Turkey Breasts</td>
                <td><span class="badge badge-green">R&D Validated</span></td>
            </tr>
            <tr>
                <td><strong>#132</strong></td>
                <td>Pepper Black Oleoresin 1001</td>
                <td>Snacks & Savory Seasonings</td>
                <td>Potato Chips / Extruded Snacks</td>
                <td><span class="badge badge-green">R&D Validated</span></td>
            </tr>
            <tr>
                <td><strong>#132</strong></td>
                <td>Pepper Black Oleoresin 1001</td>
                <td>Meat & Poultry</td>
                <td>Emulsified Sausages</td>
                <td><span class="badge badge-green">R&D Validated</span></td>
            </tr>
            <tr>
                <td><strong>#82</strong></td>
                <td>Textra Feta 400</td>
                <td>Dairy</td>
                <td>Triangular Processed Cheese</td>
                <td><span class="badge badge-green">R&D Validated</span></td>
            </tr>
            <tr>
                <td><strong>#371</strong></td>
                <td>Xanthan Gum (200 Mesh)</td>
                <td>Sauces, Condiments & Dressings</td>
                <td>Mayonnaise / Salad Dressings</td>
                <td><span class="badge badge-amber">Analyst Proposed</span></td>
            </tr>
        </tbody>
    </table>

    <div class="section-title">5. Prioritized R&D TDS Collection Queue (195 Items)</div>
    <div class="two-col">
        <div class="card" style="border-left: 3px solid #dc2626;">
            <h3>🔴 Priority 1: Urgent Collection (100 Items)</h3>
            <p><strong>Target:</strong> Standalone commodities with zero TDS in family (Cocoa powders, Sodium Benzoate, Calcium Chloride, Citric Acid, Xanthan Gum).</p>
            <p style="margin-top: 4px;"><strong>Action Required:</strong> Collect manufacturer TDS & CoA, chemical purity %, heavy metal assays, and food grade declaration.</p>
        </div>
        <div class="card" style="border-left: 3px solid #2563eb;">
            <h3>🔵 Priority 2: Variant Verification (95 Items)</h3>
            <p><strong>Target:</strong> Commercial strength variants (Black Pepper 1002..1032, Paprika 1001..1023, Garlic, Textra P 103..106).</p>
            <p style="margin-top: 4px;"><strong>Action Required:</strong> Validate active principle assay (Volatile Oil %, Capsaicin/Piperine %, Color Units ASTA) and specific carrier.</p>
        </div>
    </div>

    <div class="section-title">6. Implementation & Roadmap</div>
    <table>
        <thead>
            <tr>
                <th style="width: 25%;">Phase</th>
                <th style="width: 20%;">Milestone</th>
                <th style="width: 15%;">Status</th>
                <th style="width: 40%;">Deliverable</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><strong>Phase 1</strong></td>
                <td>Taxonomy & Normalization</td>
                <td><span class="badge badge-green">Complete</span></td>
                <td>Meat & Poultry and Snacks & Savory master tables generated.</td>
            </tr>
            <tr>
                <td><strong>Phase 2</strong></td>
                <td>Local Web Portal Sync</td>
                <td><span class="badge badge-green">Live</span></td>
                <td>Web explorer live on port 5000 with R&D PDF viewer.</td>
            </tr>
            <tr>
                <td><strong>Phase 3</strong></td>
                <td>R&D Laboratory Queue</td>
                <td><span class="badge badge-amber">In Progress</span></td>
                <td>Execute collection queue for 195 laboratory parameters.</td>
            </tr>
            <tr>
                <td><strong>Phase 4</strong></td>
                <td>Final Database Sync</td>
                <td><span class="badge badge-blue">Pending</span></td>
                <td>Incorporate verified CoAs and promote to production SQLite.</td>
            </tr>
        </tbody>
    </table>

    <div class="footer">
        <span>AWA Food Solutions &bull; Technical Data Sheet Management System</span>
        <span>Page 2 of 2</span>
    </div>
</div>

</body>
</html>
`;

    fs.writeFileSync(htmlPath, htmlContent, 'utf-8');
    const browserExe = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const cmd = `"${browserExe}" --headless --disable-gpu --no-margins --print-to-pdf="${pdfPath}" "file:///${htmlPath.replace(/\\/g, '/')}"`;
    execSync(cmd);
    console.log('✅ Clean Executive Proposal PDF generated at:', pdfPath);
}

generateCleanExecutivePDF();
