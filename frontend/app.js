document.addEventListener("DOMContentLoaded", () => {
    // State management
    let state = {
        documents: [],
        filters: {
            companies: [],
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
        closeModalBtn.addEventListener("click", () => {
            previewModal.classList.add("hidden");
            previewContainer.innerHTML = "";
        });
        previewModal.addEventListener("click", (e) => {
            if (e.target === previewModal) {
                previewModal.classList.add("hidden");
                previewContainer.innerHTML = "";
            }
        });
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
                    // Re-render SVG connections when the canvas becomes visible
                    setTimeout(renderSchemaDiagram, 50);
                }
            });
        });
    }

    // Filter event listeners
    function setupFilters() {
        const triggerSearch = debounce(() => {
            fetchData();
        }, 300);

        searchInput.addEventListener("input", triggerSearch);
        companyFilter.addEventListener("change", fetchData);
        if (brandFilter) brandFilter.addEventListener("change", fetchData);
        categoryFilter.addEventListener("change", fetchData);
        subcatFilter.addEventListener("change", fetchData);
        tagcatFilter.addEventListener("change", fetchData);
        
        resetFiltersBtn.addEventListener("click", () => {
            searchInput.value = "";
            companyFilter.value = "";
            if (brandFilter) brandFilter.value = "";
            categoryFilter.value = "";
            subcatFilter.value = "";
            tagcatFilter.value = "";
            fetchData();
        });
    }

    // Fetch catalog list from backend API
    function fetchData() {
        const queryParams = new URLSearchParams({
            search: searchInput.value,
            company: companyFilter.value,
            brand: brandFilter ? brandFilter.value : "",
            category: categoryFilter.value,
            subcategory: subcatFilter.value,
            tag_category: tagcatFilter.value
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

    // Populate drop downs dynamically
    function updateDropdownOptions(filters) {
        updateSelect(companyFilter, filters.companies, "All Companies");
        if (brandFilter) updateSelect(brandFilter, filters.brands || [], "All Brands");
        updateSelect(categoryFilter, filters.categories, "All Categories");
        updateSelect(subcatFilter, filters.subcategories, "All Subcategories");
        updateSelect(tagcatFilter, filters.tag_categories, "All Groups");
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

            // Handle clean display of categories
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

            // Click row to show details
            tr.addEventListener("click", (e) => {
                document.querySelectorAll("#products-table tr").forEach(r => r.classList.remove("selected-row"));
                tr.classList.add("selected-row");
                state.selectedDocId = doc.id;
                showProductDetails(doc);
                
                // If user specifically clicked filename link, also open preview modal directly
                if (e.target.classList.contains("filename-link")) {
                    e.preventDefault();
                    openPreviewModal(doc);
                }
            });

            productsTbody.appendChild(tr);
        });

        // Maintain selection if doc still exists in query list
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

        // Format multiple tags
        const categoryBadges = doc.applications_category 
            ? doc.applications_category.split("; ").map(c => `<span class="tag-cat-badge">${c}</span>`).join("")
            : "";
        const subcategoryBadges = doc.applications_subcategory 
            ? doc.applications_subcategory.split("; ").map(s => `<span class="tag-badge">${s}</span>`).join("")
            : "";
        const functionalBadges = doc.applications_tag 
            ? doc.applications_tag.split("; ").map(t => `<span class="tag-badge" style="border-color: rgba(0,245,212,0.3); color: var(--accent);">${t}</span>`).join("")
            : "";

        detailsView.innerHTML = `
            <div class="details-title">
                <h2>${doc.filename}</h2>
                <p class="subtitle" style="color: var(--accent); font-weight: 600;">${doc.company || 'Unknown'} <span style="color: var(--text-secondary); font-weight: 400;">(${doc.brand || 'No Brand'})</span></p>
                <div style="display: flex; gap: 8px; margin-top: 10px;">
                    <button class="primary-btn" id="btn-preview-file" style="flex: 1;">Preview File</button>
                    <button class="secondary-btn" id="btn-edit-file" style="flex: 1;">Edit Record</button>
                    <button class="secondary-btn" id="btn-history-file" style="flex: 1;">History</button>
                </div>
            </div>
            
            <div class="meta-grid">
                <div class="meta-item">
                    <div class="meta-label">Brand</div>
                    <div class="meta-val" style="color: var(--accent); font-weight: 600;">${doc.brand || 'N/A'}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Product Type</div>
                    <div class="meta-val">${doc.type || 'N/A'}</div>
                </div>
            </div>

            <div class="card-details">
                <h3>Standard Application</h3>
                <p>${doc.application || 'N/A'}</p>
            </div>

            <div class="card-details">
                <h3>Packaging & Storage</h3>
                <p><strong>Storage:</strong> ${doc.storage_conditions || 'N/A'}</p>
                <p style="margin-top: 6px;"><strong>Packaging:</strong> ${doc.packaging || 'N/A'}</p>
            </div>

            <div class="card-details">
                <h3>Ingredients & Allergens</h3>
                <p><strong>Ingredients:</strong> ${doc.ingredients || 'N/A'}</p>
                <p style="margin-top: 6px;"><strong>Allergens:</strong> ${doc.allergens || 'None declared'}</p>
            </div>

            <div class="card-details">
                <h3>Audit & Recommendation</h3>
                <p><strong>Audit Status:</strong> ${doc.audit || 'N/A'}</p>
                <p style="margin-top: 6px;"><strong>Recommendation:</strong> ${doc.recommendation || 'None'}</p>
            </div>

            <div class="card-details">
                <h3>Classifications</h3>
                <div class="tag-group">
                    <strong class="meta-txt" style="display:block; margin-bottom: 4px;">Main Categories:</strong>
                    <div class="tag-badge-container">${categoryBadges || '<span class="meta-txt">None</span>'}</div>
                </div>
                <div class="tag-group" style="margin-top: 10px;">
                    <strong class="meta-txt" style="display:block; margin-bottom: 4px;">Subcategories:</strong>
                    <div class="tag-badge-container">${subcategoryBadges || '<span class="meta-txt">None</span>'}</div>
                </div>
                <div class="tag-group" style="margin-top: 10px;">
                    <strong class="meta-txt" style="display:block; margin-bottom: 4px;">Functional Group / Specific Tags:</strong>
                    <div class="tag-badge-container">${functionalBadges || '<span class="meta-txt">None</span>'}</div>
                </div>
            </div>
        `;

        // Bind event handler for the preview button
        const previewBtn = document.getElementById("btn-preview-file");
        if (previewBtn) {
            previewBtn.addEventListener("click", () => {
                openPreviewModal(doc);
            });
        }

        // Bind event handler for edit button
        const editBtn = document.getElementById("btn-edit-file");
        if (editBtn) {
            editBtn.addEventListener("click", () => {
                openEditModal(doc);
            });
        }

        // Bind event handler for history button
        const historyBtn = document.getElementById("btn-history-file");
        if (historyBtn) {
            historyBtn.addEventListener("click", () => {
                openHistoryModal(doc);
            });
        }
    }

    // Version History Modal
    const historyModal = document.getElementById("history-modal");
    const closeHistoryModalBtn = document.getElementById("close-history-modal-btn");
    const versionHistoryList = document.getElementById("version-history-list");

    if (closeHistoryModalBtn) {
        closeHistoryModalBtn.addEventListener("click", () => historyModal.classList.add("hidden"));
    }
    if (historyModal) {
        historyModal.addEventListener("click", (e) => {
            if (e.target === historyModal) historyModal.classList.add("hidden");
        });
    }

    function openHistoryModal(doc) {
        document.getElementById("history-modal-title").textContent = `Revision History: ${doc.filename}`;
        versionHistoryList.innerHTML = `<p style="color: var(--text-muted); font-size: 13px;">Loading version history...</p>`;
        historyModal.classList.remove("hidden");

        fetch(`/api/documents/${doc.id}/versions`)
            .then(res => res.json())
            .then(data => {
                const versions = data.versions || [];
                if (versions.length === 0) {
                    versionHistoryList.innerHTML = `<p style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px;">No edit history logged yet for this record.</p>`;
                    return;
                }
                versionHistoryList.innerHTML = versions.map(v => `
                    <div class="history-item">
                        <div class="history-header">
                            <span class="history-ver">Version ${v.version_number}</span>
                            <span class="history-date">${new Date(v.edited_at).toLocaleString()}</span>
                        </div>
                        <div class="history-summary">${v.change_summary}</div>
                        <div class="history-by">Edited by ${v.edited_by}</div>
                    </div>
                `).join("");
            })
            .catch(err => {
                versionHistoryList.innerHTML = `<p style="color: red; font-size: 13px;">Failed to load history.</p>`;
            });
    }

    // Helper to open Edit Modal
    const editModal = document.getElementById("edit-modal");
    const closeEditModalBtn = document.getElementById("close-edit-modal-btn");
    const cancelEditBtn = document.getElementById("cancel-edit-btn");
    const editForm = document.getElementById("edit-form");

    if (closeEditModalBtn) closeEditModalBtn.addEventListener("click", () => editModal.classList.add("hidden"));
    if (cancelEditBtn) cancelEditBtn.addEventListener("click", () => editModal.classList.add("hidden"));

    function openEditModal(doc) {
        document.getElementById("edit-doc-id").value = doc.id;
        document.getElementById("edit-company").value = doc.company || "";
        const editBrandEl = document.getElementById("edit-brand");
        if (editBrandEl) editBrandEl.value = doc.brand || "";
        document.getElementById("edit-type").value = doc.type || "";
        document.getElementById("edit-application").value = doc.application || "";
        document.getElementById("edit-shelf-life").value = doc.shelf_life || "";
        document.getElementById("edit-appearance").value = doc.appearance || "";
        document.getElementById("edit-ingredients").value = doc.ingredients || "";
        document.getElementById("edit-packaging").value = doc.packaging || "";
        document.getElementById("edit-storage").value = doc.storage_conditions || "";
        
        const auditEl = document.getElementById("edit-audit");
        if (auditEl) auditEl.value = doc.audit || "";
        const recEl = document.getElementById("edit-recommendation");
        if (recEl) recEl.value = doc.recommendation || "";
        
        editModal.classList.remove("hidden");
    }

    if (editForm) {
        editForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const docId = document.getElementById("edit-doc-id").value;
            const editBrandEl = document.getElementById("edit-brand");
            const auditEl = document.getElementById("edit-audit");
            const recEl = document.getElementById("edit-recommendation");
            
            const payload = {
                company: document.getElementById("edit-company").value,
                brand: editBrandEl ? editBrandEl.value : "",
                type: document.getElementById("edit-type").value,
                application: document.getElementById("edit-application").value,
                shelf_life: document.getElementById("edit-shelf-life").value,
                appearance: document.getElementById("edit-appearance").value,
                ingredients: document.getElementById("edit-ingredients").value,
                packaging: document.getElementById("edit-packaging").value,
                storage_conditions: document.getElementById("edit-storage").value,
                audit: auditEl ? auditEl.value : "",
                recommendation: recEl ? recEl.value : ""
            };

            fetch(`/api/documents/${docId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    editModal.classList.add("hidden");
                    fetchData(); // Refresh list table
                } else {
                    alert("Error saving record: " + (data.error || "Unknown error"));
                }
            })
            .catch(err => {
                console.error("Save error:", err);
                alert("Failed to save changes.");
            });
        });
    }

    // Dedicated helper to open modal and render file via Python backend
    function openPreviewModal(doc) {
        modalFilename.textContent = doc.filename;
        previewContainer.innerHTML = "<div style='color: var(--accent); font-weight: 500; padding: 20px;'>Loading preview via Python server...</div>";
        previewModal.classList.remove("hidden");
        
        const filenameEnc = encodeURIComponent(doc.filename);
        const fnLower = doc.filename.toLowerCase();
        
        if (fnLower.endsWith(".jpg") || fnLower.endsWith(".jpeg") || fnLower.endsWith(".png") || fnLower.endsWith(".gif")) {
            previewContainer.innerHTML = `<img src="/documents/${filenameEnc}" alt="${doc.filename}">`;
        } else {
            // Fetch PDF info from Python backend using doc_id query parameter
            fetch(`/api/pdf-info?doc_id=${doc.id}`)
                .then(res => res.json())
                .then(info => {
                    previewContainer.innerHTML = ""; // Clear loading message
                    
                    if (info.is_pdf && info.page_count > 0) {
                        // Create page jump toolbar for multi-page PDFs
                        if (info.page_count > 1) {
                            const toolbar = document.createElement("div");
                            toolbar.className = "pdf-toolbar";
                            toolbar.style.cssText = "position: sticky; top: 0; z-index: 10; background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(10px); padding: 8px 16px; border-radius: 30px; display: flex; align-items: center; gap: 10px; margin-bottom: 20px; border: 1px solid rgba(0, 245, 212, 0.3); box-shadow: 0 4px 15px rgba(0,0,0,0.5);";
                            
                            const label = document.createElement("span");
                            label.style.cssText = "font-size: 13px; font-weight: 600; color: var(--accent); margin-right: 5px;";
                            label.textContent = `📄 Total: ${info.page_count} Pages`;
                            toolbar.appendChild(label);
                            
                            for (let p = 1; p <= info.page_count; p++) {
                                const jumpBtn = document.createElement("button");
                                jumpBtn.style.cssText = "background: rgba(255,255,255,0.08); color: #fff; border: 1px solid var(--border-color); padding: 4px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; transition: all 0.2s;";
                                jumpBtn.textContent = `Page ${p}`;
                                jumpBtn.addEventListener("click", () => {
                                    const pageEl = document.getElementById(`pdf-page-${p}`);
                                    if (pageEl) {
                                        pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    }
                                });
                                toolbar.appendChild(jumpBtn);
                            }
                            previewContainer.appendChild(toolbar);
                        }

                        for (let i = 1; i <= info.page_count; i++) {
                            const pageWrapper = document.createElement("div");
                            pageWrapper.className = "pdf-page-wrapper";
                            pageWrapper.id = `pdf-page-${i}`;
                            pageWrapper.style.cssText = "display: flex; flex-direction: column; align-items: center; margin-bottom: 30px; width: 100%; scroll-margin-top: 60px;";
                            
                            const pageHeader = document.createElement("div");
                            pageHeader.className = "page-number-badge";
                            pageHeader.style.cssText = "background: rgba(0, 245, 212, 0.15); color: var(--accent); padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 10px; border: 1px solid rgba(0, 245, 212, 0.3);";
                            pageHeader.textContent = `Page ${i} of ${info.page_count}`;
                            
                            const img = document.createElement("img");
                            img.src = `/api/pdf-page?doc_id=${doc.id}&page=${i}`;
                            img.alt = `Page ${i}`;
                            img.style.cssText = "width: 90%; max-width: 850px; border-radius: 8px; box-shadow: 0 8px 30px rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.1);";
                            
                            pageWrapper.appendChild(pageHeader);
                            pageWrapper.appendChild(img);
                            previewContainer.appendChild(pageWrapper);
                        }
                    } else {
                        // Fallback to direct image
                        previewContainer.innerHTML = `<img src="/api/pdf-page?doc_id=${doc.id}&page=1" alt="${doc.filename}">`;
                    }
                })
                .catch(err => {
                    console.error("Error fetching PDF info from Python:", err);
                    previewContainer.innerHTML = `<img src="/api/pdf-page?doc_id=${doc.id}&page=1" alt="${doc.filename}">`;
                });
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
        fetch("/api/schema")
            .then(res => res.json())
            .then(data => {
                schemaData = data;
                renderSchemaDiagram();
            })
            .catch(err => console.error("Error fetching schema:", err));
    }

    // Render interactive Database ER schema diagram
    function renderSchemaDiagram() {
        if (!schemaData || state.activeTab !== "schema-tab") return;
        
        diagramContainer.innerHTML = "";

        // Create table card 1: tds_documents
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

        // Create table card 2: tds_applications
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

        // Append cards to canvas
        diagramContainer.appendChild(docCard);
        diagramContainer.appendChild(appCard);

        // Draw relationship connector SVG line after DOM positions resolve
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
                
                // SVG canvas overlay
                const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                svg.setAttribute("class", "connector-svg");
                
                // Draw bezier line connector
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
