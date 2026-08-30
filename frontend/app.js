document.addEventListener("DOMContentLoaded", () => {
    // State management
    let state = {
        documents: [],
        allDocuments: [],
        filters: {
            companies: [],
            brands: [],
            categories: [],
            subcategories: [],
            tag_categories: []
        },
        selectedDocId: null,
        activeTab: "explorer-tab"
    };

    // DOM Elements
    const searchInput = document.getElementById("search-input");
    const companyFilter = document.getElementById("company-filter");
    const brandFilter = document.getElementById("brand-filter");
    const categoryFilter = document.getElementById("category-filter");
    const subcatFilter = document.getElementById("subcat-filter");
    const tagcatFilter = document.getElementById("tagcat-filter");
    const resetFiltersBtn = document.getElementById("reset-filters");
    
    const productsTbody = document.getElementById("products-tbody");
    const resultsCount = document.getElementById("results-count");
    
    const detailsCard = document.getElementById("details-card");
    const detailsView = document.getElementById("details-view");
    const detailsEmpty = document.querySelector(".details-empty");
    
    const tabButtons = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");
    const diagramContainer = document.getElementById("diagram-container");
    
    // Modal Elements
    const previewModal = document.getElementById("preview-modal");
    const modalFilename = document.getElementById("modal-filename");
    const closeModalBtn = document.getElementById("close-modal-btn");
    const previewContainer = document.getElementById("preview-container");

    // Initialize application
    init();

    function init() {
        setupTabs();
        setupFilters();
        setupModal();
        fetchData();
        fetchSchema();
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

    // Tab switcher
    function setupTabs() {
        tabButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                const tabId = btn.getAttribute("data-tab");
                if (!tabId) return;
                
                tabButtons.forEach(b => b.classList.remove("active"));
                tabContents.forEach(c => c.classList.remove("active"));
                
                const tabTarget = document.getElementById(tabId);
                if (tabTarget) {
                    btn.classList.add("active");
                    tabTarget.classList.add("active");
                }
                
                state.activeTab = tabId;
                
                if (tabId === "schema-tab") {
                    setTimeout(renderSchemaDiagram, 50);
                }
            });
        });
    }

    // Filter event listeners
    function setupFilters() {
        const triggerSearch = debounce(() => {
            applyFilters();
        }, 300);

        if (searchInput) searchInput.addEventListener("input", triggerSearch);
        if (companyFilter) companyFilter.addEventListener("change", applyFilters);
        if (brandFilter) brandFilter.addEventListener("change", applyFilters);
        if (categoryFilter) categoryFilter.addEventListener("change", applyFilters);
        if (subcatFilter) subcatFilter.addEventListener("change", applyFilters);
        if (tagcatFilter) tagcatFilter.addEventListener("change", applyFilters);
        
        if (resetFiltersBtn) {
            resetFiltersBtn.addEventListener("click", () => {
                if (searchInput) searchInput.value = "";
                if (companyFilter) companyFilter.value = "";
                if (brandFilter) brandFilter.value = "";
                if (categoryFilter) categoryFilter.value = "";
                if (subcatFilter) subcatFilter.value = "";
                if (tagcatFilter) tagcatFilter.value = "";
                applyFilters();
            });
        }
    }

    // Fetch catalog list from static data.json (or API fallback)
    function fetchData() {
        fetch("data.json")
            .then(res => {
                if (!res.ok) throw new Error("static data.json not found");
                return res.json();
            })
            .then(data => {
                state.allDocuments = data.documents || [];
                state.filters = data.filters || {};
                updateDropdownOptions(state.filters);
                applyFilters();
            })
            .catch(err => {
                console.warn("Falling back to /api/documents:", err);
                fetch(`/api/documents`)
                    .then(res => res.json())
                    .then(data => {
                        state.allDocuments = data.documents || [];
                        state.filters = data.filters || {};
                        updateDropdownOptions(state.filters);
                        applyFilters();
                    })
                    .catch(e => console.error("Error fetching documents:", e));
            });
    }

    // Client-side filtering logic for instant responsive experience
    function applyFilters() {
        const search = (searchInput ? searchInput.value : "").trim().toLowerCase();
        const company = companyFilter ? companyFilter.value : "";
        const brand = brandFilter ? brandFilter.value : "";
        const category = categoryFilter ? categoryFilter.value : "";
        const subcategory = subcatFilter ? subcatFilter.value : "";
        const tagCategory = tagcatFilter ? tagcatFilter.value : "";

        state.documents = state.allDocuments.filter(doc => {
            if (search) {
                const matchSearch = 
                    (doc.filename && doc.filename.toLowerCase().includes(search)) ||
                    (doc.type && doc.type.toLowerCase().includes(search)) ||
                    (doc.ingredients && doc.ingredients.toLowerCase().includes(search)) ||
                    (doc.application && doc.application.toLowerCase().includes(search)) ||
                    (doc.brand && doc.brand.toLowerCase().includes(search)) ||
                    (doc.company && doc.company.toLowerCase().includes(search));
                if (!matchSearch) return false;
            }

            if (company && doc.company !== company) return false;
            if (brand && doc.brand !== brand) return false;

            if (category) {
                const catStr = doc.applications_category || "";
                if (!catStr.includes(category)) return false;
            }

            if (subcategory) {
                const subStr = doc.applications_subcategory || "";
                if (!subStr.includes(subcategory)) return false;
            }

            if (tagCategory) {
                const tagStr = doc.applications_tag || "";
                if (!tagStr.includes(tagCategory)) return false;
            }

            return true;
        });

        renderProductsTable();
    }

    // Populate drop downs dynamically
    function updateDropdownOptions(filters) {
        if (companyFilter) updateSelect(companyFilter, filters.companies || [], "All Companies");
        if (brandFilter) updateSelect(brandFilter, filters.brands || [], "All Brands");
        if (categoryFilter) updateSelect(categoryFilter, filters.categories || [], "All Categories");
        if (subcatFilter) updateSelect(subcatFilter, filters.subcategories || [], "All Subcategories");
        if (tagcatFilter) updateSelect(tagcatFilter, filters.tag_categories || [], "All Groups");
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

    function getBrandBadge(brand) {
        if (!brand) return '<span class="tag-badge" style="opacity:0.5;">N/A</span>';
        let style = "background: rgba(255, 255, 255, 0.05); color: var(--text-secondary); border-color: rgba(255,255,255,0.1);";
        const b = brand.trim();
        if (b === "AWA Bio") {
            style = "background: rgba(0, 245, 212, 0.12); color: #00f5d4; border-color: rgba(0, 245, 212, 0.35);";
        } else if (b === "AWA Food Solutions") {
            style = "background: rgba(56, 189, 248, 0.12); color: #38bdf8; border-color: rgba(56, 189, 248, 0.35);";
        } else if (b === "AWA Food Additives") {
            style = "background: rgba(251, 191, 36, 0.12); color: #fbbf24; border-color: rgba(251, 191, 36, 0.35);";
        } else if (b === "Turkphos") {
            style = "background: rgba(192, 132, 252, 0.12); color: #c084fc; border-color: rgba(192, 132, 252, 0.35);";
        } else if (b === "Ingreva") {
            style = "background: rgba(251, 113, 133, 0.12); color: #fb7185; border-color: rgba(251, 113, 133, 0.35);";
        } else if (b === "Textra") {
            style = "background: rgba(129, 140, 248, 0.12); color: #818cf8; border-color: rgba(129, 140, 248, 0.35);";
        } else if (b.includes("Pelhřimov") || b.includes("Škrobárny")) {
            style = "background: rgba(45, 212, 191, 0.12); color: #2dd4bf; border-color: rgba(45, 212, 191, 0.35);";
        }
        return `<span class="tag-badge" style="${style}">${brand}</span>`;
    }

    // Render list table
    function renderProductsTable() {
        productsTbody.innerHTML = "";
        resultsCount.textContent = `${state.documents.length} items`;

        if (state.documents.length === 0) {
            productsTbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-secondary); padding: 30px;">No products match your filters.</td></tr>`;
            return;
        }

        state.documents.forEach(doc => {
            const tr = document.createElement("tr");
            tr.setAttribute("data-id", doc.id);
            if (state.selectedDocId === doc.id) {
                tr.classList.add("selected-row");
            }

            const appLabel = doc.applications_subcategory ? doc.applications_subcategory : doc.application;

            let auditBadge = '<span class="tag-badge" style="opacity:0.5;">N/A</span>';
            if (doc.audit === 'Yes') {
                auditBadge = '<span class="tag-badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border-color: rgba(16, 185, 129, 0.3);">Yes</span>';
            } else if (doc.audit === 'No') {
                auditBadge = '<span class="tag-badge" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border-color: rgba(239, 68, 68, 0.3);">No</span>';
            }

            tr.innerHTML = `
                <td><strong>${doc.id}</strong></td>
                <td><a href="#" class="filename-link" style="color: var(--accent); font-weight: 500; text-decoration: underline;">${doc.filename}</a></td>
                <td style="white-space: nowrap;">${doc.company || 'Unknown'}</td>
                <td>${getBrandBadge(doc.brand)}</td>
                <td class="meta-txt" style="white-space: nowrap;">${appLabel || 'N/A'}</td>
                <td><span class="tag-badge">${doc.type || 'N/A'}</span></td>
                <td>${auditBadge}</td>
                <td class="meta-txt" style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${doc.recommendation || 'N/A'}</td>
            `;

            tr.addEventListener("click", (e) => {
                document.querySelectorAll("#products-table tr").forEach(r => r.classList.remove("selected-row"));
                tr.classList.add("selected-row");
                state.selectedDocId = doc.id;
                showProductDetails(doc);
                
                if (e.target.classList.contains("filename-link")) {
                    e.preventDefault();
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

    // Render side card details
    function showProductDetails(doc) {
        detailsEmpty.classList.add("hidden");
        detailsView.classList.remove("hidden");

        const categoryBadges = doc.applications_category 
            ? doc.applications_category.split("; ").map(c => `<span class="tag-cat-badge">${c}</span>`).join("")
            : "";
        const subcategoryBadges = doc.applications_subcategory 
            ? doc.applications_subcategory.split("; ").map(s => `<span class="tag-badge">${s}</span>`).join("")
            : "";
        const tagBadges = doc.applications_tag 
            ? doc.applications_tag.split("; ").map(t => `<span class="tag-badge tag-group">${t}</span>`).join("")
            : "";

        let auditBadgeHtml = '<span class="tag-badge" style="opacity:0.6;">Not Audited</span>';
        if (doc.audit === 'Yes') {
            auditBadgeHtml = '<span class="tag-badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border-color: rgba(16, 185, 129, 0.3);">Verified & Audited</span>';
        } else if (doc.audit === 'No') {
            auditBadgeHtml = '<span class="tag-badge" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border-color: rgba(239, 68, 68, 0.3);">Audit Pending</span>';
        }

        const pdfPath = `documents/${encodeURIComponent(doc.filename)}`;

        detailsView.innerHTML = `
            <div class="details-header">
                <div class="title-with-badge">
                    <h3>${doc.filename}</h3>
                    <div style="display: flex; gap: 6px; align-items: center; margin-top: 6px;">
                        ${getBrandBadge(doc.brand)}
                        ${auditBadgeHtml}
                    </div>
                </div>
            </div>

            <div class="details-body">
                <div class="spec-grid">
                    <div class="spec-item">
                        <span class="spec-label">Company</span>
                        <span class="spec-value">${doc.company || 'N/A'}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Product Type</span>
                        <span class="spec-value">${doc.type || 'N/A'}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Shelf Life</span>
                        <span class="spec-value">${doc.shelf_life || 'N/A'}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Appearance</span>
                        <span class="spec-value">${doc.appearance || 'N/A'}</span>
                    </div>
                </div>

                ${doc.recommendation ? `
                <div class="detail-section" style="background: rgba(0, 245, 212, 0.05); border-left: 3px solid var(--accent); padding: 12px; border-radius: 4px; margin-bottom: 20px;">
                    <h4 style="color: var(--accent); font-size: 13px; margin-bottom: 4px;">💡 Technical Recommendation</h4>
                    <p style="font-size: 13px; color: var(--text-primary); line-height: 1.5;">${doc.recommendation}</p>
                </div>
                ` : ''}

                <div class="detail-section">
                    <h4>Application & Category Mappings</h4>
                    <div class="tags-container">
                        ${categoryBadges || '<span class="meta-txt">No mapped categories</span>'}
                        ${subcategoryBadges}
                        ${tagBadges}
                    </div>
                </div>

                <div class="detail-section">
                    <h4>Ingredients</h4>
                    <p class="desc-text">${doc.ingredients || 'No ingredients information specified.'}</p>
                </div>

                <div class="detail-section">
                    <h4>Packaging</h4>
                    <p class="desc-text">${doc.packaging || 'N/A'}</p>
                </div>

                <div class="detail-section">
                    <h4>Storage Conditions</h4>
                    <p class="desc-text">${doc.storage_conditions || 'N/A'}</p>
                </div>

                <div class="detail-actions" style="display: flex; gap: 10px; margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border-color);">
                    <a href="${pdfPath}" target="_blank" class="primary-btn" style="flex: 1; text-align: center; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 8px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        Open PDF Document
                    </a>
                </div>
            </div>
        `;
    }

    // Open PDF Preview modal
    function openPreviewModal(doc) {
        modalFilename.textContent = doc.filename;
        previewContainer.innerHTML = "";
        previewModal.classList.remove("hidden");
        
        const docPath = `documents/${encodeURIComponent(doc.filename)}`;
        const fnLower = doc.filename.toLowerCase();
        
        if (fnLower.endsWith(".jpg") || fnLower.endsWith(".jpeg") || fnLower.endsWith(".png") || fnLower.endsWith(".gif")) {
            previewContainer.innerHTML = `<img src="${docPath}" alt="${doc.filename}" style="max-width:100%; border-radius: 8px;">`;
        } else {
            previewContainer.innerHTML = `
                <iframe src="${docPath}" style="width: 100%; height: 80vh; border: none; border-radius: 8px;" title="${doc.filename}">
                    <p>Your browser does not support inline PDFs. <a href="${docPath}" target="_blank">Click here to download PDF</a></p>
                </iframe>
            `;
        }
    }

    function hideProductDetails() {
        detailsEmpty.classList.remove("hidden");
        detailsView.classList.add("hidden");
        state.selectedDocId = null;
    }

    // Fetch Schema definitions for ER relationship mapping
    let schemaData = null;
    function fetchSchema() {
        // Default schema structure for static mode
        schemaData = {
            schema: {
                tds_documents: [
                    { name: "id", type: "INTEGER" },
                    { name: "filename", type: "TEXT" },
                    { name: "company", type: "TEXT" },
                    { name: "brand", type: "TEXT" },
                    { name: "type", type: "TEXT" },
                    { name: "shelf_life", type: "TEXT" },
                    { name: "appearance", type: "TEXT" },
                    { name: "ingredients", type: "TEXT" },
                    { name: "packaging", type: "TEXT" },
                    { name: "storage_conditions", type: "TEXT" },
                    { name: "audit", type: "TEXT" },
                    { name: "recommendation", type: "TEXT" }
                ],
                tds_applications: [
                    { name: "id", type: "INTEGER" },
                    { name: "document_id", type: "INTEGER" },
                    { name: "category", type: "TEXT" },
                    { name: "subcategory", type: "TEXT" },
                    { name: "tag_category", type: "TEXT" }
                ]
            }
        };
        renderSchemaDiagram();
    }

    // Render interactive Database ER schema diagram
    function renderSchemaDiagram() {
        if (!schemaData || state.activeTab !== "schema-tab" || !diagramContainer) return;
        
        diagramContainer.innerHTML = "";

        const docCard = document.createElement("div");
        docCard.className = "db-table-card active-table";
        docCard.id = "table-docs";
        
        let docColsHtml = "";
        schemaData.schema.tds_documents.forEach(c => {
            const isPk = c.name === "id";
            const pkClass = isPk ? "key-col" : "";
            const pkIndicator = isPk ? "🔑" : "";
            docColsHtml += `
                <div class="db-col-row" id="doc-col-${c.name}">
                    <span class="col-name ${pkClass}">${pkIndicator} ${c.name}</span>
                    <span class="col-type">${c.type}</span>
                </div>
            `;
        });
        
        docCard.innerHTML = `
            <div class="db-table-header docs">
                <span>📁 tds_documents</span>
            </div>
            <div class="db-table-columns">
                ${docColsHtml}
            </div>
        `;

        const appCard = document.createElement("div");
        appCard.className = "db-table-card active-table";
        appCard.id = "table-apps";
        
        let appColsHtml = "";
        schemaData.schema.tds_applications.forEach(c => {
            const isPk = c.name === "id";
            const isFk = c.name === "document_id";
            const colClass = isPk ? "key-col" : (isFk ? "fk-col" : "");
            const indicator = isPk ? "🔑" : (isFk ? "🔗" : "");
            appColsHtml += `
                <div class="db-col-row" id="app-col-${c.name}">
                    <span class="col-name ${colClass}">${indicator} ${c.name}</span>
                    <span class="col-type">${c.type}</span>
                </div>
            `;
        });
        
        appCard.innerHTML = `
            <div class="db-table-header apps">
                <span>🔗 tds_applications</span>
            </div>
            <div class="db-table-columns">
                ${appColsHtml}
            </div>
        `;

        diagramContainer.appendChild(docCard);
        diagramContainer.appendChild(appCard);

        setTimeout(() => {
            const docsColRow = document.getElementById("doc-col-id");
            const appsColRow = document.getElementById("app-col-document_id");
            
            if (docsColRow && appsColRow) {
                const canvasRect = diagramContainer.getBoundingClientRect();
                const startRect = docsColRow.getBoundingClientRect();
                const endRect = appsColRow.getBoundingClientRect();
                
                const startX = (startRect.right - canvasRect.left);
                const startY = (startRect.top + startRect.height / 2 - canvasRect.top);
                
                const endX = (endRect.left - canvasRect.left);
                const endY = (endRect.top + endRect.height / 2 - canvasRect.top);
                
                const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                svg.setAttribute("class", "connector-svg");
                
                const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                path.setAttribute("class", "connector-path");
                
                const ctrlX1 = startX + 50;
                const ctrlY1 = startY;
                const ctrlX2 = endX - 50;
                const ctrlY2 = endY;
                
                const d = `M ${startX} ${startY} C ${ctrlX1} ${ctrlY1}, ${ctrlX2} ${ctrlY2}, ${endX} ${endY}`;
                path.setAttribute("d", d);
                
                svg.appendChild(path);
                diagramContainer.appendChild(svg);
            }
        }, 100);
    }

    // Debounce helper
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
});
