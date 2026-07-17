(() => {
  "use strict";

  function initTasksPlanner() {
    const root = document.getElementById("tasksView");
    if (!root) return;

    const STORAGE_KEY = "company-inventory-tasks-v1";
    const LEGACY_KEYS = ["focus-todolist-v2", "focus-todolist-v1"];
    const SOON_MS = 24 * 60 * 60 * 1000;
    const HOT_MS = 4 * 24 * 60 * 60 * 1000;

    const form = root.querySelector("#taskForm");
    const input = root.querySelector("#taskInput");
    const deadlineInput = root.querySelector("#taskDeadlineInput");
    const list = root.querySelector("#taskList");
    const empty = root.querySelector("#taskEmpty");
    const activeCountEl = root.querySelector("#taskActiveCount");
    const pausedCountEl = root.querySelector("#taskPausedCount");
    const clearDoneBtn = root.querySelector("#taskClearDone");
    const filters = root.querySelectorAll(".task-filter");
    const hotFilter = root.querySelector("#taskHotFilter");
    const hotBadge = root.querySelector("#taskHotBadge");
    const sortSelect = root.querySelector("#taskSortSelect");
    const alerts = root.querySelector("#taskAlerts");
    const notifyBtn = root.querySelector("#taskNotifyBtn");
    const notifyStatus = root.querySelector("#taskNotifyStatus");

    const editOverlay = root.querySelector("#taskEditOverlay");
    const editText = root.querySelector("#taskEditText");
    const editNotes = root.querySelector("#taskEditNotes");
    const editContact = root.querySelector("#taskEditContact");
    const editDeadline = root.querySelector("#taskEditDeadline");
    const editCancel = root.querySelector("#taskEditCancel");
    const editSave = root.querySelector("#taskEditSave");

    const extendOverlay = root.querySelector("#taskExtendOverlay");
    const extendCustom = root.querySelector("#taskExtendCustom");
    const extendCancel = root.querySelector("#taskExtendCancel");
    const extendSave = root.querySelector("#taskExtendSave");

    let todos = load();
    let filter = "all";
    let sortMode = localStorage.getItem("inventory-tasks-sort-mode") || "created-desc";
    let editingId = null;
    let extendingId = null;
    sortSelect.value = sortMode;

    function uid() {
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function normalize(todo) {
      return {
        id: todo.id || uid(),
        text: todo.text || "",
        notes: typeof todo.notes === "string" ? todo.notes : "",
        contact: typeof todo.contact === "string" ? todo.contact : "",
        done: Boolean(todo.done),
        createdAt: todo.createdAt || Date.now(),
        completedAt: todo.completedAt ?? (todo.done ? (todo.createdAt || Date.now()) : null),
        deadline: todo.deadline ?? null,
        paused: Boolean(todo.paused),
        pauseRemainingMs: todo.pauseRemainingMs ?? null,
        notifiedSoon: Boolean(todo.notifiedSoon),
        notifiedOverdue: Boolean(todo.notifiedOverdue),
      };
    }

    function load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed.map(normalize) : [];
        }
        for (const legacyKey of LEGACY_KEYS) {
          const legacyRaw = localStorage.getItem(legacyKey);
          if (!legacyRaw) continue;
          const migrated = JSON.parse(legacyRaw);
          const list = Array.isArray(migrated) ? migrated.map(normalize) : [];
          localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
          return list;
        }
        return [];
      } catch {
        return [];
      }
    }

    function save() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    }

    function pad(n) {
      return String(n).padStart(2, "0");
    }

    function toLocalInputValue(ts) {
      if (!ts) return "";
      const d = new Date(ts);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    function fromLocalInputValue(value) {
      if (!value) return null;
      const ts = new Date(value).getTime();
      return Number.isFinite(ts) ? ts : null;
    }

    function formatDateTime(ts) {
      return new Date(ts).toLocaleString("uk-UA", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    function formatDayHeading(ts) {
      return new Date(ts).toLocaleDateString("uk-UA", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }

    function dayKey(ts) {
      const d = new Date(ts);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }

    function completedAtOf(todo) {
      return todo.completedAt || todo.createdAt || Date.now();
    }

    function groupDoneByDay(list) {
      const map = new Map();
      list.forEach((todo) => {
        const key = dayKey(completedAtOf(todo));
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(todo);
      });

      return [...map.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([key, items]) => ({
          key,
          label: formatDayHeading(new Date(key + "T12:00:00").getTime()),
          items: sortTodos(items),
        }));
    }

    function deadlineStatus(todo, now = Date.now()) {
      if (todo.done || todo.paused || !todo.deadline) return null;
      if (todo.deadline <= now) return "overdue";
      if (todo.deadline - now <= SOON_MS) return "soon";
      return "ok";
    }

    function deadlineLabel(todo) {
      if (todo.paused && todo.pauseRemainingMs != null) {
        const days = Math.max(1, Math.ceil(todo.pauseRemainingMs / (24 * 60 * 60 * 1000)));
        return `На паузі · залишилось ~${days} дн.`;
      }
      if (!todo.deadline) return "Без дедлайна";
      const status = deadlineStatus(todo);
      if (status === "overdue") return `Прострочено · ${formatDateTime(todo.deadline)}`;
      if (status === "soon") return `Скоро дедлайн · ${formatDateTime(todo.deadline)}`;
      if (isHotTask(todo)) return `Горящий термін · ${formatDateTime(todo.deadline)}`;
      return `До ${formatDateTime(todo.deadline)}`;
    }

    function pluralActive(n) {
      if (n === 1) return "1 активна";
      if (n >= 2 && n <= 4) return `${n} активні`;
      return `${n} активних`;
    }

    function pluralPaused(n) {
      if (n === 1) return "1 на паузі";
      return `${n} на паузі`;
    }

    function isHotTask(todo, now = Date.now()) {
      if (todo.done || todo.paused || !todo.deadline) return false;
      return todo.deadline - now <= HOT_MS;
    }

    function hotTodos(now = Date.now()) {
      return todos.filter((t) => isHotTask(t, now));
    }

    function sortTodos(list) {
      const items = list.slice();
      const deadlineKey = (t) => {
        if (t.paused && t.pauseRemainingMs != null) return Date.now() + t.pauseRemainingMs;
        return t.deadline == null ? Number.POSITIVE_INFINITY : t.deadline;
      };

      items.sort((a, b) => {
        if (sortMode === "created-asc") return a.createdAt - b.createdAt;
        if (sortMode === "created-desc") return b.createdAt - a.createdAt;
        if (sortMode === "deadline-asc") {
          const da = deadlineKey(a);
          const db = deadlineKey(b);
          if (da !== db) return da - db;
          return b.createdAt - a.createdAt;
        }
        if (sortMode === "deadline-desc") {
          const da = deadlineKey(a);
          const db = deadlineKey(b);
          const aEmpty = !Number.isFinite(da) || da === Number.POSITIVE_INFINITY;
          const bEmpty = !Number.isFinite(db) || db === Number.POSITIVE_INFINITY;
          if (aEmpty && bEmpty) return b.createdAt - a.createdAt;
          if (aEmpty) return 1;
          if (bEmpty) return -1;
          if (da !== db) return db - da;
          return b.createdAt - a.createdAt;
        }
        return b.createdAt - a.createdAt;
      });
      return items;
    }

    function updateHotFilterUi(count) {
      if (count > 0) {
        hotFilter.classList.add("has-hot");
        hotBadge.hidden = false;
        hotBadge.textContent = String(count);
      } else {
        hotFilter.classList.remove("has-hot");
        hotBadge.hidden = true;
        hotBadge.textContent = "0";
      }
    }

    function visibleTodos() {
      let list;
      if (filter === "active") list = todos.filter((t) => !t.done && !t.paused);
      else if (filter === "hot") list = hotTodos();
      else if (filter === "paused") list = todos.filter((t) => t.paused && !t.done);
      else if (filter === "done") list = todos.filter((t) => t.done);
      else list = todos.slice();
      return sortTodos(list);
    }

    function updateNotifyButton() {
      notifyBtn.classList.remove("on", "blocked");
      notifyBtn.disabled = false;
      if (!("Notification" in window)) {
        notifyBtn.hidden = true;
        notifyStatus.textContent = "Цей браузер не підтримує сповіщення";
        return;
      }
      if (Notification.permission === "granted") {
        notifyBtn.textContent = "Сповіщення увімкнено";
        notifyBtn.disabled = true;
        notifyBtn.classList.add("on");
        notifyStatus.textContent = "Готово: зʼявляться спливаючі нагадування";
      } else if (Notification.permission === "denied") {
        notifyBtn.textContent = "Сповіщення заблоковано";
        notifyBtn.disabled = true;
        notifyBtn.classList.add("blocked");
        notifyStatus.textContent = "Дозвольте сповіщення в налаштуваннях браузера";
      } else {
        notifyBtn.textContent = "Увімкнути сповіщення";
        notifyStatus.textContent = "Натисніть і оберіть «Дозволити»";
      }
    }

    function notify(title, body) {
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      try {
        new Notification(title, { body, tag: body });
      } catch {
        /* ignore */
      }
    }

    function renderAlerts() {
      const now = Date.now();
      const overdue = todos.filter((t) => deadlineStatus(t, now) === "overdue");
      const soon = todos.filter((t) => deadlineStatus(t, now) === "soon");
      alerts.innerHTML = "";

      overdue.forEach((t) => {
        const el = document.createElement("div");
        el.className = "tasks-alert overdue";
        el.textContent = `Прострочено: ${t.text}`;
        alerts.appendChild(el);
      });

      soon.forEach((t) => {
        const el = document.createElement("div");
        el.className = "tasks-alert soon";
        el.textContent = `Скоро дедлайн: ${t.text} · до ${formatDateTime(t.deadline)}`;
        alerts.appendChild(el);
      });
    }

    function render() {
      const visible = visibleTodos();
      const activeCount = todos.filter((t) => !t.done && !t.paused).length;
      const pausedCount = todos.filter((t) => t.paused && !t.done).length;
      const doneCount = todos.filter((t) => t.done).length;
      const hotCount = hotTodos().length;

      activeCountEl.textContent = pluralActive(activeCount);
      pausedCountEl.textContent = pluralPaused(pausedCount);
      updateHotFilterUi(hotCount);
      clearDoneBtn.hidden = doneCount === 0;
      empty.hidden = visible.length > 0;
      empty.textContent = filter === "hot"
        ? "Горящих задач немає — дедлайни далі ніж за 4 дні."
        : filter === "done"
          ? "Поки немає виконаних задач."
          : "Поки порожньо — додайте першу задачу.";
      list.innerHTML = "";
      renderAlerts();

      const appendItem = (todo, i) => {
        const status = deadlineStatus(todo);
        const hot = isHotTask(todo);
        const li = document.createElement("li");
        li.className = "tasks-item"
          + (todo.done ? " done" : "")
          + (todo.paused ? " paused" : "")
          + (status === "soon" || hot ? " soon" : "")
          + (status === "overdue" ? " overdue" : "");
        li.style.animationDelay = `${Math.min(i, 8) * 0.03}s`;
        li.dataset.id = todo.id;

        const check = document.createElement("button");
        check.type = "button";
        check.className = "tasks-check";
        check.disabled = todo.paused;
        check.setAttribute("aria-label", todo.done ? "Позначити як активну" : "Позначити як готову");
        check.addEventListener("click", () => toggle(todo.id));

        const body = document.createElement("div");
        body.className = "tasks-body";

        const titleRow = document.createElement("div");
        titleRow.className = "title-row";

        const text = document.createElement("span");
        text.className = "tasks-text";
        text.textContent = todo.text;
        titleRow.appendChild(text);

        const dates = document.createElement("div");
        dates.className = "tasks-dates";

        const created = document.createElement("span");
        created.textContent = `Створено ${formatDateTime(todo.createdAt)}`;
        dates.appendChild(created);

        if (todo.done) {
          const completed = document.createElement("span");
          completed.className = "badge";
          completed.textContent = `Виконано ${formatDateTime(completedAtOf(todo))}`;
          dates.appendChild(completed);
        }

        const deadline = document.createElement("span");
        deadline.className = "deadline" + (status ? ` ${status}` : "");
        deadline.textContent = deadlineLabel(todo);
        dates.appendChild(deadline);

        if (todo.paused) {
          const badge = document.createElement("span");
          badge.className = "badge";
          badge.textContent = "Пауза";
          dates.appendChild(badge);
        }

        body.append(titleRow, dates);

        if (todo.notes && todo.notes.trim()) {
          const note = document.createElement("p");
          note.className = "tasks-note";
          note.textContent = todo.notes.trim();
          body.appendChild(note);
        }

        if (todo.contact && todo.contact.trim()) {
          const contact = document.createElement("p");
          contact.className = "tasks-contact";
          contact.textContent = `Контакт: ${todo.contact.trim()}`;
          body.appendChild(contact);
        }

        const actions = document.createElement("div");
        actions.className = "tasks-actions";

        const mkAction = (label, onClick, danger = false) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "tasks-action" + (danger ? " danger" : "");
          btn.textContent = label;
          btn.addEventListener("click", onClick);
          return btn;
        };

        if (!todo.done) {
          actions.appendChild(mkAction("Змінити", () => openEdit(todo.id)));
          actions.appendChild(mkAction("Нотатка", () => openEdit(todo.id, true)));
          actions.appendChild(
            mkAction(todo.paused ? "Зняти паузу" : "Пауза", () => togglePause(todo.id))
          );
          if (!todo.paused) {
            actions.appendChild(mkAction("Подовжити", () => openExtend(todo.id)));
          }
        } else {
          actions.appendChild(mkAction("Нотатка", () => openEdit(todo.id, true)));
        }
        actions.appendChild(mkAction("Видалити", () => removeTodo(todo.id, li), true));

        body.appendChild(actions);
        li.append(check, body);
        list.appendChild(li);
      };

      if (filter === "done") {
        let i = 0;
        groupDoneByDay(visible).forEach((group) => {
          const heading = document.createElement("li");
          heading.className = "tasks-day-heading";
          heading.textContent = group.label;
          list.appendChild(heading);
          group.items.forEach((todo) => appendItem(todo, i++));
        });
      } else {
        visible.forEach((todo, i) => appendItem(todo, i));
      }
    }

    function addTodo(text, deadlineValue) {
      const trimmed = text.trim();
      if (!trimmed) return;
      todos.unshift({
        id: uid(),
        text: trimmed,
        notes: "",
        contact: "",
        done: false,
        createdAt: Date.now(),
        completedAt: null,
        deadline: fromLocalInputValue(deadlineValue),
        paused: false,
        pauseRemainingMs: null,
        notifiedSoon: false,
        notifiedOverdue: false,
      });
      save();
      render();
      checkDeadlines();
    }

    function toggle(id) {
      todos = todos.map((t) => {
        if (t.id !== id) return t;
        const done = !t.done;
        return {
          ...t,
          done,
          completedAt: done ? Date.now() : null,
          paused: done ? false : t.paused,
          pauseRemainingMs: done ? null : t.pauseRemainingMs,
          notifiedSoon: done ? false : t.notifiedSoon,
          notifiedOverdue: done ? false : t.notifiedOverdue,
        };
      });
      save();
      render();
    }

    function togglePause(id) {
      const now = Date.now();
      todos = todos.map((t) => {
        if (t.id !== id || t.done) return t;

        if (!t.paused) {
          const remaining = t.deadline != null ? Math.max(0, t.deadline - now) : null;
          return {
            ...t,
            paused: true,
            pauseRemainingMs: remaining,
            notifiedSoon: false,
            notifiedOverdue: false,
          };
        }

        const restoredDeadline =
          t.pauseRemainingMs != null ? now + t.pauseRemainingMs : t.deadline;

        return {
          ...t,
          paused: false,
          deadline: restoredDeadline,
          pauseRemainingMs: null,
          notifiedSoon: false,
          notifiedOverdue: false,
        };
      });
      save();
      render();
      checkDeadlines();
    }

    function removeTodo(id, el) {
      el.classList.add("leaving");
      setTimeout(() => {
        todos = todos.filter((t) => t.id !== id);
        save();
        render();
      }, 220);
    }

    function openEdit(id, focusNotes = false) {
      const todo = todos.find((t) => t.id === id);
      if (!todo) return;
      editingId = id;
      editText.value = todo.text;
      editNotes.value = todo.notes || "";
      editContact.value = todo.contact || "";
      editDeadline.value = todo.paused
        ? ""
        : toLocalInputValue(todo.deadline);
      if (todo.paused) {
        editDeadline.disabled = true;
        editDeadline.title = "Спочатку зніміть паузу, щоб змінити дедлайн";
      } else {
        editDeadline.disabled = false;
        editDeadline.title = "";
      }
      editOverlay.hidden = false;
      if (focusNotes) editNotes.focus();
      else editText.focus();
    }

    function closeEdit() {
      editingId = null;
      editOverlay.hidden = true;
    }

    function saveEdit() {
      if (!editingId) return;
      const text = editText.value.trim();
      if (!text) {
        editText.focus();
        return;
      }
      const notes = editNotes.value.trim();
      const contact = editContact.value.trim();

      todos = todos.map((t) => {
        if (t.id !== editingId) return t;
        if (t.paused) {
          return { ...t, text, notes, contact };
        }
        return {
          ...t,
          text,
          notes,
          contact,
          deadline: fromLocalInputValue(editDeadline.value),
          notifiedSoon: false,
          notifiedOverdue: false,
        };
      });

      save();
      closeEdit();
      render();
      checkDeadlines();
    }

    function openExtend(id) {
      const todo = todos.find((t) => t.id === id);
      if (!todo || todo.paused || todo.done) return;
      extendingId = id;
      extendCustom.value = "";
      extendOverlay.hidden = false;
      extendCustom.focus();
    }

    function closeExtend() {
      extendingId = null;
      extendOverlay.hidden = true;
    }

    function extendByDays(days) {
      if (!extendingId || !Number.isFinite(days) || days < 1) return;
      const ms = Math.floor(days) * 24 * 60 * 60 * 1000;
      const now = Date.now();

      todos = todos.map((t) => {
        if (t.id !== extendingId) return t;
        const base = t.deadline && t.deadline > now ? t.deadline : now;
        return {
          ...t,
          deadline: base + ms,
          notifiedSoon: false,
          notifiedOverdue: false,
        };
      });

      save();
      closeExtend();
      render();
      checkDeadlines();
    }

    function checkDeadlines() {
      const now = Date.now();
      let changed = false;

      todos = todos.map((t) => {
        const status = deadlineStatus(t, now);
        if (status === "soon" && !t.notifiedSoon) {
          notify("Скоро дедлайн", t.text);
          changed = true;
          return { ...t, notifiedSoon: true };
        }
        if (status === "overdue" && !t.notifiedOverdue) {
          notify("Дедлайн прострочено", t.text);
          changed = true;
          return { ...t, notifiedOverdue: true };
        }
        return t;
      });

      if (changed) save();
      renderAlerts();
      updateItemStatuses();
    }

    function updateItemStatuses() {
      const now = Date.now();
      list.querySelectorAll(".tasks-item").forEach((li) => {
        const todo = todos.find((t) => t.id === li.dataset.id);
        if (!todo) return;
        li.classList.remove("soon", "overdue");
        const status = deadlineStatus(todo, now);
        if (status === "soon") li.classList.add("soon");
        if (status === "overdue") li.classList.add("overdue");

        const deadlineEl = li.querySelector(".deadline");
        if (deadlineEl) {
          deadlineEl.className = "deadline" + (status ? ` ${status}` : "");
          deadlineEl.textContent = deadlineLabel(todo);
        }
      });
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      addTodo(input.value, deadlineInput.value);
      input.value = "";
      deadlineInput.value = "";
      input.focus();
    });

    filters.forEach((btn) => {
      btn.addEventListener("click", () => {
        filter = btn.dataset.filter;
        filters.forEach((b) => b.classList.toggle("active", b === btn));
        render();
      });
    });

    sortSelect.addEventListener("change", () => {
      sortMode = sortSelect.value;
      localStorage.setItem("inventory-tasks-sort-mode", sortMode);
      render();
    });

    clearDoneBtn.addEventListener("click", () => {
      todos = todos.filter((t) => !t.done);
      save();
      render();
    });

    notifyBtn.addEventListener("click", async () => {
      if (!("Notification" in window)) return;
      notifyStatus.textContent = "Чекаємо відповідь браузера…";
      const result = await Promise.race([
        Notification.requestPermission(),
        new Promise((resolve) => setTimeout(() => resolve("timeout"), 4000)),
      ]);
      updateNotifyButton();
      if (result === "granted") {
        notify("Планувальник", "Сповіщення працюють");
        checkDeadlines();
      } else if (result === "denied") {
        notifyStatus.textContent = "Ви натиснули «Блокувати». Дозвольте пізніше в налаштуваннях браузера";
      } else if (result === "timeout") {
        notifyStatus.textContent = "Браузер не відповів. Спробуйте ще раз";
      } else {
        notifyStatus.textContent = "Дозвіл не збережено. Спробуйте ще раз";
      }
    });

    editCancel.addEventListener("click", closeEdit);
    editSave.addEventListener("click", saveEdit);
    editOverlay.addEventListener("click", (e) => {
      if (e.target === editOverlay) closeEdit();
    });

    extendCancel.addEventListener("click", closeExtend);
    extendOverlay.addEventListener("click", (e) => {
      if (e.target === extendOverlay) closeExtend();
    });
    extendSave.addEventListener("click", () => {
      extendByDays(Number(extendCustom.value));
    });
    root.querySelectorAll("[data-extend-days]").forEach((btn) => {
      btn.addEventListener("click", () => {
        extendByDays(Number(btn.dataset.extendDays));
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeEdit();
        closeExtend();
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") checkDeadlines();
    });

    updateNotifyButton();
    render();
    checkDeadlines();
    setInterval(checkDeadlines, 60 * 1000);

  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTasksPlanner);
  } else {
    initTasksPlanner();
  }
})();
