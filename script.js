/* ==========================================================================
   Payroll Portal — dashboard controller
   ========================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, doc, setDoc, deleteDoc,
  query, where, getDocs, orderBy, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/* ---------------------------------------------------------------- firebase */
const firebaseConfig = {
  apiKey:            "AIzaSyCID8HBa-82SOKDrJ5-7FfBpHanUyPgISs",
  authDomain:        "payroll-tracker-55409.firebaseapp.com",
  projectId:         "payroll-tracker-55409",
  storageBucket:     "payroll-tracker-55409.firebasestorage.app",
  messagingSenderId: "336268687896",
  appId:             "1:336268687896:web:666719cdb5ce72db27616d"
};

const db = getFirestore(initializeApp(firebaseConfig));

/* --------------------------------------------------------------- constants */
const CATEGORIES = [
  "Admin GPS", "Finance GPS", "Finance HPZ", "Admin HPZ", "Team comm",
  "Sales HPZ", "Gudang", "Driver", "Mekanik HPZ", "Mekanik GPS",
  "Mekanik CCTV", "Helper"
];

const BONUS_KERAJINAN    = 300_000;
const CLEANING_ALLOWANCE = 1_000_000;

const RATES = {
  gpsUnit:        5_000,
  gpsInstall:    25_000,
  gpsCheck:      15_000,
  cctvInstall:   25_000,
  cctvService:   15_000,
  salesCommission: 0.01
};

/* ──────────────────────────────────────────────────────────────────────────
   Lombok workers
   ---------------------------------------------------------------------------
   A restricted subset of the roster. They never appear in admin (Ayu /
   Christy) category dropdowns and their records are always submitted with
   `hasKerajinanBonus: false`. Only Mr. Thusen can file data for them.
   ────────────────────────────────────────────────────────────────────────── */
const LOMBOK_WORKERS = [
  { name: "Efendi Zulsilhamdi",         category: "Mekanik HPZ" },
  { name: "Afrilia Indriyani",           category: "Admin HPZ"   },
  { name: "Iwan Pratama",                category: "Sales HPZ"   },
  { name: "Ni Kadek Dwina Suryani Dewi", category: "Admin HPZ"   }
];
const LOMBOK_NAMES   = new Set(LOMBOK_WORKERS.map((w) => w.name));
const LOMBOK_BY_NAME = new Map(LOMBOK_WORKERS.map((w) => [w.name, w.category]));

const DEFAULT_ROSTER = {
  "Admin GPS":   ["Mei Dhea Cahya Ardika", "Ni Wayan Widiantari", "Tri Maharani"],
  "Finance GPS": ["Wahyuningsih"],
  "Finance HPZ": ["Christy Martika"],
  "Admin HPZ":   ["Ni Luh Ayu Atmi Kamaratih", "Widya Nurliza", "Ni Luh Febriyanti",
                  "Aldina Verbiana", "Afrilia Indriyani", "Ni Kadek Dwina Suryani Dewi"],
  "Team comm":   ["Tio Atrik Herdiansyah"],
  "Sales HPZ":   ["Richard Antonius", "Iwan Pratama"],
  "Gudang":      ["Pande Gede Ngurah Dana", "Ashera Devi Swarna Vista",
                  "Nadia Ayu Riskiyah Putri", "Ganna Sine Kustury Vegat"],
  "Driver":      ["Hersi Arnantyo", "Wiraganda Pattiwaellapia"],
  "Mekanik HPZ": ["Rohmad Imam Safii", "Ahmad Ardy Firmansyah", "Candra Bayu Pratama",
                  "Munhamir Amin Almadkur", "Efendi Zulsilhamdi"],
  "Mekanik GPS": ["Heri Hermansah", "Hauzi Alwi"],
  "Mekanik CCTV":["Jackson M Bessie", "Stefanus Rofinus R C"],
  "Helper":      ["Yoyok Ujianto"]
};

/* -------------------------------------------------------------- dom helper */
const $  = (id) => document.getElementById(id);
const on = (el, evt, fn, opts) => el && el.addEventListener(evt, fn, opts);

/* ------------------------------------------------------------------- state */
const state = {
  user:     null,
  isOwner:  false,
  roster:   structuredClone(DEFAULT_ROSTER),
  wages:    {},
  records:  []
};

/* ------------------------------------------------------------- formatting */
const nf = new Intl.NumberFormat('en-US');

const formatMoney = (v) => {
  const digits = String(v ?? '').replace(/\D/g, '');
  return digits ? nf.format(Number(digits)) : '';
};
const parseMoney = (v) => Number(String(v ?? '').replace(/\D/g, '')) || 0;
const rupiah     = (n) => `Rp ${nf.format(Math.round(Number(n) || 0))}`;

/* ------------------------------------------------------------------ toast */
function toast(message, type = 'info', ms = 3600) {
  const host = $('toastHost');
  if (!host) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => {
    el.classList.add('leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, ms);
}

/* ------------------------------------------------------------------ theme */
const THEME_KEY = 'payrollTheme';

function applyTheme(theme) {
  const light = theme === 'light';
  document.documentElement.classList.toggle('light', light);
  $('themeIconSun')?.classList.toggle('hidden', !light);
  $('themeIconMoon')?.classList.toggle('hidden', light);
}

applyTheme(document.documentElement.classList.contains('light') ? 'light' : 'dark');

$('themeToggleBtn')?.addEventListener('click', () => {
  const next = document.documentElement.classList.contains('light') ? 'dark' : 'light';
  try { localStorage.setItem(THEME_KEY, next); } catch (_) { /* quota */ }
  applyTheme(next);
});

/* --------------------------------------------------- money input delegation */
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el instanceof HTMLInputElement && el.classList.contains('money-input')) {
    el.value = formatMoney(el.value);
  }
});

/* ------------------------------------------------------------ debounce util */
function debounce(fn, wait = 180) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/* ------------------------------------------------- populate category selects */
function fillCategorySelect(select, { includeAll = false, allLabel = 'All Categories' } = {}) {
  if (!select) return;
  select.replaceChildren();
  if (includeAll) select.appendChild(new Option(allLabel, 'ALL', false, true));
  CATEGORIES.forEach((c) => select.appendChild(new Option(c, c)));
}

fillCategorySelect($('workerType'));
fillCategorySelect($('settingCategorySelect'), { includeAll: true });
fillCategorySelect($('newWorkerCategory'));
fillCategorySelect($('rosterCategoryFilter'), { includeAll: true });

/* Table filter: add a Lombok-only option after the categories */
(function addLombokTableFilter() {
  const sel = $('tableCategoryFilter');
  if (!sel) return;
  sel.replaceChildren();
  sel.appendChild(new Option('All Categories', 'ALL', false, true));
  CATEGORIES.forEach((c) => sel.appendChild(new Option(c, c)));

  /* Group visually with a divider option */
  const sep = new Option('──────────', 'SEP');
  sep.disabled = true;
  sel.appendChild(sep);

  sel.appendChild(new Option('★ Lombok Workers (Owner only)', 'LOMBOK'));
})();

/* -------------------------------------------------------- session & routing */
const params = new URLSearchParams(window.location.search);
state.user    = params.get('user') || sessionStorage.getItem('activePayrollUser');
state.isOwner = state.user === 'Thusen';

$('activeUserBadge').textContent = state.isOwner
  ? 'Mr. Thusen · Owner'
  : state.user ? `${state.user} · Admin` : 'Guest User';

$('exitSessionBtn').addEventListener('click', () => {
  sessionStorage.removeItem('activePayrollUser');
  window.location.href = 'index.html';
});

/* ------------------------------------------------------- role-based layout */
(function applyRolePermissions() {
  $('ownerSection').classList.toggle('hidden', !state.isOwner);
  $('gajiPokokSettingsSection').classList.toggle('hidden', !state.isOwner);
  $('lombokFormSection').classList.toggle('hidden', !state.isOwner);
  $('adminFormSection').classList.toggle('hidden', state.isOwner);
})();

/* ==========================================================================
   Filter & section-state persistence
   --------------------------------------------------------------------------
   Remembers the Financial Overview filters (period, category, search) and
   the collapse state of the table / filter panel across navigations within
   the same browser tab. Opening a payslip and returning lands you on the
   exact same table view.
   ========================================================================== */
const FILTER_STATE_KEY = 'payrollFilters';

function readFilterState() {
  try {
    const raw = sessionStorage.getItem(FILTER_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function writeFilterState() {
  const period   = $('tablePeriodFilter');
  const category = $('tableCategoryFilter');
  const search   = $('tableSearchInput');
  const table    = $('tableContent');
  const filters  = $('filterToolbar');
  if (!period || !category || !search || !table || !filters) return;

  try {
    sessionStorage.setItem(FILTER_STATE_KEY, JSON.stringify({
      period:          period.value,
      category:        category.value,
      search:          search.value,
      tableCollapsed:  table.classList.contains('is-collapsed'),
      filterCollapsed: filters.classList.contains('is-collapsed')
    }));
  } catch (_) { /* quota */ }
}

/**
 * Apply any saved state (filter values + collapse flags).
 * Collapse flags MUST be applied to the panel classes BEFORE
 * bindCollapsible runs so the toggles pick up the right initial state.
 */
function applySavedFilterState() {
  const saved = readFilterState();
  if (!saved) return;

  const period   = $('tablePeriodFilter');
  const category = $('tableCategoryFilter');
  const search   = $('tableSearchInput');
  const table    = $('tableContent');
  const filters  = $('filterToolbar');

  if (period   && typeof saved.period === 'string')   period.value   = saved.period;
  if (category && typeof saved.category === 'string') category.value = saved.category;
  if (search   && typeof saved.search === 'string')   search.value   = saved.search;

  if (table)   table.classList.toggle('is-collapsed',   !!saved.tableCollapsed);
  if (filters) filters.classList.toggle('is-collapsed', !!saved.filterCollapsed);
}

/* Run once before anything reads the panel state */
applySavedFilterState();

/* -------------------------------------------------------- default month */
(function setDefaultMonth() {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const recordMonth = $('recordMonth');
  const lombokMonth = $('lombokRecordMonth');
  const tablePeriod = $('tablePeriodFilter');

  if (recordMonth) recordMonth.value = ym;
  if (lombokMonth) lombokMonth.value = ym;

  /* Only default the table filter if the user hasn't already narrowed it */
  if (tablePeriod && !tablePeriod.value) tablePeriod.value = ym;
})();

/* ==========================================================================
   Collapsible sections
   ========================================================================== */
function bindCollapsible(triggers, panel, chevron, labelEl, onToggle) {
  if (!panel) { console.warn('[collapsible] panel not found'); return null; }

  const triggerList = triggers.filter(Boolean);
  if (triggerList.length === 0) {
    console.warn('[collapsible] no triggers for panel', panel.id);
    return null;
  }

  let collapsed = panel.classList.contains('is-collapsed');

  const render = () => {
    panel.style.display = collapsed ? 'none' : '';
    panel.classList.toggle('is-collapsed', collapsed);

    if (chevron) {
      chevron.style.transform = collapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
    }
    if (labelEl) {
      labelEl.textContent = collapsed ? 'Expand' : 'Minimise';
    }
    triggerList.forEach((el) => {
      if (el.hasAttribute('aria-expanded')) {
        el.setAttribute('aria-expanded', String(!collapsed));
      }
    });
  };

  const toggle = () => {
    collapsed = !collapsed;
    render();
    if (typeof onToggle === 'function') onToggle();
  };

  triggerList.forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    });
  });

  render();
  return { toggle, isCollapsed: () => collapsed };
}

bindCollapsible(
  [$('toggleSettingsBtn')],
  $('settingsContent'),
  $('settingsChevron'),
  $('settingsToggleLabel')
);

const tableCtl = bindCollapsible(
  [$('toggleTableBtn'), $('toggleTableTitleArea')],
  $('tableContent'),
  $('tableChevron'),
  $('tableToggleLabel'),
  writeFilterState
);

const filterToolbar = $('filterToolbar');
const filterChevron = $('filterChevron');

if (filterToolbar && $('toggleFilterBtn')) {
  let filterCollapsed = filterToolbar.classList.contains('is-collapsed');

  const renderFilter = () => {
    filterToolbar.style.display = filterCollapsed ? 'none' : '';
    filterToolbar.classList.toggle('is-collapsed', filterCollapsed);
    if (filterChevron) {
      filterChevron.style.transform = filterCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
    }
    $('toggleFilterBtn').setAttribute('aria-expanded', String(!filterCollapsed));
  };

  $('toggleFilterBtn').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (tableCtl && tableCtl.isCollapsed()) tableCtl.toggle();
    filterCollapsed = !filterCollapsed;
    renderFilter();
    writeFilterState();
  });

  renderFilter();
}

/* ==========================================================================
   Dynamic metric inputs
   ========================================================================== */
const workerTypeSelect  = $('workerType');
const workerSelect      = $('workerName');
const dynamicInputs     = $('dynamicInputs');
const punctualityBlock  = $('punctualityBlock');
const kasbonKantorInput = $('kasbonKantorInput');

const field = (id, label, { type = 'number', value = '0', money = false, min = '0' } = {}) => `
  <div>
    <label for="${id}" class="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-brand">${label}</label>
    <input type="${type}" id="${id}" value="${value}" ${type === 'number' ? `min="${min}"` : ''}
           inputmode="${money ? 'numeric' : 'decimal'}"
           class="field ${money ? 'money-input' : ''} font-mono" />
  </div>`;

/* Lombok variant — amber labels to visually differentiate */
const lombokField = (id, label, { type = 'number', value = '0', money = false, min = '0' } = {}) => `
  <div>
    <label for="${id}" class="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-warn">${label}</label>
    <input type="${type}" id="${id}" value="${value}" ${type === 'number' ? `min="${min}"` : ''}
           inputmode="${money ? 'numeric' : 'decimal'}"
           class="field ${money ? 'money-input' : ''} font-mono" />
  </div>`;

function renderDynamicInputs() {
  const category = workerTypeSelect.value;

  punctualityBlock.classList.toggle('hidden', category === 'Sales HPZ');

  let html = '';

  switch (category) {
    case 'Admin GPS':
      html = `<div class="md:col-span-2">${field('unitCount', 'Jumlah Penjualan Unit GPS')}</div>`;
      break;

    case 'Sales HPZ':
      html = `<div class="md:col-span-2">${field('sales3Months', 'Total Penjualan 3 Bulan Terakhir (IDR)', { type: 'text', money: true })}</div>`;
      break;

    case 'Mekanik HPZ':
      html = `<div class="md:col-span-2">${field('instalasiHpzAmount', 'Total Penjualan Instalasi HPZ Bulan Ini (IDR)', { type: 'text', money: true })}</div>`;
      break;

    case 'Mekanik GPS':
    case 'Helper':
      html = field('pasangGpsUnits', 'Jumlah Pasang GPS')
           + field('cekGpsUnits', 'Jumlah Cek Unit GPS');
      break;

    case 'Mekanik CCTV':
      html = field('pasangCctvUnits', 'Jumlah Pasang CCTV')
           + field('servisCctvUnits', 'Jumlah Servis CCTV');
      break;

    default:
      html = `<p class="md:col-span-2 text-xs italic text-muted">
                No variable metrics required for this role — standard wage components apply.
              </p>`;
  }

  dynamicInputs.innerHTML = html;
}

/* ---------- Lombok dynamic inputs (prefixed IDs) ---------- */
function renderLombokDynamicInputs() {
  const workerName = $('lombokWorker').value;
  const category   = LOMBOK_BY_NAME.get(workerName) || '';

  $('lombokCategoryDisplay').textContent = category || '—';

  let html = '';
  const f = (id, label, opts) => lombokField(`lombok_${id}`, label, opts);

  switch (category) {
    case 'Admin GPS':
      html = `<div class="md:col-span-2">${f('unitCount', 'Jumlah Penjualan Unit GPS')}</div>`;
      break;

    case 'Sales HPZ':
      html = `<div class="md:col-span-2">${f('sales3Months', 'Total Penjualan 3 Bulan Terakhir (IDR)', { type: 'text', money: true })}</div>`;
      break;

    case 'Mekanik HPZ':
      html = `<div class="md:col-span-2">${f('instalasiHpzAmount', 'Total Penjualan Instalasi HPZ Bulan Ini (IDR)', { type: 'text', money: true })}</div>`;
      break;

    case 'Mekanik GPS':
    case 'Helper':
      html = f('pasangGpsUnits', 'Jumlah Pasang GPS')
           + f('cekGpsUnits', 'Jumlah Cek Unit GPS');
      break;

    case 'Mekanik CCTV':
      html = f('pasangCctvUnits', 'Jumlah Pasang CCTV')
           + f('servisCctvUnits', 'Jumlah Servis CCTV');
      break;

    default:
      html = `<p class="md:col-span-2 text-xs italic text-muted">
                Select a Lombok worker to load their performance fields.
              </p>`;
  }

  $('lombokDynamicInputs').innerHTML = html;
}

/* ==========================================================================
   Worker option lists
   ========================================================================== */
function updateWorkerOptions() {
  /* Exclude Lombok workers from the admin-facing list. */
  const workers = (state.roster[workerTypeSelect.value] || [])
    .filter((name) => !LOMBOK_NAMES.has(name));

  workerSelect.replaceChildren(new Option('Select Worker', '', true, true));
  workerSelect.firstElementChild.disabled = true;
  workers.forEach((name) => workerSelect.appendChild(new Option(name, name)));
}

function updateSettingsWorkerDropdown() {
  const cat = $('settingCategorySelect').value;
  const list = cat === 'ALL'
    ? Object.values(state.roster).flat().sort((a, b) => a.localeCompare(b))
    : (state.roster[cat] || []);

  const sel = $('settingWorkerSelect');
  sel.replaceChildren(new Option('Select Worker', '', true, true));
  sel.firstElementChild.disabled = true;
  list.forEach((name) => sel.appendChild(new Option(name, name)));
}

/* ==========================================================================
   Lombok worker dropdown
   ========================================================================== */
function populateLombokWorkerDropdown() {
  const sel = $('lombokWorker');
  if (!sel) return;
  sel.replaceChildren(new Option('Select Lombok Worker', '', true, true));
  sel.firstElementChild.disabled = true;
  LOMBOK_WORKERS.forEach((w) => {
    sel.appendChild(new Option(`${w.name} — ${w.category}`, w.name));
  });
}

/* ==========================================================================
   Wage configuration form
   ========================================================================== */
const SETTING_FIELDS = [
  'settingGajiPokokAmount',
  'settingInsentifAmount',
  'settingUangMakanAmount',
  'settingKasbonLama',
  'settingPotonganKasbon',
  'settingKasbonKantor'
];

function updateSisaKasbonLive() {
  const lama = parseMoney($('settingKasbonLama').value);
  const pot  = parseMoney($('settingPotonganKasbon').value);
  $('settingSisaKasbonDisplay').textContent = rupiah(Math.max(0, lama - pot));
}

function loadSettingsForWorker(workerName) {
  const cfg = state.wages[workerName];

  const values = cfg
    ? {
        settingGajiPokokAmount: cfg.defaultGajiPokok,
        settingInsentifAmount:  cfg.insentif,
        settingUangMakanAmount: cfg.uangMakan,
        settingKasbonLama:      cfg.kasbonLama,
        settingPotonganKasbon:  cfg.potonganKasbon,
        settingKasbonKantor:    cfg.kasbonKantor
      }
    : Object.fromEntries(SETTING_FIELDS.map((id) => [id, 0]));

  SETTING_FIELDS.forEach((id) => { $(id).value = formatMoney(values[id] ?? 0); });
  updateSisaKasbonLive();
}

on($('settingCategorySelect'), 'change', updateSettingsWorkerDropdown);
on($('settingWorkerSelect'), 'change', (e) => loadSettingsForWorker(e.target.value));
on($('settingKasbonLama'), 'input', updateSisaKasbonLive);
on($('settingPotonganKasbon'), 'input', updateSisaKasbonLive);

/* ==========================================================================
   Wage maths
   ========================================================================== */
function resolveLoan(record, settings) {
  const kasbonLama = settings.kasbonLama ?? record.kasbonLama ?? 0;
  const rawDeduct  = settings.potonganKasbon ?? record.potonganKasbon ?? 0;
  const potongan   = kasbonLama > 0 && rawDeduct > 0 ? Math.min(rawDeduct, kasbonLama) : 0;
  return {
    kasbonLama,
    potonganKasbon: potongan,
    kasbonKantor:   record.kasbonKantor ?? settings.kasbonKantor ?? 0,
    sisaKasbon:     Math.max(0, kasbonLama - potongan)
  };
}

/* Lombok workers never receive a punctuality bonus — enforced here as a
   safety net so historical/imported records can't slip through. */
function isKerajinanEligible(record) {
  if (LOMBOK_NAMES.has(record.workerName)) return false;
  return !!record.hasKerajinanBonus;
}

function calculateTotalWage(record, settings = {}) {
  const base     = settings.defaultGajiPokok || 0;
  const meal     = settings.uangMakan || 0;
  const insentif = settings.insentif || 0;
  const bonusKerajinan = isKerajinanEligible(record) ? BONUS_KERAJINAN : 0;

  const { potonganKasbon, kasbonKantor } = resolveLoan(record, settings);
  const deductions = potonganKasbon + kasbonKantor;
  const m = record.metrics || {};

  switch (record.workerType) {
    case 'Admin GPS':
      return base + meal + insentif + bonusKerajinan + (m.unitCount || 0) * RATES.gpsUnit - deductions;

    case 'Sales HPZ':
      return meal + (m.sales3Months || 0) * RATES.salesCommission - deductions;

    case 'Mekanik HPZ':
      return base + meal + insentif + bonusKerajinan + (m.instalasiHpzAmount || 0) * RATES.salesCommission - deductions;

    case 'Mekanik GPS':
      return base + meal + insentif + bonusKerajinan
           + (m.pasangGpsUnits || 0) * RATES.gpsInstall
           + (m.cekGpsUnits || 0) * RATES.gpsCheck - deductions;

    case 'Mekanik CCTV':
      return base + meal + insentif + bonusKerajinan
           + (m.pasangCctvUnits || 0) * RATES.cctvInstall
           + (m.servisCctvUnits || 0) * RATES.cctvService - deductions;

    case 'Helper':
      return base + meal + insentif + bonusKerajinan
           + (m.pasangGpsUnits || 0) * RATES.gpsInstall
           + (m.cekGpsUnits || 0) * RATES.gpsCheck
           + (m.cleaningServiceAllowance ?? CLEANING_ALLOWANCE) - deductions;

    default:
      return base + meal + insentif + bonusKerajinan - deductions;
  }
}

/* ==========================================================================
   Submit — payroll record (admin form)
   ========================================================================== */
const payrollForm = $('payrollForm');

payrollForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const workerName = workerSelect.value;
  const category   = workerTypeSelect.value;
  const month      = $('recordMonth').value;

  if (!workerName || !category || !month) {
    toast('Please select a worker and payroll month.', 'error');
    return;
  }

  /* Hard guard: Lombok workers are owner-only. */
  if (LOMBOK_NAMES.has(workerName)) {
    toast('That worker is Lombok-only and cannot be filed from this form.', 'error');
    return;
  }

  const submitBtn = $('submitPayrollBtn');
  submitBtn.disabled = true;

  try {
    const dupSnap = await getDocs(query(
      collection(db, 'payroll_records'),
      where('workerName', '==', workerName),
      where('recordMonth', '==', month)
    ));

    if (!dupSnap.empty) {
      const label = new Date(`${month}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      toast(`A record for "${workerName}" already exists for ${label}.`, 'error', 5000);
      return;
    }

    const metrics = {};
    switch (category) {
      case 'Admin GPS':
        metrics.unitCount = Number($('unitCount')?.value || 0);
        break;
      case 'Sales HPZ':
        metrics.sales3Months = parseMoney($('sales3Months')?.value);
        break;
      case 'Mekanik HPZ':
        metrics.instalasiHpzAmount = parseMoney($('instalasiHpzAmount')?.value);
        break;
      case 'Mekanik GPS':
        metrics.pasangGpsUnits = Number($('pasangGpsUnits')?.value || 0);
        metrics.cekGpsUnits    = Number($('cekGpsUnits')?.value || 0);
        break;
      case 'Mekanik CCTV':
        metrics.pasangCctvUnits = Number($('pasangCctvUnits')?.value || 0);
        metrics.servisCctvUnits = Number($('servisCctvUnits')?.value || 0);
        break;
      case 'Helper':
        metrics.pasangGpsUnits = Number($('pasangGpsUnits')?.value || 0);
        metrics.cekGpsUnits    = Number($('cekGpsUnits')?.value || 0);
        metrics.cleaningServiceAllowance = CLEANING_ALLOWANCE;
        break;
    }

    const cfg        = state.wages[workerName] || {};
    const kasbonLama = cfg.kasbonLama || 0;
    const setting    = cfg.potonganKasbon || 0;
    const potongan   = kasbonLama > 0 && setting > 0 ? Math.min(setting, kasbonLama) : 0;

    await addDoc(collection(db, 'payroll_records'), {
      workerName,
      workerType: category,
      recordMonth: month,
      hasKerajinanBonus: category === 'Sales HPZ'
        ? false
        : $('hasKerajinanBonus').value === 'true',
      isLombok: false,
      kasbonKantor: parseMoney(kasbonKantorInput.value),
      potonganKasbon: potongan,
      kasbonLama,
      metrics,
      submittedBy: state.user || 'Admin',
      timestamp: serverTimestamp()
    });

    toast(`Record for ${workerName} submitted successfully.`, 'success');

    payrollForm.reset();
    $('recordMonth').value = month;
    if (workerTypeSelect.dataset.locked === 'true') {
      workerTypeSelect.value = category;
    }
    updateWorkerOptions();
    renderDynamicInputs();
    kasbonKantorInput.value = '0';

  } catch (err) {
    console.error('Failed to save payroll record:', err);
    toast('Could not save the record. Please try again.', 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

/* ==========================================================================
   Submit — Lombok payroll record (owner only)
   ========================================================================== */
const lombokForm = $('lombokForm');

lombokForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!state.isOwner) {
    toast('Only the owner can file Lombok records.', 'error');
    return;
  }

  const workerName = $('lombokWorker').value;
  const category   = LOMBOK_BY_NAME.get(workerName);
  const month      = $('lombokRecordMonth').value;

  if (!workerName || !category || !month) {
    toast('Please select a Lombok worker and payroll month.', 'error');
    return;
  }

  const submitBtn = $('lombokSubmitBtn');
  submitBtn.disabled = true;

  try {
    const dupSnap = await getDocs(query(
      collection(db, 'payroll_records'),
      where('workerName', '==', workerName),
      where('recordMonth', '==', month)
    ));

    if (!dupSnap.empty) {
      const label = new Date(`${month}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      toast(`A record for "${workerName}" already exists for ${label}.`, 'error', 5000);
      return;
    }

    const metrics = {};
    switch (category) {
      case 'Admin GPS':
        metrics.unitCount = Number($('lombok_unitCount')?.value || 0);
        break;
      case 'Sales HPZ':
        metrics.sales3Months = parseMoney($('lombok_sales3Months')?.value);
        break;
      case 'Mekanik HPZ':
        metrics.instalasiHpzAmount = parseMoney($('lombok_instalasiHpzAmount')?.value);
        break;
      case 'Mekanik GPS':
        metrics.pasangGpsUnits = Number($('lombok_pasangGpsUnits')?.value || 0);
        metrics.cekGpsUnits    = Number($('lombok_cekGpsUnits')?.value || 0);
        break;
      case 'Mekanik CCTV':
        metrics.pasangCctvUnits = Number($('lombok_pasangCctvUnits')?.value || 0);
        metrics.servisCctvUnits = Number($('lombok_servisCctvUnits')?.value || 0);
        break;
      case 'Helper':
        metrics.pasangGpsUnits = Number($('lombok_pasangGpsUnits')?.value || 0);
        metrics.cekGpsUnits    = Number($('lombok_cekGpsUnits')?.value || 0);
        metrics.cleaningServiceAllowance = CLEANING_ALLOWANCE;
        break;
    }

    const cfg        = state.wages[workerName] || {};
    const kasbonLama = cfg.kasbonLama || 0;
    const setting    = cfg.potonganKasbon || 0;
    const potongan   = kasbonLama > 0 && setting > 0 ? Math.min(setting, kasbonLama) : 0;

    await addDoc(collection(db, 'payroll_records'), {
      workerName,
      workerType: category,
      recordMonth: month,
      hasKerajinanBonus: false,   // Lombok — no punctuality bonus, ever
      isLombok: true,
      kasbonKantor: parseMoney($('lombokKasbonKantorInput').value),
      potonganKasbon: potongan,
      kasbonLama,
      metrics,
      submittedBy: state.user || 'Admin',
      timestamp: serverTimestamp()
    });

    toast(`Lombok record for ${workerName} submitted successfully.`, 'success');

    /* Reset form, keep month */
    lombokForm.reset();
    $('lombokRecordMonth').value = month;
    $('lombokKasbonKantorInput').value = '0';
    $('lombokCategoryDisplay').textContent = '—';
    $('lombokDynamicInputs').innerHTML = `
      <p class="md:col-span-2 text-xs italic text-muted">
        Select a Lombok worker to load their performance fields.
      </p>`;

  } catch (err) {
    console.error('Failed to save Lombok record:', err);
    toast('Could not save the record. Please try again.', 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

/* ==========================================================================
   Submit — baseline wage configuration
   ========================================================================== */
$('gajiPokokForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const workerName = $('settingWorkerSelect').value;
  if (!workerName) {
    toast('Select a worker first.', 'error');
    return;
  }

  const payload = {
    workerName,
    defaultGajiPokok: parseMoney($('settingGajiPokokAmount').value),
    insentif:         parseMoney($('settingInsentifAmount').value),
    uangMakan:        parseMoney($('settingUangMakanAmount').value),
    kasbonLama:       parseMoney($('settingKasbonLama').value),
    potonganKasbon:   parseMoney($('settingPotonganKasbon').value),
    kasbonKantor:     parseMoney($('settingKasbonKantor').value),
    updatedAt:        serverTimestamp()
  };

  try {
    await setDoc(doc(db, 'default_wages', workerName), payload);
    toast(`Wage & loan configuration saved for ${workerName}.`, 'success');

    e.target.reset();
    $('settingSisaKasbonDisplay').textContent = 'Rp 0';
    updateSettingsWorkerDropdown();
  } catch (err) {
    console.error('Failed to save wage settings:', err);
    toast('Failed to save configuration.', 'error');
  }
});

/* ==========================================================================
   Firestore listeners
   ========================================================================== */
onSnapshot(collection(db, 'worker_roster'), (snap) => {
  const merged = structuredClone(DEFAULT_ROSTER);

  snap.forEach((d) => {
    const { category, workers } = d.data();
    if (category && Array.isArray(workers) && workers.length > 0) {
      merged[category] = workers;
    }
  });

  state.roster = merged;
  try { localStorage.setItem('payrollRoster', JSON.stringify(merged)); } catch (_) { /* quota */ }

  updateWorkerOptions();
  updateSettingsWorkerDropdown();
  renderRosterList();
}, (err) => console.error('roster listener:', err));

onSnapshot(collection(db, 'default_wages'), (snap) => {
  const map = {};
  snap.forEach((d) => {
    const x = d.data();
    map[x.workerName] = {
      defaultGajiPokok: x.defaultGajiPokok || 0,
      insentif:         x.insentif || 0,
      uangMakan:        x.uangMakan || 0,
      kasbonLama:       x.kasbonLama || 0,
      potonganKasbon:   x.potonganKasbon || 0,
      kasbonKantor:     x.kasbonKantor || 0
    };
  });
  state.wages = map;

  if (workerSelect.value && map[workerSelect.value]) {
    kasbonKantorInput.value = formatMoney(map[workerSelect.value].kasbonKantor);
  }
  if ($('lombokWorker').value && map[$('lombokWorker').value]) {
    $('lombokKasbonKantorInput').value = formatMoney(map[$('lombokWorker').value].kasbonKantor);
  }
  scheduleRender();
}, (err) => console.error('wages listener:', err));

onSnapshot(
  query(collection(db, 'payroll_records'), orderBy('timestamp', 'desc')),
  (snap) => {
    state.records = snap.docs.map((d) => {
      const data = d.data();
      const date = data.timestamp?.toDate ? data.timestamp.toDate() : new Date();
      return {
        id: d.id,
        ...data,
        dateISO: date.toISOString(),
        formattedDateTime: date.toLocaleDateString('en-US', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        })
      };
    });
    scheduleRender();
  },
  (err) => console.error('records listener:', err)
);

/* ==========================================================================
   Table rendering
   ========================================================================== */
const payrollTableBody    = $('payrollTableBody');
const payrollTableFooter  = $('payrollTableFooter');
const tableCategoryFilter = $('tableCategoryFilter');
const tableSearchInput    = $('tableSearchInput');
const tablePeriodFilter   = $('tablePeriodFilter');

let renderScheduled = false;
function scheduleRender() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    renderPayrollTable();
  });
}

const monthLabel = (ym) =>
  ym ? new Date(`${ym}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Uncategorised';
const monthShort = (ym) =>
  ym ? new Date(`${ym}-01`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—';

function renderPayrollTable() {
  const cat    = tableCategoryFilter.value;
  const search = tableSearchInput.value.trim().toLowerCase();
  const period = tablePeriodFilter.value;

  const filtered = state.records.filter((r) => {
    const isLombok = LOMBOK_NAMES.has(r.workerName);

    let catMatch = true;
    if (cat === 'LOMBOK') {
      catMatch = isLombok;
    } else if (cat !== 'ALL' && cat !== 'SEP') {
      catMatch = r.workerType === cat;
    }

    return catMatch &&
      (!period || r.recordMonth === period) &&
      (!search || (r.workerName || '').toLowerCase().includes(search));
  });

  if (cat === 'LOMBOK') {
    $('summarySubtext').textContent = period
      ? `Lombok-only commitment for ${monthLabel(period)}.`
      : 'Total Lombok payroll commitment across all recorded periods.';
  } else {
    $('summarySubtext').textContent = period
      ? `Total net payroll commitment for ${monthLabel(period)}.`
      : 'Total net payroll commitment across all recorded periods.';
  }

  if (filtered.length === 0) {
    payrollTableBody.innerHTML =
      `<tr><td colspan="12" class="p-10 text-center text-xs text-dim">No matching financial records found.</td></tr>`;
    payrollTableFooter.innerHTML = '';
    $('grandTotalWageDisplay').textContent = 'Rp 0';
    $('grandTotalRecordCount').textContent = '0 Submissions Included';
    return;
  }

  const groups = new Map();
  filtered.forEach((r) => {
    const key = monthLabel(r.recordMonth);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  });

  const frag = document.createDocumentFragment();
  let grandTotal = 0;

  for (const [monthYear, records] of groups) {
    const head = document.createElement('tr');
    head.className = 'border-y border-line bg-inset';
    head.innerHTML = `<td colspan="12" class="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-brand">
                        ${monthYear} — ${records.length} submission${records.length === 1 ? '' : 's'}
                      </td>`;
    frag.appendChild(head);

    for (const record of records) {
      const settings = state.wages[record.workerName] || {};
      const { potonganKasbon, kasbonKantor, sisaKasbon } = resolveLoan(record, settings);
      const totalWage = calculateTotalWage(record, settings);
      grandTotal += totalWage;

      const isLombokRec = LOMBOK_NAMES.has(record.workerName);

      const kerajinanBadge = isKerajinanEligible(record)
        ? `<span class="rounded-full border border-success/40 bg-success/10 px-2.5 py-0.5 text-[10px] font-semibold text-success">Yes</span>`
        : `<span class="rounded-full border border-danger/40 bg-danger/10 px-2.5 py-0.5 text-[10px] font-semibold text-danger">No</span>`;

      const lombokBadge = isLombokRec
        ? `<span class="ml-2 inline-block align-middle rounded border border-warn/50 bg-warn/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-warn">
             Lombok
           </span>`
        : '';

      const actionCell = state.isOwner
        ? `<td class="p-4 text-center">
             <button type="button"
                     class="delete-btn rounded-lg border border-danger/40 bg-danger/10 p-1.5 text-danger transition-all hover:bg-danger/25 active:scale-95"
                     data-id="${record.id}"
                     data-name="${record.workerName}"
                     data-period="${monthShort(record.recordMonth)}"
                     title="Delete submission">
               <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                       d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
               </svg>
             </button>
           </td>`
        : `<td class="p-4 text-center text-[10px] italic text-dim">View only</td>`;

      const row = document.createElement('tr');
      row.dataset.recordId = record.id;
      row.className = `group cursor-pointer border-b border-line/40 transition-colors hover:bg-brand/5 active:bg-brand/10${isLombokRec ? ' bg-warn/[0.03]' : ''}`;
      row.innerHTML = `
        <td class="p-4 font-medium text-fg transition-colors group-hover:text-brand">
          ${record.workerName}${lombokBadge}
        </td>
        <td class="p-4">
          <span class="rounded-lg border border-line bg-panel/70 px-2.5 py-1 text-[10px] font-semibold text-fg-soft">
            ${record.workerType}
          </span>
        </td>
        <td class="p-4 font-mono text-[11px] text-brand">${monthShort(record.recordMonth)}</td>
        <td class="p-4 font-mono ${settings.defaultGajiPokok ? 'font-semibold text-warn' : 'text-dim'}">
          ${rupiah(settings.defaultGajiPokok || 0)}
        </td>
        <td class="p-4 font-mono ${settings.uangMakan ? 'font-semibold text-success' : 'text-dim'}">
          ${rupiah(settings.uangMakan || 0)}
        </td>
        <td class="p-4">${kerajinanBadge}</td>
        <td class="p-4 font-mono font-semibold text-danger">${rupiah(potonganKasbon)}</td>
        <td class="p-4 font-mono font-semibold text-danger">${rupiah(kasbonKantor)}</td>
        <td class="p-4 font-mono font-semibold text-warn">${rupiah(sisaKasbon)}</td>
        <td class="p-4 bg-success/10 font-mono font-bold text-success">${rupiah(totalWage)}</td>
        <td class="p-4 text-[10px] text-muted">
          <span class="font-medium text-fg-soft">${record.submittedBy || '—'}</span><br>
          <span class="font-mono text-[9px] text-dim">${record.formattedDateTime || ''}</span>
        </td>
        ${actionCell}`;

      frag.appendChild(row);
    }
  }

  payrollTableBody.replaceChildren(frag);

  $('grandTotalWageDisplay').textContent = rupiah(grandTotal);
  $('grandTotalRecordCount').textContent = `${filtered.length} Submission${filtered.length === 1 ? '' : 's'} Included`;

  payrollTableFooter.innerHTML = `
    <tr class="bg-success/10 text-success">
      <td colspan="9" class="p-4 text-right text-[11px] font-extrabold uppercase tracking-wider">
        Grand Total Payroll Commitment
      </td>
      <td class="p-4 font-mono text-sm font-extrabold text-success">${rupiah(grandTotal)}</td>
      <td colspan="2" class="p-4 text-[10px] font-normal text-muted">${filtered.length} worker(s)</td>
    </tr>`;
}

/* ---------- table interactions ---------- */
payrollTableBody.addEventListener('click', (e) => {
  const deleteBtn = e.target.closest('.delete-btn');
  if (deleteBtn) {
    e.stopPropagation();
    deletePayrollRecord(deleteBtn.dataset.id, deleteBtn.dataset.name, deleteBtn.dataset.period);
    return;
  }

  const row = e.target.closest('tr[data-record-id]');
  if (!row) return;

  const record = state.records.find((r) => r.id === row.dataset.recordId);
  if (!record) return;

  openPayslip(record);
});

function openPayslip(record) {
  const settings = state.wages[record.workerName] || {};
  const loan = resolveLoan(record, settings);

  const payload = {
    ...record,
    ...settings,
    ...loan,
    isLombok: LOMBOK_NAMES.has(record.workerName),
    totalWage: calculateTotalWage(record, settings)
  };

  /* Persist the current filter/section state so the dashboard can restore it
     when the user returns from the payslip. */
  writeFilterState();

  try {
    localStorage.setItem('selectedWorker', JSON.stringify(payload));
  } catch (err) {
    console.error('Could not persist payslip payload:', err);
    toast('Storage error — could not open the payslip.', 'error');
    return;
  }

  window.location.href = 'worker-detail.html';
}

async function deletePayrollRecord(recordId, workerName, periodFormatted) {
  if (!confirm(`Permanently delete the submission for "${workerName}" (${periodFormatted})?`)) return;

  try {
    await deleteDoc(doc(db, 'payroll_records', recordId));
    toast(`Record for ${workerName} deleted.`, 'success');
  } catch (err) {
    console.error('Delete failed:', err);
    toast('Failed to delete the record.', 'error');
  }
}

/* ---------- filters ---------- */
/* Persist the current filter values + section state, then re-render */
function persistAndRender() {
  writeFilterState();
  renderPayrollTable();
}
const persistAndRenderDebounced = debounce(persistAndRender, 180);

on(tablePeriodFilter, 'change', persistAndRender);
on(tableCategoryFilter, 'change', persistAndRender);
on(tableSearchInput, 'input', persistAndRenderDebounced);
on($('clearPeriodFilterBtn'), 'click', () => {
  tablePeriodFilter.value = '';
  persistAndRender();
});

/* ==========================================================================
   Roster modal
   ========================================================================== */
const rosterModal = $('workerRosterModal');
const rosterListContainer = $('rosterListContainer');

$('openWorkerRosterModalBtn').addEventListener('click', () => {
  rosterModal.classList.remove('hidden');
  rosterModal.classList.add('flex');
  renderRosterList();
});

function closeRosterModal() {
  rosterModal.classList.add('hidden');
  rosterModal.classList.remove('flex');
}
$('closeWorkerRosterModalBtn').addEventListener('click', closeRosterModal);
rosterModal.addEventListener('click', (e) => { if (e.target === rosterModal) closeRosterModal(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !rosterModal.classList.contains('hidden')) closeRosterModal();
});

function renderRosterList() {
  if (!rosterListContainer) return;

  const filterCat = $('rosterCategoryFilter').value;
  const frag = document.createDocumentFragment();
  let count = 0;

  Object.entries(state.roster).forEach(([cat, workers]) => {
    if (filterCat !== 'ALL' && filterCat !== cat) return;

    workers.forEach((name) => {
      count++;
      const isLombok = LOMBOK_NAMES.has(name);
      const item = document.createElement('div');
      item.className = 'flex items-center justify-between rounded-lg px-2 py-2 transition-colors hover:bg-panel/70';
      item.innerHTML = `
        <div class="flex min-w-0 items-center gap-2">
          <span class="truncate text-xs font-semibold text-fg">${name}</span>
          <span class="shrink-0 rounded-md bg-panel px-2 py-0.5 font-mono text-[9px] text-muted">${cat}</span>
          ${isLombok
            ? `<span class="shrink-0 rounded border border-warn/50 bg-warn/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-warn">Lombok</span>`
            : ''}
        </div>
        <button type="button"
                class="remove-worker-btn shrink-0 rounded-lg p-1 text-danger transition-all hover:bg-danger/15"
                data-cat="${cat}" data-name="${name}" title="Remove employee">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>`;
      frag.appendChild(item);
    });
  });

  if (count === 0) {
    rosterListContainer.innerHTML =
      `<p class="p-4 text-center text-xs italic text-dim">No workers in this category.</p>`;
  } else {
    rosterListContainer.replaceChildren(frag);
  }
}

on($('rosterCategoryFilter'), 'change', renderRosterList);

rosterListContainer.addEventListener('click', (e) => {
  const btn = e.target.closest('.remove-worker-btn');
  if (!btn) return;
  removeWorkerFromRoster(btn.dataset.cat, btn.dataset.name);
});

async function persistRosterCategory(cat) {
  try {
    await setDoc(doc(db, 'worker_roster', cat), {
      category: cat,
      workers: state.roster[cat] || []
    });
    try { localStorage.setItem('payrollRoster', JSON.stringify(state.roster)); } catch (_) { /* quota */ }
    updateWorkerOptions();
    updateSettingsWorkerDropdown();
    renderRosterList();
  } catch (err) {
    console.error('Roster save failed:', err);
    toast('Could not update the roster.', 'error');
  }
}

$('addWorkerForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const cat  = $('newWorkerCategory').value;
  const name = $('newWorkerName').value.trim();
  if (!cat || !name) return;

  if (!state.roster[cat]) state.roster[cat] = [];
  if (state.roster[cat].includes(name)) {
    toast(`"${name}" is already in ${cat}.`, 'error');
    return;
  }

  state.roster[cat].push(name);
  await persistRosterCategory(cat);
  $('newWorkerName').value = '';
  toast(`Added ${name} to ${cat}.`, 'success');
});

async function removeWorkerFromRoster(cat, name) {
  if (LOMBOK_NAMES.has(name)) {
    toast(`"${name}" is a Lombok worker and cannot be removed from the roster.`, 'error', 4500);
    return;
  }
  if (!confirm(`Remove "${name}" from the ${cat} roster?`)) return;
  state.roster[cat] = (state.roster[cat] || []).filter((w) => w !== name);
  await persistRosterCategory(cat);
  toast(`Removed ${name}.`, 'success');
}

/* ==========================================================================
   Boot
   ========================================================================== */
(function init() {
  const preType = params.get('type');
  if (preType && CATEGORIES.includes(preType)) {
    workerTypeSelect.value = preType;
    workerTypeSelect.disabled = true;
    workerTypeSelect.dataset.locked = 'true';
  }

  updateWorkerOptions();
  updateSettingsWorkerDropdown();
  renderDynamicInputs();

  /* Lombok dropdown + first render */
  populateLombokWorkerDropdown();
  renderLombokDynamicInputs();

  try {
    const cached = JSON.parse(localStorage.getItem('payrollRoster'));
    if (cached && typeof cached === 'object') {
      state.roster = { ...structuredClone(DEFAULT_ROSTER), ...cached };
      updateWorkerOptions();
      updateSettingsWorkerDropdown();
    }
  } catch (_) { /* ignore */ }

  workerTypeSelect.addEventListener('change', () => {
    updateWorkerOptions();
    renderDynamicInputs();
  });

  workerSelect.addEventListener('change', () => {
    const cfg = state.wages[workerSelect.value];
    kasbonKantorInput.value = formatMoney(cfg?.kasbonKantor || 0);
  });

  /* Lombok form interactions */
  $('lombokWorker').addEventListener('change', () => {
    renderLombokDynamicInputs();
    const cfg = state.wages[$('lombokWorker').value];
    $('lombokKasbonKantorInput').value = formatMoney(cfg?.kasbonKantor || 0);
  });
})();