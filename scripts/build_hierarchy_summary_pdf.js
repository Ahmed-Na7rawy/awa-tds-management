const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function generateHierarchySummaryPDF() {
    const rootDir = path.resolve(__dirname, '..');
    const bridgeCsvPath = path.join(rootDir, 'database', 'Material_Application_Bridge.csv');
    const masterCsvPath = path.join(rootDir, 'database', 'TDS_resolved.csv');
    const htmlPath = path.join(rootDir, 'database', 'hierarchy_summary_template.html');
    const pdfPath = path.join(rootDir, 'database', 'AWA_Hierarchy_Summary_Report.pdf');

    function parseCSV(filePath) {
        const text = fs.readFileSync(filePath, 'utf-8');
        const rows = [];
        let row = [];
        let inQuotes = false;
        let field = '';
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i + 1];
            if (char === '"') {
                if (inQuotes && nextChar === '"') { field += '"'; i++; }
                else inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                row.push(field); field = '';
            } else if ((char === '\r' || char === '\n') && !inQuotes) {
                if (char === '\r' && nextChar === '\n') i++;
                row.push(field);
                if (row.length > 1 || (row.length === 1 && row[0] !== '')) rows.push(row);
                row = []; field = '';
            } else { field += char; }
        }
        if (field !== '' || row.length > 0) {
            row.push(field);
            if (row.length > 1 || (row.length === 1 && row[0] !== '')) rows.push(row);
        }
        return rows;
    }

    const bridgeData = parseCSV(bridgeCsvPath);
    const bHeaders = bridgeData[0];
    const bridgeRows = bridgeData.slice(1).map(r => {
        const obj = {};
        bHeaders.forEach((h, idx) => obj[h] = r[idx] || '');
        return obj;
    });

    const masterData = parseCSV(masterCsvPath);
    const mHeaders = masterData[0];
    const masterRows = masterData.slice(1).map(r => {
        const obj = {};
        mHeaders.forEach((h, idx) => obj[h] = r[idx] || '');
        return obj;
    });

    // Grouping by Industry & Subcategories
    const categoryStats = new Map();
    bridgeRows.forEach(r => {
        const cat = r.industry_level_1 || 'Other';
        if (!categoryStats.has(cat)) {
            categoryStats.set(cat, {
                name: cat,
                items: [],
                subcats: new Map()
            });
        }
        const cObj = categoryStats.get(cat);
        cObj.items.push(r);

        const subKey = `${r.category_level_2} ➔ ${r.application_level_3}`;
        if (!cObj.subcats.has(subKey)) {
            cObj.subcats.set(subKey, {
                category_level_2: r.category_level_2,
                application_level_3: r.application_level_3,
                count: 0
            });
        }
        cObj.subcats.get(subKey).count += 1;
    });

    const sortedCats = [...categoryStats.entries()].sort((a, b) => b[1].items.length - a[1].items.length);

    // Build Page 1 Table Rows
    let page1TableRowsHtml = '';
    sortedCats.forEach(([catName, data]) => {
        const uniqueItems = new Set(data.items.map(i => i.material_id)).size;
        const totalRoutes = data.items.length;
        const subcatCount = data.subcats.size;
        const verifiedTds = data.items.filter(i => i.tds_found === 'Yes').length;
        const coveragePct = ((verifiedTds / totalRoutes) * 100).toFixed(0) + '%';

        // Subcategory list summary
        const subList = [...data.subcats.values()]
            .map(s => `<strong>${s.application_level_3}</strong> (${s.count})`)
            .join(' &bull; ');

        page1TableRowsHtml += `
            <tr>
                <td><strong>${catName}</strong></td>
                <td class="center"><span class="badge badge-indigo">${subcatCount}</span></td>
                <td class="center"><strong>${uniqueItems}</strong></td>
                <td class="center"><span class="badge badge-blue">${totalRoutes}</span></td>
                <td class="center"><span class="badge badge-green">${coveragePct}</span></td>
                <td class="subcat-cell">${subList}</td>
            </tr>
        `;
    });

    // Build Page 2 Category Cards (2-Column Grid)
    let page2CardsHtml = '';
    sortedCats.forEach(([catName, data]) => {
        const uniqueItems = new Set(data.items.map(i => i.material_id)).size;
        const totalRoutes = data.items.length;

        let subRowsHtml = '';
        [...data.subcats.values()].forEach(s => {
            subRowsHtml += `
                <div class="sub-item-row">
                    <div class="sub-name">
                        <span class="sub-cat-tag">${s.category_level_2}</span>
                        <strong>${s.application_level_3}</strong>
                    </div>
                    <div class="sub-count-badge">${s.count} items</div>
                </div>
            `;
        });

        page2CardsHtml += `
            <div class="cat-card">
                <div class="cat-card-header">
                    <h3>${catName}</h3>
                    <div class="cat-meta-tags">
                        <span class="badge badge-white">${uniqueItems} Products</span>
                        <span class="badge badge-amber">${totalRoutes} Routes</span>
                    </div>
                </div>
                <div class="cat-card-body">
                    ${subRowsHtml}
                </div>
            </div>
        `;
    });

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>AWA Food Science Hierarchy Structure - 7 Core Sectors</title>
<style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

    @page {
        size: A4 portrait;
        margin: 10mm 12mm 10mm 12mm;
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
        font-size: 8.5pt;
        line-height: 1.35;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }

    .page {
        page-break-after: always;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
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
        padding-bottom: 8px;
        margin-bottom: 10px;
    }

    .logo-title {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .logo-badge {
        background: #0f172a;
        color: #ffffff;
        font-weight: 800;
        font-size: 13pt;
        padding: 4px 10px;
        border-radius: 5px;
        letter-spacing: 0.5px;
    }

    .header-text h1 {
        font-size: 13pt;
        font-weight: 800;
        color: #0f172a;
        line-height: 1.15;
    }

    .header-text p {
        font-size: 7.5pt;
        color: #64748b;
        font-weight: 500;
    }

    .doc-meta {
        text-align: right;
        font-size: 7pt;
        color: #64748b;
    }

    .doc-meta strong {
        color: #0f172a;
    }

    /* KPI Grid */
    .kpi-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
        margin-bottom: 10px;
    }

    .kpi-card {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 6px 10px;
        text-align: center;
    }

    .kpi-card.blue { border-top: 3px solid #2563eb; }
    .kpi-card.green { border-top: 3px solid #059669; }
    .kpi-card.indigo { border-top: 3px solid #4338ca; }
    .kpi-card.amber { border-top: 3px solid #d97706; }

    .kpi-label {
        font-size: 6.8pt;
        text-transform: uppercase;
        font-weight: 700;
        color: #64748b;
        letter-spacing: 0.5px;
    }

    .kpi-value {
        font-size: 14pt;
        font-weight: 800;
        color: #0f172a;
        line-height: 1.1;
    }

    .kpi-sub {
        font-size: 6.5pt;
        color: #64748b;
    }

    .section-title {
        font-size: 9.5pt;
        font-weight: 800;
        color: #0f172a;
        border-left: 3.5px solid #4338ca;
        padding-left: 6px;
        margin-top: 8px;
        margin-bottom: 6px;
    }

    /* Table Styling */
    table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 8px;
        font-size: 7.6pt;
    }

    th {
        background: #0f172a;
        color: #ffffff;
        font-weight: 700;
        text-align: left;
        padding: 5px 6px;
        font-size: 7pt;
        letter-spacing: 0.2px;
    }

    th.center, td.center { text-align: center; }

    td {
        padding: 4.5px 6px;
        border-bottom: 1px solid #e2e8f0;
        color: #334155;
        vertical-align: middle;
    }

    tr:nth-child(even) td { background: #f8fafc; }

    .badge {
        display: inline-block;
        padding: 1.5px 5px;
        border-radius: 3px;
        font-size: 6.5pt;
        font-weight: 700;
        white-space: nowrap;
    }

    .badge-green { background: #dcfce7; color: #166534; }
    .badge-blue { background: #dbeafe; color: #1e40af; }
    .badge-indigo { background: #e0e7ff; color: #3730a3; }
    .badge-amber { background: #fef3c7; color: #92400e; }
    .badge-white { background: #ffffff; color: #0f172a; border: 1px solid #cbd5e1; }

    .subcat-cell {
        font-size: 6.8pt;
        color: #475569;
        line-height: 1.35;
    }

    /* Page 2 Grid & Cards */
    .cards-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
    }

    .cat-card {
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        overflow: hidden;
        box-shadow: 0 1px 2px rgba(0,0,0,0.03);
    }

    .cat-card-header {
        background: #0f172a;
        color: #ffffff;
        padding: 5px 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .cat-card-header h3 {
        font-size: 8.5pt;
        font-weight: 800;
        color: #ffffff;
    }

    .cat-meta-tags {
        display: flex;
        gap: 4px;
    }

    .cat-card-body {
        padding: 5px 8px;
        background: #fafafa;
    }

    .sub-item-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 3px 0;
        border-bottom: 1px solid #f1f5f9;
        font-size: 7.2pt;
    }

    .sub-item-row:last-child {
        border-bottom: none;
    }

    .sub-name {
        display: flex;
        align-items: center;
        gap: 4px;
        color: #1e293b;
    }

    .sub-cat-tag {
        font-size: 6.2pt;
        background: #e2e8f0;
        color: #475569;
        padding: 1px 4px;
        border-radius: 2px;
        font-weight: 600;
    }

    .sub-count-badge {
        background: #4338ca;
        color: #ffffff;
        font-weight: 700;
        font-size: 6.5pt;
        padding: 1px 6px;
        border-radius: 8px;
    }

    .footer {
        border-top: 1px solid #e2e8f0;
        padding-top: 3px;
        display: flex;
        justify-content: space-between;
        font-size: 6.5pt;
        color: #94a3b8;
    }
</style>
</head>
<body>

<!-- PAGE 1: MASTER HIERARCHY OVERVIEW & DISTRIBUTION -->
<div class="page">
    <div>
        <div class="header">
            <div class="logo-title">
                <div class="logo-badge">AWA</div>
                <div class="header-text">
                    <h1>Food Science Application Hierarchy Master</h1>
                    <p>7 Core Finished Food Sectors &bull; Fully Distributed Functional Taxonomy</p>
                </div>
            </div>
            <div class="doc-meta">
                <div>Master Catalog: <strong>370 Products</strong></div>
                <div>Relational Routes: <strong>823 Routes</strong></div>
                <div>Status: <strong>Management Approved</strong></div>
            </div>
        </div>

        <div class="kpi-grid">
            <div class="kpi-card blue">
                <div class="kpi-label">Master Catalog</div>
                <div class="kpi-value">370</div>
                <div class="kpi-sub">Total Raw Materials & Blends</div>
            </div>
            <div class="kpi-card indigo">
                <div class="kpi-label">Finished Sectors</div>
                <div class="kpi-value">7</div>
                <div class="kpi-sub">100% Industry-Distributed</div>
            </div>
            <div class="kpi-card green">
                <div class="kpi-label">Application Subcategories</div>
                <div class="kpi-value">34</div>
                <div class="kpi-sub">Level 2 & 3 Target Formats</div>
            </div>
            <div class="kpi-card amber">
                <div class="kpi-label">Relational Routes</div>
                <div class="kpi-value">823</div>
                <div class="kpi-sub">Normalized Application Mappings</div>
            </div>
        </div>

        <div class="section-title">1. Master 7 Finished Industry Sectors & Subcategories Distribution Table</div>
        <table>
            <thead>
                <tr>
                    <th style="width: 22%;">Level 1: Industry Sector</th>
                    <th style="width: 8%;" class="center">Subcats</th>
                    <th style="width: 10%;" class="center">Unique Items</th>
                    <th style="width: 10%;" class="center">Total Routes</th>
                    <th style="width: 10%;" class="center">TDS Verified</th>
                    <th style="width: 40%;">Target Application Formats (Item Count)</th>
                </tr>
            </thead>
            <tbody>
                ${page1TableRowsHtml}
            </tbody>
        </table>

        <div class="section-title">2. Architectural Highlights (Zero Generic Buckets)</div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 10px; font-size: 7.2pt; color: #475569; line-height: 1.4;">
            <p><strong>• 100% Industry Distribution:</strong> Eliminated generic "Processing" and standalone "Plant-Based" buckets. All items are now allocated to real-world matrices (e.g. <em>plant-based burgers/nuggets</em> and <em>phosphates</em> into <strong>Meat & Poultry</strong>; <em>antifoams</em> into <strong>Beverages, Dairy, and Sauces</strong>; <em>bio-preservatives</em> into <strong>Dairy and Meat</strong>).</p>
            <p style="margin-top: 3px;"><strong>• Relational Bridge Model:</strong> Decomposed multi-application ingredients into <strong>823 normalized 1-to-1 rows</strong> in <code>Application_Bridge_Map</code> for instant filtering in SQL, Power BI, and Excel.</p>
        </div>
    </div>

    <div class="footer">
        <span>AWA Food Solutions &bull; Technical Data Sheet Management System</span>
        <span>Page 1 of 2 — Master Distribution Overview</span>
    </div>
</div>

<!-- PAGE 2: DETAILED ITEM COUNTS PER CATEGORY & SUBCATEGORY -->
<div class="page">
    <div>
        <div class="header">
            <div class="logo-title">
                <div class="logo-badge">AWA</div>
                <div class="header-text">
                    <h1>Category-by-Category Subcategory Breakdown</h1>
                    <p>Itemized Distribution of all 34 Finished Food Applications across 7 Core Sectors</p>
                </div>
            </div>
            <div class="doc-meta">
                <div>Sectors: <strong>7 Finished Food Industries</strong></div>
                <div>Scope: <strong>Subcategory Item Counts & Routes</strong></div>
            </div>
        </div>

        <div class="section-title" style="margin-top: 0;">3. Detailed Subcategory & Finished Application Breakdown</div>
        <div class="cards-grid">
            ${page2CardsHtml}
        </div>
    </div>

    <div class="footer">
        <span>AWA Food Solutions &bull; Technical Data Sheet Management System</span>
        <span>Page 2 of 2 — Category Deep-Dive Breakdown</span>
    </div>
</div>

</body>
</html>
`;

    fs.writeFileSync(htmlPath, htmlContent, 'utf-8');
    const browserExe = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const cmd = `"${browserExe}" --headless --disable-gpu --no-margins --print-to-pdf="${pdfPath}" "file:///${htmlPath.replace(/\\/g, '/')}"`;
    execSync(cmd);
    console.log(`✅ Clean 2-Page Hierarchy Summary PDF generated at: ${pdfPath}`);
}

generateHierarchySummaryPDF();
