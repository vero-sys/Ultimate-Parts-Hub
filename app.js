/**
 * ==============================================================================
 * The Ultimate Compatible Parts Hub for Non Big-4 Motorcycles
 * SCRIPT: app.js
 * ==============================================================================
 */

'use strict';

/* ==========================================================================
   01. GLOBAL CONFIGURATION & STATE
   ========================================================================== */
let ACTIVE_PARTS = [];
let currentActiveTab = null;
let currentCategory = 'all';
let searchQuery = '';
let isModelDrawerExpanded = false;
let lastFocusedElement = null; // Accessibility: stores element to return focus after modal closes

const SPREADSHEET_ID = '1gPudHIe2v5fHUnXyXQB43u0pVG3u05tNDjlbcaFqPiY';
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbynjptVaj4ftkoSxjFrOzUrO1E0lttZ_7nMcCgq0UQ-nlXHTuEMKJvAX0cgErVZGh6E/exec';

/* ==========================================================================
   02. DATA LAYER & GVIZ CONNECTOR (JSONP via sheet name)
   ========================================================================== */
function fetchSheetTab(tabName) {
  const statusEl = document.getElementById('catalogStatusCounter');
  const grid = document.getElementById('partsGrid');
  
  if (statusEl) {
    statusEl.textContent = `FETCHING '${tabName.toUpperCase()}' TAB...`;
    statusEl.className = 'text-[10px] sm:text-[11px] font-mono text-amber-400 font-bold';
  }

  if (grid) {
    grid.classList.remove('hidden');
    grid.innerHTML = `
      <div class="col-span-full py-16 text-center text-slate-400 font-mono text-xs border border-dashed border-race-border rounded-2xl bg-race-card/40">
        CONNECTING TO DATABASE // TAB: ${tabName}...
      </div>
    `;
  }

  const existing = document.getElementById('gviz-tab-script');
  if (existing) existing.remove();

  const script = document.createElement('script');
  script.id = 'gviz-tab-script';
  script.src = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=responseHandler:handleSheetData&sheet=${encodeURIComponent(tabName)}`;
  script.onerror = () => {
    if (statusEl) {
      statusEl.textContent = `ERR: FAILED TO LOAD '${tabName}'`;
      statusEl.className = 'text-[10px] sm:text-[11px] font-mono text-rose-500 font-bold';
    }
    ACTIVE_PARTS = [];
    discoverTabCategories();
    renderCatalog();
  };
  document.body.appendChild(script);
}

window.handleSheetData = function(json) {
  try {
    if (!json || !json.table || !json.table.rows) throw new Error("No table rows found in tab.");

    const getCell = (row, colIndex) => {
      if (!row.c || !row.c[colIndex] || row.c[colIndex].v === null || row.c[colIndex].v === undefined) return '';
      return String(row.c[colIndex].v).trim();
    };

    const dataRows = json.table.rows.filter(r => {
      const colA = getCell(r, 0).toUpperCase();
      const colB = getCell(r, 1).toUpperCase();
      return colA !== 'CATEGORY' && colB !== 'NAME' && (colA !== '' || colB !== '');
    });

    ACTIVE_PARTS = dataRows.map((r, index) => {
      const category      = getCell(r, 0) || 'General';
      const name          = getCell(r, 1) || 'Unnamed Component';
      const specs         = getCell(r, 2) || 'Factory Specification';
      const compatibility = getCell(r, 3) ? getCell(r, 3).split(',').map(s => s.trim()).filter(Boolean) : [currentActiveTab];
      const material      = getCell(r, 4) || 'Alloy';
      const description   = getCell(r, 5) || 'No specific maintenance notes logged.';
      const link          = getCell(r, 6) || '#';

      let image = getCell(r, 7).replace('.webpp', '.webp');
      if (!image || !image.startsWith('http')) {
        image = 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=600&q=80';
      }

      const rawPrice = getCell(r, 8).replace(/[^0-9.]/g, '');
      const price = parseFloat(rawPrice) || 0;
      const id = `${(currentActiveTab || 'PART').replace(/\s+/g, '').toUpperCase()}-${String(index + 1).padStart(3, '0')}`;

      return { id, category, name, specs, compatibility, material, description, link, image, price };
    });

    discoverTabCategories();
    renderCatalog();

  } catch (err) {
    console.error("Tab parse error:", err);
    const statusEl = document.getElementById('catalogStatusCounter');
    if (statusEl) {
      statusEl.textContent = `ERR: PARSING DATA IN '${currentActiveTab}'`;
      statusEl.className = 'text-[10px] sm:text-[11px] font-mono text-rose-500 font-bold';
    }
    ACTIVE_PARTS = [];
    discoverTabCategories();
    renderCatalog();
  }
};

/* ==========================================================================
   03. MODEL SELECTION & COLLAPSIBLE DRAWER
   ========================================================================== */
function toggleMotorcycleDrawer(forceState = null) {
  const wrapper = document.getElementById('sheetTabWrapper');
  const btn = document.getElementById('toggleModelsBtn');
  const icon = document.getElementById('modelsToggleIcon');
  const text = document.getElementById('modelsToggleText');
  
  // Bottom handle elements
  const handleBtn = document.getElementById('mobileDrawerHandle');
  const handleIcon = document.getElementById('handleIcon');
  const handleText = document.getElementById('handleText');

  const totalTabs = document.querySelectorAll('#sheetTabGroup .sheet-tab-btn').length;

  if (!wrapper) return;

  isModelDrawerExpanded = forceState !== null ? forceState : !isModelDrawerExpanded;

  if (isModelDrawerExpanded) {
    wrapper.style.maxHeight = wrapper.scrollHeight + 'px';
    
    // Desktop top button
    if (icon) icon.classList.add('rotate-180');
    if (text) text.textContent = 'Collapse';
    if (btn) btn.setAttribute('aria-expanded', 'true');

    // Bottom handle
    if (handleIcon) handleIcon.classList.add('rotate-180');
    if (handleText) handleText.textContent = 'Collapse';
    if (handleBtn) handleBtn.setAttribute('aria-expanded', 'true');
  } else {
    wrapper.style.maxHeight = '58px';
    
    // Desktop top button
    if (icon) icon.classList.remove('rotate-180');
    if (text) text.textContent = currentActiveTab ? `${currentActiveTab} (Change)` : `All Models (${totalTabs})`;
    if (btn) btn.setAttribute('aria-expanded', 'false');

    // Bottom handle
    if (handleIcon) handleIcon.classList.remove('rotate-180');
    if (handleText) handleText.textContent = currentActiveTab ? 'Change Model' : 'More Models';
    if (handleBtn) handleBtn.setAttribute('aria-expanded', 'false');
  }
}

function switchSheetTab(e, tabName) {
  if (e && e.preventDefault) {
    e.preventDefault();
  }

  // Support invocation passing raw string as first argument
  if (typeof e === 'string' && !tabName) {
    tabName = e;
  }

  currentActiveTab = tabName;
  currentCategory = 'all';
  searchQuery = '';

  // Deactivate initial prompt beacon once a model is selected
  const toggleBtn = document.getElementById('toggleModelsBtn');
  const beacon = document.getElementById('modelPromptBeacon');
  if (toggleBtn) {
    toggleBtn.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-[#161a25] hover:bg-[#202636] border border-race-border text-slate-300 hover:text-white transition-all active:scale-95 focus:ring-2 focus:ring-rose-500';
  }
  if (beacon) {
    beacon.classList.add('hidden');
  }

  // Reflect selected model in the toggle button label when collapsed
  const toggleText = document.getElementById('modelsToggleText');
  if (toggleText && !isModelDrawerExpanded) {
    toggleText.textContent = `${tabName} (Change)`;
  }

  // Auto-collapse drawer on mobile to conserve screen space for parts
  if (isModelDrawerExpanded && window.innerWidth < 768) {
    toggleMotorcycleDrawer(false);
  }

  // Clear search fields on tab change
  const dInput = document.getElementById('desktopSearchInput');
  const mInput = document.getElementById('mobileSearchInput');
  if (dInput) dInput.value = '';
  if (mInput) mInput.value = '';

  // Reset fallback archive box
  const pioneerBox = document.getElementById('advPioneerFallback');
  if (pioneerBox) {
    pioneerBox.classList.add('hidden');
  }

  // Sync submission form target model
  const submitSelect = document.getElementById('targetSheetTab');
  if (submitSelect) submitSelect.value = tabName;

  // Update ARIA tab states, visual styles, and move active tab to slot 1
  const group = document.getElementById('sheetTabGroup');
  let selectedButton = null;

  document.querySelectorAll('#sheetTabGroup .sheet-tab-btn').forEach(btn => {
    const isTarget = btn.getAttribute('data-tab') === tabName;
    const dot = btn.querySelector('.rounded-full');
    const tabNum = btn.querySelector('.font-mono:last-child');

    btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');

    if (isTarget) {
      selectedButton = btn;
      btn.className = 'sheet-tab-btn min-h-[48px] px-3.5 py-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 text-white font-bold flex items-center justify-between transition focus:ring-2 focus:ring-rose-500';
      if (dot) dot.className = 'w-2.5 h-2.5 rounded-full bg-rose-500';
      if (tabNum) tabNum.className = 'text-[10px] text-rose-400 opacity-80 font-mono';
    } else {
      btn.className = 'sheet-tab-btn min-h-[48px] px-3.5 py-2.5 rounded-xl border border-race-border bg-[#161a25] text-slate-300 hover:text-white font-semibold flex items-center justify-between transition focus:ring-2 focus:ring-rose-500';
      if (dot) dot.className = 'w-2.5 h-2.5 rounded-full bg-slate-600';
      if (tabNum) tabNum.className = 'text-[10px] text-slate-500 font-mono';
    }
  });

  // Reorder active tab to the very top so it stays in view when collapsed
  if (selectedButton && group && group.firstElementChild !== selectedButton) {
    group.prepend(selectedButton);
  }

  fetchSheetTab(tabName);
}

/* ==========================================================================
   04. CATEGORY FILTERING & DYNAMIC OVERFLOW
   ========================================================================== */
function discoverTabCategories() {
  const container = document.getElementById('categoryFilterContainer');
  if (!container) return;

  const categories = Array.from(new Set(ACTIVE_PARTS.map(p => p.category).filter(Boolean)));

  container.innerHTML = `
    <button type="button" onclick="filterCategory('all')" data-cat="all" class="cat-pill shrink-0 min-h-[40px] px-3.5 py-2 rounded-lg font-semibold bg-rose-600 text-white transition focus:ring-2 focus:ring-rose-500">
      All Parts
    </button>
    ${categories.map(cat => `
      <button 
        type="button" 
        onclick="filterCategory('${cat}')" 
        data-cat="${cat}" 
        class="cat-pill shrink-0 min-h-[40px] px-3.5 py-2 rounded-lg font-semibold bg-[#161a25] text-slate-300 border border-race-border hover:border-rose-500/40 transition focus:ring-2 focus:ring-rose-500"
      >
        ${cat}
      </button>
    `).join('')}
  `;

  updateCategoryScrollFade(container);
}

function filterCategory(cat) {
  currentCategory = cat;

  document.querySelectorAll('#categoryFilterContainer .cat-pill').forEach(btn => {
    if (btn.getAttribute('data-cat') === cat) {
      btn.className = 'cat-pill shrink-0 min-h-[40px] px-3.5 py-2 rounded-lg font-semibold bg-rose-600 text-white transition focus:ring-2 focus:ring-rose-500';
    } else {
      btn.className = 'cat-pill shrink-0 min-h-[40px] px-3.5 py-2 rounded-lg font-semibold bg-[#161a25] text-slate-300 border border-race-border hover:border-rose-500/40 transition focus:ring-2 focus:ring-rose-500';
    }
  });

  renderCatalog();
}

function resetActiveTabFilters() {
  currentCategory = 'all';
  searchQuery = '';
  const dInput = document.getElementById('desktopSearchInput');
  const mInput = document.getElementById('mobileSearchInput');
  if (dInput) dInput.value = '';
  if (mInput) mInput.value = '';

  filterCategory('all');
}

let isCatScrolling = false;

function updateCategoryScrollFade(el) {
  if (window.innerWidth >= 640) return;

  if (!isCatScrolling) {
    window.requestAnimationFrame(() => {
      const maxScrollLeft = el.scrollWidth - el.clientWidth;
      if (maxScrollLeft <= 5) {
        el.classList.remove('scroll-fade-right', 'scroll-fade-both', 'scroll-fade-left');
      } else if (el.scrollLeft <= 10) {
        el.className = 'flex flex-nowrap overflow-x-auto sm:flex-wrap sm:overflow-visible gap-1.5 sm:gap-2 py-1 text-xs font-mono no-scrollbar scroll-fade-right';
      } else if (el.scrollLeft >= maxScrollLeft - 10) {
        el.className = 'flex flex-nowrap overflow-x-auto sm:flex-wrap sm:overflow-visible gap-1.5 sm:gap-2 py-1 text-xs font-mono no-scrollbar scroll-fade-left';
      } else {
        el.className = 'flex flex-nowrap overflow-x-auto sm:flex-wrap sm:overflow-visible gap-1.5 sm:gap-2 py-1 text-xs font-mono no-scrollbar scroll-fade-both';
      }
      isCatScrolling = false;
    });
    isCatScrolling = true;
  }
}

function handleCategorySelect(val) {
  const wrapper = document.getElementById('newCategoryWrapper');
  const customInput = document.getElementById('customCategoryInput');
  if (!wrapper || !customInput) return;

  if (val === '__NEW_CATEGORY__') {
    wrapper.classList.remove('hidden');
    customInput.required = true;
    customInput.focus();
  } else {
    wrapper.classList.add('hidden');
    customInput.required = false;
    customInput.value = '';
  }
}

/* ==========================================================================
   05. CATALOG DISPLAY & SEARCH LOGIC
   ========================================================================== */
function handleSearch(val) {
  searchQuery = val;
  const dInput = document.getElementById('desktopSearchInput');
  const mInput = document.getElementById('mobileSearchInput');
  if (dInput && dInput.value !== val) dInput.value = val;
  if (mInput && mInput.value !== val) mInput.value = val;
  renderCatalog();
}

function renderCatalog() {
  const grid = document.getElementById('partsGrid');
  const noResults = document.getElementById('noResultsNotice');
  const pioneerBox = document.getElementById('advPioneerFallback');
  const counter = document.getElementById('catalogStatusCounter');
  if (!grid) return;

  if (!currentActiveTab) {
    if (counter) {
      counter.textContent = 'PLEASE SELECT A MOTORCYCLE MODEL';
      counter.className = 'text-[10px] sm:text-[11px] font-mono text-amber-400 font-bold';
    }
    if (noResults) noResults.classList.add('hidden');
    if (pioneerBox) pioneerBox.classList.add('hidden');
    return;
  }

  const filtered = ACTIVE_PARTS.filter(part => {
    const matchesCat = (currentCategory === 'all') || 
      (part.category || '').toLowerCase() === currentCategory.toLowerCase();

    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      (part.name || '').toLowerCase().includes(q) ||
      (part.category || '').toLowerCase().includes(q) ||
      (part.specs || '').toLowerCase().includes(q) ||
      (part.description || '').toLowerCase().includes(q) ||
      (part.compatibility || []).some(c => c.toLowerCase().includes(q));

    return matchesCat && matchesSearch;
  });

  if (counter) {
    counter.className = 'text-[10px] sm:text-[11px] font-mono text-slate-300';
    counter.textContent = `SHOWING ${filtered.length} OF ${ACTIVE_PARTS.length} [TAB: ${currentActiveTab.toUpperCase()}]`;
  }

  if (filtered.length === 0) {
    grid.innerHTML = '';
    grid.classList.add('hidden');

    if (noResults) {
      noResults.classList.remove('hidden');

      if (pioneerBox) {
        if (currentActiveTab === 'ADV 175') {
          pioneerBox.classList.remove('hidden');
        } else {
          pioneerBox.classList.add('hidden');
        }
      }
    }
    return;
  }

  grid.classList.remove('hidden');
  if (noResults) noResults.classList.add('hidden');
  if (pioneerBox) pioneerBox.classList.add('hidden');

  
  
  grid.innerHTML = filtered.map(part => `
    <article onclick="openSpecsModal('${part.id}')" class="bg-race-card rounded-xl sm:rounded-2xl border border-race-border overflow-hidden flex flex-col justify-between group hover:border-rose-500/50 hover:shadow-xl hover:shadow-rose-500/5 transition-all duration-300 cursor-pointer">
      <div>
        <div class="relative h-28 sm:h-48 w-full bg-[#0d0f15] overflow-hidden">
          <img src="${part.image}" alt="${part.name}" loading="lazy" decoding="async" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onerror="this.src='https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=600&q=80';"/>
          <div class="absolute inset-0 bg-gradient-to-t from-race-card via-transparent to-black/30"></div>
          <div class="absolute top-2 left-2 flex gap-1 font-mono">
            <span class="px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded text-[9px] sm:text-[10px] font-bold tracking-tight bg-black/70 backdrop-blur-md text-rose-400 border border-white/10 truncate max-w-[85px] sm:max-w-none">${part.category}</span>
          </div>
          <div class="absolute top-2 right-2 font-mono">
            <span class="px-1.5 py-0.5 rounded text-[8px] sm:text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">${part.id}</span>
          </div>
        </div>
        <div class="p-2.5 sm:p-5 space-y-1.5 sm:space-y-3 font-mono">
          <div class="flex items-center justify-between text-[10px] sm:text-xs text-slate-400">
            <span class="truncate max-w-[55px] sm:max-w-none">${part.material}</span>
            <span class="text-rose-400 font-bold truncate max-w-[65px] sm:max-w-none">${part.compatibility[0] || currentActiveTab}</span>
          </div>
          <h3 class="font-bold text-white text-xs sm:text-base leading-tight group-hover:text-rose-400 transition-colors line-clamp-2">${part.name}</h3>
          <p class="text-[10px] sm:text-xs text-slate-400 line-clamp-1 sm:line-clamp-2 leading-tight">${part.specs}</p>
        </div>
      </div>
      <div class="p-2.5 sm:p-5 pt-0 font-mono">
        <div class="pt-2 border-t border-race-border/80">
          <div class="flex items-baseline justify-between mb-2">
            <span class="text-[9px] sm:text-[11px] text-slate-400">PRICE</span>
            <span class="text-xs sm:text-lg font-bold text-white">${part.price > 0 ? `₱${part.price.toLocaleString()}` : 'OEM SPEC'}</span>
          </div>
          <a href="${part.link !== '#' ? part.link : 'https://shopee.ph'}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" class="w-full min-h-[38px] sm:min-h-[44px] py-1.5 px-3 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition flex items-center justify-center gap-1.5 shadow-sm shadow-rose-600/30 active:scale-95 focus:ring-2 focus:ring-rose-500 truncate" aria-label="Buy ${part.name} on Shopee">
            <span class="truncate">Open</span>
            <i class="ph-bold ph-arrow-up-right text-[10px] sm:text-xs shrink-0" aria-hidden="true"></i>
          </a>
        </div>
      </div>
    </article>
  `).join('');
}

/* ==========================================================================
   06. SPECIFICATIONS BLUEPRINT MODAL (ACCESSIBLE & FOCUS TRAPPED)
   ========================================================================== */
function openSpecsModal(partId) {
  const part = ACTIVE_PARTS.find(p => p.id === partId);
  if (!part) return;

  lastFocusedElement = document.activeElement;

  const setElText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  setElText('modalTitle', part.name);
  setElText('modalSubtitle', `OEM Category: ${part.category} • Blueprint Specs`);
  setElText('modalCategory', part.category.toUpperCase());
  setElText('modalId', part.id);
  setElText('modalPrice', part.price > 0 ? `₱${part.price.toLocaleString()}` : 'OEM SPEC');
  setElText('modalDesc', part.description);
  setElText('modalSpecMaterial', part.material);

  const imgEl = document.getElementById('modalImage');
  if (imgEl) imgEl.src = part.image;

  const shopBtn = document.getElementById('modalShopBtn');
  if (shopBtn) shopBtn.href = part.link !== '#' ? part.link : 'https://shopee.ph';

  const fitmentContainer = document.getElementById('modalFitmentPills');
  if (fitmentContainer) {
    fitmentContainer.innerHTML = (part.compatibility || []).map(bike => `
      <span class="px-2.5 py-1 rounded-md text-xs font-medium bg-[#1a1f2e] border border-race-border text-slate-300 flex items-center gap-1.5">
        <i class="ph-bold ph-check text-rose-500" aria-hidden="true"></i> ${bike}
      </span>
    `).join('');
  }

  const modal = document.getElementById('specsModal');
  const box = document.getElementById('modalBox');
  if (!modal || !box) return;

  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    box.classList.remove('scale-95');
    const closeBtn = document.getElementById('closeModalBtn') || modal.querySelector('button');
    if (closeBtn) closeBtn.focus();
  }, 40);
}

function closeSpecsModal() {
  const modal = document.getElementById('specsModal');
  const box = document.getElementById('modalBox');
  if (!modal || !box) return;

  modal.classList.add('opacity-0');
  box.classList.add('scale-95');
  setTimeout(() => {
    modal.classList.add('hidden');
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
  }, 300);
}

/* ==========================================================================
   07. NAVIGATION & UTILITIES
   ========================================================================== */

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  if (menu) menu.classList.toggle('hidden');
}

let isScrolling = false;

function handleScrollTopVisibility() {
  if (!isScrolling) {
    window.requestAnimationFrame(() => {
      const btn = document.getElementById('scrollTopBtn');
      if (btn) {
        if (window.scrollY > 400) {
          btn.classList.remove('translate-y-16', 'opacity-0', 'pointer-events-none');
          btn.classList.add('translate-y-0', 'opacity-100', 'pointer-events-auto');
        } else {
          btn.classList.add('translate-y-16', 'opacity-0', 'pointer-events-none');
          btn.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
        }
      }
      isScrolling = false;
    });
    isScrolling = true;
  }
}

/* ==========================================================================
   08. INITIALIZATION, FORM DISPATCHER & EVENT HANDLERS
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  // ------------------------------------------------------------------------
  // 08.1 Bootstrap UI State & Drawer Indicators
  // ------------------------------------------------------------------------
  const totalTabs = document.querySelectorAll('#sheetTabGroup .sheet-tab-btn').length;
  const toggleText = document.getElementById('modelsToggleText');
  if (toggleText && totalTabs > 0) {
    toggleText.textContent = `All Models (${totalTabs})`;
  }

  const counter = document.getElementById('catalogStatusCounter');
  if (counter) {
    counter.textContent = 'PLEASE SELECT A MOTORCYCLE MODEL';
    counter.className = 'text-[10px] sm:text-[11px] font-mono text-amber-400 font-bold';
  }

  // ------------------------------------------------------------------------
  // 08.2 Unified 9-Column Submission Form Dispatcher
  // ------------------------------------------------------------------------
  const form = document.getElementById('compatSubmitForm');
  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      const btn = document.getElementById('submitPartBtn');
      const status = document.getElementById('submissionStatus');

      // A. Mandatory Field Validation: Purchase Link
      const linkVal = document.getElementById('partLink').value.trim();
      if (!linkVal) {
        status.textContent = 'ERR: PURCHASE LINK IS REQUIRED';
        status.className = 'text-xs text-rose-500 font-mono';
        document.getElementById('partLink').focus();
        return;
      }

      // B. Dynamic Category Resolution (Standard Dropdown vs Custom Input)
      let categoryVal = document.getElementById('partCategory').value.trim();
      if (categoryVal === '__NEW_CATEGORY__') {
        const customCatInput = document.getElementById('customCategoryInput');
        const customVal = customCatInput ? customCatInput.value.trim() : '';

        if (!customVal) {
          status.textContent = 'ERR: PLEASE ENTER A NEW CATEGORY NAME';
          status.className = 'text-xs text-rose-500 font-mono';
          if (customCatInput) customCatInput.focus();
          return;
        }
        categoryVal = customVal;
      }

      // C. Optional Image Resolution with Safe Placeholder Fallback
      const rawImage = document.getElementById('partImage').value.trim();
      const defaultPlaceholder = 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=600&q=80';
      const imageVal = rawImage.startsWith('http') ? rawImage : defaultPlaceholder;

      // D. Dispatch Lock
      btn.disabled = true;
      status.textContent = 'COMMITTING TO TARGET TAB...';
      status.className = 'text-xs text-amber-400 font-mono';

      // E. Payload Assembly (Exact 9-Column Architecture)
      const payload = {
        sheetTab: document.getElementById('targetSheetTab').value,
        category: categoryVal,
        name: document.getElementById('partName').value.trim(),
        specs: document.getElementById('partSpecs').value.trim(),
        compatibility: document.getElementById('partCompatibility').value.trim(),
        material: document.getElementById('partMaterial').value.trim(),
        description: document.getElementById('partDescription').value.trim(),
        link: linkVal,
        image: imageVal,
        price: parseFloat(document.getElementById('partPrice').value) || 0
      };

      // F. Remote Transmission to Google Apps Script
      try {
        if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('PASTE_YOUR')) {
          throw new Error('Configure your Google Apps Script URL in app.js');
        }

        const res = await fetch(APPS_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });

        const result = await res.json();
        if (result.status === 'success') {
          status.textContent = `SUCCESSFULLY LOGGED TO TAB: ${payload.sheetTab}`;
          status.className = 'text-xs text-emerald-400 font-mono';
          form.reset();

          // Reset custom category field visibility
          handleCategorySelect(document.getElementById('partCategory').value);

          // Live reload active catalog if committed to the currently selected model
          if (payload.sheetTab === currentActiveTab) {
            fetchSheetTab(currentActiveTab);
          }
        } else {
          throw new Error(result.message || 'Transmission failed');
        }
      } catch (err) {
        status.textContent = `ERR: ${err.message}`;
        status.className = 'text-xs text-rose-500 font-mono';
      } finally {
        btn.disabled = false;
      }
    });
  }

  // ------------------------------------------------------------------------
  // 08.3 Keyboard Shortcuts & Focus Controls (WCAG 2.1.1 / 2.1.2)
  // ------------------------------------------------------------------------
  window.addEventListener('keydown', (e) => {
    // ESC closes modal and restores previous focus
    if (e.key === 'Escape') {
      closeSpecsModal();
    }

    // "/" triggers instant search without capturing input inside active text fields
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      document.getElementById('desktopSearchInput')?.focus();
    }
  });

  // ------------------------------------------------------------------------
  // 08.4 Modal Overlay Click Dismissal
  // ------------------------------------------------------------------------
  const modal = document.getElementById('specsModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target.id === 'specsModal') {
        closeSpecsModal();
      }
    });
  }

  // ------------------------------------------------------------------------
  // 08.5 Floating Scroll-To-Top Event Handler
  // ------------------------------------------------------------------------
  window.addEventListener('scroll', handleScrollTopVisibility, { passive: true });
});
