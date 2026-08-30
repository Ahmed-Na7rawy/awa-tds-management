const fs = require('fs');
const path = require('path');

function cleanupOutdatedFiles() {
    const rootDir = path.resolve(__dirname, '..');
    const dbDir = path.join(rootDir, 'database');
    const scriptsDir = path.join(rootDir, 'scripts');

    // 1. Rename AWA_TDS_Taxonomy_Master_v3.xlsx to AWA_TDS_Taxonomy_Master.xlsx for a clean official name
    const v3Path = path.join(dbDir, 'AWA_TDS_Taxonomy_Master_v3.xlsx');
    const officialMasterExcel = path.join(dbDir, 'AWA_TDS_Taxonomy_Master.xlsx');
    if (fs.existsSync(v3Path)) {
        fs.copyFileSync(v3Path, officialMasterExcel);
        try { fs.unlinkSync(v3Path); } catch(e) {}
        console.log(`Created clean official master: ${officialMasterExcel}`);
    }

    // List of obsolete database files to remove
    const dbFilesToDelete = [
        'TDS_Audited_Master.xlsx',
        'TDS_Category_Subcategory_Master.xlsx',
        'TDS_Granular_Applications_Master.xlsx',
        'TDS_Materials_Hierarchy.xlsx',
        'TDS_Materials_Master.xlsx',
        'TDS_Materials_Status.xlsx',
        'TDS_RD_Verification_Master.xlsx',
        'TDS_Summary_and_Pivots.xlsx',
        'TDS_Taxonomy_Normalized_Master.xlsx',
        'RD_TDS_Collection_Request.csv',
        'AWA_Zero_TDS_RD_Request.csv',
        'AWA_Zero_TDS_RD_Request.xlsx',
        'AWA_Complete_Hierarchy_Catalog.pdf',
        'db_inspection.txt',
        'hierarchy_catalog_template.html',
        'hierarchy_summary_template.html',
        'proposal_template.html'
    ];

    dbFilesToDelete.forEach(f => {
        const full = path.join(dbDir, f);
        if (fs.existsSync(full)) {
            try {
                fs.unlinkSync(full);
                console.log(`Deleted obsolete database file: ${f}`);
            } catch(e) {
                console.log(`Could not delete ${f} (may be locked): ${e.message}`);
            }
        }
    });

    // List of obsolete scratch / temporary scripts to remove
    const scriptsToDelete = [
        'dump_175.js',
        'dump_json.js',
        'dump_manager_sheets.js',
        'extracted_bio_products.json',
        'extract_bio_catalog.js',
        'extract_oil_pdfs.py',
        'generate_full_dataset.js',
        'generate_hierarchy_pdf.js',
        'generate_proposal_pdf.js',
        'generate_zero_tds_sheet.js',
        'inspect_reviewed.js',
        'inspect_user_edits.js',
        'list_all_records.js',
        'merge_bio_excel.js',
        'parse_all_bio.js',
        'parse_bio_pdfs.js',
        'parse_user_list.js',
        'reclassify_applications.py',
        'records_full_dump.json',
        'refine_matcher.js',
        'server.py',
        'split_application_columns.js',
        'standardize_applications_field.py',
        'strict_food_science_audit.js',
        'sync_sqlite.js',
        'test_matcher.js',
        'user_materials.txt',
        'all_parsed_bio.json',
        'app_map.json',
        'create_pivot_summary_sheet.js',
        'deep_matcher.js',
        'export_to_excel.js',
        'analyze_data.js',
        'analyze_reviewed.js',
        'apply_rules.js',
        'audit_and_recommendations.js',
        'build_hierarchy.js',
        'add_tds_found.js',
        'implement_taxonomy.js',
        'update_meat_poultry_taxonomy.js',
        'distribute_functional_and_plant_based.js'
    ];

    scriptsToDelete.forEach(f => {
        const full = path.join(scriptsDir, f);
        if (fs.existsSync(full)) {
            try {
                fs.unlinkSync(full);
                console.log(`Deleted obsolete script: ${f}`);
            } catch(e) {}
        }
    });

    console.log('\nCleanup complete! Current clean repository state:');
    fs.readdirSync(dbDir).forEach(f => console.log('  [database]', f));
}

cleanupOutdatedFiles();
