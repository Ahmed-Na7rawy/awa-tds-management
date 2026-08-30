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
                
                tabButtons.forEach(b => b.classList.remove("active"));
                tabContents.forEach(c => c.classList.remove("active"));
                
                btn.classList.add("active");
                document.getElementById(tabId).classList.add("active");
                
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
        categoryFilter.addEventListener("change", fetchData);
        subcatFilter.addEventListener("change", fetchData);
        tagcatFilter.addEventListener("change", fetchData);
        
        resetFiltersBtn.addEventListener("click", () => {
            searchInput.value = "";
            companyFilter.value = "";
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
        // Only update drop-down lists if they are currently empty (to avoid resetting selections)
        updateSelect(companyFilter, filters.companies, "All Companies");
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
                <td>${doc.company || 'Unknown'}</td>
                <td>N/A</td>
                <td class="meta-txt">${appLabel || 'N/A'}</td>
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
                <p class="subtitle" style="color: var(--accent);">${doc.company || 'Unknown'}</p>
                <button class="preview-btn" id="btn-preview-file">📄 Preview File</button>
            </div>
            
            <div class="meta-grid">
                <div class="meta-item">
                    <div class="meta-label">Product Type</div>
                    <div class="meta-val">${doc.type || 'N/A'}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Shelf Life</div>
                    <div class="meta-val">${doc.shelf_life || 'N/A'}</div>
                </div>
            </div>

            <div class="card-details">
                <h3>📖 Standard Application</h3>
                <p>${doc.application || 'N/A'}</p>
            </div>

            <div class="card-details">
                <h3>📦 Packaging & storage</h3>
                <p><strong>Storage:</strong> ${doc.storage_conditions || 'N/A'}</p>
                <p style="margin-top: 6px;"><strong>Packaging:</strong> ${doc.packaging || 'N/A'}</p>
            </div>

            <div class="card-details">
                <h3>🧪 Ingredients & Allergens</h3>
                <p><strong>Ingredients:</strong> ${doc.ingredients || 'N/A'}</p>
                <p style="margin-top: 6px;"><strong>Allergens:</strong> ${doc.allergens || 'None declared'}</p>
            </div>

            <div class="card-details">
                <h3>📋 Audit & Recommendation</h3>
                <p><strong>Audit Status:</strong> ${doc.audit || 'N/A'}</p>
                <p style="margin-top: 6px;"><strong>Recommendation:</strong> ${doc.recommendation || 'None'}</p>
            </div>

            <div class="card-details">
                <h3>📂 Database Schema Classifications</h3>
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
            // Fetch PDF info from Python backend
            fetch(`/api/pdf-info/${filenameEnc}`)
                .then(res => res.json())
                .then(info => {
                    previewContainer.innerHTML = ""; // Clear loading message
                    
                    if (info.is_pdf && info.page_count > 0) {
                        for (let i = 1; i <= info.page_count; i++) {
                            const pageWrapper = document.createElement("div");
                            pageWrapper.className = "pdf-page-wrapper";
                            pageWrapper.style.cssText = "display: flex; flex-direction: column; align-items: center; margin-bottom: 25px; width: 100%;";
                            
                            const pageHeader = document.createElement("div");
                            pageHeader.className = "page-number-badge";
                            pageHeader.style.cssText = "background: rgba(0, 245, 212, 0.15); color: var(--accent); padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 8px; border: 1px solid rgba(0, 245, 212, 0.3);";
                            pageHeader.textContent = `Page ${i} of ${info.page_count}`;
                            
                            const img = document.createElement("img");
                            img.src = `/api/pdf-page/${filenameEnc}/${i}`;
                            img.alt = `Page ${i}`;
                            img.style.cssText = "max-width: 100%; border-radius: 6px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);";
                            
                            pageWrapper.appendChild(pageHeader);
                            pageWrapper.appendChild(img);
                            previewContainer.appendChild(pageWrapper);
                        }
                    } else {
                        // Fallback to direct image
                        previewContainer.innerHTML = `<img src="/api/pdf-page/${filenameEnc}/1" alt="${doc.filename}">`;
                    }
                })
                .catch(err => {
                    console.error("Error fetching PDF info from Python:", err);
                    previewContainer.innerHTML = `<img src="/api/pdf-page/${filenameEnc}/1" alt="${doc.filename}">`;
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
