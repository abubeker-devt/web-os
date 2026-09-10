const startBtn = document.getElementById("startBtn");
const startMenu = document.getElementById("startMenu");
const desktopIcons = document.querySelectorAll(".desktop-icon");
const menuApps = document.querySelectorAll(".menu-app");
const taskApps = document.querySelectorAll(".task-app");
const closeBtns = document.querySelectorAll(".close-btn");
const minBtns = document.querySelectorAll(".min-btn");
const clock = document.getElementById("clock");

const appMap = {
  notes: "notesWindow",
  files: "filesWindow",
  browser: "browserWindow"
};

startBtn.addEventListener("click", () => {
  startMenu.classList.toggle("show");
});

document.addEventListener("click", (e) => {
  if (!startMenu.contains(e.target) && !startBtn.contains(e.target)) {
    startMenu.classList.remove("show");
  }
});

function openApp(appName) {
  const windowId = appMap[appName];
  if (!windowId) return;
  document.getElementById(windowId).classList.add("show");
  startMenu.classList.remove("show");
}

desktopIcons.forEach(icon => {
  icon.addEventListener("dblclick", () => {
    openApp(icon.dataset.app);
  });
});

menuApps.forEach(button => {
  button.addEventListener("click", () => {
    openApp(button.dataset.app);
  });
});

taskApps.forEach(button => {
  button.addEventListener("click", () => {
    openApp(button.dataset.app);
  });
});

closeBtns.forEach(button => {
  button.addEventListener("click", () => {
    document.getElementById(button.dataset.target).classList.remove("show");
  });
});

minBtns.forEach(button => {
  button.addEventListener("click", () => {
    document.getElementById(button.dataset.target).classList.remove("show");
  });
});

function updateClock() {
  const now = new Date();
  let hours = now.getHours().toString().padStart(2, "0");
  let minutes = now.getMinutes().toString().padStart(2, "0");
  clock.textContent = `${hours}:${minutes}`;
}

updateClock();
setInterval(updateClock, 1000);
