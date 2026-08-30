const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

async function buildConsolidatedRdRequestAndResolveMissing() {
    const rootDir = path.resolve(__dirname, '..');
    const resolvedCsvPath = path.join(rootDir, 'database', 'TDS_resolved.csv');
    const dbCsvPath = path.join(rootDir, 'database', 'tds_database.csv');
    const bridgeCsvPath = path.join(rootDir, 'database', 'Material_Application_Bridge.csv');
    const masterExcelPath = path.join(rootDir, 'database', 'AWA_TDS_Taxonomy_Master_v3.xlsx');
    const consolidatedExcelPath = path.join(rootDir, 'database', 'AWA_Zero_TDS_RD_Request_Consolidated.xlsx');
    const consolidatedCsvPath = path.join(rootDir, 'database', 'AWA_Zero_TDS_RD_Request_Consolidated.csv');
    const dataPath = path.join(rootDir, 'database', 'TDS_Data.xlsx');

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

    const masterData = parseCSV(resolvedCsvPath);
    const mHeaders = masterData[0];
    const rawRows = masterData.slice(1).map(r => {
        const obj = {};
        mHeaders.forEach((h, idx) => obj[h] = r[idx] || '');
        return obj;
    });

    console.log(`Analyzing ${rawRows.length} catalog items...`);

    // =========================================================================
    // PART 1: Consolidate Zero-TDS R&D Request by Family (NO REPEATS)
    // =========================================================================
    const zeroTdsItems = rawRows.filter(r => r.tds_found === "No, and doesn't have variants" || r.tds_found === "Not found for any variants");
    console.log(`Total zero-TDS individual items: ${zeroTdsItems.length}`);

    const familyMap = new Map();
    zeroTdsItems.forEach(item => {
        const fam = item.product_family || item.material_name;
        if (!familyMap.has(fam)) {
            familyMap.set(fam, {
                product_family: fam,
                has_variants: item.has_variants === 'Yes',
                variants: [],
                industry_level_1: item.industry_level_1,
                category_level_2: item.category_level_2,
                application_level_3: item.application_level_3,
                sample_item: item
            });
        }
        const fObj = familyMap.get(fam);
        fObj.variants.push({
            id: item.id,
            name: item.material_name
        });
    });

    console.log(`Consolidated into ${familyMap.size} distinct product families (ZERO repeated items).`);

    let famId = 1;
    const consolidatedRequests = [];

    for (const [famName, data] of familyMap.entries()) {
        const varCount = data.variants.length;
        const variantListStr = data.has_variants
            ? data.variants.map(v => `#${v.id} ${v.name}`).join('; ')
            : `#${data.variants[0].id} ${data.variants[0].name}`;

        let labParams = 'Official Manufacturer Technical Data Sheet (TDS); Certificate of Analysis (CoA); Active Chemical Purity / Assay %; Heavy Metals (Pb, As, Cd, Hg); Moisture %; pH (1% solution); Food Grade E-Number & Allergen Statement; Standard Industrial Dosage Range; Storage Limits & Shelf Life.';
        const fLower = famName.toLowerCase();

        if (fLower.includes('annatto')) {
            labParams = 'Manufacturer Master TDS & Grade CoAs; Active Pigment Content % (Bixin / Norbixin % for 2.2%, 3.5%, 4.0% WS grades); Absorbance / Color Value; Solubility profile (Water-Soluble WS vs Oil-Soluble OS); Heavy metals (Pb < 2ppm, As < 3ppm); Heat stability.';
        } else if (fLower.includes('curcumin') || fLower.includes('lutein') || fLower.includes('chlorophyll') || fLower.includes('color') || fLower.includes('carbon black')) {
            labParams = 'Manufacturer Master TDS & Grade CoAs; Pigment Concentration % (5%, 10%, 14%, 20% WS/OS); Color intensity (E 1% 1cm); pH stability range; Light & oxidation stability; Heavy metals & residual solvent limits.';
        } else if (fLower.includes('cocoa')) {
            labParams = 'Manufacturer Master TDS & Grade CoAs; Fat content % (10-12% standard vs alkalized G100, JB800, S9, SL60, SP70, V98); pH value; Fineness (min 99.5% through 200 mesh); Moisture (max 5%); Total Plate Count & Salmonella negative; Melting curve for Cocoa Butter Substitute.';
        } else if (fLower.includes('pectin')) {
            labParams = 'Manufacturer Master TDS & Grade CoAs; Degree of Esterification (DE %); Degree of Amidation (DA %); Calcium Sensitivity Index for LM 101/102/104/106 and Rapid Set CE 514/Ultra; Gel Strength (USA-SAG / Bloom); Setting Temperature; Loss on drying (max 12%).';
        } else if (fLower.includes('xanthan') || fLower.includes('guar') || fLower.includes('locust')) {
            labParams = 'Manufacturer Master TDS & Grade CoAs; Viscosity (1% in 1% KCl, mPa.s / CPS); Granulometry / Mesh size (80 vs 200 Mesh vs Clear/Transparent); Loss on drying; Heavy metals; Total plate count & E. coli negative.';
        } else if (fLower.includes('propionate') || fLower.includes('sorbate') || fLower.includes('benzoate')) {
            labParams = 'Manufacturer Master TDS & Grade CoAs; Active Assay % (min 99.0% dry basis); Physical form (Granular vs Powder vs Wuhan grade); Loss on drying (max 5%); Heavy metals (Pb < 2ppm); Water solubility; Food grade compliance certificate.';
        } else if (fLower.includes('citric') || fLower.includes('citrate') || fLower.includes('tartaric') || fLower.includes('calcium chloride')) {
            labParams = 'Manufacturer Master TDS & Grade CoAs; Chemical Purity % (min 99.5%); Water content (Anhydrous vs Monohydrate); Heavy metals (Pb, As, Hg); Clarity and color of solution; Food grade certificate.';
        } else if (fLower.includes('protein') || fLower.includes('collagen')) {
            labParams = 'Manufacturer Master TDS & Grade CoAs; Crude Protein Content % (dry basis); Amino Acid profile; Bulk density; Water hydration capacity; Ash & moisture %; Heavy metals.';
        } else if (fLower.includes('phosphate') || fLower.includes('sapp') || fLower.includes('shmp') || fLower.includes('stpp')) {
            labParams = 'Manufacturer Master TDS & Grade CoAs; Total Phosphate Content (as P2O5 %); pH of 1% solution; Water insolubles (max 0.1%); Fluoride (max 10 ppm); Heavy metals (Pb, As); Bulk density.';
        }

        consolidatedRequests.push({
            family_id: `REQ-${String(famId++).padStart(3, '0')}`,
            product_family: famName,
            has_variants: data.has_variants ? 'Yes' : 'No',
            variant_count: varCount,
            commercial_codes_included: variantListStr,
            industry_level_1: data.industry_level_1,
            category_level_2: data.category_level_2,
            application_level_3: data.application_level_3,
            required_lab_parameters: labParams,
            action_required: `Request Manufacturer Master TDS & Batch CoAs covering all ${varCount} listed grades`
        });
    }

    // Write Consolidated CSV
    const consHeaders = [
        'family_id',
        'product_family',
        'has_variants',
        'variant_count',
        'commercial_codes_included',
        'industry_level_1',
        'category_level_2',
        'application_level_3',
        'required_lab_parameters',
        'action_required'
    ];

    function writeCSV(filePath, recordList, hList) {
        const lines = [];
        lines.push(hList.join(','));
        recordList.forEach(rec => {
            const row = hList.map(h => {
                let val = String(rec[h] || '');
                if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
                    val = '"' + val.replace(/"/g, '""') + '"';
                }
                return val;
            });
            lines.push(row.join(','));
        });
        fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
    }

    writeCSV(consolidatedCsvPath, consolidatedRequests, consHeaders);
    console.log(`Saved consolidated CSV: ${consolidatedCsvPath}`);

    // Build Consolidated Standalone Excel Workbook
    const wbCons = new ExcelJS.Workbook();
    wbCons.creator = 'AWA Food Solutions - R&D Sector';
    wbCons.created = new Date();

    const wsCons = wbCons.addWorksheet('🚨 Consolidated_R&D_Request', {
        views: [{ state: 'frozen', xSplit: 2, ySplit: 2 }]
    });

    wsCons.mergeCells('B2:J2');
    const cTitle = wsCons.getCell('B2');
    cTitle.value = `AWA R&D SECTOR — CONSOLIDATED TDS REQUEST QUEUE (${consolidatedRequests.length} DISTINCT PRODUCT FAMILIES — ZERO REPEATS)`;
    cTitle.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    cTitle.alignment = { vertical: 'middle', horizontal: 'center' };
    cTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF991B1B' } };
    wsCons.getRow(2).height = 32;

    wsCons.addRow([]);
    const cHeaderRow = wsCons.addRow([
        'Request ID',
        'Base Ingredient / Product Family',
        'Has Variants',
        'Variant Count',
        'Specific Commercial Codes & Grades Included',
        'Level 1: Industry',
        'Level 2: Category',
        'Level 3: Application',
        'Required Laboratory Parameters & CoA Specifications',
        'Action Required'
    ]);
    cHeaderRow.height = 28;
    cHeaderRow.eachCell((cell, colNum) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Segoe UI' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: colNum === 4 ? { argb: 'FFDC2626' } : { argb: 'FF0F172A' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });

    consolidatedRequests.forEach((rec, idx) => {
        const rowData = [
            rec.family_id,
            rec.product_family,
            rec.has_variants,
            rec.variant_count,
            rec.commercial_codes_included,
            rec.industry_level_1,
            rec.category_level_2,
            rec.application_level_3,
            rec.required_lab_parameters,
            rec.action_required
        ];
        const row = wsCons.addRow(rowData);
        row.height = 30;
        const isEven = idx % 2 === 0;

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF0F172A' } };
            cell.alignment = {
                vertical: 'top',
                horizontal: [1, 3, 4].includes(colNumber) ? 'center' : 'left',
                wrapText: true
            };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };
            if (!isEven) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            if (colNumber === 2) cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF991B1B' } };
            if (colNumber === 4) cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFB91C1C' } };
        });
    });

    wsCons.columns = [
        { width: 14 }, // Request ID
        { width: 34 }, // Product Family
        { width: 14 }, // Has Variants
        { width: 14 }, // Variant Count
        { width: 55 }, // Commercial Codes Included
        { width: 25 }, // Level 1 Industry
        { width: 28 }, // Level 2 Category
        { width: 35 }, // Level 3 Application
        { width: 65 }, // Required Lab Parameters
        { width: 35 }  // Action Required
    ];

    wsCons.autoFilter = { from: { row: 4, column: 1 }, to: { row: consolidatedRequests.length + 4, column: 10 } };
    await wbCons.xlsx.writeFile(consolidatedExcelPath);
    console.log(`Saved standalone consolidated Excel to: ${consolidatedExcelPath}`);

    // =========================================================================
    // PART 2: Website Missing TDS Linking & Field Clearing
    // =========================================================================
    // "also on the site any varients that do not have a tds for all of them pick one and add it for the missing and leave the data that will be diffirents fields blank"
    
    // Map family to authentic TDS file if one exists in family or master catalog
    const familyTdsFileMap = new Map();
    rawRows.forEach(r => {
        const fam = r.product_family;
        if (r.filename && r.filename.trim() !== '' && !familyTdsFileMap.has(fam)) {
            familyTdsFileMap.set(fam, r.filename);
        }
    });

    // Bio catalog master PDF fallbacks for natural products
    const bioCategoryFallbackMap = {
        'Oleoresins': 'Oleoresins (TDS)s.pdf',
        'Essential Oils': 'Essential Oils (TDS)s.pdf',
        'Natural Colors': 'Natural Colors (TDS)s.pdf',
        'Spice Blends': 'Liquid Spice Blends (TDS)s.pdf',
        'Antioxidants': 'Natural Anti-Oxidants (TDS)s.pdf'
    };

    const updatedCatalogForSite = rawRows.map(item => {
        const hasDirectTds = Boolean(item.filename && item.filename.trim() !== '');
        
        if (hasDirectTds) {
            // Already has direct verified TDS
            return item;
        }

        // Missing direct TDS: Find family representative or category master PDF
        let repFile = familyTdsFileMap.get(item.product_family) || '';
        
        if (!repFile) {
            const nameLower = (item.material_name || '').toLowerCase();
            const typeLower = (item.type || '').toLowerCase();
            if (nameLower.includes('oleoresin') || typeLower.includes('oleoresin')) {
                repFile = 'Oleoresins (TDS)s.pdf';
            } else if (nameLower.includes('oil') || typeLower.includes('essential oil')) {
                repFile = 'Essential Oils (TDS)s.pdf';
            } else if (nameLower.includes('annatto') || nameLower.includes('curcumin') || nameLower.includes('chlorophyll') || nameLower.includes('carmine') || nameLower.includes('lutein') || nameLower.includes('color')) {
                repFile = 'Natural Colors (TDS)s.pdf';
            } else if (nameLower.includes('blend') || typeLower.includes('spice blend')) {
                repFile = 'Liquid Spice Blends (TDS)s.pdf';
            } else {
                repFile = 'Bio Ingredints Portfolio B2B.PDF';
            }
        }

        // Leave variant-specific fields blank as instructed:
        // "leave the data that will be diffirents fields blank"
        return {
            ...item,
            filename: repFile, // Link to representative / master catalog PDF
            concentration: '', // Blank: specific to grade
            dosage: '',        // Blank: specific to grade
            recommendation: `[Catalog TDS Reference Linked]: ${repFile} | Note: Grade-specific active concentration & dosage left blank pending Supplier CoA.`
        };
    });

    writeCSV(resolvedCsvPath, updatedCatalogForSite, mHeaders);
    writeCSV(dbCsvPath, updatedCatalogForSite, mHeaders);
    console.log(`Updated website resolved catalog with representative TDS links and blank variant fields.`);

    // Update master workbook with consolidated sheet
    try {
        const wbMaster = new ExcelJS.Workbook();
        await wbMaster.xlsx.readFile(masterExcelPath);

        const existingCons = wbMaster.getWorksheet('🚨 Consolidated_R&D_Request');
        if (existingCons) wbMaster.removeWorksheet(existingCons.id);

        const wsMCons = wbMaster.addWorksheet('🚨 Consolidated_R&D_Request', {
            views: [{ state: 'frozen', xSplit: 2, ySplit: 2 }]
        });

        wsMCons.mergeCells('B2:J2');
        const mCTitle = wsMCons.getCell('B2');
        mCTitle.value = `AWA R&D SECTOR — CONSOLIDATED TDS REQUEST QUEUE (${consolidatedRequests.length} DISTINCT PRODUCT FAMILIES — ZERO REPEATS)`;
        mCTitle.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
        mCTitle.alignment = { vertical: 'middle', horizontal: 'center' };
        mCTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF991B1B' } };
        wsMCons.getRow(2).height = 32;

        wsMCons.addRow([]);
        const mCHeaderRow = wsMCons.addRow([
            'Request ID',
            'Base Ingredient / Product Family',
            'Has Variants',
            'Variant Count',
            'Specific Commercial Codes & Grades Included',
            'Level 1: Industry',
            'Level 2: Category',
            'Level 3: Application',
            'Required Laboratory Parameters & CoA Specifications',
            'Action Required'
        ]);
        mCHeaderRow.height = 28;
        mCHeaderRow.eachCell((cell, colNum) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Segoe UI' };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: colNum === 4 ? { argb: 'FFDC2626' } : { argb: 'FF0F172A' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        });

        consolidatedRequests.forEach((rec, idx) => {
            const row = wsMCons.addRow([
                rec.family_id,
                rec.product_family,
                rec.has_variants,
                rec.variant_count,
                rec.commercial_codes_included,
                rec.industry_level_1,
                rec.category_level_2,
                rec.application_level_3,
                rec.required_lab_parameters,
                rec.action_required
            ]);
            row.height = 30;
            const isEven = idx % 2 === 0;
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF0F172A' } };
                cell.alignment = { vertical: 'top', horizontal: [1, 3, 4].includes(colNumber) ? 'center' : 'left', wrapText: true };
                if (!isEven) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                if (colNumber === 2) cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF991B1B' } };
                if (colNumber === 4) cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFB91C1C' } };
            });
        });

        wsMCons.columns = [
            { width: 14 }, { width: 34 }, { width: 14 }, { width: 14 }, { width: 55 },
            { width: 25 }, { width: 28 }, { width: 35 }, { width: 65 }, { width: 35 }
        ];
        wsMCons.autoFilter = { from: { row: 4, column: 1 }, to: { row: consolidatedRequests.length + 4, column: 10 } };

        await wbMaster.xlsx.writeFile(masterExcelPath);
        console.log(`Updated master workbook: ${masterExcelPath}`);
    } catch(e) {
        console.log('Master workbook locked by Excel. Standalone workbook ready.');
    }

    try {
        await wbCons.xlsx.writeFile(dataPath);
        console.log(`Updated TDS_Data.xlsx`);
    } catch(e) {}
}

buildConsolidatedRdRequestAndResolveMissing().catch(console.error);
