(() => {
  const STORAGE_KEY = "company-inventory-v1";
  const SEED_FLAG = "company-inventory-seed-version";
  const RESTORE_FLAG = "company-inventory-restore-version";
  const WAREHOUSE = "";
  const GENERAL_SITE = "Загальний склад";
  const LOCAL_SITES = ["Ігорівська", "Автозаводська", "Ірпінь"];
  const SITES = [GENERAL_SITE, ...LOCAL_SITES];
  const DEFAULT_SITE = LOCAL_SITES[0];

  /** @typedef {{ id: string, name: string }} Employee */
  /** @typedef {{
   *  id: string,
   *  name: string,
   *  model: string,
   *  invNumber: string,
   *  working: boolean,
   *  site: string,
   *  employeeId: string,
   *  specs: string,
   *  note: string,
   *  action: string,
   *  problems: string,
   *  createdAt: string,
   *  updatedAt: string
   * }} Item */

  /** @type {{ employees: Employee[], items: Item[] }} */
  let state = { employees: [], items: [] };
  /** @type {string|null} */
  let viewingEmployeeId = null;
  /** @type {"Загальний склад"|string} */
  let warehouseTab = GENERAL_SITE;
  /** @type {"items"|"warehouse"|"employees"} */
  let currentView = "items";

  const els = {
    itemsView: document.getElementById("itemsView"),
    warehouseView: document.getElementById("warehouseView"),
    employeesView: document.getElementById("employeesView"),
    navBtns: [...document.querySelectorAll(".nav-btn")],
    itemsGrid: document.getElementById("itemsGrid"),
    itemsEmpty: document.getElementById("itemsEmpty"),
    warehouseContent: document.getElementById("warehouseContent"),
    warehouseEmpty: document.getElementById("warehouseEmpty"),
    warehouseTabs: document.getElementById("warehouseTabs"),
    employeesList: document.getElementById("employeesList"),
    employeesEmpty: document.getElementById("employeesEmpty"),
    itemSearch: document.getElementById("itemSearch"),
    statusFilter: document.getElementById("statusFilter"),
    siteFilter: document.getElementById("siteFilter"),
    employeeFilter: document.getElementById("employeeFilter"),
    warehouseSearch: document.getElementById("warehouseSearch"),
    warehouseStatusFilter: document.getElementById("warehouseStatusFilter"),
    employeeSearch: document.getElementById("employeeSearch"),
    addItemBtn: document.getElementById("addItemBtn"),
    addWarehouseItemBtn: document.getElementById("addWarehouseItemBtn"),
    addEmployeeBtn: document.getElementById("addEmployeeBtn"),
    itemModal: document.getElementById("itemModal"),
    employeeModal: document.getElementById("employeeModal"),
    employeeItemsModal: document.getElementById("employeeItemsModal"),
    assignModal: document.getElementById("assignModal"),
    assignForm: document.getElementById("assignForm"),
    assignItemId: document.getElementById("assignItemId"),
    assignItemLabel: document.getElementById("assignItemLabel"),
    assignEmployee: document.getElementById("assignEmployee"),
    transferModal: document.getElementById("transferModal"),
    transferForm: document.getElementById("transferForm"),
    transferItemId: document.getElementById("transferItemId"),
    transferItemLabel: document.getElementById("transferItemLabel"),
    transferSite: document.getElementById("transferSite"),
    itemForm: document.getElementById("itemForm"),
    employeeForm: document.getElementById("employeeForm"),
    itemModalTitle: document.getElementById("itemModalTitle"),
    employeeModalTitle: document.getElementById("employeeModalTitle"),
    employeeItemsTitle: document.getElementById("employeeItemsTitle"),
    employeeItemsSub: document.getElementById("employeeItemsSub"),
    employeeItemsEmpty: document.getElementById("employeeItemsEmpty"),
    employeeItemsGrid: document.getElementById("employeeItemsGrid"),
    itemId: document.getElementById("itemId"),
    itemName: document.getElementById("itemName"),
    itemModel: document.getElementById("itemModel"),
    itemInvNumber: document.getElementById("itemInvNumber"),
    itemWorking: document.getElementById("itemWorking"),
    itemSite: document.getElementById("itemSite"),
    itemEmployee: document.getElementById("itemEmployee"),
    itemSpecs: document.getElementById("itemSpecs"),
    itemNote: document.getElementById("itemNote"),
    itemAction: document.getElementById("itemAction"),
    itemProblems: document.getElementById("itemProblems"),
    employeeId: document.getElementById("employeeId"),
    employeeName: document.getElementById("employeeName"),
    syncCloudBtn: document.getElementById("syncCloudBtn"),
    exportBtn: document.getElementById("exportBtn"),
    exportPdfBtn: document.getElementById("exportPdfBtn"),
    exportExcelBtn: document.getElementById("exportExcelBtn"),
    importInput: document.getElementById("importInput"),
    toast: document.getElementById("toast"),
  };

  function uid() {
    return crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  const config = window.INVENTORY_CONFIG || {};
  const SUPABASE_URL = config.supabaseUrl || "";
  const SUPABASE_ANON_KEY = config.supabaseAnonKey || "";
  /** @type {import("@supabase/supabase-js").SupabaseClient|null} */
  let supabaseClient = null;
  let cloudReady = false;
  let cloudSyncTimer = null;
  let cloudRefreshTimer = null;
  let cloudSyncing = false;

  function initSupabaseClient() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || typeof supabase === "undefined") return null;
    return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  function itemToRow(item) {
    return {
      id: item.id,
      name: item.name || "",
      model: item.model || "",
      inv_number: item.invNumber || "",
      working: !!item.working,
      site: item.site || DEFAULT_SITE,
      employee_id: item.employeeId || "",
      specs: item.specs || "",
      note: item.note || "",
      action: item.action || "",
      problems: item.problems || "",
      created_at: item.createdAt || new Date().toISOString(),
      updated_at: item.updatedAt || new Date().toISOString(),
    };
  }

  function rowToItem(row) {
    return {
      id: row.id,
      name: row.name || "",
      model: row.model || "",
      invNumber: row.inv_number || "",
      working: !!row.working,
      site: SITES.includes(row.site) ? row.site : DEFAULT_SITE,
      employeeId: row.employee_id || "",
      specs: row.specs || "",
      note: row.note || "",
      action: row.action || "",
      problems: row.problems || "",
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    };
  }

  function normalizeState(parsed) {
    return {
      employees: Array.isArray(parsed.employees) ? parsed.employees : [],
      items: Array.isArray(parsed.items)
        ? parsed.items.map((item) => ({
            ...item,
            site: SITES.includes(item.site) ? item.site : DEFAULT_SITE,
          }))
        : [],
    };
  }

  function getSeedState() {
    const seed = typeof window !== "undefined" ? window.INVENTORY_SEED : null;
    if (!seed || !Array.isArray(seed.employees) || !Array.isArray(seed.items)) return null;
    return normalizeState(seed);
  }

  async function loadStateFromCloud() {
    if (!supabaseClient) return loadStateLocal();

    const [employeesRes, itemsRes] = await Promise.all([
      supabaseClient.from("employees").select("id,name"),
      supabaseClient.from("items").select("*"),
    ]);

    if (employeesRes.error) {
      throw new Error(`employees: ${employeesRes.error.message}`);
    }
    if (itemsRes.error) {
      throw new Error(`items: ${itemsRes.error.message}`);
    }

    return {
      employees: (employeesRes.data || []).map((row) => ({ id: row.id, name: row.name })),
      items: (itemsRes.data || []).map(rowToItem),
    };
  }

  async function syncStateToCloud() {
    if (!supabaseClient || cloudSyncing) return;
    cloudSyncing = true;

    try {
      const employeeRows = state.employees.map((employee) => ({
        id: employee.id,
        name: employee.name,
      }));
      const itemRows = state.items.map(itemToRow);
      const employeeIds = employeeRows.map((row) => row.id);
      const itemIds = itemRows.map((row) => row.id);

      const { error: employeesError } = await supabaseClient.from("employees").upsert(employeeRows);
      if (employeesError) throw employeesError;

      const { error: itemsError } = await supabaseClient.from("items").upsert(itemRows);
      if (itemsError) throw itemsError;

      const { data: dbEmployees, error: dbEmployeesError } = await supabaseClient
        .from("employees")
        .select("id");
      if (dbEmployeesError) throw dbEmployeesError;

      const orphanEmployeeIds = (dbEmployees || [])
        .map((row) => row.id)
        .filter((id) => !employeeIds.includes(id));
      if (orphanEmployeeIds.length) {
        const { error } = await supabaseClient.from("employees").delete().in("id", orphanEmployeeIds);
        if (error) throw error;
      }

      const { data: dbItems, error: dbItemsError } = await supabaseClient.from("items").select("id");
      if (dbItemsError) throw dbItemsError;

      const orphanItemIds = (dbItems || [])
        .map((row) => row.id)
        .filter((id) => !itemIds.includes(id));
      if (orphanItemIds.length) {
        const { error } = await supabaseClient.from("items").delete().in("id", orphanItemIds);
        if (error) throw error;
      }
    } finally {
      cloudSyncing = false;
    }
  }

  function setupCloudRealtime() {
    if (!supabaseClient) return;

    supabaseClient
      .channel("inventory-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "employees" }, scheduleCloudRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "items" }, scheduleCloudRefresh)
      .subscribe();
  }

  function scheduleCloudRefresh() {
    if (!cloudReady || cloudSyncing) return;
    clearTimeout(cloudRefreshTimer);
    cloudRefreshTimer = setTimeout(async () => {
      try {
        state = await loadStateFromCloud();
        sortEmployees();
        renderAll();
      } catch {
        showToast("Не вдалося оновити дані з хмари");
      }
    }, 400);
  }

  function loadStateLocal() {
    try {
      const seed = typeof window !== "undefined" ? window.INVENTORY_SEED : null;
      const restoreVer = seed && seed.restoreVersion ? String(seed.restoreVersion) : "";

      if (
        seed &&
        restoreVer &&
        localStorage.getItem(RESTORE_FLAG) !== restoreVer &&
        Array.isArray(seed.employees) &&
        Array.isArray(seed.items)
      ) {
        const restored = normalizeState(seed);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(restored));
        localStorage.setItem(RESTORE_FLAG, restoreVer);
        if (seed.version) localStorage.setItem(SEED_FLAG, seed.version);
        return restored;
      }

      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return normalizeState(JSON.parse(raw));

      const seeded = getSeedState();
      if (seeded) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
        if (seed?.version) localStorage.setItem(SEED_FLAG, seed.version);
        if (restoreVer) localStorage.setItem(RESTORE_FLAG, restoreVer);
        return seeded;
      }

      return { employees: [], items: [] };
    } catch {
      return { employees: [], items: [] };
    }
  }

  function itemTimestamp(item) {
    const value = item.updatedAt || item.createdAt;
    return value ? new Date(value).getTime() : 0;
  }

  function mergePreferNewer(localState, cloudState) {
    const merged = {
      employees: cloudState.employees.map((employee) => ({ ...employee })),
      items: cloudState.items.map((item) => ({ ...item })),
    };
    const employeeById = new Map(merged.employees.map((employee) => [employee.id, employee]));
    let changes = 0;

    for (const localEmployee of localState.employees) {
      const existing = employeeById.get(localEmployee.id);
      if (!existing) {
        merged.employees.push({ ...localEmployee });
        employeeById.set(localEmployee.id, localEmployee);
        changes += 1;
        continue;
      }
      if (existing.name !== localEmployee.name) {
        existing.name = localEmployee.name;
        changes += 1;
      }
    }

    const itemById = new Map(merged.items.map((item) => [item.id, item]));
    for (const localItem of localState.items) {
      const existing = itemById.get(localItem.id);
      if (!existing) {
        merged.items.push({ ...localItem });
        itemById.set(localItem.id, localItem);
        changes += 1;
        continue;
      }
      if (itemTimestamp(localItem) >= itemTimestamp(existing)) {
        const before = JSON.stringify(existing);
        Object.assign(existing, localItem);
        if (JSON.stringify(existing) !== before) changes += 1;
      }
    }

    return { state: merged, changes };
  }

  async function mergeLocalIntoCloud() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw || !supabaseClient) return 0;

    const local = loadStateLocal();
    if (!local.items.length && !local.employees.length) return 0;

    const { state: merged, changes } = mergePreferNewer(local, state);
    if (!changes) return 0;

    state = merged;
    sortEmployees();
    await syncStateToCloud();
    return changes;
  }

  async function pushLocalToCloud() {
    if (!supabaseClient) {
      showToast("Supabase не налаштовано");
      return;
    }
    if (!localStorage.getItem(STORAGE_KEY)) {
      showToast("Локальних даних не знайдено");
      return;
    }
    if (!confirm("Завантажити локальні дані на сайт? Поточні зміни на сайті будуть оновлені.")) {
      return;
    }

    els.syncCloudBtn.disabled = true;
    try {
      state = loadStateLocal();
      sortEmployees();
      cloudReady = true;
      await syncStateToCloud();
      renderAll();
      showToast(`На сайт завантажено ${state.items.length} предметів`);
    } catch {
      showToast("Помилка завантаження на сайт");
    } finally {
      els.syncCloudBtn.disabled = false;
    }
  }

  async function mergeSeedMissingIntoCloud() {
    const seeded = getSeedState();
    if (!seeded || !supabaseClient || !cloudReady) return 0;

    const itemIds = new Set(state.items.map((item) => item.id));
    const employeeIds = new Set(state.employees.map((employee) => employee.id));
    const missingItems = seeded.items.filter((item) => !itemIds.has(item.id));
    const missingEmployees = seeded.employees.filter((employee) => !employeeIds.has(employee.id));

    if (!missingItems.length && !missingEmployees.length) return 0;

    state.items.push(...missingItems);
    state.employees.push(...missingEmployees);
    sortEmployees();
    await syncStateToCloud();
    return missingItems.length;
  }

  async function bootstrap() {
    supabaseClient = initSupabaseClient();

    if (supabaseClient) {
      try {
        showToast("Завантаження з хмари…");
        state = await loadStateFromCloud();

        if (!state.employees.length && !state.items.length) {
          const seeded = getSeedState();
          if (seeded) {
            state = seeded;
            sortEmployees();
            await syncStateToCloud();
            showToast("Початкові дані завантажено в Supabase");
          }
        } else {
          sortEmployees();
          const localChanges = await mergeLocalIntoCloud();
          const seedAdded = localChanges ? 0 : await mergeSeedMissingIntoCloud();
          if (localChanges > 0) {
            showToast(`Локальні зміни завантажено на сайт (${localChanges})`);
          } else if (seedAdded > 0) {
            showToast(`Дані з хмари + ${seedAdded} предметів з резерву`);
          } else {
            showToast("Дані завантажено з Supabase");
          }
        }

        cloudReady = true;
        setupCloudRealtime();
      } catch (error) {
        console.error("Supabase bootstrap failed:", error);
        state = loadStateLocal();
        sortEmployees();
        const detail = error instanceof Error ? error.message : String(error);
        showToast(`Supabase: ${detail}`, 6000);
      }
    } else {
      state = loadStateLocal();
      sortEmployees();
      if (SUPABASE_URL || SUPABASE_ANON_KEY) {
        showToast("Перевірте SUPABASE_URL та SUPABASE_ANON_KEY на Render", 5000);
      }
    }

    renderAll();
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    if (supabaseClient && cloudReady) {
      clearTimeout(cloudSyncTimer);
      cloudSyncTimer = setTimeout(async () => {
        try {
          await syncStateToCloud();
        } catch {
          showToast("Помилка збереження в Supabase");
        }
      }, 500);
    }
  }

  function showToast(message, duration = 2200) {
    els.toast.textContent = message;
    els.toast.classList.remove("hidden");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => els.toast.classList.add("hidden"), duration);
  }

  function problemsText(value) {
    const t = (value || "").trim();
    return t || "проблеми не виявлено";
  }

  function hasProblems(item) {
    return !!(item.problems || "").trim();
  }

  /** @returns {"ok"|"warn"|"broken"} */
  function cardTone(item) {
    if (!item.working) return "broken";
    if (hasProblems(item)) return "warn";
    return "ok";
  }

  function isWarehouse(item) {
    return !item.employeeId;
  }

  function locationLabel(employeeId) {
    if (!employeeId) return "Склад";
    const emp = state.employees.find((e) => e.id === employeeId);
    return emp ? emp.name : "— співробітника видалено —";
  }

  function sortEmployees() {
    state.employees.sort((a, b) => a.name.localeCompare(b.name, "uk"));
  }

  function normalizePib(name) {
    return String(name || "")
      .replace(/[\u02bcʼ’`]/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  /** Same person if surname + first name match (patronymic optional). */
  function pibKey(name) {
    const n = normalizePib(name);
    if (!n || n.includes("+") || n.includes("/")) return `__unique__:${n.toLowerCase()}`;
    const parts = n.split(" ");
    if (parts.length < 2) return `__unique__:${n.toLowerCase()}`;
    return `${parts[0].toLowerCase()}|${parts[1].toLowerCase()}`;
  }

  function preferPibName(a, b) {
    const an = normalizePib(a);
    const bn = normalizePib(b);
    const ap = an.split(" ");
    const bp = bn.split(" ");
    if (bp.length !== ap.length) return bp.length > ap.length ? bn : an;
    return bn.length > an.length ? bn : an;
  }

  function findEmployeeByPib(name, exceptId = "") {
    const key = pibKey(name);
    return state.employees.find((e) => e.id !== exceptId && pibKey(e.name) === key) || null;
  }

  function mergeEmployeeInto(keepId, removeId, preferredName) {
    if (!keepId || !removeId || keepId === removeId) return;
    state.items = state.items.map((item) =>
      item.employeeId === removeId ? { ...item, employeeId: keepId } : item
    );
    const keepIdx = state.employees.findIndex((e) => e.id === keepId);
    if (keepIdx >= 0 && preferredName) {
      state.employees[keepIdx] = {
        ...state.employees[keepIdx],
        name: preferPibName(state.employees[keepIdx].name, preferredName),
      };
    }
    state.employees = state.employees.filter((e) => e.id !== removeId);
  }

  function itemsForEmployee(employeeId) {
    return state.items
      .filter((i) => i.employeeId === employeeId)
      .sort((a, b) => a.name.localeCompare(b.name, "uk"));
  }

  function warehouseItems() {
    return state.items.filter(isWarehouse);
  }

  function fillEmployeeSelects() {
    const options = state.employees
      .map((e) => `<option value="${escapeAttr(e.id)}">${escapeHtml(e.name)}</option>`)
      .join("");

    els.itemEmployee.innerHTML =
      `<option value="">Склад (ніким не використовується)</option>${options}`;

    const current = els.employeeFilter.value || "all";
    els.employeeFilter.innerHTML =
      `<option value="all">Усі (склад/ПБІ)</option>` +
      `<option value="warehouse">Тільки склад</option>` +
      `<option value="assigned">Тільки у співробітників</option>` +
      state.employees
        .map((e) => `<option value="${escapeAttr(e.id)}">${escapeHtml(e.name)}</option>`)
        .join("");
    els.employeeFilter.value = [...els.employeeFilter.options].some((o) => o.value === current)
      ? current
      : "all";
  }

  function siteLabel(site) {
    return SITES.includes(site) ? site : "— не вказано —";
  }

  function pdfSiteLabel(site) {
    if (site === GENERAL_SITE) return "Невідомо";
    return SITES.includes(site) ? site : "—";
  }

  function pdfAssigneeLabel(employeeId) {
    if (!employeeId) return "—";
    const emp = state.employees.find((e) => e.id === employeeId);
    return emp ? emp.name : "—";
  }

  function pdfStatusLabel(item) {
    if (!item.working) return "Несправний";
    if (hasProblems(item)) return "Справний · є проблеми";
    return "Справний";
  }

  const EXPORT_HEADERS = [
    "№",
    "Назва",
    "Модель",
    "Місце",
    "За ким закріплений",
    "Інв. номер",
    "Стан",
    "Характеристики",
    "Замітка",
    "Що зробити",
    "Проблеми",
  ];

  function getFilteredEmployees() {
    const q = els.employeeSearch.value.trim().toLowerCase();
    return state.employees.filter((e) => e.name.toLowerCase().includes(q));
  }

  function getExportScope() {
    if (currentView === "warehouse") {
      const q = els.warehouseSearch.value.trim();
      const status = els.warehouseStatusFilter.value;
      const items = getFilteredWarehouseItems(warehouseTab);
      const labelParts = [warehouseTab];
      const slugParts = [warehouseTab];

      if (q) {
        labelParts.push(`«${q}»`);
        slugParts.push(q);
      }
      if (status === "ok") {
        labelParts.push("справні");
        slugParts.push("spravni");
      } else if (status === "broken") {
        labelParts.push("несправні");
        slugParts.push("nespravni");
      }

      return {
        label: labelParts.join(" · "),
        fileSlug: slugParts.join("-"),
        items,
      };
    }

    if (currentView === "employees") {
      const q = els.employeeSearch.value.trim();
      const matched = getFilteredEmployees();

      if (q && matched.length) {
        const ids = new Set(matched.map((employee) => employee.id));
        return {
          label:
            matched.length === 1
              ? `ПБІ: ${matched[0].name}`
              : `ПБІ (${matched.length}) · «${q}»`,
          fileSlug: matched.length === 1 ? matched[0].name : `pbi-${q}`,
          items: state.items
            .filter((item) => ids.has(item.employeeId))
            .sort((a, b) => a.name.localeCompare(b.name, "uk")),
        };
      }

      return {
        label: "Закріплені предмети",
        fileSlug: "assigned",
        items: state.items
          .filter((item) => !isWarehouse(item))
          .sort((a, b) => a.name.localeCompare(b.name, "uk")),
      };
    }

    const q = els.itemSearch.value.trim();
    const status = els.statusFilter.value;
    const site = els.siteFilter.value;
    const place = els.employeeFilter.value;
    const items = getFilteredItems();
    const labelParts = [];
    const slugParts = [];

    labelParts.push(site !== "all" ? site : "Усі локації");
    slugParts.push(site !== "all" ? site : "all");

    if (q) {
      labelParts.push(`«${q}»`);
      slugParts.push(q);
    }
    if (status === "ok") {
      labelParts.push("справні");
      slugParts.push("spravni");
    } else if (status === "broken") {
      labelParts.push("несправні");
      slugParts.push("nespravni");
    }
    if (place === "warehouse") {
      labelParts.push("склад");
      slugParts.push("warehouse");
    } else if (place === "assigned") {
      labelParts.push("у ПБІ");
      slugParts.push("assigned");
    } else if (place !== "all") {
      const emp = state.employees.find((employee) => employee.id === place);
      if (emp) {
        labelParts.push(emp.name);
        slugParts.push(emp.name);
      }
    }

    return {
      label: labelParts.join(" · "),
      fileSlug: slugParts.join("-"),
      items,
    };
  }

  function exportFileSlug(value) {
    return String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();
  }

  function exportCell(value) {
    const text = value == null ? "" : String(value).trim();
    return text || "—";
  }

  function itemExportRow(item, index) {
    return [
      index + 1,
      exportCell(item.name),
      exportCell(item.model),
      pdfSiteLabel(item.site),
      pdfAssigneeLabel(item.employeeId),
      item.invNumber ? item.invNumber : "не вказано",
      pdfStatusLabel(item),
      exportCell(item.specs),
      exportCell(item.note),
      exportCell(item.action),
      problemsText(item.problems),
    ];
  }

  function exportMetaRows(scopeLabel) {
    const dateStr = new Date().toLocaleDateString("uk-UA", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return [
      ["Інвентаризація техніки"],
      [`ТОВ ТЕКСА · ${dateStr}`],
      [`Фільтр: ${scopeLabel}`],
      [],
    ];
  }

  function buildPdfDocument(items, scopeLabel) {
    const dateStr = new Date().toLocaleDateString("uk-UA", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const headerRow = EXPORT_HEADERS.map((text) => ({ text, style: "tableHeader" }));

    const bodyRows = items.map((item, index) =>
      itemExportRow(item, index).map((value, colIndex) => ({
        text: String(value),
        style: colIndex === 0 ? "tableCellCenter" : "tableCell",
      }))
    );

    /** @type {import('pdfmake/interfaces').Content[]} */
    const content = [
      { text: "Інвентаризація техніки", style: "header" },
      { text: `ТОВ ТЕКСА · ${dateStr}`, style: "subheader", margin: [0, 0, 0, 6] },
      { text: `Фільтр: ${scopeLabel}`, style: "subheader", margin: [0, 0, 0, 6] },
      { text: `Усього предметів: ${items.length}`, style: "muted", margin: [0, 0, 0, 14] },
      {
        table: {
          headerRows: 1,
          dontBreakRows: false,
          widths: [18, 72, 58, 48, 62, 48, 42, 78, 58, 58, 72],
          body: [headerRow, ...bodyRows],
        },
        layout: {
          fillColor(rowIndex) {
            if (rowIndex === 0) return "#E8EEF4";
            return rowIndex % 2 === 0 ? "#F9FAFB" : null;
          },
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => "#CCCCCC",
          vLineColor: () => "#CCCCCC",
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 3,
          paddingBottom: () => 3,
        },
      },
    ];

    return {
      pageSize: "A4",
      pageOrientation: "landscape",
      pageMargins: [28, 36, 28, 36],
      defaultStyle: { font: "Roboto", fontSize: 7.5, lineHeight: 1.25 },
      styles: {
        header: { fontSize: 14, bold: true },
        subheader: { fontSize: 10, color: "#444444" },
        muted: { fontSize: 9, color: "#666666" },
        tableHeader: { fontSize: 7.5, bold: true, alignment: "center" },
        tableCell: { fontSize: 7.5 },
        tableCellCenter: { fontSize: 7.5, alignment: "center" },
      },
      content,
    };
  }

  function exportPdf() {
    if (typeof pdfMake === "undefined") {
      showToast("Бібліотека PDF не завантажилась. Перевірте інтернет.");
      return;
    }

    const { items, label, fileSlug } = getExportScope();
    if (!items.length) {
      showToast("Немає предметів для експорту за поточним фільтром");
      return;
    }

    els.exportPdfBtn.disabled = true;
    try {
      const date = new Date().toISOString().slice(0, 10);
      const fileName = `inventory-${exportFileSlug(fileSlug)}-${date}.pdf`;
      pdfMake.createPdf(buildPdfDocument(items, label)).download(fileName);
      showToast(`PDF збережено (${label})`);
    } catch {
      showToast("Помилка створення PDF");
    } finally {
      els.exportPdfBtn.disabled = false;
    }
  }

  function exportExcel() {
    if (typeof XLSX === "undefined") {
      showToast("Бібліотека Excel не завантажилась. Перевірте інтернет.");
      return;
    }

    const { items, label, fileSlug } = getExportScope();
    if (!items.length) {
      showToast("Немає предметів для експорту за поточним фільтром");
      return;
    }

    els.exportExcelBtn.disabled = true;
    try {
      const rows = [
        ...exportMetaRows(label),
        EXPORT_HEADERS,
        ...items.map((item, index) => itemExportRow(item, index)),
      ];
      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      worksheet["!cols"] = [
        { wch: 4 },
        { wch: 28 },
        { wch: 22 },
        { wch: 14 },
        { wch: 24 },
        { wch: 14 },
        { wch: 16 },
        { wch: 30 },
        { wch: 22 },
        { wch: 22 },
        { wch: 28 },
      ];
      const workbook = XLSX.utils.book_new();
      const sheetName = String(label).slice(0, 31) || "Інвентар";
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      const date = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `inventory-${exportFileSlug(fileSlug)}-${date}.xlsx`);
      showToast(`Excel збережено (${label})`);
    } catch {
      showToast("Помилка створення Excel");
    } finally {
      els.exportExcelBtn.disabled = false;
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function escapeAttr(str) {
    return escapeHtml(str).replaceAll("'", "&#39;");
  }

  function switchView(view) {
    currentView = view;
    els.navBtns.forEach((btn) => btn.classList.toggle("active", btn.dataset.view === view));
    els.itemsView.classList.toggle("hidden", view !== "items");
    els.warehouseView.classList.toggle("hidden", view !== "warehouse");
    els.employeesView.classList.toggle("hidden", view !== "employees");
  }

  function matchesQuery(item, q) {
    if (!q) return true;
    const hay = [
      item.name,
      item.model,
      item.invNumber,
      item.site,
      item.specs,
      item.note,
      item.action,
      problemsText(item.problems),
      locationLabel(item.employeeId),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  }

  function getFilteredItems() {
    const q = els.itemSearch.value.trim().toLowerCase();
    const status = els.statusFilter.value;
    const site = els.siteFilter.value;
    const place = els.employeeFilter.value;

    return state.items
      .filter((item) => {
        if (status === "ok" && !item.working) return false;
        if (status === "broken" && item.working) return false;
        if (site !== "all" && item.site !== site) return false;
        if (place === "warehouse" && !isWarehouse(item)) return false;
        if (place === "assigned" && isWarehouse(item)) return false;
        if (place !== "all" && place !== "warehouse" && place !== "assigned" && item.employeeId !== place) {
          return false;
        }
        return matchesQuery(item, q);
      })
      .sort((a, b) => a.name.localeCompare(b.name, "uk"));
  }

  function getFilteredWarehouseItems(siteFilter = "all") {
    const q = els.warehouseSearch.value.trim().toLowerCase();
    const status = els.warehouseStatusFilter.value;

    return warehouseItems()
      .filter((item) => {
        if (status === "ok" && !item.working) return false;
        if (status === "broken" && item.working) return false;
        if (siteFilter !== "all" && item.site !== siteFilter) return false;
        return matchesQuery(item, q);
      })
      .sort((a, b) => a.name.localeCompare(b.name, "uk"));
  }

  function appendCards(container, items, cardOpts) {
    items.forEach((item) => {
      const card = document.createElement("article");
      card.className = `card tone-${cardTone(item)}`;
      card.innerHTML = itemCardHtml(item, cardOpts);
      container.appendChild(card);
    });
  }

  function updateWarehouseTabCounts() {
    const all = warehouseItems();
    els.warehouseTabs.querySelectorAll("[data-count-for]").forEach((el) => {
      const key = el.getAttribute("data-count-for");
      el.textContent = String(all.filter((i) => i.site === key).length);
    });
    els.warehouseTabs.querySelectorAll(".subtab").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-warehouse-tab") === warehouseTab);
    });
  }

  function renderWarehouse() {
    updateWarehouseTabCounts();
    els.warehouseContent.innerHTML = "";
    els.warehouseEmpty.classList.add("hidden");

    const items = getFilteredWarehouseItems(warehouseTab);
    const hasSearchOrFilter =
      !!els.warehouseSearch.value.trim() || els.warehouseStatusFilter.value !== "all";
    const isGeneral = warehouseTab === GENERAL_SITE;

    if (!items.length) {
      const title = hasSearchOrFilter
        ? "Нічого не знайдено"
        : isGeneral
          ? "Загальний склад порожній"
          : `Склад «${warehouseTab}» порожній`;
      const text = hasSearchOrFilter
        ? "Спробуйте змінити пошук або фільтри."
        : isGeneral
          ? "Сюди додають предмети перед відправкою на локальні склади."
          : `На локальному складі «${warehouseTab}» зараз немає вільних предметів.`;
      els.warehouseContent.innerHTML = `<div class="empty"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(text)}</p></div>`;
      return;
    }

    const grid = document.createElement("div");
    grid.className = "cards";
    appendCards(grid, items, { showLocation: false });
    els.warehouseContent.appendChild(grid);
  }

  function itemCardHtml(item, { showLocation = true } = {}) {
    const tone = cardTone(item);
    const statusBadge =
      tone === "broken"
        ? `<span class="badge bad">Несправний</span>`
        : tone === "warn"
          ? `<span class="badge warn">Справний · є проблеми</span>`
          : `<span class="badge ok">Справний</span>`;
    const location = isWarehouse(item)
      ? `<span class="badge stock">Склад</span>`
      : "";
    return `
      <div class="card-top">
        <div>
          <h3 class="card-title">${escapeHtml(item.name)}</h3>
          <p class="card-model">${escapeHtml(item.model || "модель не вказана")}</p>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
          ${statusBadge}
          ${location}
        </div>
      </div>
      <dl class="meta">
        <div>
          <dt>Інвентарний номер</dt>
          <dd class="${item.invNumber ? "" : "missing-value"}">${escapeHtml(item.invNumber || "не вказано")}</dd>
        </div>
        <div>
          <dt>Місце знаходження</dt>
          <dd>${escapeHtml(siteLabel(item.site))}</dd>
        </div>
        ${
          showLocation
            ? `<div>
                <dt>Закріплення</dt>
                <dd>${escapeHtml(locationLabel(item.employeeId))}</dd>
              </div>`
            : ""
        }
        <div>
          <dt>Характеристики</dt>
          <dd>${escapeHtml(item.specs || "—")}</dd>
        </div>
        <div>
          <dt>Замітка</dt>
          <dd>${escapeHtml(item.note || "—")}</dd>
        </div>
        <div>
          <dt>Що зробити</dt>
          <dd>${escapeHtml(item.action || "—")}</dd>
        </div>
        <div>
          <dt>Проблеми</dt>
          <dd>${escapeHtml(problemsText(item.problems))}</dd>
        </div>
      </dl>
      <div class="card-actions">
        <button class="btn ghost small" type="button" data-edit-item="${escapeAttr(item.id)}" title="Редагувати">Редагувати</button>
        <button class="btn ghost small" type="button" data-copy-template="${escapeAttr(item.id)}" title="Створити новий предмет за цим шаблоном">Шаблон</button>
        ${
          isWarehouse(item)
            ? `<button class="btn primary small" type="button" data-from-warehouse="${escapeAttr(item.id)}" title="Вилучити зі складу">Зі складу</button>`
            : `<button class="btn ghost small" type="button" data-to-warehouse="${escapeAttr(item.id)}" title="Перенести на склад">На склад</button>`
        }
        ${
          isWarehouse(item) && item.site === GENERAL_SITE
            ? `<button class="btn ghost small" type="button" data-transfer-item="${escapeAttr(item.id)}" title="Надіслати на локальний склад">На локацію</button>`
            : ""
        }
        <button class="btn danger small" type="button" data-delete-item="${escapeAttr(item.id)}" title="Видалити">Видалити</button>
      </div>
    `;
  }

  function renderItemList(container, emptyEl, items, allCount, emptyTitle, emptyText, cardOpts) {
    emptyEl.classList.toggle("hidden", allCount > 0);
    container.innerHTML = "";

    if (!items.length && allCount > 0) {
      container.innerHTML = `<div class="empty"><h2>Нічого не знайдено</h2><p>Спробуйте змінити пошук або фільтри.</p></div>`;
      return;
    }

    if (!allCount) {
      emptyEl.querySelector("h2").textContent = emptyTitle;
      emptyEl.querySelector("p").textContent = emptyText;
      return;
    }

    items.forEach((item) => {
      const card = document.createElement("article");
      card.className = `card tone-${cardTone(item)}`;
      card.innerHTML = itemCardHtml(item, cardOpts);
      container.appendChild(card);
    });
  }

  function renderItems() {
    renderItemList(
      els.itemsGrid,
      els.itemsEmpty,
      getFilteredItems(),
      state.items.length,
      "Поки немає предметів",
      "Натисніть «Додати предмет», щоб почати облік.",
      { showLocation: true }
    );
  }

  function renderEmployees() {
    const list = getFilteredEmployees();

    els.employeesEmpty.classList.toggle("hidden", state.employees.length > 0);
    els.employeesList.innerHTML = "";

    if (!list.length && state.employees.length) {
      els.employeesList.innerHTML = `<div class="empty"><h2>Нічого не знайдено</h2><p>Спробуйте інший запит.</p></div>`;
      return;
    }

    list.forEach((emp) => {
      const assigned = itemsForEmployee(emp.id);
      const row = document.createElement("div");
      row.className = "list-row";
      row.innerHTML = `
        <div class="row-main">
          <strong>${escapeHtml(emp.name)}</strong>
          <div class="muted" style="margin-top:4px">Закріплено предметів: ${assigned.length}</div>
        </div>
        <div class="row-actions">
          <button class="btn primary small" type="button" data-view-employee-items="${escapeAttr(emp.id)}">Предмети</button>
          <button class="btn ghost small" type="button" data-edit-employee="${escapeAttr(emp.id)}">Редагувати</button>
          <button class="btn danger small" type="button" data-delete-employee="${escapeAttr(emp.id)}">Видалити</button>
        </div>
      `;
      els.employeesList.appendChild(row);
    });
  }

  function renderEmployeeItemsModal() {
    if (!viewingEmployeeId) return;
    const emp = state.employees.find((e) => e.id === viewingEmployeeId);
    if (!emp) {
      els.employeeItemsModal.close();
      viewingEmployeeId = null;
      return;
    }

    const items = itemsForEmployee(emp.id);
    els.employeeItemsTitle.textContent = emp.name;
    els.employeeItemsSub.textContent = `Закріплених предметів: ${items.length}`;
    els.employeeItemsEmpty.classList.toggle("hidden", items.length > 0);
    els.employeeItemsGrid.innerHTML = "";

    items.forEach((item) => {
      const card = document.createElement("article");
      card.className = `card tone-${cardTone(item)}`;
      card.innerHTML = itemCardHtml(item, { showLocation: false });
      els.employeeItemsGrid.appendChild(card);
    });
  }

  function renderAll() {
    fillEmployeeSelects();
    renderItems();
    renderWarehouse();
    renderEmployees();
    if (els.employeeItemsModal.open) renderEmployeeItemsModal();
  }

  function openItemModal(item, { forceWarehouse = false, presetSite = null, asTemplate = false } = {}) {
    fillEmployeeSelects();
    const isEdit = !!(item && !asTemplate);
    els.itemModalTitle.textContent = asTemplate
      ? "Новий предмет з шаблону"
      : isEdit
        ? "Редагувати предмет"
        : "Новий предмет";
    els.itemId.value = isEdit ? item.id : "";
    els.itemName.value = item?.name || "";
    els.itemModel.value = item?.model || "";
    // Unique field — clear when copying as template so the user enters a new serial/inv number
    els.itemInvNumber.value = asTemplate ? "" : item?.invNumber || "";
    els.itemWorking.value = item ? String(!!item.working) : "true";
    const defaultSite =
      presetSite && SITES.includes(presetSite)
        ? presetSite
        : item && SITES.includes(item.site)
          ? item.site
          : forceWarehouse
            ? GENERAL_SITE
            : DEFAULT_SITE;
    els.itemSite.value = defaultSite;
    els.itemEmployee.value =
      forceWarehouse && !item ? WAREHOUSE : item?.employeeId || WAREHOUSE;
    els.itemSpecs.value = item?.specs || "";
    els.itemNote.value = item?.note || "";
    els.itemAction.value = item?.action || "";
    els.itemProblems.value = item?.problems || "";
    els.itemModal.showModal();
    if (asTemplate) {
      els.itemInvNumber.focus();
    } else {
      els.itemName.focus();
    }
  }

  function openEmployeeModal(emp) {
    els.employeeModalTitle.textContent = emp ? "Редагувати ПБІ" : "Новий співробітник";
    els.employeeId.value = emp?.id || "";
    els.employeeName.value = emp?.name || "";
    els.employeeModal.showModal();
    els.employeeName.focus();
  }

  function openEmployeeItems(employeeId) {
    viewingEmployeeId = employeeId;
    renderEmployeeItemsModal();
    els.employeeItemsModal.showModal();
  }

  function closeModal(id) {
    document.getElementById(id)?.close();
    if (id === "employeeItemsModal") viewingEmployeeId = null;
  }

  function moveToWarehouse(itemId) {
    const idx = state.items.findIndex((i) => i.id === itemId);
    if (idx < 0) return;
    state.items[idx] = {
      ...state.items[idx],
      employeeId: WAREHOUSE,
      updatedAt: new Date().toISOString(),
    };
    saveState();
    renderAll();
    showToast("Предмет перенесено на склад");
  }

  function openAssignModal(itemId) {
    const item = state.items.find((i) => i.id === itemId);
    if (!item) return;
    els.assignItemId.value = itemId;
    els.assignItemLabel.textContent = `${item.name}${item.model ? ` · ${item.model}` : ""}${item.invNumber ? ` · інв. ${item.invNumber}` : " · інв. номер не вказано"}`;
    els.assignEmployee.innerHTML =
      `<option value="">— оберіть ПБІ —</option>` +
      state.employees
        .map((e) => `<option value="${escapeAttr(e.id)}">${escapeHtml(e.name)}</option>`)
        .join("");
    els.assignModal.showModal();
    els.assignEmployee.focus();
  }

  function assignFromWarehouse(itemId, employeeId) {
    const idx = state.items.findIndex((i) => i.id === itemId);
    if (idx < 0) return;
    state.items[idx] = {
      ...state.items[idx],
      employeeId,
      updatedAt: new Date().toISOString(),
    };
    saveState();
    renderAll();
    showToast("Предмет вилучено зі складу");
  }

  function openTransferModal(itemId) {
    const item = state.items.find((i) => i.id === itemId);
    if (!item) return;
    els.transferItemId.value = itemId;
    els.transferItemLabel.textContent = `${item.name}${item.model ? ` · ${item.model}` : ""}${item.invNumber ? ` · інв. ${item.invNumber}` : ""}`;
    els.transferSite.value = "";
    els.transferModal.showModal();
    els.transferSite.focus();
  }

  function transferToLocalSite(itemId, site) {
    const idx = state.items.findIndex((i) => i.id === itemId);
    if (idx < 0 || !LOCAL_SITES.includes(site)) return;
    state.items[idx] = {
      ...state.items[idx],
      site,
      updatedAt: new Date().toISOString(),
    };
    saveState();
    renderAll();
    showToast(`Надіслано на склад «${site}»`);
  }

  // Navigation
  els.navBtns.forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  // Filters
  [els.itemSearch, els.statusFilter, els.siteFilter, els.employeeFilter].forEach((el) => {
    el.addEventListener("input", renderItems);
    el.addEventListener("change", renderItems);
  });
  [els.warehouseSearch, els.warehouseStatusFilter].forEach((el) => {
    el.addEventListener("input", renderWarehouse);
    el.addEventListener("change", renderWarehouse);
  });
  els.employeeSearch.addEventListener("input", renderEmployees);

  els.warehouseTabs.addEventListener("click", (e) => {
    const tab = e.target.closest?.("[data-warehouse-tab]");
    if (!tab) return;
    warehouseTab = tab.getAttribute("data-warehouse-tab") || GENERAL_SITE;
    renderWarehouse();
  });

  // Add buttons
  els.addItemBtn.addEventListener("click", () => openItemModal(null));
  els.addWarehouseItemBtn.addEventListener("click", () =>
    openItemModal(null, {
      forceWarehouse: true,
      presetSite: warehouseTab,
    })
  );
  els.addEmployeeBtn.addEventListener("click", () => openEmployeeModal(null));

  // Close buttons
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => closeModal(btn.getAttribute("data-close")));
  });

  // Item form
  els.itemForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = els.itemName.value.trim();
    const invNumber = els.itemInvNumber.value.trim();
    if (!name) return;

    if (invNumber) {
      const duplicate = state.items.find(
        (i) => i.invNumber.toLowerCase() === invNumber.toLowerCase() && i.id !== els.itemId.value
      );
      if (duplicate) {
        showToast("Такий інвентарний номер уже існує");
        return;
      }
    }

    const now = new Date().toISOString();
    const payload = {
      name,
      model: els.itemModel.value.trim(),
      invNumber,
      working: els.itemWorking.value === "true",
      site: els.itemSite.value,
      employeeId: els.itemEmployee.value,
      specs: els.itemSpecs.value.trim(),
      note: els.itemNote.value.trim(),
      action: els.itemAction.value.trim(),
      problems: els.itemProblems.value.trim(),
      updatedAt: now,
    };

    if (els.itemId.value) {
      const idx = state.items.findIndex((i) => i.id === els.itemId.value);
      if (idx >= 0) {
        state.items[idx] = { ...state.items[idx], ...payload };
      }
      showToast("Предмет оновлено");
    } else {
      state.items.push({ id: uid(), createdAt: now, ...payload });
      showToast("Предмет додано");
    }

    saveState();
    renderAll();
    els.itemModal.close();
  });

  // Employee form
  els.employeeForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = normalizePib(els.employeeName.value);
    if (!name) return;

    const existingSame = findEmployeeByPib(name, els.employeeId.value);
    if (existingSame) {
      if (els.employeeId.value) {
        // editing into another person's surname+name — merge current into existing
        mergeEmployeeInto(existingSame.id, els.employeeId.value, name);
        showToast("ПБІ об’єднано (одна людина)");
      } else {
        // adding duplicate — update existing name to fuller form if needed
        const idx = state.employees.findIndex((emp) => emp.id === existingSame.id);
        if (idx >= 0) {
          state.employees[idx] = {
            ...state.employees[idx],
            name: preferPibName(state.employees[idx].name, name),
          };
        }
        showToast("Така людина вже є — ПБІ оновлено");
      }
      sortEmployees();
      saveState();
      renderAll();
      els.employeeModal.close();
      return;
    }

    if (els.employeeId.value) {
      const idx = state.employees.findIndex((emp) => emp.id === els.employeeId.value);
      if (idx >= 0) state.employees[idx] = { ...state.employees[idx], name };
      showToast("ПБІ оновлено");
    } else {
      state.employees.push({ id: uid(), name });
      showToast("Співробітника додано");
    }

    sortEmployees();
    saveState();
    renderAll();
    els.employeeModal.close();
  });

  els.assignForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const itemId = els.assignItemId.value;
    const employeeId = els.assignEmployee.value;
    if (!itemId || !employeeId) {
      showToast("Оберіть співробітника");
      return;
    }
    assignFromWarehouse(itemId, employeeId);
    els.assignModal.close();
  });

  els.transferForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const itemId = els.transferItemId.value;
    const site = els.transferSite.value;
    if (!itemId || !LOCAL_SITES.includes(site)) {
      showToast("Оберіть локальний склад");
      return;
    }
    transferToLocalSite(itemId, site);
    els.transferModal.close();
  });

  // Delegated actions
  document.addEventListener("click", (e) => {
    const editItemId = e.target.closest?.("[data-edit-item]")?.getAttribute("data-edit-item");
    const copyTemplateId = e.target.closest?.("[data-copy-template]")?.getAttribute("data-copy-template");
    const deleteItemId = e.target.closest?.("[data-delete-item]")?.getAttribute("data-delete-item");
    const toWarehouseId = e.target.closest?.("[data-to-warehouse]")?.getAttribute("data-to-warehouse");
    const fromWarehouseId = e.target.closest?.("[data-from-warehouse]")?.getAttribute("data-from-warehouse");
    const transferItemId = e.target.closest?.("[data-transfer-item]")?.getAttribute("data-transfer-item");
    const viewEmpItemsId = e.target.closest?.("[data-view-employee-items]")?.getAttribute("data-view-employee-items");
    const editEmpId = e.target.closest?.("[data-edit-employee]")?.getAttribute("data-edit-employee");
    const deleteEmpId = e.target.closest?.("[data-delete-employee]")?.getAttribute("data-delete-employee");

    if (viewEmpItemsId) {
      openEmployeeItems(viewEmpItemsId);
      return;
    }

    if (editItemId) {
      const item = state.items.find((i) => i.id === editItemId);
      if (item) openItemModal(item);
      return;
    }

    if (copyTemplateId) {
      const item = state.items.find((i) => i.id === copyTemplateId);
      if (item) {
        openItemModal(item, { asTemplate: true });
        showToast("Шаблон скопійовано — змініть потрібні поля");
      }
      return;
    }

    if (transferItemId) {
      openTransferModal(transferItemId);
      return;
    }

    if (fromWarehouseId) {
      const item = state.items.find((i) => i.id === fromWarehouseId);
      if (!item) return;
      if (!state.employees.length) {
        showToast("Спочатку додайте співробітника в список");
        return;
      }
      openAssignModal(fromWarehouseId);
      return;
    }

    if (toWarehouseId) {
      const item = state.items.find((i) => i.id === toWarehouseId);
      if (!item) return;
      if (!confirm(`Перенести «${item.name}» на склад?`)) return;
      moveToWarehouse(toWarehouseId);
      return;
    }

    if (deleteItemId) {
      const item = state.items.find((i) => i.id === deleteItemId);
      if (!item) return;
      if (!confirm(`Видалити предмет «${item.name}»${item.invNumber ? ` (${item.invNumber})` : ""}?`)) return;
      state.items = state.items.filter((i) => i.id !== deleteItemId);
      saveState();
      renderAll();
      showToast("Предмет видалено");
      return;
    }

    if (editEmpId) {
      const emp = state.employees.find((e2) => e2.id === editEmpId);
      if (emp) openEmployeeModal(emp);
      return;
    }

    if (deleteEmpId) {
      const emp = state.employees.find((e2) => e2.id === deleteEmpId);
      if (!emp) return;
      const linked = itemsForEmployee(deleteEmpId).length;
      const msg =
        linked > 0
          ? `У «${emp.name}» закріплено предметів: ${linked}. Видалити ПБІ? Ці предмети перейдуть на склад.`
          : `Видалити «${emp.name}» зі списку?`;
      if (!confirm(msg)) return;
      state.employees = state.employees.filter((e2) => e2.id !== deleteEmpId);
      state.items = state.items.map((i) =>
        i.employeeId === deleteEmpId ? { ...i, employeeId: WAREHOUSE } : i
      );
      saveState();
      renderAll();
      showToast("Співробітника видалено");
    }
  });

  // Export / import
  els.syncCloudBtn?.addEventListener("click", pushLocalToCloud);
  els.exportPdfBtn.addEventListener("click", exportPdf);
  els.exportExcelBtn.addEventListener("click", exportExcel);

  els.exportBtn.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Експорт збережено");
  });

  els.importInput.addEventListener("change", async () => {
    const file = els.importInput.files?.[0];
    els.importInput.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed.employees) || !Array.isArray(parsed.items)) {
        throw new Error("Невірна структура файлу");
      }
      if (!confirm("Імпорт замінить поточні дані. Продовжити?")) return;
      state = {
        employees: parsed.employees,
        items: parsed.items.map((item) => ({
          ...item,
          site: SITES.includes(item.site) ? item.site : DEFAULT_SITE,
        })),
      };
      sortEmployees();
      saveState();
      renderAll();
      showToast("Дані імпортовано");
    } catch {
      showToast("Помилка імпорту JSON");
    }
  });

  [els.itemModal, els.employeeModal, els.employeeItemsModal, els.assignModal, els.transferModal].forEach((dlg) => {
    dlg.addEventListener("cancel", (e) => {
      e.preventDefault();
      dlg.close();
      if (dlg === els.employeeItemsModal) viewingEmployeeId = null;
    });
  });

  bootstrap();
})();
