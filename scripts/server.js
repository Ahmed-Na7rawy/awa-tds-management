const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

const rootDir = path.resolve(__dirname, '..');
const frontendDir = path.join(rootDir, 'frontend');
const documentsDir = path.join(rootDir, 'documents');
const rdDir = 'C:/Users/mayar/OneDrive/Documents/R&D';
const resolvedCsvPath = path.join(rootDir, 'database', 'TDS_resolved.csv');
const proposalPdfPath = path.join(rootDir, 'database', 'AWA_TDS_Taxonomy_and_Audit_Proposal.pdf');

app.use(express.json());
app.use(express.static(frontendDir));

// CSV parser
function parseCSV(filePath) {
    if (!fs.existsSync(filePath)) return [];
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
    if (rows.length === 0) return [];
    const headers = rows[0];
    return rows.slice(1).map(r => {
        const obj = {};
        headers.forEach((h, idx) => {
            obj[h] = r[idx] || '';
        });
        return obj;
    });
}

function loadDocuments() {
    return parseCSV(resolvedCsvPath);
}

// Recursive document file cache across documents/ and R&D directories
let docPathCache = {};
function refreshDocPathCache() {
    const cache = {};
    function scanDir(dir) {
        if (!fs.existsSync(dir)) return;
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    scanDir(full);
                } else {
                    const key = entry.name.toLowerCase().trim();
                    cache[key] = full;
                    // Also cache clean key without special characters
                    const cleanKey = key.replace(/[^a-z0-9.]/g, '');
                    cache[cleanKey] = full;
                }
            }
        } catch(e) {}
    }
    scanDir(documentsDir);
    scanDir(rdDir);
    docPathCache = cache;
}
refreshDocPathCache();

// Intelligent document resolver
function getDocFilePath(filename, matName) {
    if (!filename && !matName) return null;
    refreshDocPathCache();

    if (filename) {
        const fn = filename.toLowerCase().trim();
        if (docPathCache[fn] && fs.existsSync(docPathCache[fn])) return docPathCache[fn];

        const cleanFn = fn.replace(/[^a-z0-9.]/g, '');
        if (docPathCache[cleanFn] && fs.existsSync(docPathCache[cleanFn])) return docPathCache[cleanFn];

        // Match with .pdf appended
        if (!fn.endsWith('.pdf')) {
            if (docPathCache[fn + '.pdf'] && fs.existsSync(docPathCache[fn + '.pdf'])) return docPathCache[fn + '.pdf'];
        }
    }

    if (matName) {
        const mn = matName.toLowerCase().trim();
        if (docPathCache[mn + '.pdf'] && fs.existsSync(docPathCache[mn + '.pdf'])) return docPathCache[mn + '.pdf'];
        const cleanMn = mn.replace(/[^a-z0-9.]/g, '');
        if (docPathCache[cleanMn + '.pdf'] && fs.existsSync(docPathCache[cleanMn + '.pdf'])) return docPathCache[cleanMn + '.pdf'];

        // Check for partial matches
        for (const [k, fullPath] of Object.entries(docPathCache)) {
            if (k.endsWith('.pdf')) {
                const base = k.replace('.pdf', '');
                if (mn.includes(base) || base.includes(mn)) {
                    return fullPath;
                }
            }
        }
    }

    return null;
}

// In-memory versions store
const versionsStore = new Map();

// API: Download Proposal PDF
app.get('/api/download-proposal', (req, res) => {
    if (fs.existsSync(proposalPdfPath)) {
        res.download(proposalPdfPath, 'AWA_TDS_Taxonomy_and_Audit_Proposal.pdf');
    } else {
        res.status(404).send('Proposal PDF not found');
    }
});

// API: Get all documents with filters
app.get('/api/documents', (req, res) => {
    let docs = loadDocuments();

    const search = (req.query.search || '').trim().toLowerCase();
    const industry = (req.query.industry || req.query.category || '').trim();
    const category = (req.query.category_level_2 || req.query.subcategory || '').trim();
    const company = (req.query.company || '').trim();
    const brand = (req.query.brand || '').trim();
    const tdsStatus = (req.query.tds_status || req.query.tds_found || '').trim();
    const validationStatus = (req.query.validation_status || '').trim();

    if (search) {
        docs = docs.filter(d => {
            return (
                (d.material_name && d.material_name.toLowerCase().includes(search)) ||
                (d.filename && d.filename.toLowerCase().includes(search)) ||
                (d.industry_level_1 && d.industry_level_1.toLowerCase().includes(search)) ||
                (d.category_level_2 && d.category_level_2.toLowerCase().includes(search)) ||
                (d.application_level_3 && d.application_level_3.toLowerCase().includes(search)) ||
                (d.application_function_details && d.application_function_details.toLowerCase().includes(search)) ||
                (d.ingredients && d.ingredients.toLowerCase().includes(search)) ||
                (d.brand && d.brand.toLowerCase().includes(search)) ||
                (d.type && d.type.toLowerCase().includes(search))
            );
        });
    }

    if (industry) {
        docs = docs.filter(d => d.industry_level_1 && d.industry_level_1.toLowerCase().includes(industry.toLowerCase()));
    }
    if (category) {
        docs = docs.filter(d => d.category_level_2 && d.category_level_2.toLowerCase().includes(category.toLowerCase()));
    }
    if (company) {
        docs = docs.filter(d => d.company === company);
    }
    if (brand) {
        docs = docs.filter(d => d.brand === brand);
    }
    if (tdsStatus) {
        docs = docs.filter(d => d.tds_found === tdsStatus);
    }
    if (validationStatus) {
        docs = docs.filter(d => d.validation_status === validationStatus);
    }

    const allDocs = loadDocuments();
    const industries = [...new Set(allDocs.map(d => d.industry_level_1).filter(Boolean))].sort();
    const categories = [...new Set(allDocs.map(d => d.category_level_2).filter(Boolean))].sort();
    const companies = [...new Set(allDocs.map(d => d.company).filter(Boolean))].sort();
    const brands = [...new Set(allDocs.map(d => d.brand).filter(Boolean))].sort();
    const tdsStatuses = ['Yes', 'No, but copied variant', 'Not found for any variants', "No, and doesn't have variants"];
    const validationStatuses = ['R&D Validated', 'Analyst Proposed'];

    res.json({
        documents: docs,
        filters: {
            industries,
            categories,
            companies,
            brands,
            tds_statuses: tdsStatuses,
            validation_statuses: validationStatuses
        }
    });
});

// API: Get document versions
app.get('/api/documents/:id/versions', (req, res) => {
    const docId = String(req.params.id);
    const versions = versionsStore.get(docId) || [];
    res.json({ versions });
});

// API: Update document
app.put('/api/documents/:id', (req, res) => {
    const docId = String(req.params.id);
    const data = req.body || {};
    const docs = loadDocuments();
    const idx = docs.findIndex(d => String(d.id) === docId);

    if (idx === -1) {
        return res.status(404).json({ error: 'Document not found' });
    }

    const oldDoc = docs[idx];
    const updatedDoc = { ...oldDoc, ...data };
    docs[idx] = updatedDoc;

    const currVersions = versionsStore.get(docId) || [];
    const nextVer = currVersions.length + 1;
    currVersions.unshift({
        id: nextVer,
        document_id: docId,
        version_number: nextVer,
        edited_at: new Date().toISOString(),
        edited_by: data.edited_by || 'R&D Auditor',
        change_summary: 'Audited & updated in web UI',
        snapshot_json: JSON.stringify(updatedDoc)
    });
    versionsStore.set(docId, currVersions);

    res.json({ success: true, document: updatedDoc });
});

// Serve document files with intelligent lookup
app.use('/documents', (req, res) => {
    const rawReq = decodeURIComponent(req.path.replace(/^\//, ''));
    const filepath = getDocFilePath(rawReq, req.query.mat || rawReq);
    if (!filepath || !fs.existsSync(filepath)) {
        return res.status(404).send('Document file not found: ' + rawReq);
    }
    res.sendFile(filepath);
});

// API: pdf-info
app.get('/api/pdf-info', (req, res) => {
    let filename = req.query.filename || req.query.file;
    let matName = req.query.mat || '';
    if (!filename && req.query.doc_id) {
        const docs = loadDocuments();
        const found = docs.find(d => String(d.id) === String(req.query.doc_id));
        if (found) {
            filename = found.filename;
            matName = found.material_name;
        }
    }

    const filepath = getDocFilePath(filename, matName);
    if (!filepath || !fs.existsSync(filepath)) {
        return res.status(404).json({ error: 'TDS File not found on disk. Please upload document to R&D folder.' });
    }

    const baseName = path.basename(filepath);
    const fl = baseName.toLowerCase();
    if (fl.endsWith('.jpg') || fl.endsWith('.png') || fl.endsWith('.jpeg')) {
        return res.json({ is_pdf: false, page_count: 1, url: `/documents/${encodeURIComponent(baseName)}` });
    }
    res.json({ is_pdf: true, page_count: 1, url: `/documents/${encodeURIComponent(baseName)}` });
});

// Fallback to index.html
app.use((req, res) => {
    const p = path.join(frontendDir, req.path);
    if (fs.existsSync(p) && !fs.statSync(p).isDirectory()) {
        return res.sendFile(p);
    }
    res.sendFile(path.join(frontendDir, 'index.html'));
});

app.listen(PORT, '127.0.0.1', () => {
    console.log(`====================================================`);
    console.log(`  AWA TDS Management Website is Live!`);
    console.log(`  URL: http://localhost:${PORT}`);
    console.log(`====================================================`);
});
