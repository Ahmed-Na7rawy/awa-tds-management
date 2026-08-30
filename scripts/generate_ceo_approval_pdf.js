const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function generateCeoApprovalPDF() {
    const rootDir = path.resolve(__dirname, '..');
    const bridgeCsvPath = path.join(rootDir, 'database', 'Material_Application_Bridge.csv');
    const masterCsvPath = path.join(rootDir, 'database', 'TDS_resolved.csv');
    const htmlPath = path.join(rootDir, 'database', 'ceo_approval_template.html');
    const pdfPath = path.join(rootDir, 'database', 'AWA_CEO_Taxonomy_Approval_Dossier.pdf');

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

    // Grouping by Level 1 Industry -> Level 2 Category -> Level 3 Application
    const industryOrder = [
        'Meat & Poultry',
        'Dairy',
        'Snacks & Savory Seasonings',
        'Sauces, Condiments & Dressings',
        'Bakery',
        'Beverages',
        'Confectionery'
    ];

    const sectorTree = new Map();
    industryOrder.forEach(ind => {
        sectorTree.set(ind, {
            name: ind,
            items: [],
            categories: new Map()
        });
    });

    bridgeRows.forEach(r => {
        const ind = r.industry_level_1 || 'Other';
        if (!sectorTree.has(ind)) {
            sectorTree.set(ind, { name: ind, items: [], categories: new Map() });
        }
        const sObj = sectorTree.get(ind);
        sObj.items.push(r);

        const cat = r.category_level_2 || 'General';
        if (!sObj.categories.has(cat)) {
            sObj.categories.set(cat, {
                category_name: cat,
                subcats: new Map()
            });
        }
        const cObj = sObj.categories.get(cat);

        const sub = r.application_level_3 || 'General Application';
        if (!cObj.subcats.has(sub)) {
            cObj.subcats.set(sub, []);
        }
        cObj.subcats.get(sub).push(r);
    });

    // Generate Executive Summary Table for Page 1
    let summaryTableHtml = '';
    sectorTree.forEach((data, indName) => {
        const uniqueCount = new Set(data.items.map(i => i.material_id)).size;
        const totalRoutes = data.items.length;
        const directTds = data.items.filter(i => i.tds_found === 'Yes').length;
        const copiedTds = data.items.filter(i => i.tds_found.includes('copied')).length;
        const pendingTds = totalRoutes - directTds - copiedTds;
        const verifiedPct = (((directTds + copiedTds) / totalRoutes) * 100).toFixed(0) + '%';

        let catCount = data.categories.size;
        let subcatCount = 0;
        data.categories.forEach(c => subcatCount += c.subcats.size);

        summaryTableHtml += `
            <tr>
                <td><strong>${indName}</strong></td>
                <td class="center"><strong>${catCount}</strong> Cats / <strong>${subcatCount}</strong> Subs</td>
                <td class="center"><strong>${uniqueCount}</strong></td>
                <td class="center"><span class="badge badge-blue">${totalRoutes}</span></td>
                <td class="center"><span class="badge badge-green">${directTds}</span></td>
                <td class="center"><span class="badge badge-indigo">${copiedTds}</span></td>
                <td class="center"><span class="badge badge-amber">${pendingTds}</span></td>
                <td class="center"><strong>${verifiedPct}</strong></td>
            </tr>
        `;
    });

    // Build Sector Chapters (Detailed Item Distribution)
    let chaptersHtml = '';
    let chapterNum = 1;

    sectorTree.forEach((sData, indName) => {
        const uniqueCount = new Set(sData.items.map(i => i.material_id)).size;
        const totalRoutes = sData.items.length;

        chaptersHtml += `
        <div class="chapter-break"></div>
        <div class="chapter-header">
            <div class="chapter-title-group">
                <span class="chapter-num">CHAPTER ${chapterNum++}</span>
                <h2>${indName.toUpperCase()} SECTOR</h2>
            </div>
            <div class="chapter-badges">
                <span class="header-badge">${uniqueCount} Master Products</span>
                <span class="header-badge" style="background: #4338ca;">${totalRoutes} Application Routes</span>
            </div>
        </div>
        <p class="chapter-intro">Itemized finished-product matrix distribution, functional ingredient behavior, and physical TDS laboratory audit status:</p>
        `;

        sData.categories.forEach((cData, catName) => {
            chaptersHtml += `
            <div class="cat-section-header">
                📁 Level 2 Product Category: <strong>${catName}</strong> (${cData.subcats.size} Application Matrices)
            </div>
            `;

            cData.subcats.forEach((items, subName) => {
                chaptersHtml += `
                <div class="subcat-title-bar">
                    🎯 Level 3 Application: <strong>${subName}</strong> (${items.length} materials)
                </div>
                <table class="item-table">
                    <thead>
                        <tr>
                            <th style="width: 6%;" class="center">ID</th>
                            <th style="width: 24%;">Material Name & Family</th>
                            <th style="width: 44%;">Functional Usage in Food Matrix</th>
                            <th style="width: 14%;" class="center">TDS Status</th>
                            <th style="width: 12%;" class="center">Validation</th>
                        </tr>
                    </thead>
                    <tbody>
                `;

                items.forEach(item => {
                    let tdsBadge = '<span class="badge badge-green">Direct TDS</span>';
                    if (item.tds_found.includes('copied')) {
                        tdsBadge = '<span class="badge badge-indigo">Copied Sibling</span>';
                    } else if (item.tds_found !== 'Yes') {
                        tdsBadge = '<span class="badge badge-amber">Pending CoA</span>';
                    }

                    const valBadge = item.validation_status === 'R&D Validated'
                        ? '<span class="badge badge-green">Validated</span>'
                        : '<span class="badge badge-amber">Proposed</span>';

                    chaptersHtml += `
                        <tr>
                            <td class="center"><strong>#${item.material_id}</strong></td>
                            <td>
                                <strong class="mat-title">${item.material_name}</strong>
                                <div class="mat-fam">Family: ${item.product_family}</div>
                            </td>
                            <td class="func-desc">${item.application_function_details}</td>
                            <td class="center">${tdsBadge}</td>
                            <td class="center">${valBadge}</td>
                        </tr>
                    `;
                });

                chaptersHtml += `
                    </tbody>
                </table>
                `;
            });
        });
    });

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>AWA CEO Taxonomy & Material Distribution Approval Dossier</title>
<style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

    @page {
        size: A4 portrait;
        margin: 12mm 12mm 12mm 12mm;
        @bottom-right {
            content: counter(page) " of " counter(pages);
            font-size: 7pt;
            color: #64748b;
        }
    }

    * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
    }

    body {
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #0f172a;
        background: #ffffff;
        font-size: 8.2pt;
        line-height: 1.4;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }

    /* Cover / Page 1 Styles */
    .cover-page {
        page-break-after: always;
        min-height: 98vh;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }

    .chapter-break {
        page-break-before: always;
    }

    .header-banner {
        border-bottom: 2.5px solid #0f172a;
        padding-bottom: 12px;
        margin-bottom: 14px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .brand-group {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .brand-logo-badge {
        background: #0f172a;
        color: #ffffff;
        font-weight: 800;
        font-size: 16pt;
        padding: 6px 14px;
        border-radius: 6px;
        letter-spacing: 0.5px;
    }

    .banner-text h1 {
        font-size: 14.5pt;
        font-weight: 800;
        color: #0f172a;
        line-height: 1.15;
    }

    .banner-text p {
        font-size: 8.2pt;
        color: #475569;
        font-weight: 600;
    }

    .dossier-meta {
        text-align: right;
        font-size: 7.5pt;
        color: #64748b;
    }

    .dossier-meta strong {
        color: #0f172a;
    }

    /* Executive KPI Grid */
    .kpi-row {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
        margin-bottom: 14px;
    }

    .kpi-box {
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 10px;
        text-align: center;
    }

    .kpi-box.blue { border-top: 3px solid #2563eb; }
    .kpi-box.indigo { border-top: 3px solid #4338ca; }
    .kpi-box.green { border-top: 3px solid #059669; }
    .kpi-box.amber { border-top: 3px solid #d97706; }

    .kpi-title {
        font-size: 7pt;
        font-weight: 700;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.4px;
    }

    .kpi-num {
        font-size: 16pt;
        font-weight: 800;
        color: #0f172a;
        line-height: 1.1;
        margin: 3px 0;
    }

    .kpi-desc {
        font-size: 7pt;
        color: #64748b;
    }

    .section-title {
        font-size: 10pt;
        font-weight: 800;
        color: #0f172a;
        border-left: 4px solid #4338ca;
        padding-left: 8px;
        margin-top: 14px;
        margin-bottom: 8px;
    }

    /* Executive Summary Table */
    table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 12px;
        font-size: 7.8pt;
    }

    th {
        background: #0f172a;
        color: #ffffff;
        font-weight: 700;
        text-align: left;
        padding: 6px 8px;
        font-size: 7.2pt;
        letter-spacing: 0.2px;
    }

    th.center, td.center { text-align: center; }

    td {
        padding: 5px 8px;
        border-bottom: 1px solid #e2e8f0;
        color: #1e293b;
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

    .badge-green { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
    .badge-blue { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
    .badge-indigo { background: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe; }
    .badge-amber { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }

    /* Chapter Header Styles */
    .chapter-header {
        background: #0f172a;
        color: #ffffff;
        padding: 8px 12px;
        border-radius: 6px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
    }

    .chapter-num {
        font-size: 6.5pt;
        color: #94a3b8;
        font-weight: 800;
        letter-spacing: 0.5px;
    }

    .chapter-title-group h2 {
        font-size: 11pt;
        font-weight: 800;
        color: #ffffff;
    }

    .chapter-badges {
        display: flex;
        gap: 6px;
    }

    .header-badge {
        background: #1e293b;
        border: 1px solid rgba(255,255,255,0.25);
        color: #ffffff;
        font-size: 7.2pt;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 12px;
    }

    .chapter-intro {
        font-size: 7.5pt;
        color: #64748b;
        margin-bottom: 8px;
    }

    .cat-section-header {
        background: #e2e8f0;
        color: #0f172a;
        font-weight: 800;
        font-size: 8.2pt;
        padding: 4px 8px;
        border-radius: 4px;
        margin-top: 10px;
        margin-bottom: 4px;
    }

    .subcat-title-bar {
        background: #f1f5f9;
        color: #334155;
        font-weight: 700;
        font-size: 7.6pt;
        padding: 3px 8px;
        border-left: 3px solid #2563eb;
        margin-top: 6px;
        margin-bottom: 4px;
    }

    .mat-title {
        color: #065f46;
        font-size: 7.8pt;
    }

    .mat-fam {
        font-size: 6.5pt;
        color: #64748b;
    }

    .func-desc {
        font-size: 7.2pt;
        color: #334155;
        line-height: 1.3;
    }

    .footer {
        border-top: 1px solid #cbd5e1;
        padding-top: 4px;
        margin-top: 12px;
        display: flex;
        justify-content: space-between;
        font-size: 6.8pt;
        color: #94a3b8;
    }
</style>
</head>
<body>

<!-- PAGE 1: COVER & EXECUTIVE DOSSIER OVERVIEW -->
<div class="cover-page">
    <div>
        <div class="header-banner">
            <div class="brand-group">
                <div class="brand-logo-badge">AWA</div>
                <div class="banner-text">
                    <h1>Executive Catalog & Taxonomy Approval Dossier</h1>
                    <p>Standardized Finished Food Industry Sectors, Applications & TDS Verification Status</p>
                </div>
            </div>
            <div class="dossier-meta">
                <div>Document Ref: <strong>AWA-EXEC-2026-TAX-01</strong></div>
                <div>Date: <strong>August 2026</strong></div>
                <div>Audience: <strong>Executive Management Review</strong></div>
            </div>
        </div>

        <div class="kpi-row">
            <div class="kpi-box blue">
                <div class="kpi-title">Master Catalog</div>
                <div class="kpi-num">370</div>
                <div class="kpi-desc">Total Commercial Products</div>
            </div>
            <div class="kpi-box indigo">
                <div class="kpi-title">Finished Sectors</div>
                <div class="kpi-num">7</div>
                <div class="kpi-desc">100% Industry-Distributed</div>
            </div>
            <div class="kpi-box green">
                <div class="kpi-title">Matrix Applications</div>
                <div class="kpi-num">34</div>
                <div class="kpi-desc">Finished Food Subcategories</div>
            </div>
            <div class="kpi-box amber">
                <div class="kpi-title">Relational Routes</div>
                <div class="kpi-num">823</div>
                <div class="kpi-desc">1-to-1 Application Mappings</div>
            </div>
        </div>

        <div class="section-title">1. Master Industry Sectors & TDS Coverage Overview</div>
        <table>
            <thead>
                <tr>
                    <th style="width: 25%;">Level 1: Industry Sector</th>
                    <th style="width: 16%;" class="center">Categories / Subs</th>
                    <th style="width: 10%;" class="center">Products</th>
                    <th style="width: 10%;" class="center">Routes</th>
                    <th style="width: 10%;" class="center">Direct TDS</th>
                    <th style="width: 10%;" class="center">Copied TDS</th>
                    <th style="width: 10%;" class="center">Pending CoA</th>
                    <th style="width: 9%;" class="center">TDS %</th>
                </tr>
            </thead>
            <tbody>
                ${summaryTableHtml}
            </tbody>
        </table>

        <div class="section-title">2. Executive Framework & Standardization Principles</div>
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 14px; font-size: 7.6pt; color: #334155; line-height: 1.5; margin-top: 6px;">
            <p><strong>• 100% Industry Distribution:</strong> Eliminated generic umbrella categories (such as "Processing" and standalone "Plant-Based"). All functional aids, plant proteins, and antifoams are allocated directly to the industrial food matrices where they perform.</p>
            <p style="margin-top: 6px;"><strong>• Relational Bridge Architecture:</strong> Resolved multi-value semicolon strings into <strong>823 normalized relational rows</strong> in <code>Application_Bridge_Map</code>, ensuring clean integration with Power BI dashboards and ERP master data.</p>
            <p style="margin-top: 6px;"><strong>• Streamlined Laboratory R&D Queue:</strong> Consolidated 100 missing items into <strong>52 unique Base Ingredient Families (zero repeats)</strong> for efficient procurement and Certificate of Analysis (CoA) collection.</p>
            <p style="margin-top: 6px;"><strong>• Variant & Concentration Hierarchy:</strong> Distinguished identical functional extracts (e.g. 33 Black Pepper grades, 30 Paprika grades) into parent Product Families while maintaining individual active concentration tracking.</p>
        </div>
    </div>

    <div class="footer">
        <span>AWA Food Solutions &bull; Technical Data Sheet Management System</span>
        <span>Executive Dossier — Master Summary & Framework Overview</span>
    </div>
</div>

<!-- DETAILED SECTOR CHAPTERS -->
${chaptersHtml}

</body>
</html>
`;

    fs.writeFileSync(htmlPath, htmlContent, 'utf-8');
    console.log(`Wrote CEO Approval HTML template (clean without signature block) to: ${htmlPath}`);

    const browserExe = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const cmd = `"${browserExe}" --headless --disable-gpu --no-margins --print-to-pdf="${pdfPath}" "file:///${htmlPath.replace(/\\/g, '/')}"`;
    execSync(cmd);
    console.log(`✅ Updated CEO Approval Dossier PDF generated at: ${pdfPath}`);
}

generateCeoApprovalPDF();
