/**
 * ==============================================================================
 * ENDGAME GY6HUB // PADDOCK RACE SPEC & MULTI-TAB ARCHITECTURE
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
let lastFocusedElement = null; // Accessibility: stores element to return focus after modal closes

const SPREADSHEET_ID = '1gPudHIe2v5fHUnXyXQB43u0pVG3u05tNDjlbcaFqPiY';
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbynjptVaj4ftkoSxjFrOzUrO1E0lttZ_7nMcCgq0UQ-nlXHTuEMKJvAX0cgErVZGh6E/exec';

const KNOWN_ISSUES = [
  {
    id: "issue-1",
    title: "Transmission Low-Speed Shudder (\"Pang-Gigil\")",
    category: "CVT & Transmission",
    severity: "Common / Street Wear",
    symptoms: "Heavy handlebar shaking and clutch judder between 0 to 20 km/h, disappearing once speed stabilizes.",
    rootCause: "Glazed friction pads and molten drive belt dust compacted inside the bell friction track.",
    solution: "1. Clean drum thoroughly with non-chlorinated brake cleaner.<br>2. De-glaze friction shoes using 240-grit emery sandpaper.<br>3. Replace solid bell with a grooved/vented race bell to clear belt debris automatically.",
    recommendedPart: "Grooved & Vented Clutch Bell"
  },
  {
    id: "issue-2",
    title: "Brake Sponge & Thermal Vapor Lock on Descents",
    category: "Braking System",
    severity: "Safety Critical",
    symptoms: "Brake lever pulls back close to the throttle under heavy downhill riding; lever feels soft and spongy.",
    rootCause: "Moisture-contaminated DOT 3/4 brake fluid boiling under repeated hard trail braking, creating vapor pockets.",
    solution: "1. Flush hydraulic lines with DOT 5.1 high-temperature racing brake fluid (260°C dry boiling point).<br>2. Replace warped solid rotor with a 260mm floating wave disc to accommodate thermal expansion.",
    recommendedPart: "Floating Wave Stainless Disc Rotor"
  },
  {
    id: "issue-3",
    title: "Stator & Rectifier Overheating / Cut-Off",
    category: "Electrical & Stator",
    severity: "Critical",
    symptoms: "Sudden instrument reset, battery failing to charge past 12.4V, or charred regulator wiring harness.",
    rootCause: "High-resistance engine-to-frame grounding and auxiliary LED load overheating OEM shunt regulator fins.",
    solution: "1. Run an 8 AWG direct engine-to-frame grounding bridge.<br>2. Replace stock rectifier with a solid-state MOSFET unit relocated to direct front airflow.",
    recommendedPart: "Heavy-Duty MOSFET Regulator"
  },
  {
    id: "issue-4",
    title: "Premature Drive Belt Shredding & Edge Wear",
    category: "CVT & Transmission",
    severity: "Stoppage Risk",
    symptoms: "Screeching sound at wide-open throttle, loss of top speed, rubber powder inside the crankcase cover.",
    rootCause: "Worn variator slider guides tilting the pulley face, or using improperly sized aftermarket flyballs.",
    solution: "1. Inspect variator face for stepped ridges with a straight edge.<br>2. Replace the 3 plastic slider guides.<br>3. Torque variator drive nut to 59 Nm using a calibrated torque wrench.",
    recommendedPart: "Kevlar Aramid Reinforced Drive Belt"
  }
];

/* ==========================================================================
   02. MULTI-TAB GOOGLE SHEETS CONNECTOR (JSONP via sheet name)
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
        CONNECTING TO GOOGLE SHEETS // TAB: ${tabName}...
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
   03. TAB SWITCHER & CATEGORY DISCOVERY
   ========================================================================== */
function switchSheetTab(e, tabName) {
  if (e && e.preventDefault) {
    e.preventDefault();
  }

  if (typeof e === 'string' && !tabName) {
    tabName = e;
  }

  currentActiveTab = tabName;
  currentCategory = 'all';
  searchQuery = '';

  // Remove the attention-seeking border from the tab container
  const tabGroup = document.getElementById('sheetTabGroup');
  if (tabGroup) {
    tabGroup.classList.remove('model-prompt-highlight');
  }

  const dInput = document.getElementById('desktopSearchInput');
  const mInput = document.getElementById('mobileSearchInput');
  if (dInput) dInput.value = '';
  if (mInput) mInput.value = '';

  // Hide pioneer fallback until renderCatalog evaluates results
  const pioneerBox = document.getElementById('advPioneerFallback');
  if (pioneerBox) {
    pioneerBox.classList.add('hidden');
  }

  // Update Submission form dropdown match
  const submitSelect = document.getElementById('targetSheetTab');
  if (submitSelect) submitSelect.value = tabName;

  // Accessibility: Update Tab Switcher UI styling and aria-selected states
  document.querySelectorAll('#sheetTabGroup .sheet-tab-btn').forEach(btn => {
    const isTarget = btn.getAttribute('data-tab') === tabName;
    const dot = btn.querySelector('.rounded-full');
    const tabNum = btn.querySelector('.font-mono:last-child');

    btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');

    if (isTarget) {
      btn.className = 'sheet-tab-btn min-h-[48px] px-3.5 py-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 text-white font-bold flex items-center justify-between transition focus:ring-2 focus:ring-rose-500';
      if (dot) dot.className = 'w-2.5 h-2.5 rounded-full bg-rose-500';
      if (tabNum) tabNum.className = 'text-[10px] text-rose-400 opacity-80 font-mono';
    } else {
      btn.className = 'sheet-tab-btn min-h-[48px] px-3.5 py-2.5 rounded-xl border border-race-border bg-[#161a25] text-slate-300 hover:text-white font-semibold flex items-center justify-between transition focus:ring-2 focus:ring-rose-500';
      if (dot) dot.className = 'w-2.5 h-2.5 rounded-full bg-slate-600';
      if (tabNum) tabNum.className = 'text-[10px] text-slate-500 font-mono';
    }
  });

  fetchSheetTab(tabName);
}

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

function handleSearch(val) {
  searchQuery = val;
  const dInput = document.getElementById('desktopSearchInput');
  const mInput = document.getElementById('mobileSearchInput');
  if (dInput && dInput.value !== val) dInput.value = val;
  if (mInput && mInput.value !== val) mInput.value = val;
  renderCatalog();
}

/* ==========================================================================
   04. CATALOG RENDERING & EMPTY STATE ARCHIVE
   ========================================================================== */
function renderCatalog() {
  const grid = document.getElementById('partsGrid');
  const noResults = document.getElementById('noResultsNotice');
  const pioneerBox = document.getElementById('advPioneerFallback');
  const counter = document.getElementById('catalogStatusCounter');
  if (!grid) return;

  // Guard: If no bike is picked yet, do not trigger the "No parts found" notice
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

  // Handle No Results State only when a tab is actively loaded
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

  // When parts exist, show the grid
  grid.classList.remove('hidden');
  if (noResults) noResults.classList.add('hidden');
  if (pioneerBox) pioneerBox.classList.add('hidden');

  grid.innerHTML = filtered.map(part => `
    <article class="bg-race-card rounded-2xl border border-race-border overflow-hidden flex flex-col group hover:border-rose-500/50 hover:shadow-xl hover:shadow-rose-500/5 transition-all duration-300">
      <div class="relative h-44 sm:h-48 w-full bg-[#0d0f15] overflow-hidden">
        <img 
          src="${part.image}" 
          alt="${part.name}" 
          loading="lazy"
          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onerror="this.src='https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=600&q=80';"
        />
        <div class="absolute inset-0 bg-gradient-to-t from-race-card via-transparent to-black/30"></div>
        <div class="absolute top-3 left-3 flex gap-1.5 font-mono">
          <span class="px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide bg-black/60 backdrop-blur-md text-rose-400 border border-white/10">
            ${part.category}
          </span>
        </div>
        <div class="absolute top-3 right-3 font-mono">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
            ${part.id}
          </span>
        </div>
      </div>

      <div class="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4 font-mono">
        <div>
          <div class="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>${part.material}</span>
            <span class="text-rose-400 font-bold">${part.compatibility[0] || currentActiveTab}</span>
          </div>
          <h3 class="font-bold text-white text-sm sm:text-base leading-snug group-hover:text-rose-400 transition-colors">
            ${part.name}
          </h3>
          <p class="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
            ${part.specs}
          </p>
        </div>

        <div class="pt-3 border-t border-race-border">
          <div class="flex items-baseline justify-between mb-3">
            <span class="text-[11px] text-slate-400">ESTIMATE / SRP</span>
            <span class="text-base sm:text-lg font-bold text-white">${part.price > 0 ? `₱${part.price.toLocaleString()}` : 'OEM SPEC'}</span>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <button 
              type="button"
              onclick="openSpecsModal('${part.id}')"
              class="w-full min-h-[44px] py-2 px-2.5 rounded-xl text-xs font-semibold bg-[#1d2230] hover:bg-[#252b3d] text-slate-200 border border-race-border transition flex items-center justify-center gap-1.5 active:scale-95 focus:ring-2 focus:ring-rose-500"
              aria-label="View technical specifications for ${part.name}"
            >
              <i class="ph-bold ph-sliders-horizontal" aria-hidden="true"></i> Specs
            </button>
            <a 
              href="${part.link !== '#' ? part.link : 'https://shopee.ph'}" 
              target="_blank" 
              rel="noopener noreferrer" 
              class="w-full min-h-[44px] py-2 px-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition flex items-center justify-center gap-1 shadow-sm shadow-rose-600/30 active:scale-95 focus:ring-2 focus:ring-rose-500"
              aria-label="Buy ${part.name} on online store"
            >
              <span>Shopee</span>
              <i class="ph-bold ph-arrow-up-right text-xs" aria-hidden="true"></i>
            </a>
          </div>
        </div>
      </div>
    </article>
  `).join('');
}

/* ==========================================================================
   05. FIELD DIAGNOSTICS & ACCORDIONS
   ========================================================================== */
function renderIssues() {
  const container = document.getElementById('issuesContainer');
  if (!container) return;

  container.innerHTML = KNOWN_ISSUES.map(issue => `
    <div class="rounded-xl border border-race-border bg-race-card overflow-hidden transition-all">
      <button 
        type="button" 
        onclick="toggleAccordion('${issue.id}')" 
        class="w-full text-left p-4 sm:p-5 flex items-center justify-between gap-3 hover:bg-white/[0.02] transition active:bg-white/5 focus:ring-2 focus:ring-rose-500"
        aria-expanded="false"
        aria-controls="content-${issue.id}"
      >
        <div class="flex items-start sm:items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0" aria-hidden="true">
            <i class="ph-bold ph-warning text-lg"></i>
          </div>
          <div>
            <div class="flex flex-wrap items-center gap-1.5 mb-1 font-mono">
              <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10">
                ${issue.category}
              </span>
              <span class="text-[10px] font-semibold text-rose-400">
                ${issue.severity}
              </span>
            </div>
            <h3 class="text-xs sm:text-base font-bold text-white font-mono">${issue.title}</h3>
          </div>
        </div>
        <i class="ph ph-caret-down text-lg text-slate-400 transition-transform duration-300 shrink-0" id="icon-${issue.id}" aria-hidden="true"></i>
      </button>

      <div id="content-${issue.id}" class="hidden border-t border-race-border p-4 sm:p-5 bg-[#0f111a] text-xs sm:text-sm space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 font-mono">
          <div class="bg-[#151924] p-3.5 rounded-lg border border-race-border">
            <div class="text-[11px] font-bold uppercase tracking-wider text-rose-400 mb-1 flex items-center gap-1.5">
              <i class="ph-bold ph-waveform" aria-hidden="true"></i> Symptoms
            </div>
            <p class="text-slate-300 leading-relaxed text-xs">${issue.symptoms}</p>
          </div>

          <div class="bg-[#151924] p-3.5 rounded-lg border border-race-border">
            <div class="text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-1 flex items-center gap-1.5">
              <i class="ph-bold ph-magnifying-glass" aria-hidden="true"></i> Root Cause
            </div>
            <p class="text-slate-300 leading-relaxed text-xs">${issue.rootCause}</p>
          </div>
        </div>

        <div class="bg-[#151924] p-3.5 sm:p-4 rounded-lg border border-race-border space-y-2">
          <div class="text-[11px] font-bold font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <i class="ph-bold ph-wrench" aria-hidden="true"></i> Field Fix Procedure
          </div>
          <div class="text-slate-300 leading-relaxed text-xs font-mono space-y-1">
            ${issue.solution}
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

function toggleAccordion(id) {
  const content = document.getElementById(`content-${id}`);
  const icon = document.getElementById(`icon-${id}`);
  const triggerBtn = document.querySelector(`button[aria-controls="content-${id}"]`);
  if (!content) return;

  const isExpanded = content.classList.contains('hidden');
  if (isExpanded) {
    content.classList.remove('hidden');
    if (icon) icon.classList.add('rotate-180');
    if (triggerBtn) triggerBtn.setAttribute('aria-expanded', 'true');
  } else {
    content.classList.add('hidden');
    if (icon) icon.classList.remove('rotate-180');
    if (triggerBtn) triggerBtn.setAttribute('aria-expanded', 'false');
  }
}

/* ==========================================================================
   06. SPECIFICATIONS BLUEPRINT MODAL (ACCESSIBLE & FOCUS TRAPPED)
   ========================================================================== */
function openSpecsModal(partId) {
  const part = ACTIVE_PARTS.find(p => p.id === partId);
  if (!part) return;

  // Save the currently focused element to return focus after modal closes
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
    // Shift keyboard & screen reader focus inside the dialog to the Close button
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
    // Accessibility: Return focus back to the button that opened the modal
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
  }, 300);
}

/* ==========================================================================
   07. NAVIGATION & UTILITIES
   ========================================================================== */
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

function toggleMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  if (menu) menu.classList.toggle('hidden');
}

/* ==========================================================================
   08. INITIALIZATION & SINGLE DISPATCHER SETUP
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  renderIssues();

  // Highlight tab switcher on load to guide the user
  const tabGroup = document.getElementById('sheetTabGroup');
  if (tabGroup) {
    tabGroup.classList.add('model-prompt-highlight');
  }
  
  // Set initial status prompt
  const counter = document.getElementById('catalogStatusCounter');
  if (counter) {
    counter.textContent = 'PLEASE SELECT A MOTORCYCLE MODEL';
    counter.className = 'text-[10px] sm:text-[11px] font-mono text-amber-400 font-bold';
  }

  // Unified 9-Column Submission Form Dispatcher
  const form = document.getElementById('compatSubmitForm');
  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      const btn = document.getElementById('submitPartBtn');
      const status = document.getElementById('submissionStatus');

      const linkVal = document.getElementById('partLink').value.trim();
      const rawImage = document.getElementById('partImage').value.trim();

      // Client-side guard: purchase link is mandatory
      if (!linkVal) {
        status.textContent = 'ERR: PURCHASE LINK IS REQUIRED';
        status.className = 'text-xs text-rose-500 font-mono';
        document.getElementById('partLink').focus();
        return;
      }

      // Default placeholder image if no image URL was provided
      const defaultPlaceholder = 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=600&q=80';
      const imageVal = rawImage.startsWith('http') ? rawImage : defaultPlaceholder;

      btn.disabled = true;
      status.textContent = 'COMMITTING TO TARGET TAB...';
      status.className = 'text-xs text-amber-400 font-mono';

      const payload = {
        sheetTab: document.getElementById('targetSheetTab').value,
        category: document.getElementById('partCategory').value.trim(),
        name: document.getElementById('partName').value.trim(),
        specs: document.getElementById('partSpecs').value.trim(),
        compatibility: document.getElementById('partCompatibility').value.trim(),
        material: document.getElementById('partMaterial').value.trim(),
        description: document.getElementById('partDescription').value.trim(),
        link: linkVal,
        image: imageVal,
        price: parseFloat(document.getElementById('partPrice').value) || 0
      };

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

  // Hotkeys: Escape closes modal, "/" focuses instant search
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSpecsModal();
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      document.getElementById('desktopSearchInput')?.focus();
    }
  });

  // Modal Backdrop Click Dismiss
  const modal = document.getElementById('specsModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target.id === 'specsModal') closeSpecsModal();
    });
  }
});

/* ==========================================================================
   CATEGORY DROPDOWN & CUSTOM INPUT TOGGLE
   ========================================================================== */
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
