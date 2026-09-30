// 1. Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore,  
  collection, 
  addDoc, 
  doc,
  setDoc,
  deleteDoc,
  query, 
  where,
  getDocs,
  orderBy, 
  onSnapshot,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 2. Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCID8HBa-82SOKDrJ5-7FfBpHanUyPgISs",
  authDomain: "payroll-tracker-55409.firebaseapp.com",
  projectId: "payroll-tracker-55409",
  storageBucket: "payroll-tracker-55409.firebasestorage.app",
  messagingSenderId: "336268687896",
  appId: "1:336268687896:web:666719cdb5ce72db27616d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM Elements
const payrollForm = document.getElementById('payrollForm');
const recordMonthInput = document.getElementById('recordMonth');
const workerSelect = document.getElementById('workerName');
const workerTypeSelect = document.getElementById('workerType');
const dynamicInputs = document.getElementById('dynamicInputs');
const payrollTableBody = document.getElementById('payrollTableBody');
const payrollTableFooter = document.getElementById('payrollTableFooter');
const grandTotalWageDisplay = document.getElementById('grandTotalWageDisplay');
const grandTotalRecordCount = document.getElementById('grandTotalRecordCount');
const summarySubtext = document.getElementById('summarySubtext');
const activeUserBadge = document.getElementById('activeUserBadge');
const ownerSection = document.getElementById('ownerSection');
const adminFormSection = document.getElementById('adminFormSection');
const adminNotice = document.getElementById('adminNotice');
const gajiPokokSettingsSection = document.getElementById('gajiPokokSettingsSection');
const settingCategorySelect = document.getElementById('settingCategorySelect');
const settingWorkerSelect = document.getElementById('settingWorkerSelect');
const gajiPokokForm = document.getElementById('gajiPokokForm');

// Filters
const tableCategoryFilter = document.getElementById('tableCategoryFilter');
const tableSearchInput = document.getElementById('tableSearchInput');
const tablePeriodFilter = document.getElementById('tablePeriodFilter');
const clearPeriodFilterBtn = document.getElementById('clearPeriodFilterBtn');
const punctualityBlock = document.getElementById('punctualityBlock');

// Kasbon Settings Elements (Mr. Thusen)
const settingKasbonLama = document.getElementById('settingKasbonLama');
const settingPotonganKasbon = document.getElementById('settingPotonganKasbon');
const settingSisaKasbonDisplay = document.getElementById('settingSisaKasbonDisplay');

// Theme Elements
const themeToggleBtn = document.getElementById('themeToggleBtn');
const themeIconSun = document.getElementById('themeIconSun');
const themeIconMoon = document.getElementById('themeIconMoon');

function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.classList.add('light');
    if (themeIconSun) themeIconSun.classList.remove('hidden');
    if (themeIconMoon) themeIconMoon.classList.add('hidden');
  } else {
    document.documentElement.classList.remove('light');
    if (themeIconSun) themeIconSun.classList.add('hidden');
    if (themeIconMoon) themeIconMoon.classList.remove('hidden');
  }
}

const savedTheme = localStorage.getItem('payrollTheme') || 'dark';
applyTheme(savedTheme);

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.classList.contains('light') ? 'dark' : 'light';
    localStorage.setItem('payrollTheme', currentTheme);
    applyTheme(currentTheme);
  });
}

// Collapsible Handlers
const toggleSettingsBtn = document.getElementById('toggleSettingsBtn');
const settingsContent = document.getElementById('settingsContent');
const settingsChevron = document.getElementById('settingsChevron');
const settingsToggleLabel = document.getElementById('settingsToggleLabel');

const toggleTableBtn = document.getElementById('toggleTableBtn');
const toggleTableTitleArea = document.getElementById('toggleTableTitleArea');
const tableContent = document.getElementById('tableContent');
const tableChevron = document.getElementById('tableChevron');
const tableToggleLabel = document.getElementById('tableToggleLabel');

const toggleFilterBtn = document.getElementById('toggleFilterBtn');
const filterToolbar = document.getElementById('filterToolbar');
const filterChevron = document.getElementById('filterChevron');

if (recordMonthInput) {
  const now = new Date();
  const currentYYYYMM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  recordMonthInput.value = currentYYYYMM;
  if (tablePeriodFilter) tablePeriodFilter.value = currentYYYYMM;
}

const workersByCategory = {
  "Admin GPS": ["Mei Dhea Cahya Ardika", "Ni Wayan Widiantari", "Tri Maharani"],
  "Finance": ["Christy Martika", "Wahyuningsih"],
  "Admin HPZ": ["Ni Luh Ayu Atmi Kamaratih", "Widya Nurliza", "Ni Luh Febriyanti", "Aldina Verbiana", "Afrilia Indriyani", "Ni Kadek Dina Suryani Dewi"],
  "Team comm": ["Tio Atrik Herdiansyah"],
  "Sales HPZ": ["Richard Antonius", "Iwan Pratama"],
  "Gudang": ["Pande Gede Ngurah Dana", "Ashera Devi Swarna Vista", "Nadia Ayu Riskiyah Putri", "Ganna Sine Kustury Vegat"],
  "Driver": ["Hersi Arnantyo", "Wiraganda Pattiwaellapia"],
  "Mekanik HPZ": ["Rohmad Imam Safii", "Ahmad Ardy Firmansyah", "Candra Bayu Pratama", "Munhamir Amin Almadkur", "Efendi Zulsilhamdi"],
  "Mekanik GPS": ["Heri Hermansah", "Hauzi Alwi"],
  "Mekanik CCTV": ["Jackson M Bessie", "Stefanus"],
  "Helper": ["Yoyok Ujianto"]
};

function renderDynamicInputs() {
  const category = workerTypeSelect.value;
  let html = '';

  if (category === "Sales HPZ") {
    punctualityBlock.classList.add('hidden');
  } else {
    punctualityBlock.classList.remove('hidden');
  }

  if (category === "Admin GPS") {
    html = `
      <div class="col-span-2">
        <label class="block text-[11px] font-semibold text-indigo-300 mb-2 uppercase tracking-wider">Jumlah Penjualan Unit GPS</label>
        <input type="number" id="unitCount" value="0" min="0" required class="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-indigo-500 font-mono">
      </div>`;
  } else if (category === "Sales HPZ") {
    html = `
      <div class="col-span-2">
        <label class="block text-[11px] font-semibold text-indigo-300 mb-2 uppercase tracking-wider">Total Penjualan 3 Bulan Terakhir (IDR)</label>
        <input type="text" id="sales3Months" value="0" required class="money-input w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-indigo-500 font-mono">
      </div>`;
  } else if (category === "Mekanik HPZ") {
    html = `
      <div class="col-span-2">
        <label class="block text-[11px] font-semibold text-indigo-300 mb-2 uppercase tracking-wider">Total Penjualan Instalasi HPZ Bulan Ini (IDR)</label>
        <input type="text" id="instalasiHpzAmount" value="0" required class="money-input w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-indigo-500 font-mono">
      </div>`;
  } else if (category === "Mekanik GPS" || category === "Helper") {
    html = `
      <div>
        <label class="block text-[11px] font-semibold text-indigo-300 mb-2 uppercase tracking-wider">Jumlah Pasang GPS</label>
        <input type="number" id="pasangGpsUnits" value="0" min="0" required class="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-indigo-500 font-mono">
      </div>
      <div>
        <label class="block text-[11px] font-semibold text-indigo-300 mb-2 uppercase tracking-wider">Jumlah Cek Unit GPS</label>
        <input type="number" id="cekGpsUnits" value="0" min="0" required class="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-indigo-500 font-mono">
      </div>`;
  } else if (category === "Mekanik CCTV") {
    html = `
      <div>
        <label class="block text-[11px] font-semibold text-indigo-300 mb-2 uppercase tracking-wider">Jumlah Pasang CCTV</label>
        <input type="number" id="pasangCctvUnits" value="0" min="0" required class="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-indigo-500 font-mono">
      </div>
      <div>
        <label class="block text-[11px] font-semibold text-indigo-300 mb-2 uppercase tracking-wider">Jumlah Servis CCTV</label>
        <input type="number" id="servisCctvUnits" value="0" min="0" required class="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-indigo-500 font-mono">
      </div>`;
  } else {
    html = `<div class="col-span-2 text-xs text-slate-400 italic">No additional variable metrics required for this role. Standard wage components will apply.</div>`;
  }

  dynamicInputs.innerHTML = html;

  document.querySelectorAll('.money-input').forEach(input => {
    input.addEventListener('input', (e) => {
      e.target.value = formatCurrencyString(e.target.value);
    });
  });
}

let defaultWageSettingsMap = {};
let rawPayrollRecords = [];

function formatCurrencyString(val) {
  const digits = String(val).replace(/\D/g, "");
  return digits ? Number(digits).toLocaleString('en-US') : "";
}

function parseCurrencyNumber(formattedStr) {
  return Number(String(formattedStr).replace(/\D/g, "")) || 0;
}

document.querySelectorAll('.money-input').forEach(input => {
  input.addEventListener('input', (e) => {
    e.target.value = formatCurrencyString(e.target.value);
  });
});

function updateSisaKasbonLive() {
  if (!settingKasbonLama || !settingPotonganKasbon || !settingSisaKasbonDisplay) return;
  const kasbonLama = parseCurrencyNumber(settingKasbonLama.value);
  const potongan = parseCurrencyNumber(settingPotonganKasbon.value);
  const sisa = Math.max(0, kasbonLama - potongan);
  settingSisaKasbonDisplay.textContent = `Rp ${sisa.toLocaleString('en-US')}`;
}

if (settingKasbonLama) settingKasbonLama.addEventListener('input', updateSisaKasbonLive);
if (settingPotonganKasbon) settingPotonganKasbon.addEventListener('input', updateSisaKasbonLive);

const urlParams = new URLSearchParams(window.location.search);
const preselectedType = urlParams.get('type');
const preselectedUser = urlParams.get('user');

if (preselectedType && workerTypeSelect) {
  workerTypeSelect.value = preselectedType;
  workerTypeSelect.disabled = true;
}

if (preselectedUser) {
  activeUserBadge.textContent = preselectedUser === 'Thusen' ? 'Mr. Thusen (Owner)' : `${preselectedUser} (Admin)`;
} else {
  activeUserBadge.textContent = 'Guest User';
}

const exitSessionBtn = document.getElementById('exitSessionBtn');
if (exitSessionBtn) {
  exitSessionBtn.addEventListener('click', () => {
    sessionStorage.removeItem('activePayrollUser');
  });
}

if (toggleSettingsBtn) {
  toggleSettingsBtn.addEventListener('click', () => {
    const isNowCollapsed = settingsContent.classList.toggle('collapsed');
    settingsChevron.style.transform = isNowCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
    settingsToggleLabel.textContent = isNowCollapsed ? 'Expand' : 'Minimize';
  });
}

function toggleTableSection() {
  const isNowCollapsed = tableContent.classList.toggle('collapsed');
  tableChevron.style.transform = isNowCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
  tableToggleLabel.textContent = isNowCollapsed ? 'Expand' : 'Minimize';
}

if (toggleTableBtn) toggleTableBtn.addEventListener('click', toggleTableSection);
if (toggleTableTitleArea) toggleTableTitleArea.addEventListener('click', toggleTableSection);

if (toggleFilterBtn) {
  toggleFilterBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (tableContent.classList.contains('collapsed')) toggleTableSection();
    const isNowCollapsed = filterToolbar.classList.toggle('collapsed');
    filterChevron.style.transform = isNowCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
  });
}

function updateWorkerOptions() {
  const selectedCategory = workerTypeSelect.value;
  const workers = workersByCategory[selectedCategory] || [];

  workerSelect.innerHTML = '<option value="" disabled selected>Select Worker</option>';
  workers.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    workerSelect.appendChild(opt);
  });
}

function updateSettingsWorkerDropdown() {
  const selectedCategory = settingCategorySelect.value;
  let targetWorkers = selectedCategory === "ALL" 
    ? Object.values(workersByCategory).flat().sort()
    : workersByCategory[selectedCategory] || [];

  settingWorkerSelect.innerHTML = '<option value="" disabled selected>Select Worker</option>';
  targetWorkers.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    settingWorkerSelect.appendChild(opt);
  });
}

settingCategorySelect.addEventListener('change', updateSettingsWorkerDropdown);

settingWorkerSelect.addEventListener('change', () => {
  const selectedWorker = settingWorkerSelect.value;
  const existing = defaultWageSettingsMap[selectedWorker];

  if (existing) {
    document.getElementById('settingGajiPokokAmount').value = formatCurrencyString(existing.defaultGajiPokok || 0);
    document.getElementById('settingInsentifAmount').value = formatCurrencyString(existing.insentif || 0);
    document.getElementById('settingUangMakanAmount').value = formatCurrencyString(existing.uangMakan || 0);
    settingKasbonLama.value = formatCurrencyString(existing.kasbonLama || 0);
    settingPotonganKasbon.value = formatCurrencyString(existing.potonganKasbon || 0);
  } else {
    document.getElementById('settingGajiPokokAmount').value = "0";
    document.getElementById('settingInsentifAmount').value = "0";
    document.getElementById('settingUangMakanAmount').value = "0";
    settingKasbonLama.value = "0";
    settingPotonganKasbon.value = "0";
  }
  updateSisaKasbonLive();
});

updateWorkerOptions();
updateSettingsWorkerDropdown();
renderDynamicInputs();

function applyRolePermissions() {
  if (preselectedUser === 'Thusen') {
    ownerSection.classList.remove('hidden');
    gajiPokokSettingsSection.classList.remove('hidden');
    adminFormSection.classList.add('hidden');
    adminNotice.classList.add('hidden');
  } else {
    ownerSection.classList.add('hidden');
    gajiPokokSettingsSection.classList.add('hidden');
    adminFormSection.classList.remove('hidden');
    adminNotice.classList.remove('hidden');
  }
}

applyRolePermissions();

gajiPokokForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const workerName = settingWorkerSelect.value;
  const gajiPokok = parseCurrencyNumber(document.getElementById('settingGajiPokokAmount').value);
  const insentif = parseCurrencyNumber(document.getElementById('settingInsentifAmount').value);
  const uangMakan = parseCurrencyNumber(document.getElementById('settingUangMakanAmount').value);
  const kasbonLama = parseCurrencyNumber(settingKasbonLama.value);
  const potonganKasbon = parseCurrencyNumber(settingPotonganKasbon.value);

  try {
    await setDoc(doc(db, "default_wages", workerName), {
      workerName: workerName,
      defaultGajiPokok: gajiPokok,
      insentif: insentif,
      uangMakan: uangMakan,
      kasbonLama: kasbonLama,
      potonganKasbon: potonganKasbon,
      updatedAt: serverTimestamp()
    });
    alert(`Wage & Kasbon configuration saved for ${workerName}.`);
    gajiPokokForm.reset();
    settingSisaKasbonDisplay.textContent = "Rp 0";
    updateSettingsWorkerDropdown();
  } catch (error) {
    console.error("Error saving wage settings: ", error);
  }
});

function listenToDefaultWages() {
  onSnapshot(collection(db, "default_wages"), (snapshot) => {
    defaultWageSettingsMap = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      defaultWageSettingsMap[data.workerName] = {
        defaultGajiPokok: data.defaultGajiPokok || 0,
        insentif: data.insentif || 0,
        uangMakan: data.uangMakan || 0,
        kasbonLama: data.kasbonLama || 0,
        potonganKasbon: data.potonganKasbon || 0
      };
    });
    renderPayrollTable();
  });
}

payrollForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const selectedWorkerName = workerSelect.value;
  const selectedCategory = workerTypeSelect.value;
  const selectedMonth = recordMonthInput.value;
  const kerajinanValue = document.getElementById('hasKerajinanBonus').value === "true";

  if (!selectedWorkerName || !selectedMonth) {
    alert("Please select worker name and payroll month period.");
    return;
  }

  try {
    const duplicateQuery = query(
      collection(db, "payroll_records"),
      where("workerName", "==", selectedWorkerName),
      where("recordMonth", "==", selectedMonth)
    );

    const querySnapshot = await getDocs(duplicateQuery);

    if (!querySnapshot.empty) {
      const formattedMonthName = new Date(`${selectedMonth}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      alert(`Hello ${preselectedUser || 'Admin'},\n\nA performance record for "${selectedWorkerName}" has already been submitted for ${formattedMonthName}.\n\nTo prevent financial discrepancies, duplicate entries for the same worker in the same month are restricted.`);
      return;
    }

    let metrics = {};
    if (selectedCategory === "Admin GPS") {
      metrics.unitCount = Number(document.getElementById('unitCount')?.value || 0);
    } else if (selectedCategory === "Sales HPZ") {
      metrics.sales3Months = parseCurrencyNumber(document.getElementById('sales3Months')?.value || 0);
    } else if (selectedCategory === "Mekanik HPZ") {
      metrics.instalasiHpzAmount = parseCurrencyNumber(document.getElementById('instalasiHpzAmount')?.value || 0);
    } else if (selectedCategory === "Mekanik GPS") {
      metrics.pasangGpsUnits = Number(document.getElementById('pasangGpsUnits')?.value || 0);
      metrics.cekGpsUnits = Number(document.getElementById('cekGpsUnits')?.value || 0);
    } else if (selectedCategory === "Mekanik CCTV") {
      metrics.pasangCctvUnits = Number(document.getElementById('pasangCctvUnits')?.value || 0);
      metrics.servisCctvUnits = Number(document.getElementById('servisCctvUnits')?.value || 0);
    } else if (selectedCategory === "Helper") {
      metrics.pasangGpsUnits = Number(document.getElementById('pasangGpsUnits')?.value || 0);
      metrics.cekGpsUnits = Number(document.getElementById('cekGpsUnits')?.value || 0);
      metrics.cleaningServiceAllowance = 1000000;
    }

    const workerData = {
      workerName: selectedWorkerName,
      workerType: selectedCategory,
      recordMonth: selectedMonth,
      hasKerajinanBonus: selectedCategory === "Sales HPZ" ? false : kerajinanValue,
      metrics: metrics,
      submittedBy: preselectedUser || "Admin",
      timestamp: serverTimestamp()
    };

    await addDoc(collection(db, "payroll_records"), workerData);
    alert("Record synchronized successfully.");
    payrollForm.reset();
    
    const now = new Date();
    recordMonthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    updateWorkerOptions();
    renderDynamicInputs();
  } catch (error) {
    console.error("Error saving record: ", error);
    alert("An error occurred while saving. Please try again.");
  }
});

function listenToPayrollData() {
  const q = query(collection(db, "payroll_records"), orderBy("timestamp", "desc"));
  
  onSnapshot(q, (snapshot) => {
    rawPayrollRecords = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      const dateObj = data.timestamp ? data.timestamp.toDate() : new Date();
      rawPayrollRecords.push({
        id: doc.id,
        ...data,
        dateObj: dateObj,
        formattedDateTime: dateObj.toLocaleDateString('en-US', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      });
    });
    renderPayrollTable();
  });
}

function calculateTotalWage(record, settings) {
  const baseSalary = settings.defaultGajiPokok || 0;
  const mealAllowance = settings.uangMakan || 0;
  const incentive = settings.insentif || 0;
  const bonusKerajinan = record.hasKerajinanBonus ? 300000 : 0;
  const potonganKasbon = settings.potonganKasbon || 0;
  const m = record.metrics || {};

  let variableBonus = 0;

  switch (record.workerType) {
    case "Admin GPS":
      variableBonus = (m.unitCount || 0) * 5000;
      return baseSalary + mealAllowance + bonusKerajinan + incentive + variableBonus - potonganKasbon;

    case "Finance":
    case "Admin HPZ":
    case "Team comm":
    case "Gudang":
    case "Driver":
      return baseSalary + mealAllowance + bonusKerajinan + incentive - potonganKasbon;

    case "Sales HPZ":
      variableBonus = (m.sales3Months || 0) * 0.01;
      return mealAllowance + variableBonus - potonganKasbon;

    case "Mekanik HPZ":
      variableBonus = (m.instalasiHpzAmount || 0) * 0.01;
      return baseSalary + mealAllowance + bonusKerajinan + incentive + variableBonus - potonganKasbon;

    case "Mekanik GPS":
      variableBonus = ((m.pasangGpsUnits || 0) * 25000) + ((m.cekGpsUnits || 0) * 15000);
      return baseSalary + mealAllowance + bonusKerajinan + incentive + variableBonus - potonganKasbon;

    case "Mekanik CCTV":
      variableBonus = ((m.pasangCctvUnits || 0) * 25000) + ((m.servisCctvUnits || 0) * 15000);
      return baseSalary + mealAllowance + bonusKerajinan + incentive + variableBonus - potonganKasbon;

    case "Helper":
      variableBonus = ((m.pasangGpsUnits || 0) * 25000) + ((m.cekGpsUnits || 0) * 15000) + (m.cleaningServiceAllowance || 1000000);
      return baseSalary + mealAllowance + bonusKerajinan + incentive + variableBonus - potonganKasbon;

    default:
      return baseSalary + mealAllowance + bonusKerajinan + incentive - potonganKasbon;
  }
}

async function deletePayrollRecord(recordId, workerName, periodFormatted) {
  if (confirm(`Are you sure you want to permanently delete the submission record for "${workerName}" (${periodFormatted})?`)) {
    try {
      await deleteDoc(doc(db, "payroll_records", recordId));
      alert(`Record for ${workerName} has been deleted.`);
    } catch (error) {
      console.error("Error deleting document: ", error);
      alert("Failed to delete the record. Please try again.");
    }
  }
}

function renderPayrollTable() {
  payrollTableBody.innerHTML = '';
  if (payrollTableFooter) payrollTableFooter.innerHTML = '';

  const selectedCategory = tableCategoryFilter.value;
  const searchQuery = tableSearchInput.value.toLowerCase().trim();
  const selectedPeriod = tablePeriodFilter ? tablePeriodFilter.value : '';

  const filteredRecords = rawPayrollRecords.filter(record => {
    const matchesCategory = selectedCategory === "ALL" || record.workerType === selectedCategory;
    const matchesSearch = record.workerName.toLowerCase().includes(searchQuery);
    const matchesPeriod = !selectedPeriod || record.recordMonth === selectedPeriod;
    return matchesCategory && matchesSearch && matchesPeriod;
  });

  if (summarySubtext) {
    if (selectedPeriod) {
      const formattedMonth = new Date(`${selectedPeriod}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      summarySubtext.textContent = `Total net payroll commitment for ${formattedMonth}.`;
    } else {
      summarySubtext.textContent = `Total net payroll commitment across all recorded periods.`;
    }
  }

  if (filteredRecords.length === 0) {
    payrollTableBody.innerHTML = `<tr><td colspan="11" class="p-8 text-center text-slate-500 text-xs">No matching financial records located.</td></tr>`;
    if (grandTotalWageDisplay) grandTotalWageDisplay.textContent = "Rp 0";
    if (grandTotalRecordCount) grandTotalRecordCount.textContent = "0 Submissions Included";
    return;
  }

  let cumulativeGrandTotalWage = 0;

  const groupedRecords = {};
  filteredRecords.forEach(record => {
    let monthYearName = "Uncategorized Period";
    if (record.recordMonth) {
      monthYearName = new Date(`${record.recordMonth}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (record.dateObj) {
      monthYearName = record.dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    if (!groupedRecords[monthYearName]) groupedRecords[monthYearName] = [];
    groupedRecords[monthYearName].push(record);
  });

  Object.keys(groupedRecords).forEach(monthYear => {
    const headerRow = document.createElement('tr');
    headerRow.className = 'bg-slate-950/90 border-y border-slate-800';
    headerRow.innerHTML = `
      <td colspan="11" class="p-3.5 px-4 font-semibold text-indigo-400 tracking-wider text-[10px] uppercase">
        ${monthYear} &mdash; ${groupedRecords[monthYear].length} Submissions
      </td>
    `;
    payrollTableBody.appendChild(headerRow);

    groupedRecords[monthYear].forEach(record => {
      const kerajinanBadge = record.hasKerajinanBonus 
        ? `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/80">Yes</span>`
        : `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-950/80 text-rose-400 border border-rose-800/80">No</span>`;

      const settings = defaultWageSettingsMap[record.workerName] || { defaultGajiPokok: 0, insentif: 0, uangMakan: 0, kasbonLama: 0, potonganKasbon: 0 };
      const totalWage = calculateTotalWage(record, settings);
      cumulativeGrandTotalWage += totalWage;

      const sisaKasbon = Math.max(0, (settings.kasbonLama || 0) - (settings.potonganKasbon || 0));

      const formattedGajiPokok = settings.defaultGajiPokok 
        ? `<span class="text-amber-300 font-semibold font-mono">Rp ${settings.defaultGajiPokok.toLocaleString('en-US')}</span>`
        : `<span class="text-slate-600 font-mono">Rp 0</span>`;

      const formattedUangMakan = settings.uangMakan 
        ? `<span class="text-emerald-300 font-semibold font-mono">Rp ${settings.uangMakan.toLocaleString('en-US')}</span>`
        : `Rp 0`;

      const periodFormatted = record.recordMonth 
        ? new Date(`${record.recordMonth}-01`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        : '-';

      const actionCellHTML = preselectedUser === 'Thusen'
        ? `<td class="p-4 text-center">
             <button type="button" class="delete-btn p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/80 text-rose-400 border border-rose-800/50 transition-all hover:scale-105 active:scale-95" title="Delete Submission">
               <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
             </button>
           </td>`
        : `<td class="p-4 text-center text-slate-600 text-[10px] italic">View Only</td>`;

      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-800/60 transition-colors cursor-pointer group border-b border-slate-800/40 active:bg-indigo-950/30';
      row.innerHTML = `
        <td class="p-4 font-medium text-white group-hover:text-indigo-300 transition-colors">${record.workerName}</td>
        <td class="p-4"><span class="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-slate-800/80 text-slate-300 border border-slate-700/80">${record.workerType}</span></td>
        <td class="p-4 font-mono text-[11px] text-indigo-300">${periodFormatted}</td>
        <td class="p-4">${formattedGajiPokok}</td>
        <td class="p-4">${formattedUangMakan}</td>
        <td class="p-4">${kerajinanBadge}</td>
        <td class="p-4 font-semibold text-rose-400 font-mono">Rp ${(settings.potonganKasbon || 0).toLocaleString('en-US')}</td>
        <td class="p-4 font-semibold text-amber-300 font-mono">Rp ${sisaKasbon.toLocaleString('en-US')}</td>
        <td class="p-4 font-bold text-emerald-400 font-mono bg-emerald-950/30">Rp ${totalWage.toLocaleString('en-US')}</td>
        <td class="p-4 text-slate-400 text-[10px]">
          <span class="font-medium text-slate-300">${record.submittedBy}</span><br>
          <span class="text-slate-500 font-mono text-[9px]">${record.formattedDateTime}</span>
        </td>
        ${actionCellHTML}
      `;

      row.addEventListener('click', (e) => {
        if (e.target.closest('.delete-btn')) return;
        localStorage.setItem('selectedWorker', JSON.stringify({
          ...record,
          ...settings,
          totalWage: totalWage,
          sisaKasbon: sisaKasbon
        }));
        window.location.href = 'worker-detail.html';
      });

      if (preselectedUser === 'Thusen') {
        const deleteBtn = row.querySelector('.delete-btn');
        if (deleteBtn) {
          deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deletePayrollRecord(record.id, record.workerName, periodFormatted);
          });
        }
      }

      payrollTableBody.appendChild(row);
    });
  });

  if (grandTotalWageDisplay) {
    grandTotalWageDisplay.textContent = `Rp ${cumulativeGrandTotalWage.toLocaleString('en-US')}`;
  }
  if (grandTotalRecordCount) {
    grandTotalRecordCount.textContent = `${filteredRecords.length} Submissions Included`;
  }

  if (payrollTableFooter) {
    payrollTableFooter.innerHTML = `
      <tr class="bg-emerald-950/40 text-emerald-300">
        <td colspan="8" class="p-4 text-right uppercase tracking-wider font-extrabold text-[11px]">Grand Total Payroll Commitment:</td>
        <td class="p-4 font-extrabold font-mono text-emerald-400 text-sm bg-emerald-950/80">Rp ${cumulativeGrandTotalWage.toLocaleString('en-US')}</td>
        <td colspan="2" class="p-4 text-slate-500 font-normal text-[10px]">${filteredRecords.length} Total Workers</td>
      </tr>
    `;
  }
}

if (tablePeriodFilter) tablePeriodFilter.addEventListener('change', renderPayrollTable);
if (tableCategoryFilter) tableCategoryFilter.addEventListener('change', renderPayrollTable);
if (tableSearchInput) tableSearchInput.addEventListener('input', renderPayrollTable);

if (clearPeriodFilterBtn) {
  clearPeriodFilterBtn.addEventListener('click', () => {
    if (tablePeriodFilter) tablePeriodFilter.value = '';
    renderPayrollTable();
  });
}

listenToDefaultWages();
listenToPayrollData();
