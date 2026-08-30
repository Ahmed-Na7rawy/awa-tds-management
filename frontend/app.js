document.addEventListener("DOMContentLoaded", () => {
    let state = {
        documents: [],
        filters: {
            industries: [],
            categories: [],
            companies: [],
            brands: [],
            tds_statuses: [],
            validation_statuses: []
        },
        selectedDocId: null
    };

    const searchInput = document.getElementById("search-input");
    const industryFilter = document.getElementById("industry-filter");
    const categoryFilter = document.getElementById("category-filter");
    const tdsFilter = document.getElementById("tds-filter");
    const validationFilter = document.getElementById("validation-filter");
    const companyFilter = document.getElementById("company-filter");
    const brandFilter = document.getElementById("brand-filter");
    const resetFiltersBtn = document.getElementById("reset-filters");
    
    const productsTbody = document.getElementById("products-tbody");
    const resultsCount = document.getElementById("results-count");
    
    const detailsView = document.getElementById("details-view");
    const detailsEmpty = document.querySelector(".details-empty");
    
    // Modal Elements
    const previewModal = document.getElementById("preview-modal");
    const modalFilename = document.getElementById("modal-filename");
    const closeModalBtn = document.getElementById("close-modal-btn");
    const previewContainer = document.getElementById("preview-container");

    init();

    function init() {
        setupFilters();
        setupModal();
        fetchData();
    }

    function setupModal() {
        if (closeModalBtn) {
            closeModalBtn.addEventListener("click", () => {
                previewModal.classList.add("hidden");
                previewContainer.innerHTML = "";
            });
        }
        if (previewModal) {
            previewModal.addEventListener("click", (e) => {
                if (e.target === previewModal) {
                    previewModal.classList.add("hidden");
                    previewContainer.innerHTML = "";
                }
            });
        }
    }

    function setupFilters() {
        const triggerSearch = debounce(() => {
            fetchData();
        }, 250);

        searchInput.addEventListener("input", triggerSearch);
        industryFilter.addEventListener("change", fetchData);
        categoryFilter.addEventListener("change", fetchData);
        tdsFilter.addEventListener("change", fetchData);
        validationFilter.addEventListener("change", fetchData);
        companyFilter.addEventListener("change", fetchData);
        brandFilter.addEventListener("change", fetchData);
        
        resetFiltersBtn.addEventListener("click", () => {
            searchInput.value = "";
            industryFilter.value = "";
            categoryFilter.value = "";
            tdsFilter.value = "";
            validationFilter.value = "";
            companyFilter.value = "";
            brandFilter.value = "";
            fetchData();
        });
    }

    function fetchData() {
        const queryParams = new URLSearchParams({
            search: searchInput.value,
            industry: industryFilter.value,
            category_level_2: categoryFilter.value,
            tds_status: tdsFilter.value,
            validation_status: validationFilter.value,
            company: companyFilter.value,
            brand: brandFilter.value
        });

        fetch(`/api/documents?${queryParams}`)
            .then(res => res.json())
            .then(data => {
                state.documents = data.documents;
                if (data.filters) {
                    updateDropdownOptions(data.filters);
                }
                renderProductsTable();
            })
            .catch(err => console.error("Error fetching documents:", err));
    }

    function updateDropdownOptions(filters) {
        updateSelect(industryFilter, filters.industries || [], "All Industries");
        updateSelect(categoryFilter, filters.categories || [], "All Categories");
        updateSelect(tdsFilter, filters.tds_statuses || [], "All TDS Statuses");
        updateSelect(validationFilter, filters.validation_statuses || [], "All Validations");
        updateSelect(companyFilter, filters.companies || [], "All Companies");
        updateSelect(brandFilter, filters.brands || [], "All Brands");
    }

    function updateSelect(selectEl, list, defaultLabel) {
        const val = selectEl.value;
        selectEl.innerHTML = `<option value="">${defaultLabel}</option>`;
        list.forEach(item => {
            if (item) {
                const opt = document.createElement("option");
                opt.value = item;
                opt.textContent = item;
                if (item === val) opt.selected = true;
                selectEl.appendChild(opt);
            }
        });
    }

    function getTdsStatusBadge(status) {
        if (status === 'Yes') {
            return '<span class="badge-yes">Direct TDS</span>';
        } else if (status === 'No, but copied variant') {
            return '<span class="badge-copied">Copied Variant</span>';
        } else {
            return '<span class="badge-missing">Missing TDS</span>';
        }
    }

    function getValidationBadge(status) {
        if (status === 'R&D Validated') {
            return '<span class="badge-validated">R&D Validated</span>';
        } else {
            return '<span class="badge-proposed">Analyst Proposed</span>';
        }
    }

    function renderProductsTable() {
        productsTbody.innerHTML = "";
        resultsCount.textContent = `${state.documents.length} items`;

        if (state.documents.length === 0) {
            productsTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 30px;">No products match your filters.</td></tr>`;
            return;
        }

        state.documents.forEach(doc => {
            const tr = document.createElement("tr");
            tr.setAttribute("data-id", doc.id);
            if (state.selectedDocId === doc.id) {
                tr.classList.add("selected-row");
            }

            const matName = doc.material_name || doc.filename;
            const l1 = doc.industry_level_1 || 'Unassigned';
            const l3 = doc.application_level_3 || doc.application || 'General Food Formulations';

            tr.innerHTML = `
                <td><strong>${doc.id}</strong></td>
                <td><span style="color: #059669; font-weight: 600;">${matName}</span></td>
                <td><span class="tag-badge" style="background: rgba(67, 56, 202, 0.12); color: #4338ca; border-color: rgba(67, 56, 202, 0.3); font-weight: 600;">${l1}</span></td>
                <td class="meta-txt" style="max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${l3}</td>
                <td>${getTdsStatusBadge(doc.tds_found)}</td>
                <td>${getValidationBadge(doc.validation_status)}</td>
                <td>
                    <button class="primary-btn btn-view-pdf" style="padding: 4px 10px; font-size: 11px;">View TDS</button>
                </td>
            `;

            tr.addEventListener("click", (e) => {
                document.querySelectorAll("#products-table tr").forEach(r => r.classList.remove("selected-row"));
                tr.classList.add("selected-row");
                state.selectedDocId = doc.id;
                showProductDetails(doc);
                
                if (e.target.classList.contains("btn-view-pdf")) {
                    e.preventDefault();
                    e.stopPropagation();
                    openPreviewModal(doc);
                }
            });

            productsTbody.appendChild(tr);
        });

        if (state.selectedDocId) {
            const selectedDoc = state.documents.find(d => d.id === state.selectedDocId);
            if (selectedDoc) {
                showProductDetails(selectedDoc);
            } else {
                hideProductDetails();
            }
        }
    }

    function showProductDetails(doc) {
        detailsEmpty.classList.add("hidden");
        detailsView.classList.remove("hidden");

        const matName = doc.material_name || doc.filename;

        detailsView.innerHTML = `
            <div class="details-title">
                <h2>${matName}</h2>
                <p class="subtitle" style="color: var(--accent); font-weight: 600;">${doc.company || 'AWA Food Solutions'} <span style="color: var(--text-secondary); font-weight: 400;">(${doc.brand || 'No Brand'})</span></p>
                <div style="display: flex; gap: 8px; margin-top: 10px;">
                    <button class="primary-btn" id="btn-preview-file" style="flex: 1;">📄 View TDS Document</button>
                </div>
            </div>
            
            <div class="card-details" style="background: rgba(67, 56, 202, 0.05); border: 1px solid rgba(67, 56, 202, 0.2);">
                <h3 style="color: #4338ca;">🏛️ 3-Level Food Science Taxonomy</h3>
                <p><strong>Level 1 (Industry):</strong> <span style="color: #4338ca; font-weight: 600;">${doc.industry_level_1 || 'Unassigned'}</span></p>
                <p style="margin-top: 4px;"><strong>Level 2 (Category):</strong> ${doc.category_level_2 || 'General Category'}</p>
                <p style="margin-top: 4px;"><strong>Level 3 (Application):</strong> <span style="font-weight: 600;">${doc.application_level_3 || 'General Applications'}</span></p>
                <p style="margin-top: 6px; font-size: 12px; color: #475569; border-top: 1px dashed #cbd5e1; padding-top: 6px;"><strong>Functional Usage:</strong> ${doc.application_function_details || 'Standard food grade processing ingredient.'}</p>
            </div>

            <div class="meta-grid">
                <div class="meta-item">
                    <div class="meta-label">TDS Document</div>
                    <div class="meta-val" style="font-size: 11px;">${doc.filename || 'No Dedicated File'}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Product Family</div>
                    <div class="meta-val" style="font-size: 11px; font-weight: 600;">${doc.product_family || matName}</div>
                </div>
            </div>

            <div class="card-details">
                <h3>Technical Specifications</h3>
                <p><strong>Concentration / Assay:</strong> ${doc.concentration || 'See Laboratory CoA'}</p>
                <p style="margin-top: 4px;"><strong>Recommended Dosage:</strong> ${doc.dosage || 'Application dependent'}</p>
                <p style="margin-top: 4px;"><strong>Shelf Life:</strong> ${doc.shelf_life || '24 months'}</p>
                <p style="margin-top: 4px;"><strong>Appearance:</strong> ${doc.appearance || 'Standard food grade powder / liquid'}</p>
            </div>

            <div class="card-details">
                <h3>Packaging & Storage</h3>
                <p><strong>Packaging:</strong> ${doc.packaging || 'Commercial standard'}</p>
                <p style="margin-top: 4px;"><strong>Storage:</strong> ${doc.storage_conditions || 'Store in cool dry conditions'}</p>
            </div>

            <div class="card-details">
                <h3>Ingredients & Allergens</h3>
                <p><strong>Ingredients:</strong> ${doc.ingredients || 'Food grade ingredients'}</p>
                <p style="margin-top: 4px;"><strong>Allergens:</strong> ${doc.allergens || 'None declared'}</p>
            </div>

            <div class="card-details">
                <h3>Audit & Recommendations</h3>
                <p><strong>Audit Status:</strong> ${doc.audit || 'Pending Review'}</p>
                <p style="margin-top: 4px;"><strong>Validation:</strong> ${getValidationBadge(doc.validation_status)}</p>
                <p style="margin-top: 6px; font-size: 12px; color: #1e40af;"><strong>Action Note:</strong> ${doc.recommendation || 'Verified.'}</p>
            </div>
        `;

        const previewBtn = document.getElementById("btn-preview-file");
        if (previewBtn) {
            previewBtn.addEventListener("click", () => {
                openPreviewModal(doc);
            });
        }
    }

    function openPreviewModal(doc) {
        const matName = doc.material_name || doc.filename;
        modalFilename.textContent = `TDS Document: ${matName}`;
        previewContainer.innerHTML = "<div style='color: var(--accent); font-weight: 500; padding: 40px; text-align: center;'>Loading TDS Document from R&D Directory...</div>";
        previewModal.classList.remove("hidden");
        
        fetch(`/api/pdf-info?doc_id=${doc.id}&mat=${encodeURIComponent(matName)}&file=${encodeURIComponent(doc.filename || '')}`)
            .then(res => res.json())
            .then(info => {
                if (info.error) {
                    previewContainer.innerHTML = `
                        <div style="text-align: center; padding: 40px; color: #64748b;">
                            <div style="font-size: 40px; margin-bottom: 12px;">📁</div>
                            <h3 style="color: #0f172a; margin-bottom: 8px;">Physical TDS File Not Found on Disk</h3>
                            <p style="font-size: 13px; max-width: 500px; margin: 0 auto 16px;">This product (${matName}) requires a dedicated laboratory TDS upload from supplier/R&D records.</p>
                            <span class="badge-missing">Listed in R&D Collection Queue</span>
                        </div>
                    `;
                    return;
                }

                if (info.is_pdf) {
                    previewContainer.innerHTML = `
                        <iframe src="${info.url}" style="width: 100%; height: 100%; border: none;" title="TDS Viewer"></iframe>
                    `;
                } else {
                    previewContainer.innerHTML = `
                        <div style="display: flex; justify-content: center; align-items: center; height: 100%; padding: 20px;">
                            <img src="${info.url}" alt="${matName}" style="max-width: 100%; max-height: 100%; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
                        </div>
                    `;
                }
            })
            .catch(err => {
                console.error("Error loading TDS:", err);
                previewContainer.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #ef4444;">
                        <h3>Error Loading Document</h3>
                        <p>Could not connect to document server.</p>
                    </div>
                `;
            });
    }

    function hideProductDetails() {
        detailsEmpty.classList.remove("hidden");
        detailsView.classList.add("hidden");
        state.selectedDocId = null;
    }

    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
});
