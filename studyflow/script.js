
const $ = selector => document.querySelector(selector);

const STORAGE_KEY = "studyflow-data-v1";
const CIRCUMFERENCE = 2 * Math.PI * 96;

const defaultSubjects = [
  { id: "mat", name: "Matemática", color: "purple" },
  { id: "por", name: "Português", color: "green" },
  { id: "his", name: "História", color: "blue" },
  { id: "cie", name: "Ciências", color: "orange" }
];

const defaultTasks = [
  { id: "task1", title: "Revisar exercícios da última aula", subject: "mat", priority: "alta", due: "", completed: false },
  { id: "task2", title: "Ler e resumir o capítulo", subject: "por", priority: "normal", due: "", completed: false },
  { id: "task3", title: "Organizar anotações no caderno", subject: "his", priority: "baixa", due: "", completed: true }
];

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

    if (
      saved &&
      Array.isArray(saved.subjects) &&
      Array.isArray(saved.tasks) &&
      saved.subjects.every(s => s && typeof s.id === "string" && typeof s.name === "string") &&
      saved.tasks.every(t =>
        t &&
        typeof t.id === "string" &&
        typeof t.title === "string" &&
        typeof t.subject === "string" &&
        typeof t.completed === "boolean"
      )
    ) {
      return {
        subjects: saved.subjects,
        tasks: saved.tasks,
        focusMinutes: Number.isFinite(saved.focusMinutes) && saved.focusMinutes >= 0
          ? saved.focusMinutes
          : 0
      };
    }
  } catch (error) {
    console.warn("Não foi possível carregar os dados salvos.", error);
  }

  return {
    subjects: defaultSubjects.map(subject => ({ ...subject })),
    tasks: defaultTasks.map(task => ({ ...task })),
    focusMinutes: 0
  };
}

const data = loadData();
let subjects = data.subjects;
let tasks = data.tasks;
let focusMinutes = data.focusMinutes;

let currentFilter = "todas";
let editingTaskId = null;
let toastTimeout = null;

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      subjects,
      tasks,
      focusMinutes
    }));
  } catch (error) {
    console.warn("Não foi possível salvar os dados.", error);
    showToast("Não foi possível salvar. Verifique o armazenamento do navegador.");
  }
}

function createId() {
  return window.crypto?.randomUUID?.() ??
    `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  if (!value) return "";

  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some(number => !Number.isFinite(number))) {
    return "";
  }

  const date = new Date(parts[0], parts[1] - 1, parts[2]);

  if (
    date.getFullYear() !== parts[0] ||
    date.getMonth() !== parts[1] - 1 ||
    date.getDate() !== parts[2]
  ) return "";

  if (value === localDateString()) return "Hoje";

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short"
  });
}

function showToast(message) {
  const toast = $("#toast");
  clearTimeout(toastTimeout);

  toast.textContent = message;
  toast.classList.add("show");

  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}

function getSubject(subjectId) {
  return subjects.find(subject => subject.id === subjectId);
}

function updateStats() {
  const pending = tasks.filter(task => !task.completed).length;
  const completed = tasks.filter(task => task.completed).length;
  const completion = tasks.length
    ? Math.round(completed / tasks.length * 100)
    : 0;

  $("#pending-stat").textContent = pending;
  $("#completed-stat").textContent = completed;
  $("#completed-line").style.width = `${completion}%`;
  $("#focus-stat").innerHTML = `${focusMinutes} <small>min</small>`;
  $("#subjects-stat").textContent = subjects.length;
  $("#nav-task-count").textContent = pending;
  $("#task-summary").textContent =
    `${tasks.length} ${tasks.length === 1 ? "tarefa" : "tarefas"} · ${completion}% concluído`;
}

function renderTasks() {
  const search = $("#task-search").value.trim().toLocaleLowerCase("pt-BR");

  const visibleTasks = tasks.filter(task => {
    const subject = getSubject(task.subject);
    const searchable = `${task.title} ${subject?.name || ""}`
      .toLocaleLowerCase("pt-BR");

    const matchesSearch = searchable.includes(search);
    const matchesFilter =
      currentFilter === "todas" ||
      (currentFilter === "pendentes" && !task.completed) ||
      (currentFilter === "concluidas" && task.completed);

    return matchesSearch && matchesFilter;
  });

  $("#task-list").innerHTML = visibleTasks.map(task => {
    const subject = getSubject(task.subject);
    const dueLabel = formatDate(task.due);
    const overdue = task.due &&
      task.due < localDateString() &&
      !task.completed;

    const priorityLabels = {
      alta: "Alta",
      normal: "Normal",
      baixa: "Baixa"
    };

    const priority = priorityLabels[task.priority] || "Normal";

    return `
      <article class="task-row ${task.completed ? "is-complete" : ""}">
        <input
          class="task-check"
          type="checkbox"
          data-toggle-task="${escapeHTML(task.id)}"
          ${task.completed ? "checked" : ""}
          aria-label="Concluir ${escapeHTML(task.title)}"
        >
        <div class="task-main">
          <span class="task-title">${escapeHTML(task.title)}</span>
          <div class="task-meta">
            <span class="task-subject">${escapeHTML(subject?.name || "Sem matéria")}</span>
            <span class="priority priority-${priorityLabels[task.priority] ? task.priority : "normal"}">${priority}</span>
            ${dueLabel ? `<span class="task-due ${overdue ? "overdue" : ""}">${overdue ? "Atrasada · " : ""}${escapeHTML(dueLabel)}</span>` : ""}
          </div>
        </div>
        <button class="task-delete" data-delete-task="${escapeHTML(task.id)}" aria-label="Excluir tarefa" title="Excluir tarefa">×</button>
      </article>
    `;
  }).join("");

  $("#task-empty").hidden = visibleTasks.length !== 0;
  updateStats();
}

function renderSubjects() {
  const grid = $("#subjects-grid");

  grid.innerHTML = subjects.map(subject => {
    const subjectTasks = tasks.filter(task => task.subject === subject.id);
    const completed = subjectTasks.filter(task => task.completed).length;
    const percent = subjectTasks.length
      ? Math.round(completed / subjectTasks.length * 100)
      : 0;

    const icons = {
      purple: "∑",
      green: "Aa",
      blue: "▤",
      orange: "⚗",
      pink: "✦"
    };

    return `
      <article class="subject-card ${escapeHTML(subject.color)}">
        <div class="subject-top">
          <span class="subject-icon">${icons[subject.color] || "✦"}</span>
          <button class="subject-menu" data-delete-subject="${escapeHTML(subject.id)}" title="Excluir matéria" aria-label="Excluir matéria ${escapeHTML(subject.name)}">⋯</button>
        </div>
        <h3>${escapeHTML(subject.name)}</h3>
        <p>${subjectTasks.length} ${subjectTasks.length === 1 ? "tarefa" : "tarefas"} no total</p>
        <div class="subject-progress-head">
          <span>Progresso</span><strong>${percent}%</strong>
        </div>
        <div class="subject-progress"><span style="width:${percent}%"></span></div>
      </article>
    `;
  }).join("");

  if (subjects.length === 0) {
    grid.innerHTML = `<p class="subject-empty">Adicione uma matéria para começar a organizar seus estudos.</p>`;
  }

  updateSubjectOptions();
  updateStats();
}

function updateSubjectOptions() {
  const select = $("#task-subject");
  const previousValue = select.value;

  select.innerHTML = subjects.map(subject =>
    `<option value="${escapeHTML(subject.id)}">${escapeHTML(subject.name)}</option>`
  ).join("");

  if (subjects.some(subject => subject.id === previousValue)) {
    select.value = previousValue;
  }
}

function renderAll() {
  renderTasks();
  renderSubjects();
}

function openTaskModal(task = null) {
  if (subjects.length === 0) {
    showToast("Adicione uma matéria antes de criar uma tarefa.");
    $("#subject-modal").showModal();
    return;
  }

  editingTaskId = task?.id ?? null;
  const form = $("#task-form");
  form.reset();

  $("#task-modal-title").textContent = task ? "Editar tarefa" : "Nova tarefa";

  if (task) {
    form.elements.title.value = task.title;
    form.elements.subject.value = task.subject;
    form.elements.priority.value = task.priority || "normal";
    form.elements.due.value = task.due || "";
  } else {
    form.elements.due.value = "";
    form.elements.priority.value = "normal";
  }

  $("#task-modal").showModal();
}

$("#task-form").addEventListener("submit", event => {
  event.preventDefault();

  const form = event.currentTarget;
  const title = form.elements.title.value.trim();
  const subject = form.elements.subject.value;
  const priority = form.elements.priority.value;
  const due = form.elements.due.value;

  if (!title || !subjects.some(item => item.id === subject)) {
    showToast("Preencha o nome da tarefa e selecione uma matéria.");
    return;
  }

  if (due && !formatDate(due)) {
    showToast("Selecione uma data válida.");
    return;
  }

  if (editingTaskId) {
    const task = tasks.find(item => item.id === editingTaskId);

    if (task) {
      Object.assign(task, { title, subject, priority, due });
    }
  } else {
    tasks.unshift({
      id: createId(),
      title,
      subject,
      priority,
      due,
      completed: false
    });
  }

  saveData();
  renderAll();
  $("#task-modal").close();
  showToast(editingTaskId ? "Tarefa atualizada!" : "Tarefa adicionada!");

  editingTaskId = null;
});

$("#new-task-top").addEventListener("click", () => openTaskModal());
$("#new-task-inline").addEventListener("click", () => openTaskModal());

$("#task-tabs").addEventListener("click", event => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;

  currentFilter = button.dataset.filter;

  $("#task-tabs").querySelectorAll(".task-tab").forEach(tab => {
    tab.classList.toggle("active", tab === button);
  });

  renderTasks();
});

$("#task-search").addEventListener("input", renderTasks);

$("#task-list").addEventListener("change", event => {
  const checkbox = event.target.closest("[data-toggle-task]");
  if (!checkbox) return;

  const task = tasks.find(item => item.id === checkbox.dataset.toggleTask);
  if (!task) return;

  task.completed = checkbox.checked;
  saveData();
  renderAll();

  showToast(task.completed ? "Boa! Tarefa concluída." : "Tarefa reaberta.");
});

$("#task-list").addEventListener("click", event => {
  const deleteButton = event.target.closest("[data-delete-task]");
  if (!deleteButton) return;

  tasks = tasks.filter(task => task.id !== deleteButton.dataset.deleteTask);
  saveData();
  renderAll();
  showToast("Tarefa excluída.");
});

$("#clear-completed").addEventListener("click", () => {
  const before = tasks.length;
  tasks = tasks.filter(task => !task.completed);

  if (before === tasks.length) {
    showToast("Não há tarefas concluídas para limpar.");
    return;
  }

  saveData();
  renderAll();
  showToast("Tarefas concluídas removidas.");
});

$("#add-subject").addEventListener("click", () => {
  $("#subject-form").reset();
  $("#subject-modal").showModal();
});

$("#subject-form").addEventListener("submit", event => {
  event.preventDefault();

  const form = event.currentTarget;
  const name = form.elements.name.value.trim();
  const color = form.elements.color.value;

  if (!name) return;

  const duplicate = subjects.some(subject =>
    subject.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR")
  );

  if (duplicate) {
    showToast("Essa matéria já está cadastrada.");
    return;
  }

  subjects.push({ id: createId(), name, color });
  saveData();
  renderAll();
  $("#subject-modal").close();
  showToast("Matéria adicionada!");
});

$("#subjects-grid").addEventListener("click", event => {
  const button = event.target.closest("[data-delete-subject]");
  if (!button) return;

  const subject = getSubject(button.dataset.deleteSubject);
  if (!subject) return;

  const hasTasks = tasks.some(task => task.subject === subject.id);

  if (hasTasks) {
    showToast("Exclua ou reorganize as tarefas dessa matéria primeiro.");
    return;
  }

  subjects = subjects.filter(item => item.id !== subject.id);
  saveData();
  renderAll();
  showToast("Matéria removida.");
});

document.querySelectorAll("[data-close]").forEach(button => {
  button.addEventListener("click", () => {
    const dialog = document.getElementById(button.dataset.close);
    dialog?.close();
  });
});

document.querySelectorAll("dialog").forEach(dialog => {
  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });
});

// Cronômetro Pomodoro
let timerDuration = 25 * 60;
let timerRemaining = timerDuration;
let timerInterval = null;
let timerRunning = false;
let currentTimerMode = 25;

function updateTimerDisplay() {
  const minutes = Math.floor(timerRemaining / 60);
  const seconds = timerRemaining % 60;

  $("#timer-display").textContent =
    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const progress = timerDuration > 0
    ? 1 - timerRemaining / timerDuration
    : 0;

  $("#timer-progress").style.strokeDasharray = CIRCUMFERENCE;
  $("#timer-progress").style.strokeDashoffset =
    CIRCUMFERENCE * progress;

  $("#timer-start").textContent = timerRunning ? "Ⅱ Pausar" : "▶ Iniciar foco";
  $("#timer-label").textContent =
    currentTimerMode === 25 ? "HORA DE FOCAR" : "MOMENTO DE PAUSA";

  $("#timer-session").textContent =
    currentTimerMode === 25 ? "Sessão de foco" : "Sessão de descanso";
}

function stopTimer() {
  if (timerInterval !== null) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  timerRunning = false;
  updateTimerDisplay();
}

function setTimerMode(minutes) {
  stopTimer();

  currentTimerMode = minutes;
  timerDuration = minutes * 60;
  timerRemaining = timerDuration;

  document.querySelectorAll(".timer-tab").forEach(tab => {
    tab.classList.toggle("active", Number(tab.dataset.minutes) === minutes);
  });

  $("#focus-message").textContent =
    minutes === 25 ? "Desative as distrações e comece." : "Respire e recarregue as energias.";

  updateTimerDisplay();
}

function startTimer() {
  if (timerRunning) {
    stopTimer();
    $("#focus-message").textContent = "Sessão pausada. Continue quando quiser.";
    return;
  }

  if (timerRemaining <= 0) {
    timerRemaining = timerDuration;
  }

  timerRunning = true;
  updateTimerDisplay();
  $("#focus-message").textContent = "Você está no controle do seu foco.";

  timerInterval = setInterval(() => {
    timerRemaining = Math.max(0, timerRemaining - 1);
    updateTimerDisplay();

    if (timerRemaining === 0) {
      stopTimer();

      if (currentTimerMode === 25) {
        focusMinutes += 25;
        saveData();
        updateStats();
      }

      $("#focus-message").textContent = "Sessão finalizada. Muito bem!";
      showToast(
        currentTimerMode === 25
          ? "Sessão de foco concluída! 25 minutos registrados."
          : "Pausa concluída. Você pode voltar aos estudos."
      );
    }
  }, 1000);
}

$("#timer-start").addEventListener("click", startTimer);

$("#timer-reset").addEventListener("click", () => {
  stopTimer();
  timerRemaining = timerDuration;
  $("#focus-message").textContent = "Cronômetro reiniciado.";
  updateTimerDisplay();
});

$("#timer-skip").addEventListener("click", () => {
  setTimerMode(currentTimerMode);
  $("#focus-message").textContent = "Sessão reiniciada.";
});

document.querySelectorAll(".timer-tab").forEach(button => {
  button.addEventListener("click", () => {
    setTimerMode(Number(button.dataset.minutes));
  });
});

// Menu responsivo
$("#mobile-menu").addEventListener("click", () => {
  $("#sidebar").classList.toggle("mobile-open");
});

document.querySelectorAll(".nav-link").forEach(link => {
  link.addEventListener("click", () => {
    $("#sidebar").classList.remove("mobile-open");

    document.querySelectorAll(".nav-link").forEach(item => {
      item.classList.toggle("active", item === link);
    });
  });
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    $("#sidebar").classList.remove("mobile-open");
  }
});

// Inicialização
const now = new Date();

$("#today-label").textContent = now.toLocaleDateString("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "short"
});

$("#year").textContent = now.getFullYear();

updateSubjectOptions();
renderAll();
updateTimerDisplay();
