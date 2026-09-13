
"use strict";

const Storage = {
  prefix: "webos.",
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(this.prefix + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
    } catch {  }
  },
  remove(key) {
    try { localStorage.removeItem(this.prefix + key); } catch {}
  },
  usageBytes() {
    let bytes = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k.startsWith(this.prefix)) bytes += k.length + (localStorage.getItem(k) || "").length;
      }
    } catch {}
    return bytes;
  }
};

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

const VFS = {
  data: null,

  load() {
    this.data = Storage.get("vfs", null);
    if (!this.data) {
      this.data = this.defaultTree();
      this.save();
    }
  },

  save() {
    Storage.set("vfs", this.data);
  },

  now() { return Date.now(); },

  defaultTree() {
    const t = this.now();
    return {
      type: "folder", name: "Home", created: t, modified: t,
      children: {
        Documents: {
          type: "folder", name: "Documents", created: t, modified: t,
          children: {
            "welcome.txt": { type: "file", name: "welcome.txt", created: t, modified: t,
              content: "Welcome to Web OS 3.0!\n\nThis file lives in the virtual file system and is saved in your browser's localStorage. V3 adds the App Store: install Weather, Tic-Tac-Toe, Music and Paint from the store window." },
            "todo.txt": { type: "file", name: "todo.txt", created: t, modified: t,
              content: "TODO\n- Try the new resizable windows\n- Delete something and restore it from the Recycle Bin\n- Change the accent color in Settings\n- Press Ctrl+K to search\n" }
          }
        },
        Projects: { type: "folder", name: "Projects", created: t, modified: t, children: {
          "ideas.txt": { type: "file", name: "ideas.txt", created: t, modified: t,
            content: "Project ideas:\n- Portfolio website\n- Game clone\n- This Web OS!\n" }
        } },
        Images: { type: "folder", name: "Images", created: t, modified: t, children: {} },
        Downloads: { type: "folder", name: "Downloads", created: t, modified: t, children: {} }
      }
    };
  },

  resolve(path) {
    let node = this.data;
    for (const part of path) {
      if (!node || node.type !== "folder" || !node.children[part]) return null;
      node = node.children[part];
    }
    return node;
  },

  list(path) {
    const node = this.resolve(path);
    if (!node || node.type !== "folder") return [];
    return Object.values(node.children);
  },

  createFile(path, name, content = "") {
    const folder = this.resolve(path);
    if (!folder || folder.type !== "folder" || !name || name.includes("/")) return false;
    if (folder.children[name]) return false;
    const t = this.now();
    folder.children[name] = { type: "file", name, content, created: t, modified: t };
    folder.modified = t;
    this.save();
    return true;
  },

  createFolder(path, name) {
    const folder = this.resolve(path);
    if (!folder || folder.type !== "folder" || !name || name.includes("/")) return false;
    if (folder.children[name]) return false;
    const t = this.now();
    folder.children[name] = { type: "folder", name, created: t, modified: t, children: {} };
    folder.modified = t;
    this.save();
    return true;
  },

  rename(path, oldName, newName) {
    const folder = this.resolve(path);
    if (!folder || !folder.children[oldName] || !newName || newName.includes("/")) return false;
    if (oldName !== newName && folder.children[newName]) return false;
    const entry = folder.children[oldName];
    delete folder.children[oldName];
    entry.name = newName;
    entry.modified = this.now();
    folder.children[newName] = entry;
    this.save();
    return true;
  },

  remove(path, name) {
    const folder = this.resolve(path);
    if (!folder || !folder.children[name]) return false;
    delete folder.children[name];
    this.save();
    return true;
  },

  readFile(path, name) {
    const folder = this.resolve(path);
    const entry = folder && folder.children[name];
    return entry && entry.type === "file" ? entry.content : null;
  },

  writeFile(path, name, content) {
    const folder = this.resolve(path);
    const entry = folder && folder.children[name];
    if (!entry || entry.type !== "file") return false;
    entry.content = content;
    entry.modified = this.now();
    this.save();
    return true;
  },

  countFiles(node = this.data) {
    if (node.type === "file") return 1;
    return Object.values(node.children || {}).reduce((s, c) => s + this.countFiles(c), 0);
  }
};

const Trash = {
  KEY: "trash",
  MAX: 100,
  now() { return Date.now(); },

  load() { return Storage.get(this.KEY, []); },
  save(items) { Storage.set(this.KEY, items.slice(0, this.MAX)); },

  put(path, name) {
    const folder = VFS.resolve(path);
    const entry = folder && folder.children[name];
    if (!entry) return false;
    delete folder.children[name];
    VFS.save();
    const items = this.load();
    items.unshift({ name, from: path, node: entry, deletedAt: this.now() });
    this.save(items);
    return true;
  },

  restore(index) {
    const items = this.load();
    const item = items[index];
    if (!item) return false;
    const folder = VFS.resolve(item.from);
    if (!folder || folder.type !== "folder") return false;
    if (folder.children[item.name]) return false;
    folder.children[item.name] = item.node;
    VFS.save();
    items.splice(index, 1);
    this.save(items);
    return true;
  },

  purge(index) {
    const items = this.load();
    if (!items[index]) return false;
    items.splice(index, 1);
    this.save(items);
    return true;
  },

  empty() { this.save([]); },

  count() { return this.load().length; }
};

function timeAgo(ts) {
  if (!ts) return "";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + " min ago";
  if (s < 86400) return Math.floor(s / 3600) + " h ago";
  return new Date(ts).toLocaleDateString();
}

const NotifCenter = {
  KEY: "notifs",
  unread: 0,

  load() { return Storage.get(this.KEY, []); },
  save(list) { Storage.set(this.KEY, list.slice(0, 30)); },

  push(title, message, icon = "🔔") {
    const list = this.load();
    list.unshift({ title, message, icon, at: Date.now() });
    this.save(list);
    this.unread++;
    this.renderBadge();
    Notify.toast(title, message, icon);
  },

  renderBadge() {
    const badge = document.getElementById("notifBadge");
    if (!badge) return;
    if (this.unread > 0) {
      badge.hidden = false;
      badge.textContent = this.unread > 9 ? "9+" : String(this.unread);
    } else {
      badge.hidden = true;
    }
  },

  renderPanel() {
    const listEl = document.getElementById("notifList");
    const items = this.load();
    this.unread = 0;
    this.renderBadge();
    if (!items.length) {
      listEl.innerHTML = '<div class="notif-empty">No notifications yet</div>';
      return;
    }
    listEl.innerHTML = items.map(n =>
      '<div class="notif-entry"><span class="n-icon">' + esc(n.icon) + "</span>" +
      '<div class="n-body"><div class="n-title">' + esc(n.title) + "</div>" +
      '<div class="n-msg">' + esc(n.message) + "</div></div>" +
      '<span class="n-time">' + timeAgo(n.at) + "</span></div>"
    ).join("");
  },

  clearAll() {
    this.save([]);
    this.renderPanel();
  }
};

const Notify = {
  toast(title, message, icon = "🔔", ms = 3500) {
    const box = document.getElementById("notifications");
    const t = document.createElement("div");
    t.className = "toast";
    t.innerHTML =
      '<div class="toast-title"><span>' + esc(icon) + "</span>" + esc(title) + "</div>" +
      '<div class="toast-msg">' + esc(message) + "</div>";
    box.appendChild(t);
    setTimeout(() => {
      t.classList.add("leaving");
      setTimeout(() => t.remove(), 320);
    }, ms);
  },
  show(title, message, icon, ms) { this.toast(title, message, icon, ms); }
};

const Apps = {};

function registerApp(def) {
  Apps[def.name] = def;
}

const WM = {
  layer: null,
  zTop: 100,
  windows: {},
  MINW: 280,
  MINH: 180,

  init() {
    this.layer = document.getElementById("windowsLayer");
  },

  open(appName) {
    const def = Apps[appName];
    if (!def) return null;
    const id = "win-" + appName;

    if (this.windows[id]) {
      const w = this.windows[id];
      if (w.minimized) this.restore(id);
      else this.focus(id);
      return w;
    }

    const el = document.createElement("div");
    el.className = "window";
    el.id = id;

    const desktop = document.getElementById("desktop");
    const dw = desktop.clientWidth, dh = desktop.clientHeight;
    const count = Object.keys(this.windows).length;
    const defW = Math.min(def.width || 520, Math.max(dw - 40, this.MINW));
    const defH = Math.min(def.height || 360, Math.max(dh - 120, this.MINH));

    el.innerHTML =
      '<div class="window-top">' +
        '<div class="window-title">' + def.icon + " " + esc(def.title) + "</div>" +
        '<div class="window-actions">' +
          '<button class="min-btn" title="Minimize">—</button>' +
          '<button class="max-btn" title="Maximize">□</button>' +
          '<button class="close-btn" title="Close (Alt+F4)">✕</button>' +
        "</div>" +
      "</div>" +
      '<div class="window-body"></div>';

    this.layer.appendChild(el);

    const w = {
      id, app: appName, el,
      minimized: false,
      preMax: null,
      taskBtn: Taskbar.addTaskButton(appName, def, id)
    };
    this.windows[id] = w;

    const saved = Storage.get("winstate", {})[appName];
    if (saved) {
      el.style.left = saved.l; el.style.top = saved.t;
      el.style.width = saved.w; el.style.height = saved.h;
    } else {
      el.style.width = defW + "px";
      el.style.height = defH + "px";
      el.style.left = Math.max(16, (dw - defW) / 2 + count * 28 - 40) + "px";
      el.style.top = Math.max(16, (dh - 84 - defH) / 2 + count * 22 - 30) + "px";
    }

    el.querySelector(".min-btn").addEventListener("click", e => {
      e.stopPropagation();
      this.minimize(id);
    });
    el.querySelector(".max-btn").addEventListener("click", e => {
      e.stopPropagation();
      this.toggleMaximize(id);
    });
    el.querySelector(".close-btn").addEventListener("click", e => {
      e.stopPropagation();
      this.close(id);
    });

    const top = el.querySelector(".window-top");
    top.addEventListener("dblclick", () => this.toggleMaximize(id));

    el.addEventListener("pointerdown", () => this.focus(id));

    this.enableDrag(w, top);
    this.enableResize(w);

    const body = el.querySelector(".window-body");
    body.classList.add(def.name + "-app");
    if (def.mount) def.mount(body, w);

    el.classList.add("show");
    this.focus(id);
    return w;
  },

  focus(id) {
    const w = this.windows[id];
    if (!w) return;
    w.el.style.zIndex = ++this.zTop;
    if (typeof Widgets !== "undefined") Widgets.tick();
    Object.values(this.windows).forEach(x => {
      x.el.classList.toggle("active", x.id === id);
      if (x.taskBtn) {
        x.taskBtn.classList.toggle("focused", x.id === id && !x.minimized);
        x.taskBtn.classList.toggle("open", !x.minimized);
      }
    });
  },

  focusedId() {
    let best = null, bestZ = -1;
    Object.values(this.windows).forEach(w => {
      if (!w.minimized) {
        const z = parseFloat(w.el.style.zIndex) || 0;
        if (z > bestZ) { bestZ = z; best = w.id; }
      }
    });
    return best;
  },

  cycle() {
    const open = Object.values(this.windows).filter(w => !w.minimized);
    if (open.length < 2) return;
    open.sort((a, b) => (parseFloat(a.el.style.zIndex) || 0) - (parseFloat(b.el.style.zIndex) || 0));
    this.focus(open[0].id);
  },

  closeFocused() {
    const id = this.focusedId();
    if (id) this.close(id);
  },

  minimize(id) {
    const w = this.windows[id];
    if (!w) return;
    w.minimized = true;
    w.el.classList.add("minimized");
    w.el.classList.remove("active");
    if (w.taskBtn) w.taskBtn.classList.remove("focused", "open");
    const next = Object.values(this.windows).find(x => !x.minimized);
    if (next) this.focus(next.id);
  },

  restore(id) {
    const w = this.windows[id];
    if (!w) return;
    w.minimized = false;
    w.el.classList.remove("minimized");
    w.el.classList.add("show");
    this.focus(id);
  },

  close(id) {
    const w = this.windows[id];
    if (!w) return;
    if (w.taskBtn) Taskbar.releaseButton(w.app);
    w.el.remove();
    delete this.windows[id];
  },

  toggleMaximize(id) {
    const w = this.windows[id];
    if (!w) return;
    const el = w.el;
    if (el.classList.contains("maximized")) {
      el.classList.remove("maximized");
      const p = w.preMax;
      el.style.left = p.left; el.style.top = p.top;
      el.style.width = p.width; el.style.height = p.height;
    } else {
      w.preMax = {
        left: el.style.left, top: el.style.top,
        width: el.style.width, height: el.style.height
      };
      el.classList.add("maximized");
      el.style.left = "0px";
      el.style.top = "0px";
      el.style.width = "100%";
      el.style.height = "calc(100% - 76px)";
    }
  },

  computeResize(dir, rect, dx, dy) {
    let { l, t, w, h } = rect;
    if (dir.includes("e")) w = Math.max(this.MINW, rect.w + dx);
    if (dir.includes("s")) h = Math.max(this.MINH, rect.h + dy);
    if (dir.includes("w")) { w = Math.max(this.MINW, rect.w - dx); l = rect.l + (rect.w - w); }
    if (dir.includes("n")) { h = Math.max(this.MINH, rect.h - dy); t = rect.t + (rect.h - h); }
    return { l, t, w, h };
  },

  enableDrag(w, handle) {
    let startX, startY, origL, origT, dragging = false, pid = null;

    handle.addEventListener("pointerdown", e => {
      if (e.target.closest(".window-actions")) return;
      if (w.el.classList.contains("maximized")) return;
      dragging = true;
      pid = e.pointerId;
      try { handle.setPointerCapture(pid); } catch {}
      startX = e.clientX; startY = e.clientY;
      origL = parseFloat(w.el.style.left) || 0;
      origT = parseFloat(w.el.style.top) || 0;
      handle.style.cursor = "grabbing";
    });

    handle.addEventListener("pointermove", e => {
      if (!dragging || e.pointerId !== pid) return;
      const desktop = document.getElementById("desktop");
      let nl = origL + (e.clientX - startX);
      let nt = origT + (e.clientY - startY);
      nl = Math.min(Math.max(nl, -w.el.offsetWidth + 80), desktop.clientWidth - 80);
      nt = Math.min(Math.max(nt, 0), desktop.clientHeight - 100);
      w.el.style.left = nl + "px";
      w.el.style.top = nt + "px";
    });

    const end = e => {
      if (!dragging || (pid !== null && e.pointerId !== pid)) return;
      dragging = false;
      handle.style.cursor = "";
      this.saveState();
    };
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  },

  enableResize(w) {
    ["n", "s", "e", "w", "ne", "nw", "se", "sw"].forEach(dir => {
      const h = document.createElement("div");
      h.className = "rz " + dir;
      w.el.appendChild(h);

      h.addEventListener("pointerdown", e => {
        if (w.el.classList.contains("maximized")) return;
        e.preventDefault();
        e.stopPropagation();
        const pid = e.pointerId;
        try { h.setPointerCapture(pid); } catch {}
        const startX = e.clientX, startY = e.clientY;
        const rect = {
          l: w.el.offsetLeft, t: w.el.offsetTop,
          w: w.el.offsetWidth, h: w.el.offsetHeight
        };

        const onMove = ev => {
          if (ev.pointerId !== pid) return;
          const r = this.computeResize(dir, rect, ev.clientX - startX, ev.clientY - startY);
          w.el.style.left = r.l + "px";
          w.el.style.top = r.t + "px";
          w.el.style.width = r.w + "px";
          w.el.style.height = r.h + "px";
        };
        const onUp = ev => {
          if (ev.pointerId !== pid) return;
          h.removeEventListener("pointermove", onMove);
          h.removeEventListener("pointerup", onUp);
          h.removeEventListener("pointercancel", onUp);
          this.saveState();
        };
        h.addEventListener("pointermove", onMove);
        h.addEventListener("pointerup", onUp);
        h.addEventListener("pointercancel", onUp);
      });
    });
  },

  saveState() {
    const st = {};
    Object.values(this.windows).forEach(w => {
      if (!w.el.classList.contains("maximized")) {
        st[w.app] = {
          l: w.el.style.left, t: w.el.style.top,
          w: w.el.style.width, h: w.el.style.height
        };
      }
    });
    Storage.set("winstate", st);
  }
};

const Taskbar = {
  container: null,
  buttons: {},

  init() {
    this.container = document.getElementById("taskApps");
  },

  addTaskButton(appName, def, winId) {
    if (!this.buttons[appName]) {
      const btn = document.createElement("button");
      btn.className = "task-app";
      btn.textContent = def.icon;
      btn.title = def.title;
      btn.addEventListener("click", () => {
        const w = WM.windows[winId];
        if (!w) return;
        if (w.minimized) WM.restore(winId);
        else if (w.el.classList.contains("active")) WM.minimize(winId);
        else WM.focus(winId);
      });
      this.container.appendChild(btn);
      this.buttons[appName] = btn;
    }
    const btn = this.buttons[appName];
    btn.classList.add("open");
    return btn;
  },

  releaseButton(appName) {
    const btn = this.buttons[appName];
    if (btn) btn.classList.remove("open", "focused");
  }
};

registerApp({
  name: "notes",
  core: true,
  title: "Notes",
  icon: "📝",
  width: 560, height: 440,

  mount(body, w) {
    body.innerHTML =
      '<div class="notes-toolbar">' +
        '<input class="os-input notes-title" placeholder="Note title…" />' +
        '<button class="os-btn save-note">Save</button>' +
      "</div>" +
      '<div class="notes-toolbar">' +
        '<button class="os-btn ghost toggle-list">📋 My notes</button>' +
        '<input class="os-input notes-search" placeholder="Search notes…" style="flex:1;min-width:100px" />' +
        '<button class="os-btn ghost new-note">New</button>' +
        '<button class="os-btn ghost delete-note">Delete</button>' +
      "</div>" +
      '<div class="notes-list"></div>' +
      '<textarea class="notes-area" placeholder="Write your note here…"></textarea>' +
      '<div class="notes-toolbar">' +
        '<span class="notes-counts">0 words · 0 characters</span>' +
        '<span class="notes-status">Unsaved changes</span>' +
      "</div>";

    const titleEl = body.querySelector(".notes-title");
    const areaEl = body.querySelector(".notes-area");
    const statusEl = body.querySelector(".notes-status");
    const countsEl = body.querySelector(".notes-counts");
    const listEl = body.querySelector(".notes-list");
    const searchEl = body.querySelector(".notes-search");
    const SAVE_KEY = "notes.list";

    const getList = () => Storage.get(SAVE_KEY, {});
    const setList = l => Storage.set(SAVE_KEY, l);

    function updateCounts() {
      const text = areaEl.value;
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      countsEl.textContent = words + " words · " + text.length + " characters";
    }

    function renderList() {
      const q = searchEl.value.trim().toLowerCase();
      const list = getList();
      const names = Object.keys(list)
        .filter(n => !q || n.toLowerCase().includes(q) || (list[n].content || "").toLowerCase().includes(q))
        .sort((a, b) => (list[b].pinned ? 1 : 0) - (list[a].pinned ? 1 : 0) ||
                        (list[b].updated || 0) - (list[a].updated || 0));
      if (!names.length) {
        listEl.innerHTML = '<div class="note-row" style="cursor:default;color:var(--muted)">No notes found</div>';
        return;
      }
      listEl.innerHTML = names.map(n => {
        const meta = (list[n].pinned ? "📌 " : "") + timeAgo(list[n].updated);
        return '<div class="note-row' + (list[n].pinned ? " pinned" : "") + '" data-name="' + esc(n) + '">' +
          "<span>📄 " + esc(n) + '</span><span class="note-meta">' + esc(meta) + "</span>" +
          '<button class="note-pin" title="Pin/Unpin">' + (list[n].pinned ? "Unpin" : "Pin") + "</button></div>";
      }).join("");
    }

    function markSaved() { statusEl.textContent = "Saved ✓"; }
    function markDirty() { statusEl.textContent = "Unsaved changes"; }

    function saveNote() {
      const name = titleEl.value.trim();
      if (!name) { NotifCenter.push("Notes", "Give the note a title before saving.", "📝"); return; }
      const list = getList();
      const prev = list[name];
      list[name] = {
        content: areaEl.value,
        created: prev ? prev.created : Date.now(),
        updated: Date.now(),
        pinned: prev ? !!prev.pinned : false
      };
      setList(list);
      markSaved();
      updateCounts();
      renderList();
      NotifCenter.push("Notes", 'Note "' + name + '" saved.', "📝");
    }

    function loadNote(name) {
      const list = getList();
      if (list[name]) {
        titleEl.value = name;
        areaEl.value = list[name].content;
        markSaved();
        updateCounts();
        renderList();
      }
    }

    if (w && w.openArgs && w.openArgs.note) loadNote(w.openArgs.note);

    body.querySelector(".save-note").addEventListener("click", saveNote);
    body.querySelector(".new-note").addEventListener("click", () => {
      titleEl.value = ""; areaEl.value = ""; markDirty(); updateCounts(); titleEl.focus();
    });
    body.querySelector(".delete-note").addEventListener("click", () => {
      const name = titleEl.value.trim();
      if (!name) return;
      const list = getList();
      if (!list[name]) { NotifCenter.push("Notes", "This note is not saved yet.", "📝"); return; }
      delete list[name];
      setList(list);
      renderList();
      titleEl.value = ""; areaEl.value = ""; updateCounts();
      NotifCenter.push("Notes", 'Note "' + name + '" deleted.', "🗑️");
    });
    body.querySelector(".toggle-list").addEventListener("click", () => {
      listEl.classList.toggle("show");
      if (listEl.classList.contains("show")) renderList();
    });
    searchEl.addEventListener("input", () => {
      if (listEl.classList.contains("show")) renderList();
    });

    listEl.addEventListener("click", e => {
      const row = e.target.closest(".note-row");
      if (!row || !row.dataset.name) return;
      if (e.target.classList.contains("note-pin")) {
        const list = getList();
        const n = row.dataset.name;
        if (list[n]) { list[n].pinned = !list[n].pinned; setList(list); renderList(); }
        return;
      }
      loadNote(row.dataset.name);
    });

    [titleEl, areaEl].forEach(el => el.addEventListener("input", () => { markDirty(); updateCounts(); }));

    body.addEventListener("keydown", e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveNote();
      }
    });

    updateCounts();
  }
});

function fileIcon(name, isFolder) {
  if (isFolder) return "📁";
  const ext = (name.split(".").pop() || "").toLowerCase();
  const map = {
    txt: "📄", md: "📝", js: "📜", html: "🌐", css: "🎨", json: "🧾",
    png: "🖼️", jpg: "🖼️", jpeg: "🖼️", gif: "🖼️", svg: "🖼️",
    mp3: "🎵", wav: "🎵", mp4: "🎬", pdf: "📕", zip: "🗜️", csv: "📊"
  };
  return map[ext] || "📄";
}

registerApp({
  name: "files",
  core: true,
  title: "File Manager",
  icon: "📁",
  width: 640, height: 460,

  mount(body) {
    body.innerHTML =
      '<div class="files-toolbar">' +
        '<button class="os-btn ghost up-btn" title="Up one folder">⬆</button>' +
        '<div class="breadcrumb"></div>' +
      "</div>" +
      '<div class="files-toolbar">' +
        '<input class="os-input files-search" placeholder="Search this folder…" style="flex:1;min-width:120px" />' +
        '<select class="os-select sort-select">' +
          '<option value="name">Sort: Name</option>' +
          '<option value="type">Sort: Type</option>' +
          '<option value="date">Sort: Date</option>' +
        "</select>" +
      "</div>" +
      '<div class="files-toolbar">' +
        '<button class="os-btn tiny new-file">📄 New file</button>' +
        '<button class="os-btn tiny new-folder">📂 New folder</button>' +
        '<button class="os-btn tiny ghost rename-btn">✏️ Rename</button>' +
        '<button class="os-btn tiny ghost copy-btn">📋 Copy</button>' +
        '<button class="os-btn tiny ghost cut-btn">✂️ Cut</button>' +
        '<button class="os-btn tiny ghost paste-btn">📌 Paste</button>' +
        '<button class="os-btn tiny ghost delete-btn">🗑️ Delete</button>' +
      "</div>" +
      '<div class="files-grid"></div>';

    const grid = body.querySelector(".files-grid");
    const crumbsEl = body.querySelector(".breadcrumb");
    const searchEl = body.querySelector(".files-search");
    const sortSel = body.querySelector(".sort-select");
    let cwd = [];
    let selected = null;
    let clipboard = null;

    function sorted(items) {
      const mode = sortSel.value;
      return [...items].sort((a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
        if (mode === "date") return (b.modified || 0) - (a.modified || 0);
        if (mode === "type") {
          const ea = (a.name.split(".").pop() || ""), eb = (b.name.split(".").pop() || "");
          return ea === eb ? a.name.localeCompare(b.name) : ea.localeCompare(eb);
        }
        return a.name.localeCompare(b.name);
      });
    }

    function renderCrumbs() {
      crumbsEl.innerHTML =
        '<button class="crumb' + (cwd.length ? "" : " current") + '" data-i="-1">🏠 Home</button>';
      cwd.forEach((part, i) => {
        crumbsEl.innerHTML += '<span class="crumb-sep">›</span>' +
          '<button class="crumb' + (i === cwd.length - 1 ? " current" : "") + '" data-i="' + i + '">' + esc(part) + "</button>";
      });
    }

    function render() {
      renderCrumbs();
      grid.innerHTML = "";
      let items = VFS.list(cwd);
      const q = searchEl.value.trim().toLowerCase();
      if (q) items = items.filter(it => it.name.toLowerCase().includes(q));
      if (!items.length) {
        grid.innerHTML = '<div class="files-empty">' + (q ? "No matches in this folder." : "This folder is empty. Create a file or folder above.") + "</div>";
        selected = null;
        return;
      }
      sorted(items).forEach(item => {
        const el = document.createElement("div");
        el.className = "file-item";
        el.title = item.type === "folder" ? "Folder — double-click to open" : "File — double-click to open in Notes";
        el.innerHTML =
          '<div class="file-icon">' + fileIcon(item.name, item.type === "folder") + "</div>" +
          '<div class="file-name">' + esc(item.name) + "</div>" +
          '<div class="file-date">' + (item.modified ? timeAgo(item.modified) : "") + "</div>";
        if (clipboard && clipboard.mode === "cut" && clipboard.name === item.name &&
            JSON.stringify(clipboard.from) === JSON.stringify(cwd)) {
          el.classList.add("cut");
        }
        el.addEventListener("click", () => select(item.name, el));
        el.addEventListener("dblclick", () => openEntry(item));
        grid.appendChild(el);
      });
      selected = null;
    }

    function select(name, el) {
      selected = name;
      grid.querySelectorAll(".file-item").forEach(x => x.classList.remove("selected"));
      el.classList.add("selected");
    }

    function selectedItemEl() {
      return [...grid.querySelectorAll(".file-item")]
        .find(x => x.querySelector(".file-name").textContent === selected);
    }

    function promptName(defaultValue, action) {
      const input = document.createElement("input");
      input.className = "rename-input";
      input.value = defaultValue || "";
      const target = selected ? selectedItemEl() : null;
      if (target) target.querySelector(".file-name").replaceWith(input);
      else grid.prepend(input);
      input.focus();
      input.select();
      const restore = () => {
        if (!input.isConnected) return;
        input.replaceWith(Object.assign(document.createElement("div"),
          { className: "file-name", textContent: selected || defaultValue }));
      };
      const commit = () => {
        const val = input.value.trim();
        restore();
        if (val && val !== defaultValue) action(val);
      };
      input.addEventListener("keydown", e => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") restore();
      });
      input.addEventListener("blur", commit);
    }

    function openEntry(item) {
      if (item.type === "folder") {
        cwd = [...cwd, item.name];
        searchEl.value = "";
        render();
      } else {
        const content = VFS.readFile(cwd, item.name);
        const win = WM.open("notes");
        if (win) {
          win.el.querySelector(".notes-title").value = item.name;
          win.el.querySelector(".notes-area").value = content || "";
        }
      }
    }

    body.querySelector(".up-btn").addEventListener("click", () => {
      if (cwd.length) { cwd = cwd.slice(0, -1); searchEl.value = ""; render(); }
    });
    crumbsEl.addEventListener("click", e => {
      const c = e.target.closest(".crumb");
      if (!c) return;
      const i = Number(c.dataset.i);
      cwd = i < 0 ? [] : cwd.slice(0, i + 1);
      searchEl.value = "";
      render();
    });
    searchEl.addEventListener("input", render);
    sortSel.addEventListener("change", render);

    body.querySelector(".new-file").addEventListener("click", () => {
      promptName("untitled.txt", val => {
        if (VFS.createFile(cwd, val, "")) { render(); NotifCenter.push("File Manager", 'Created file "' + val + '".', "📄"); }
        else NotifCenter.push("File Manager", 'An item named "' + val + '" already exists here.', "📁");
      });
    });
    body.querySelector(".new-folder").addEventListener("click", () => {
      promptName("New folder", val => {
        if (VFS.createFolder(cwd, val)) { render(); NotifCenter.push("File Manager", 'Created folder "' + val + '".', "📂"); }
        else NotifCenter.push("File Manager", 'An item named "' + val + '" already exists here.', "📁");
      });
    });
    body.querySelector(".rename-btn").addEventListener("click", () => {
      if (!selected) { NotifCenter.push("File Manager", "Select an item to rename first.", "📁"); return; }
      const old = selected;
      promptName(old, val => {
        if (VFS.rename(cwd, old, val)) render();
        else NotifCenter.push("File Manager", 'Could not rename to "' + val + '".', "📁");
      });
    });
    body.querySelector(".copy-btn").addEventListener("click", () => {
      if (!selected) { NotifCenter.push("File Manager", "Select an item to copy first.", "📋"); return; }
      clipboard = { mode: "copy", from: [...cwd], name: selected };
      NotifCenter.push("File Manager", '"' + selected + '" copied to clipboard.', "📋");
    });
    body.querySelector(".cut-btn").addEventListener("click", () => {
      if (!selected) { NotifCenter.push("File Manager", "Select an item to cut first.", "✂️"); return; }
      clipboard = { mode: "cut", from: [...cwd], name: selected };
      render();
      NotifCenter.push("File Manager", '"' + selected + '" cut. Paste to move it.', "✂️");
    });
    body.querySelector(".paste-btn").addEventListener("click", () => {
      if (!clipboard) { NotifCenter.push("File Manager", "Clipboard is empty.", "📌"); return; }
      const src = VFS.resolve(clipboard.from);
      const node = src && src.children[clipboard.name];
      if (!node) { clipboard = null; NotifCenter.push("File Manager", "Clipboard item no longer exists.", "📌"); render(); return; }
      if (VFS.resolve(cwd).children[clipboard.name]) {
        NotifCenter.push("File Manager", '"' + clipboard.name + '" already exists in this folder.', "📌");
        return;
      }
      const copy = JSON.parse(JSON.stringify(node));
      copy.name = clipboard.name;
      copy.modified = VFS.now();
      VFS.resolve(cwd).children[copy.name] = copy;
      if (clipboard.mode === "cut") {
        delete src.children[clipboard.name];
        clipboard = null;
      }
      VFS.save();
      render();
      NotifCenter.push("File Manager", '"' + copy.name + '" pasted.', "📌");
    });
    body.querySelector(".delete-btn").addEventListener("click", () => {
      if (!selected) { NotifCenter.push("File Manager", "Select an item to delete first.", "🗑️"); return; }
      const name = selected;
      if (Trash.put(cwd, name)) {
        NotifCenter.push("Recycle Bin", '"' + name + '" moved to the Recycle Bin.', "🗑️");
        render();
        Desktop.refreshTrash();
      }
    });

    render();
  }
});

registerApp({
  name: "trash",
  core: true,
  title: "Recycle Bin",
  icon: "🗑️",
  width: 520, height: 400,

  mount(body) {
    body.innerHTML =
      '<div class="files-toolbar">' +
        '<button class="os-btn tiny ghost restore-btn">♻️ Restore selected</button>' +
        '<button class="os-btn tiny ghost purge-btn">❌ Delete permanently</button>' +
        '<button class="os-btn tiny danger empty-btn">🔥 Empty Recycle Bin</button>' +
      "</div>" +
      '<div class="files-grid"></div>';

    const grid = body.querySelector(".files-grid");
    let selectedIdx = null;

    function render() {
      grid.innerHTML = "";
      const items = Trash.load();
      if (!items.length) {
        grid.innerHTML = '<div class="files-empty">The Recycle Bin is empty.</div>';
        selectedIdx = null;
        return;
      }
      items.forEach((item, i) => {
        const el = document.createElement("div");
        el.className = "file-item" + (i === selectedIdx ? " selected" : "");
        el.innerHTML =
          '<div class="file-icon">' + fileIcon(item.name, item.node.type === "folder") + "</div>" +
          '<div class="file-name">' + esc(item.name) + "</div>" +
          '<div class="file-date">from ' + esc(["Home", ...item.from].join("/")) + " · " + timeAgo(item.deletedAt) + "</div>";
        el.addEventListener("click", () => {
          selectedIdx = i;
          grid.querySelectorAll(".file-item").forEach(x => x.classList.remove("selected"));
          el.classList.add("selected");
        });
        el.addEventListener("dblclick", () => doRestore(i));
        grid.appendChild(el);
      });
    }

    function doRestore(i) {
      if (Trash.restore(i)) {
        NotifCenter.push("Recycle Bin", 'Item restored.', "♻️");
        render();
        Desktop.refreshTrash();
      } else {
        NotifCenter.push("Recycle Bin", "Cannot restore: original folder missing or name taken.", "♻️");
      }
    }

    body.querySelector(".restore-btn").addEventListener("click", () => {
      if (selectedIdx === null) { NotifCenter.push("Recycle Bin", "Select an item first.", "🗑️"); return; }
      doRestore(selectedIdx);
    });
    body.querySelector(".purge-btn").addEventListener("click", () => {
      if (selectedIdx === null) { NotifCenter.push("Recycle Bin", "Select an item first.", "🗑️"); return; }
      Trash.purge(selectedIdx);
      NotifCenter.push("Recycle Bin", "Item deleted permanently.", "🔥");
      render();
      Desktop.refreshTrash();
    });
    body.querySelector(".empty-btn").addEventListener("click", () => {
      Trash.empty();
      NotifCenter.push("Recycle Bin", "Recycle Bin emptied.", "🔥");
      render();
      Desktop.refreshTrash();
    });

    render();
  }
});

registerApp({
  name: "calculator",
  core: true,
  title: "Calculator",
  icon: "🧮",
  width: 320, height: 480,

  mount(body) {
    body.innerHTML =
      '<div class="files-toolbar">' +
        '<button class="os-btn tiny ghost sci-toggle">fx Scientific</button>' +
        '<button class="os-btn tiny ghost copy-result">📋 Copy</button>' +
        '<button class="os-btn tiny ghost hist-toggle">🕘 History</button>' +
      "</div>" +
      '<div class="calc-display">' +
        '<div class="calc-history">&nbsp;</div>' +
        '<div class="calc-value">0</div>' +
        '<div class="calc-mem"></div>' +
      "</div>" +
      '<div class="calc-hist-panel" style="display:none"></div>' +
      '<div class="calc-keys">' +
        '<button class="fn" data-k="MC">MC</button><button class="fn" data-k="MR">MR</button>' +
        '<button class="fn" data-k="M+">M+</button><button class="fn" data-k="M−">M−</button>' +
        '<button data-k="C">C</button><button data-k="←">←</button>' +
        '<button data-k="%">%</button><button class="op" data-k="/">÷</button>' +
        '<button data-k="7">7</button><button data-k="8">8</button>' +
        '<button data-k="9">9</button><button class="op" data-k="*">×</button>' +
        '<button data-k="4">4</button><button data-k="5">5</button>' +
        '<button data-k="6">6</button><button class="op" data-k="-">−</button>' +
        '<button data-k="1">1</button><button data-k="2">2</button>' +
        '<button data-k="3">3</button><button class="op" data-k="+">+</button>' +
        '<button class="wide" data-k="0">0</button><button data-k=".">.</button>' +
        '<button class="eq" data-k="=">=</button>' +
      "</div>";

    const keysEl = body.querySelector(".calc-keys");
    const valueEl = body.querySelector(".calc-value");
    const histEl = body.querySelector(".calc-history");
    const memEl = body.querySelector(".calc-mem");
    const histPanel = body.querySelector(".calc-hist-panel");

    let current = "0";
    let prev = null, op = null, fresh = true, memory = 0;
    const history = [];

    const SCI_BUTTONS = [
      ["sin", "s("], ["cos", "c("], ["tan", "t("], ["π", String(Math.PI)],
      ["√", "r"], ["x²", "q"], ["log", "l("], ["ln", "n("]
    ];

    const fmt = n => !isFinite(n) ? "Error" : String(Math.round(n * 1e10) / 1e10);
    const show = () => {
      valueEl.textContent = current;
      memEl.textContent = memory !== 0 ? "M = " + fmt(memory) : "";
    };

    function evaluateExpr(expr) {

      if (!/^[0-9+\-*/%.() ]*$/.test(expr)) return NaN;
      try { return Function('"use strict";return (' + expr + ")")(); }
      catch { return NaN; }
    }

    function pushHistory(expr, result) {
      history.unshift({ expr, result });
      if (history.length > 20) history.pop();
      renderHistory();
    }

    function renderHistory() {
      if (!history.length) {
        histPanel.innerHTML = '<div class="calc-hist-row" style="cursor:default;color:var(--muted)">No calculations yet</div>';
        return;
      }
      histPanel.innerHTML = history.map((h, i) =>
        '<div class="calc-hist-row" data-i="' + i + '"><span>' + esc(h.expr) + "</span><strong>" + esc(h.result) + "</strong></div>"
      ).join("");
    }

    function toggleSci(on) {
      const existing = keysEl.querySelectorAll("[data-sci]");
      if (on && !existing.length) {
        SCI_BUTTONS.forEach(([label, val]) => {
          const b = document.createElement("button");
          b.className = "fn";
          b.dataset.k = val;
          b.dataset.sci = "1";
          b.textContent = label;
          keysEl.prepend(b);
        });
      } else if (!on) {
        existing.forEach(b => b.remove());
      }
      keysEl.classList.toggle("sci", on);
    }

    function applyOp(a, b, o) {
      switch (o) {
        case "+": return a + b;
        case "-": return a - b;
        case "*": return a * b;
        case "/": return b === 0 ? Infinity : a / b;
        case "%": return a % b;
      }
      return b;
    }

    function press(k) {
      if (/^s\(|^c\(|^t\(|^l\(|^n\(/.test(k)) {
        const f = k[0] === "s" ? Math.sin : k[0] === "c" ? Math.cos : k[0] === "t" ? Math.tan
          : k[0] === "l" ? Math.log10 : Math.log;
        const v = parseFloat(current) || 0;
        histEl.textContent = k[0] + "(" + current + ")";
        current = fmt(f(v));
        fresh = true; show(); return;
      }
      if (k === "r") {
        const v = parseFloat(current) || 0;
        histEl.textContent = "√(" + current + ")";
        current = fmt(v < 0 ? NaN : Math.sqrt(v));
        fresh = true; show(); return;
      }
      if (k === "q") {
        const v = parseFloat(current) || 0;
        histEl.textContent = "sqr(" + current + ")";
        current = fmt(v * v);
        fresh = true; show(); return;
      }
      if (k === String(Math.PI)) { current = fmt(Math.PI); fresh = true; show(); return; }
      if (k === "MC") { memory = 0; show(); return; }
      if (k === "MR") { current = fmt(memory); fresh = true; show(); return; }
      if (k === "M+") { memory += parseFloat(current) || 0; show(); return; }
      if (k === "M−") { memory -= parseFloat(current) || 0; show(); return; }

      if (k >= "0" && k <= "9") {
        current = fresh || current === "0" ? k : current + k;
        fresh = false;
      } else if (k === ".") {
        if (fresh) { current = "0."; fresh = false; }
        else if (!current.includes(".")) current += ".";
      } else if (k === "C") {
        current = "0"; prev = null; op = null; fresh = true;
        histEl.innerHTML = "&nbsp;";
      } else if (k === "←") {
        current = current.length > 1 ? current.slice(0, -1) : "0";
      } else if (k === "=") {
        if (op !== null && prev !== null) {
          const expr = prev + " " + op + " " + current;
          const result = fmt(applyOp(parseFloat(prev), parseFloat(current), op));
          histEl.textContent = expr + " =";
          pushHistory(expr, result);
          current = result;
          prev = null; op = null; fresh = true;
        }
      } else {
        if (op !== null && prev !== null && !fresh) current = fmt(applyOp(parseFloat(prev), parseFloat(current), op));
        prev = current;
        op = k;
        fresh = true;
        histEl.textContent = prev + " " + k;
      }
      show();
    }

    keysEl.addEventListener("click", e => {
      const btn = e.target.closest("button[data-k]");
      if (btn) press(btn.dataset.k);
    });

    body.querySelector(".sci-toggle").addEventListener("click", e => {
      const on = !keysEl.querySelector("[data-sci]");
      toggleSci(on);
      e.currentTarget.classList.toggle("ghost", !on);
    });

    body.querySelector(".hist-toggle").addEventListener("click", () => {
      const showPanel = histPanel.style.display === "none";
      histPanel.style.display = showPanel ? "" : "none";
      if (showPanel) renderHistory();
    });

    histPanel.addEventListener("click", e => {
      const row = e.target.closest(".calc-hist-row");
      if (!row || row.dataset.i === undefined) return;
      current = history[Number(row.dataset.i)].result;
      fresh = true;
      show();
    });

    body.querySelector(".copy-result").addEventListener("click", () => {
      const text = valueEl.textContent;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          () => NotifCenter.push("Calculator", 'Copied "' + text + '" to clipboard.', "📋"),
          () => NotifCenter.push("Calculator", "Result: " + text, "🧮")
        );
      } else {
        NotifCenter.push("Calculator", "Result: " + text, "🧮");
      }
    });

    body.tabIndex = -1;
    body.addEventListener("keydown", e => {
      const map = { Enter: "=", Backspace: "←", Escape: "C", x: "*" };
      const k = map[e.key] !== undefined ? map[e.key] : e.key;
      if ("0123456789.+-*/%=".includes(k) || k === "←" || k === "C") {
        e.preventDefault();
        press(k);
      }
    });
    body.addEventListener("pointerdown", () => body.focus());
    renderHistory();
    show();
  }
});

registerApp({
  name: "browser",
  core: true,
  title: "Browser",
  icon: "🌐",
  width: 640, height: 460,

  mount(body) {
    body.innerHTML =
      '<div class="browser-bar">' +
        '<button class="nav-btn back-btn" title="Back">←</button>' +
        '<button class="nav-btn fwd-btn" title="Forward">→</button>' +
        '<button class="nav-btn home-btn" title="Home">⌂</button>' +
        '<input class="os-input addr-input" placeholder="Search or enter address…" />' +
        '<button class="nav-btn star-btn" title="Bookmark this page">☆</button>' +
      "</div>" +
      '<div class="browser-tabs"></div>' +
      '<div class="browser-content"></div>';

    const input = body.querySelector(".addr-input");
    const content = body.querySelector(".browser-content");
    const tabsEl = body.querySelector(".browser-tabs");
    const backBtn = body.querySelector(".back-btn");
    const fwdBtn = body.querySelector(".fwd-btn");
    const starBtn = body.querySelector(".star-btn");
    const HIST_KEY = "browser.history";
    const BM_KEY = "browser.bookmarks";

    let stack = ["home"];
    let idx = 0;

    const getHistory = () => Storage.get(HIST_KEY, []);
    const addHistory = q => {
      const h = getHistory().filter(x => x !== q);
      h.unshift(q);
      Storage.set(HIST_KEY, h.slice(0, 15));
    };
    const getBookmarks = () => Storage.get(BM_KEY, []);
    const setBookmarks = b => Storage.set(BM_KEY, b);

    function isBookmarked() {
      const page = stack[idx];
      return page !== "home" && getBookmarks().includes(page);
    }

    function updateNav() {
      backBtn.disabled = idx <= 0;
      fwdBtn.disabled = idx >= stack.length - 1;
      starBtn.textContent = isBookmarked() ? "★" : "☆";
      input.value = stack[idx] === "home" ? "" : stack[idx];
      renderTabs();
    }

    function renderTabs() {
      tabsEl.innerHTML = stack.map((p, i) =>
        '<button class="browser-tab' + (i === idx ? " current" : "") + '" data-i="' + i + '">' +
        (p === "home" ? "⌂ Home" : "🔍 " + esc(p.length > 18 ? p.slice(0, 18) + "…" : p)) + "</button>"
      ).join("") ;
    }

    function render() {
      updateNav();
      const page = stack[idx];
      if (page === "home") { renderHome(); return; }

      content.innerHTML =
        "<h2>🔍 Results for “" + esc(page) + "”</h2>" +
        "<p>This is a browser simulator inside Web OS. Real websites block being embedded " +
        "(X-Frame-Options), so results open in your actual browser.</p>" +
        '<div class="search-chips">' +
          '<button class="chip open-real">🌍 Open “' + esc(page) + '” in real browser</button>' +
          '<button class="chip bm-add">★ Bookmark this search</button>' +
        "</div>" +
        "<h2>🌐 Try these</h2>" +
        '<div class="search-chips">' +
          ["Wikipedia", "GitHub", "MDN Web Docs", "Stack Overflow"].map(s =>
            '<button class="chip res-link" data-q="' + esc(s + " " + page) + '">' + esc(s) + "</button>").join("") +
        "</div>";
    }

    function renderHome() {
      const recent = getHistory();
      const bms = getBookmarks();
      content.innerHTML =
        "<h2>🌐 Welcome to the Web OS Browser</h2>" +
        "<p>Type a search in the address bar above. Your recent searches and bookmarks appear below.</p>" +
        (recent.length ? '<div class="start-section-label">Recent searches</div>' +
          '<div class="search-chips">' + recent.map(q =>
            '<button class="chip hist-chip" data-q="' + esc(q) + '">🕘 ' + esc(q) + "</button>").join("") + "</div>" : "") +
        (bms.length ? '<div class="start-section-label">Bookmarks</div>' +
          bms.map(b => '<div class="bookmark-row"><span>★</span><span class="bm-open" data-q="' + esc(b) + '">' + esc(b) + "</span>" +
            '<button class="bm-del" data-q="' + esc(b) + '" title="Remove bookmark">✕</button></div>').join("") : "") +
        (!recent.length && !bms.length ? '<p style="color:var(--muted)">No history or bookmarks yet.</p>' : "");
    }

    function navigate(page) {

      stack = stack.slice(0, idx + 1);
      stack.push(page);
      idx = stack.length - 1;
      if (page !== "home") addHistory(page);
      render();
    }

    function submit() {
      const q = input.value.trim();
      if (!q) return;
      navigate(q);
    }

    input.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });

    content.addEventListener("click", e => {
      const chip = e.target.closest(".chip, .bm-open");
      const del = e.target.closest(".bm-del");
      if (del) {
        setBookmarks(getBookmarks().filter(b => b !== del.dataset.q));
        render();
        return;
      }
      if (e.target.classList.contains("open-real")) {
        window.open("https://www.google.com/search?q=" + encodeURIComponent(stack[idx]), "_blank");
        return;
      }
      if (e.target.classList.contains("bm-add")) {
        const q = stack[idx];
        if (q !== "home" && !getBookmarks().includes(q)) {
          setBookmarks([q, ...getBookmarks()].slice(0, 20));
          NotifCenter.push("Browser", 'Bookmarked "' + q + '".', "★");
        }
        render();
        return;
      }
      if (chip && chip.dataset.q) navigate(chip.dataset.q);
    });

    backBtn.addEventListener("click", () => { if (idx > 0) { idx--; render(); } });
    fwdBtn.addEventListener("click", () => { if (idx < stack.length - 1) { idx++; render(); } });
    starBtn.addEventListener("click", () => {
      const q = stack[idx];
      if (q === "home") return;
      const bms = getBookmarks();
      if (bms.includes(q)) { setBookmarks(bms.filter(b => b !== q)); }
      else { setBookmarks([q, ...bms].slice(0, 20)); NotifCenter.push("Browser", 'Bookmarked "' + q + '".', "★"); }
      render();
    });

    tabsEl.addEventListener("click", e => {
      const t = e.target.closest(".browser-tab");
      if (t) { idx = Number(t.dataset.i); render(); }
    });

    body.querySelector(".home-btn").addEventListener("click", () => {
      stack = ["home"]; idx = 0; render();
    });

    render();
  }
});

const WALLPAPERS = {
  aurora:   { label: "Aurora",   css: "radial-gradient(circle at top left, rgba(122,92,255,.35), transparent 30%),radial-gradient(circle at top right, rgba(255,77,166,.25), transparent 30%),linear-gradient(135deg, #111325, #1a1140 45%, #0e1d3a)" },
  sunset:   { label: "Sunset",   css: "radial-gradient(circle at 20% 80%, rgba(255,120,60,.4), transparent 40%),linear-gradient(135deg, #2b0f2e, #4a1445 45%, #1a0b33)" },
  ocean:    { label: "Ocean",    css: "radial-gradient(circle at 70% 20%, rgba(77,184,255,.35), transparent 35%),linear-gradient(135deg, #04182b, #06315c 50%, #02101f)" },
  forest:   { label: "Forest",   css: "radial-gradient(circle at 30% 20%, rgba(80,200,140,.3), transparent 35%),linear-gradient(135deg, #062015, #0b3a24 50%, #03130c)" },
  graphite: { label: "Graphite", css: "radial-gradient(circle at 50% 0%, rgba(160,160,180,.18), transparent 40%),linear-gradient(160deg, #17181d, #23242b 55%, #101116)" },
  candy:    { label: "Candy",    css: "radial-gradient(circle at 80% 10%, rgba(255,150,220,.35), transparent 40%),linear-gradient(135deg, #3a0f4d, #7a1f6a 50%, #2a0b3d)" },
  desert:   { label: "Desert",   css: "radial-gradient(circle at 25% 15%, rgba(255,200,100,.3), transparent 40%),linear-gradient(135deg, #33200a, #5c3a14 50%, #1f1408)" },
  midnight: { label: "Midnight", css: "radial-gradient(circle at 60% 30%, rgba(60,80,255,.25), transparent 40%),linear-gradient(160deg, #050510, #0a0a24 55%, #020208)" }
};

const ACCENTS = {
  purple: "#7a5cff",
  pink:   "#ff4da6",
  blue:   "#4db8ff",
  green:  "#3ecf8e",
  orange: "#ff9f43",
  red:    "#ff5c5c"
};

const Settings = {
  defaults: {
    wallpaper: "aurora", theme: "dark", clock24: true, seconds: false,
    accent: "purple", winStyle: "glass", iconSize: "medium", showIcons: true, widgets: true
  },
  get() { return Object.assign({}, this.defaults, Storage.get("settings", {})); },
  set(patch) { Storage.set("settings", Object.assign(this.get(), patch)); },

  hexToSoft(hex, alpha) {
    const n = parseInt(hex.slice(1), 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + alpha + ")";
  },

  apply() {
    const s = this.get();
    const desktop = document.getElementById("desktop");
    const wp = WALLPAPERS[s.wallpaper] || WALLPAPERS.aurora;
    desktop.style.background = wp.css;

    if (s.theme === "light") document.body.setAttribute("data-theme", "light");
    else document.body.removeAttribute("data-theme");

    document.body.dataset.winstyle = s.winStyle;
    document.body.dataset.iconsize = s.iconSize;
    document.body.dataset.icons = s.showIcons ? "visible" : "hidden";

    const hex = ACCENTS[s.accent] || ACCENTS.purple;
    document.documentElement.style.setProperty("--accent", hex);
    document.documentElement.style.setProperty("--accent-soft", this.hexToSoft(hex, 0.45));

    Clock.update();
  }
};

registerApp({
  name: "settings",
  core: true,
  title: "Settings",
  icon: "⚙️",
  width: 560, height: 520,

  mount(body) {
    const s = Settings.get();

    body.innerHTML =
      '<div class="settings-app">' +
        '<div class="settings-section"><h4>Wallpaper</h4><div class="wallpaper-grid"></div></div>' +
        '<div class="settings-section"><h4>Accent color</h4><div class="accent-row"></div></div>' +
        '<div class="settings-section"><h4>Appearance</h4>' +
          '<div class="setting-row"><span>Theme</span>' +
            '<select class="os-select theme-select"><option value="dark">Dark</option><option value="light">Light</option></select></div>' +
          '<div class="setting-row"><span>Window style</span>' +
            '<select class="os-select winstyle-select"><option value="glass">Glass (blur)</option><option value="solid">Solid</option></select></div>' +
          '<div class="setting-row"><span>Desktop icon size</span>' +
            '<select class="os-select iconsize-select"><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select></div>' +
          '<div class="setting-row"><span>Show desktop icons</span><div class="toggle-switch showicons"></div></div>' +
          '<div class="setting-row"><span>Show widgets</span><div class="toggle-switch widgets"></div></div>' +
        "</div>" +
        '<div class="settings-section"><h4>Clock</h4>' +
          '<div class="setting-row"><span>24-hour time</span><div class="toggle-switch clock24"></div></div>' +
          '<div class="setting-row"><span>Show seconds</span><div class="toggle-switch seconds"></div></div>' +
        "</div>" +
        '<div class="settings-section"><h4>Keyboard shortcuts</h4>' +
          '<table class="shortcut-table"><tbody>' +
            "<tr><td><kbd>Ctrl</kbd><kbd>K</kbd></td><td>Start menu / search</td></tr>" +
            "<tr><td><kbd>Ctrl</kbd><kbd>S</kbd></td><td>Save note (in Notes)</td></tr>" +
            "<tr><td><kbd>Alt</kbd><kbd>Tab</kbd></td><td>Switch windows</td></tr>" +
            "<tr><td><kbd>Alt</kbd><kbd>F4</kbd></td><td>Close active window</td></tr>" +
            "<tr><td><kbd>Esc</kbd></td><td>Close menus</td></tr>" +
          "</tbody></table>" +
        "</div>" +
        '<div class="settings-section"><h4>Storage</h4>' +
          '<div class="setting-row"><span>Reset all Web OS data (notes, files, trash, settings)</span>' +
            '<button class="os-btn ghost reset-btn">Reset</button></div>' +
        "</div>" +
      "</div>";

    const grid = body.querySelector(".wallpaper-grid");
    function renderWallpapers() {
      grid.innerHTML = "";
      const current = Settings.get().wallpaper;
      Object.entries(WALLPAPERS).forEach(([key, wp]) => {
        const t = document.createElement("div");
        t.className = "wallpaper-thumb" + (key === current ? " selected" : "");
        t.style.background = wp.css;
        t.innerHTML = "<span>" + esc(wp.label) + "</span>";
        t.addEventListener("click", () => {
          Settings.set({ wallpaper: key });
          Settings.apply();
          renderWallpapers();
          NotifCenter.push("Settings", 'Wallpaper changed to "' + wp.label + '".', "🎨");
        });
        grid.appendChild(t);
      });
    }
    renderWallpapers();

    const accentRow = body.querySelector(".accent-row");
    function renderAccents() {
      accentRow.innerHTML = "";
      const current = Settings.get().accent;
      Object.entries(ACCENTS).forEach(([key, hex]) => {
        const d = document.createElement("div");
        d.className = "accent-dot" + (key === current ? " selected" : "");
        d.style.background = hex;
        d.title = key;
        d.addEventListener("click", () => {
          Settings.set({ accent: key });
          Settings.apply();
          renderAccents();
        });
        accentRow.appendChild(d);
      });
    }
    renderAccents();

    const bindSelect = (sel, key, after) => {
      sel.value = Settings.get()[key];
      sel.addEventListener("change", () => {
        Settings.set({ [key]: sel.value });
        Settings.apply();
        if (after) after();
      });
    };
    bindSelect(body.querySelector(".theme-select"), "theme");
    bindSelect(body.querySelector(".winstyle-select"), "winStyle");
    bindSelect(body.querySelector(".iconsize-select"), "iconSize");

    const bindToggle = (el, key) => {
      el.classList.toggle("on", Settings.get()[key]);
      el.addEventListener("click", () => {
        const v = !Settings.get()[key];
        Settings.set({ [key]: v });
        el.classList.toggle("on", v);
        Settings.apply();
      });
    };
    bindToggle(body.querySelector(".toggle-switch.clock24"), "clock24");
    bindToggle(body.querySelector(".toggle-switch.seconds"), "seconds");
    bindToggle(body.querySelector(".toggle-switch.showicons"), "showIcons");
    bindToggle(body.querySelector(".toggle-switch.widgets"), "widgets");

    body.querySelector(".reset-btn").addEventListener("click", () => {
      ["notes.list", "vfs", "settings", "trash", "notifs", "winstate",
       "browser.history", "browser.bookmarks"].forEach(k => Storage.remove(k));
      NotifCenter.push("Settings", "All data reset. Reload the page to start fresh.", "♻️", 5000);
    });
  }
});

registerApp({
  name: "sysinfo",
  core: true,
  title: "System Information",
  icon: "📊",
  width: 500, height: 480,

  mount(body) {
    function render() {
      const nav = navigator;
      const conn = nav.connection || {};
      const mem = nav.deviceMemory !== undefined ? "≈ " + nav.deviceMemory + " GB" : "Not reported";
      const notes = Object.keys(Storage.get("notes.list", {})).length;
      const fileCount = VFS.countFiles();
      const trashCount = Trash.count();
      const used = Storage.usageBytes();
      const quota = 5 * 1024 * 1024;
      const pct = Math.min(100, Math.round((used / quota) * 100));
      const openWins = Object.keys(WM.windows).length;

      body.innerHTML =
        '<div class="sysinfo-app">' +
          '<div class="sys-card"><h4>System</h4><table>' +
            "<tr><td>OS</td><td>Web OS 3.0</td></tr>" +
            "<tr><td>Platform</td><td>" + esc(nav.platform || "Unknown") + "</td></tr>" +
            "<tr><td>CPU threads</td><td>" + (nav.hardwareConcurrency || "?") + " logical cores</td></tr>" +
            "<tr><td>Device memory</td><td>" + esc(mem) + "</td></tr>" +
            "<tr><td>Screen</td><td>" + screen.width + " × " + screen.height + " px</td></tr>" +
            "<tr><td>Window</td><td>" + window.innerWidth + " × " + window.innerHeight + " px</td></tr>" +
            "<tr><td>Language</td><td>" + esc(nav.language || "?") + "</td></tr>" +
            "<tr><td>Online</td><td>" + (nav.onLine ? "Yes" : "No") + "</td></tr>" +
            "<tr><td>Connection</td><td>" + esc(conn.effectiveType || "Not reported") + "</td></tr>" +
            "<tr><td>Touch support</td><td>" + (("ontouchstart" in window) ? "Yes" : "No") + "</td></tr>" +
          "</table></div>" +
          '<div class="sys-card"><h4>Windows &amp; apps</h4><table>' +
            "<tr><td>Open windows</td><td>" + openWins + "</td></tr>" +
            "<tr><td>Registered apps</td><td>" + Object.keys(Apps).length + "</td></tr>" +
          "</table></div>" +
          '<div class="sys-card"><h4>Storage</h4><table>' +
            "<tr><td>Notes saved</td><td>" + notes + "</td></tr>" +
            "<tr><td>Virtual files</td><td>" + fileCount + " files</td></tr>" +
            "<tr><td>Recycle Bin</td><td>" + trashCount + " items</td></tr>" +
          "</table>" +
          '<div class="sys-progress"><div style="width:' + pct + '%"></div></div>' +
          '<div class="sys-progress-label">' + (used / 1024).toFixed(1) + " KB used of ~" +
            (quota / 1024 / 1024) + " MB localStorage (" + pct + "%)</div></div>" +
        "</div>";
    }
    render();
    const iv = setInterval(() => {
      if (!document.body.contains(body)) { clearInterval(iv); return; }
      render();
    }, 2000);
  }
});

registerApp({
  name: "about",
  core: true,
  title: "About Web OS",
  icon: "ℹ️",
  width: 460, height: 400,

  mount(body) {
    body.innerHTML =
      '<div class="about-app">' +
        '<div class="about-logo">⬢</div>' +
        '<div style="text-align:center"><span class="version-tag">Version 3.0</span></div>' +
        "<p><strong>Web OS</strong> is a browser-based desktop environment built with plain HTML, CSS and JavaScript — no frameworks, no build step.</p>" +
        "<p>V3 highlights: an App Store with installable apps (Weather, Tic-Tac-Toe, Music, Paint), desktop widgets, and a boot/power experience. Earlier versions added the window manager, File Manager, Recycle Bin, Notification Center and personalization.</p>" +
        "<p>🥚 Rumor has it an old game controller code unlocks something…</p>" +
      "</div>";
  }
});

const Clock = {
  timer: null,
  calMonth: null,

  update() {
    const clockEl = document.getElementById("clock");
    const dateEl = document.getElementById("clockDate");
    if (!clockEl) return;
    const s = Settings.get();
    const now = new Date();

    let h = now.getHours();
    let timeStr;
    if (!s.clock24) {
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      timeStr = h + ":" + String(now.getMinutes()).padStart(2, "0") +
        (s.seconds ? ":" + String(now.getSeconds()).padStart(2, "0") : "") + " " + ampm;
    } else {
      timeStr = String(h).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0") +
        (s.seconds ? ":" + String(now.getSeconds()).padStart(2, "0") : "");
    }
    clockEl.textContent = timeStr;
    dateEl.textContent = now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

    const bigTime = document.getElementById("calBigTime");
    if (bigTime) bigTime.textContent = timeStr;
  },

  renderCalendar() {
    const panel = document.getElementById("calendarPanel");
    const s = Settings.get();
    const now = new Date();
    if (!this.calMonth) this.calMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const view = this.calMonth;
    const year = view.getFullYear(), month = view.getMonth();

    const monthName = view.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysPrev = new Date(year, month, 0).getDate();

    let cells = "";
    for (let i = firstDow - 1; i >= 0; i--) {
      cells += '<div class="cal-day other">' + (daysPrev - i) + "</div>";
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const today = d === now.getDate() && month === now.getMonth() && year === now.getFullYear();
      cells += '<div class="cal-day' + (today ? " today" : "") + '">' + d + "</div>";
    }
    const trailing = (7 - ((firstDow + daysInMonth) % 7)) % 7;
    for (let d = 1; d <= trailing; d++) cells += '<div class="cal-day other">' + d + "</div>";

    const dows = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
      .map(d => '<div class="cal-dow">' + d + "</div>").join("");

    panel.innerHTML =
      '<div class="cal-big-time" id="calBigTime">--:--</div>' +
      '<div class="cal-big-date">' + now.toLocaleDateString(undefined,
        { weekday: "long", month: "long", day: "numeric", year: "numeric" }) + "</div>" +
      '<div class="cal-head"><strong>' + esc(monthName) + "</strong>" +
        '<span><button class="cal-nav cal-prev">‹</button> <button class="cal-nav cal-next">›</button></span></div>' +
      '<div class="cal-grid">' + dows + cells + "</div>";

    this.update();
    panel.querySelector(".cal-prev").addEventListener("click", () => {
      this.calMonth = new Date(year, month - 1, 1);
      this.renderCalendar();
    });
    panel.querySelector(".cal-next").addEventListener("click", () => {
      this.calMonth = new Date(year, month + 1, 1);
      this.renderCalendar();
    });
  },

  start() {
    if (this.timer) clearInterval(this.timer);
    this.update();
    this.timer = setInterval(() => this.update(), 1000);
  }
};

const StartMenu = {
  el: null,
  input: null,

  init() {
    this.el = document.getElementById("startMenu");
    this.input = document.getElementById("startSearch");

    renderStartApps();

    document.getElementById("startBtn").addEventListener("click", e => {
      e.stopPropagation();
      this.toggle();
    });

    document.addEventListener("click", e => {
      if (!this.el.contains(e.target) && !e.target.closest("#startBtn")) this.close();
    });

    this.input.addEventListener("input", () => this.search(this.input.value));
    this.input.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        const first = this.el.querySelector(".menu-app.active, .start-file-hit");
        if (first) first.click();
      }
    });
  },

  toggle() {
    const show = !this.el.classList.contains("show");
    if (show) {
      this.el.classList.add("show");
      this.input.value = "";
      this.search("");
      setTimeout(() => this.input.focus(), 50);
    } else this.close();
  },

  close() { this.el.classList.remove("show"); },

  search(query) {
    const q = query.trim().toLowerCase();
    const appBtns = [...this.el.querySelectorAll(".menu-app")];
    const filesBox = document.getElementById("startFiles");
    const filesLabel = document.getElementById("startFilesLabel");

    appBtns.forEach(btn => {
      const def = Apps[btn.dataset.app];
      const match = !q || def.title.toLowerCase().includes(q) || def.name.includes(q);
      btn.style.display = match ? "" : "none";
      btn.classList.toggle("active", !!q && match);
    });

    filesBox.innerHTML = "";
    if (q) {
      const hits = [];
      (function walk(node, path) {
        if (hits.length >= 8) return;
        Object.values(node.children || {}).forEach(child => {
          if (hits.length >= 8) return;
          if (child.name.toLowerCase().includes(q)) {
            hits.push({ name: child.name, path: path.join("/") || "Home", isFile: child.type === "file" });
          }
          if (child.type === "folder") walk(child, [...path, child.name]);
        });
      })(VFS.data, []);

      filesLabel.hidden = false;
      if (!hits.length) {
        filesBox.innerHTML = '<div class="start-file-hit" style="cursor:default">No matching files</div>';
      } else {
        hits.forEach(hit => {
          const b = document.createElement("button");
          b.className = "start-file-hit";
          b.innerHTML = (hit.isFile ? fileIcon(hit.name, false) : "📁 ") + " " + esc(hit.name) +
            '<span class="hit-path">' + esc(hit.path) + "</span>";
          b.addEventListener("click", () => {
            this.close();
            if (hit.isFile) {
              const parts = hit.path === "Home" ? [] : hit.path.split("/");
              WM.open("files");
              const w = WM.open("notes");
              if (w) {
                w.el.querySelector(".notes-title").value = hit.name;
                w.el.querySelector(".notes-area").value = VFS.readFile(parts, hit.name) || "";
              }
            } else {
              WM.open("files");
            }
          });
          filesBox.appendChild(b);
        });
      }
    } else {
      filesLabel.hidden = true;
    }
  }
};

const Desktop = {
  init() {
    const box = document.getElementById("desktopIcons");
    box.innerHTML = "";

    renderDesktopIcons();
    this.refreshTrash();

    document.getElementById("desktop").addEventListener("click", e => {
      if (e.target.id === "desktop" || e.target.classList.contains("desktop-icons")) {
        box.querySelectorAll(".desktop-icon").forEach(x => x.classList.remove("selected"));
      }
    });

    const menu = document.getElementById("contextMenu");
    const items = [
      { icon: "🖼️", label: "Change wallpaper", act: () => openApp("settings") },
      { icon: "🎨", label: "Next wallpaper", act: () => {
          const keys = Object.keys(WALLPAPERS);
          const cur = keys.indexOf(Settings.get().wallpaper);
          const next = keys[(cur + 1) % keys.length];
          Settings.set({ wallpaper: next });
          Settings.apply();
          NotifCenter.push("Desktop", 'Wallpaper: "' + WALLPAPERS[next].label + '".', "🎨");
        } },
      { icon: "🎯", label: "Next accent color", act: () => {
          const keys = Object.keys(ACCENTS);
          const cur = keys.indexOf(Settings.get().accent);
          const next = keys[(cur + 1) % keys.length];
          Settings.set({ accent: next });
          Settings.apply();
          NotifCenter.push("Desktop", 'Accent color: "' + next + '".', "🎯");
        } },
      { icon: "🧩", label: "Toggle widgets", act: () => Widgets.toggle() },
      { sep: true },
      { icon: "📝", label: "New note", act: () => openApp("notes") },
      { icon: "📂", label: "Open File Manager", act: () => openApp("files") },
      { icon: "🗑️", label: "Empty Recycle Bin", act: () => {
          if (Trash.count()) {
            Trash.empty();
            Desktop.refreshTrash();
            NotifCenter.push("Recycle Bin", "Recycle Bin emptied.", "🔥");
          } else {
            NotifCenter.push("Recycle Bin", "The Recycle Bin is already empty.", "🗑️");
          }
        } },
      { sep: true },
      { icon: "📊", label: "System information", act: () => openApp("sysinfo") },
      { icon: "ℹ️", label: "About Web OS", act: () => openApp("about") },
      { icon: "⚙️", label: "Settings", act: () => openApp("settings") },
      { sep: true },
      { icon: "🔄", label: "Close all windows", act: () =>
          Object.keys(WM.windows).forEach(id => WM.close(id)) }
    ];

    menu.innerHTML = items.map((it, i) => it.sep
      ? '<div class="context-sep"></div>'
      : '<button class="context-item" data-idx="' + i + '">' + it.icon + " " + esc(it.label) + "</button>"
    ).join("");

    menu.addEventListener("click", e => {
      const btn = e.target.closest(".context-item");
      if (!btn) return;
      const item = items[Number(btn.dataset.idx)];
      menu.classList.remove("show");
      if (item && item.act) item.act();
    });

    document.getElementById("desktop").addEventListener("contextmenu", e => {
      if (e.target.closest(".window") || e.target.closest(".taskbar")) return;
      e.preventDefault();
      menu.classList.add("show");
      menu.style.left = Math.min(e.clientX, window.innerWidth - menu.offsetWidth - 8) + "px";
      menu.style.top = Math.min(e.clientY, window.innerHeight - menu.offsetHeight - 8) + "px";
    });

    document.addEventListener("click", e => {
      if (!menu.contains(e.target)) menu.classList.remove("show");
    });
    document.addEventListener("contextmenu", e => {
      if (!e.target.closest("#desktop") || e.target.closest(".window")) {
        if (!menu.contains(e.target) && !e.target.closest("#desktop")) menu.classList.remove("show");
      }
    });
    window.addEventListener("blur", () => menu.classList.remove("show"));
  },

  refreshTrash() {
    const badge = document.getElementById("trashBadge");
    if (!badge) return;
    const n = Trash.count();
    badge.hidden = n === 0;
    badge.textContent = String(n);
  }
};

const Panels = {
  init() {
    const notifPanel = document.getElementById("notifPanel");
    const calPanel = document.getElementById("calendarPanel");

    const closeAll = except => {
      [notifPanel, calPanel].forEach(p => { if (p !== except) p.classList.remove("show"); });
    };

    document.getElementById("notifBell").addEventListener("click", e => {
      e.stopPropagation();
      const show = !notifPanel.classList.contains("show");
      closeAll(null);
      if (show) {
        NotifCenter.renderPanel();
        notifPanel.classList.add("show");
      }
    });

    document.getElementById("clockBtn").addEventListener("click", e => {
      e.stopPropagation();
      const show = !calPanel.classList.contains("show");
      closeAll(null);
      if (show) {
        Clock.calMonth = null;
        Clock.renderCalendar();
        calPanel.classList.add("show");
      }
    });

    document.querySelector(".notif-clear").addEventListener("click", () => {
      NotifCenter.clearAll();
      NotifCenter.renderPanel();
    });

    document.addEventListener("click", e => {
      if (!notifPanel.contains(e.target) && !e.target.closest("#notifBell")) notifPanel.classList.remove("show");
      if (!calPanel.contains(e.target) && !e.target.closest("#clockBtn")) calPanel.classList.remove("show");
    });

    document.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        closeAll(null);
        StartMenu.close();
        document.getElementById("contextMenu").classList.remove("show");
      }
    });
  }
};

const Shortcuts = {
  init() {
    document.addEventListener("keydown", e => {

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        StartMenu.toggle();
        return;
      }

      if (e.altKey && e.key === "Tab") {
        e.preventDefault();
        WM.cycle();
        return;
      }

      if (e.altKey && e.key === "F4") {
        e.preventDefault();
        WM.closeFocused();
        return;
      }

      if (e.key === "Meta" && !e.ctrlKey && !e.altKey) {
        StartMenu.toggle();
        return;
      }
      this.konami(e.key);
    });
  },

  _seq: ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"],
  _pos: 0,
  konami(key) {
    if (key === this._seq[this._pos]) {
      this._pos++;
      if (this._pos === this._seq.length) {
        this._pos = 0;
        const keys = Object.keys(ACCENTS);
        const pick = keys[Math.floor(Math.random() * keys.length)];
        Settings.set({ accent: pick });
        Settings.apply();
        NotifCenter.push("🥚 Easter egg", "Konami code accepted! Accent changed to " + pick + ". You found the secret.", "🎮", 6000);
      }
    } else {
      this._pos = key === this._seq[0] ? 1 : 0;
    }
  }
};

function openApp(name, args) {
  const w = WM.open(name);
  if (w && args) {
    w.openArgs = args;
    const def = Apps[name];
    if (def && def.mount) {
      const body = w.el.querySelector(".window-body");
      def.mount(body, w);
    }
  }
  StartMenu.close();
  return w;
}

const CATALOG = {
  weather: { title: "Weather", icon: "🌤️", desc: "Simulated 5-day forecast for five cities" },
  game:    { title: "Tic-Tac-Toe", icon: "🎮", desc: "Two-player game with saved scoreboard" },
  music:   { title: "Music Player", icon: "🎵", desc: "Synth tracks with a live visualizer" },
  paint:   { title: "Paint", icon: "🖌️", desc: "Canvas drawing with brush and eraser" }
};

const Installer = {
  KEY: "installed",

  init() {},

  installed() { return Storage.get(this.KEY, []); },
  isInstalled(id) { return this.installed().includes(id); },

  install(id) {
    const meta = CATALOG[id];
    if (!meta || this.isInstalled(id)) return false;
    Storage.set(this.KEY, [...this.installed(), id]);
    NotifCenter.push("App Store", '"' + meta.title + '" installed. Find it in the Start menu.', meta.icon);
    this.refreshUI();
    return true;
  },

  uninstall(id) {
    const meta = CATALOG[id];
    if (!meta || !this.isInstalled(id)) return false;
    Storage.set(this.KEY, this.installed().filter(x => x !== id));
    const win = WM.windows["win-" + id];
    if (win) WM.close("win-" + id);
    NotifCenter.push("App Store", '"' + meta.title + '" uninstalled.', meta.icon);
    this.refreshUI();
    return true;
  },

  refreshUI() {
    renderStartApps();
    renderDesktopIcons();
    Desktop.refreshTrash();
  }
};

function renderStartApps() {
  const appsBox = document.getElementById("startApps");
  if (!appsBox) return;
  appsBox.innerHTML = "";
  Object.values(Apps)
    .filter(def => def.core || Installer.isInstalled(def.name))
    .forEach(def => {
      const btn = document.createElement("button");
      btn.className = "menu-app";
      btn.dataset.app = def.name;
      btn.innerHTML = '<span class="menu-icon">' + def.icon + "</span><span>" + esc(def.title) + "</span>";
      btn.addEventListener("click", () => {
        openApp(def.name);
        StartMenu.close();
      });
      appsBox.appendChild(btn);
    });
}

function renderDesktopIcons() {
  const box = document.getElementById("desktopIcons");
  if (!box) return;
  box.innerHTML = "";
  const names = ["notes", "files", "calculator", "browser", "store", "settings", "sysinfo", "trash", ...Installer.installed()];
  names.forEach(name => {
    const def = Apps[name];
    if (!def) return;
    if (!def.core && !Installer.isInstalled(name)) return;
    const icon = document.createElement("div");
    icon.className = "desktop-icon";
    icon.dataset.app = name;
    icon.innerHTML = '<div class="icon-box">' + def.icon +
      (name === "trash" ? '<span class="trash-badge" id="trashBadge" hidden></span>' : "") +
      "</div><span>" + esc(def.title) + "</span>";
    icon.addEventListener("dblclick", () => openApp(name));
    icon.addEventListener("click", () => {
      box.querySelectorAll(".desktop-icon").forEach(x => x.classList.remove("selected"));
      icon.classList.add("selected");
    });
    box.appendChild(icon);
  });
}

registerApp({
  name: "store", core: true, title: "App Store", icon: "🛍️", width: 540, height: 440,

  mount(body) {
    body.innerHTML = '<div class="store-app"><div class="start-section-label" style="margin-top:0">Available apps</div><div class="store-list"></div></div>';
    const list = body.querySelector(".store-list");

    function render() {
      list.innerHTML = "";
      Object.entries(CATALOG).forEach(([id, meta]) => {
        const inst = Installer.isInstalled(id);
        const card = document.createElement("div");
        card.className = "store-card";
        card.innerHTML =
          '<div class="store-icon">' + meta.icon + "</div>" +
          '<div class="store-info"><strong>' + esc(meta.title) + "</strong><span>" + esc(meta.desc) + "</span></div>";
        const btn = document.createElement("button");
        btn.className = "os-btn tiny" + (inst ? " ghost" : "");
        btn.textContent = inst ? "Uninstall" : "Install";
        btn.addEventListener("click", () => {
          if (inst) Installer.uninstall(id); else Installer.install(id);
          render();
        });
        card.appendChild(btn);
        list.appendChild(card);
      });
    }
    render();
  }
});

registerApp({
  name: "weather", title: "Weather", icon: "🌤️", width: 420, height: 480,

  mount(body) {
    body.innerHTML =
      '<div class="files-toolbar">' +
        '<select class="os-select city-select"></select>' +
        '<button class="os-btn tiny ghost refresh-wx">🔄 Refresh</button>' +
      "</div>" +
      '<div class="weather-now"></div>' +
      '<div class="weather-days"></div>';

    const citySel = body.querySelector(".city-select");
    ["New York", "London", "Tokyo", "Sydney", "Paris"].forEach(c => {
      const o = document.createElement("option");
      o.value = c; o.textContent = c;
      citySel.appendChild(o);
    });

    const ICONS = ["☀️", "🌤️", "⛅", "🌧️", "⛈️", "❄️"];
    const seed = str => {
      let h = 0;
      for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
      return h;
    };

    function render() {
      const city = citySel.value;
      const base = seed(city) % 18 + 4;
      const today = new Date();
      body.querySelector(".weather-now").innerHTML =
        '<div class="wx-temp">' + (base + 8) + "°C</div>" +
        '<div class="wx-cond">' + ICONS[seed(city + today.getDate()) % ICONS.length] + " " + esc(city) + "</div>";
      body.querySelector(".weather-days").innerHTML = [1, 2, 3, 4, 5].map(d => {
        const date = new Date(today.getTime() + d * 864e5);
        const t = base + (seed(city + d) % 10) - 5;
        return '<div class="wx-day"><span>' + date.toLocaleDateString(undefined, { weekday: "short" }) + "</span>" +
          "<span>" + ICONS[seed(city + d) % ICONS.length] + "</span><strong>" + t + "°</strong></div>";
      }).join("");
    }

    citySel.addEventListener("change", render);
    body.querySelector(".refresh-wx").addEventListener("click", () => {
      render();
      NotifCenter.push("Weather", "Forecast refreshed.", "🌤️");
    });
    render();
  }
});

registerApp({
  name: "game", title: "Tic-Tac-Toe", icon: "🎮", width: 360, height: 480,

  mount(body) {
    body.innerHTML =
      '<div class="game-status">X to move</div>' +
      '<div class="game-board"></div>' +
      '<div class="game-score"></div>' +
      '<div class="files-toolbar">' +
        '<button class="os-btn tiny ghost game-reset">↺ Reset round</button>' +
        '<button class="os-btn tiny ghost game-zero">Reset scores</button>' +
      "</div>";

    const WIN = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    const KEY = "game.score";
    const boardEl = body.querySelector(".game-board");
    const statusEl = body.querySelector(".game-status");
    const scoreEl = body.querySelector(".game-score");
    let board, turn, over;

    const score = () => Storage.get(KEY, { x: 0, o: 0, d: 0 });

    function renderScore() {
      const sc = score();
      scoreEl.textContent = "X " + sc.x + " · O " + sc.o + " · Draws " + sc.d;
    }

    function renderBoard() {
      boardEl.innerHTML = "";
      board.forEach((cell, i) => {
        const b = document.createElement("button");
        b.textContent = cell || "";
        b.dataset.i = i;
        if (cell) b.disabled = true;
        b.addEventListener("click", () => move(i));
        boardEl.appendChild(b);
      });
    }

    function move(i) {
      if (over || board[i]) return;
      board[i] = turn;
      const winLine = WIN.find(line => line.every(c => board[c] === turn));
      if (winLine) {
        over = true;
        const sc = score();
        if (turn === "X") sc.x++; else sc.o++;
        Storage.set(KEY, sc);
        statusEl.textContent = turn + " wins!";
        winLine.forEach(c => boardEl.children[c].classList.add("win"));
        renderScore();
        NotifCenter.push("Tic-Tac-Toe", "Player " + turn + " wins the round!", "🎮");
        return;
      }
      if (board.every(c => c)) {
        over = true;
        const sc = score();
        sc.d++;
        Storage.set(KEY, sc);
        statusEl.textContent = "Draw!";
        renderScore();
        return;
      }
      turn = turn === "X" ? "O" : "X";
      statusEl.textContent = turn + " to move";
      renderBoard();
    }

    function reset() {
      board = Array(9).fill("");
      turn = "X";
      over = false;
      statusEl.textContent = "X to move";
      renderBoard();
    }

    body.querySelector(".game-reset").addEventListener("click", reset);
    body.querySelector(".game-zero").addEventListener("click", () => {
      Storage.set(KEY, { x: 0, o: 0, d: 0 });
      renderScore();
    });

    reset();
    renderScore();
  }
});

registerApp({
  name: "music", title: "Music Player", icon: "🎵", width: 420, height: 440,

  mount(body) {
    body.innerHTML =
      '<div class="music-display">' +
        '<div class="music-title">Pick a track</div>' +
        '<canvas class="music-viz" width="320" height="60"></canvas>' +
      "</div>" +
      '<div class="files-toolbar">' +
        '<button class="os-btn tiny music-prev">⏮</button>' +
        '<button class="os-btn music-play">▶ Play</button>' +
        '<button class="os-btn tiny ghost music-stop">⏹</button>' +
        '<button class="os-btn tiny music-next">⏭</button>' +
      "</div>" +
      '<div class="music-list"></div>';

    const F = { C4:261.6, D4:293.7, E4:329.6, F4:349.2, G4:392, A4:440, B4:493.9, C5:523.3, D5:587.3, E5:659.3 };
    const TRACKS = [
      { name: "Startup Chime", tempo: 320, notes: ["C4","E4","G4","C5"] },
      { name: "Desktop Groove", tempo: 210, notes: ["C4","C4","G4","A4","G4","E4","D4","C4"] },
      { name: "Night Loop", tempo: 270, notes: ["A4","G4","E4","D4","E4","G4","A4","C5"] }
    ];
    const titleEl = body.querySelector(".music-title");
    const listEl = body.querySelector(".music-list");
    const playBtn = body.querySelector(".music-play");
    let ctx = null, analyser = null, timer = null, raf = null;
    let idx = 0, step = 0, playing = false;

    function renderList() {
      listEl.innerHTML = TRACKS.map((t, i) =>
        '<div class="music-row' + (i === idx ? " current" : "") + '" data-i="' + i + '">' + esc(t.name) + "</div>"
      ).join("");
    }

    function draw() {
      if (!playing || !analyser) return;
      const canvas = body.querySelector(".music-viz");
      const c = canvas.getContext && canvas.getContext("2d");
      if (!c) return;
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      c.clearRect(0, 0, canvas.width, canvas.height);
      c.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--accent") || "#7a5cff";
      const bars = 24, bw = canvas.width / bars;
      for (let i = 0; i < bars; i++) {
        const v = data[i * 4] / 255;
        c.fillRect(i * bw + 1, canvas.height - v * canvas.height, bw - 2, v * canvas.height);
      }
      raf = requestAnimationFrame(draw);
    }

    function tickNote() {
      const track = TRACKS[idx];
      const note = track.notes[step % track.notes.length];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = F[note] || 440;
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + track.tempo / 1000);
      osc.connect(gain).connect(analyser);
      osc.start();
      osc.stop(ctx.currentTime + track.tempo / 1000);
      step++;
    }

    function start() {
      if (playing) return;
      if (typeof AudioContext === "undefined") {
        titleEl.textContent = "Audio not supported here";
        return;
      }
      if (!ctx) {
        ctx = new AudioContext();
        analyser = ctx.createAnalyser();
        analyser.connect(ctx.destination);
      }
      if (ctx.state === "suspended") ctx.resume();
      playing = true;
      playBtn.textContent = "⏸ Pause";
      titleEl.textContent = "🎵 " + TRACKS[idx].name;
      timer = setInterval(tickNote, TRACKS[idx].tempo);
      tickNote();
      draw();
    }

    function stopAll() {
      playing = false;
      playBtn.textContent = "▶ Play";
      if (timer) clearInterval(timer);
      if (raf) cancelAnimationFrame(raf);
      const canvas = body.querySelector(".music-viz");
      const c = canvas.getContext && canvas.getContext("2d");
      if (c) c.clearRect(0, 0, canvas.width, canvas.height);
    }

    playBtn.addEventListener("click", () => { playing ? stopAll() : start(); });
    body.querySelector(".music-stop").addEventListener("click", () => {
      stopAll();
      step = 0;
      titleEl.textContent = "Pick a track";
    });
    body.querySelector(".music-next").addEventListener("click", () => {
      stopAll();
      idx = (idx + 1) % TRACKS.length;
      step = 0;
      renderList();
      start();
    });
    body.querySelector(".music-prev").addEventListener("click", () => {
      stopAll();
      idx = (idx - 1 + TRACKS.length) % TRACKS.length;
      step = 0;
      renderList();
      start();
    });
    listEl.addEventListener("click", e => {
      const row = e.target.closest(".music-row");
      if (!row) return;
      stopAll();
      idx = Number(row.dataset.i);
      step = 0;
      renderList();
      start();
    });

    renderList();
  }
});

registerApp({
  name: "paint", title: "Paint", icon: "🖌️", width: 540, height: 480,

  mount(body) {
    body.innerHTML =
      '<div class="files-toolbar">' +
        '<input type="color" class="os-input paint-color" value="#7a5cff" title="Brush color" />' +
        '<input type="range" class="paint-size" min="1" max="30" value="4" title="Brush size" />' +
        '<button class="os-btn tiny ghost paint-eraser">🧽 Eraser</button>' +
        '<button class="os-btn tiny ghost paint-clear">🗑️ Clear</button>' +
      "</div>" +
      '<canvas class="paint-canvas" width="800" height="520"></canvas>';

    const canvas = body.querySelector(".paint-canvas");
    let drawing = false, last = null, eraser = false;

    function pos(e) {
      const r = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) * (canvas.width / r.width),
        y: (e.clientY - r.top) * (canvas.height / r.height)
      };
    }

    canvas.addEventListener("pointerdown", e => {
      const c = canvas.getContext && canvas.getContext("2d");
      if (!c) return;
      drawing = true;
      last = pos(e);
      try { canvas.setPointerCapture(e.pointerId); } catch {}
    });
    canvas.addEventListener("pointermove", e => {
      if (!drawing) return;
      const c = canvas.getContext("2d");
      if (!c) return;
      const p = pos(e);
      c.strokeStyle = eraser ? "#ffffff" : body.querySelector(".paint-color").value;
      c.lineWidth = eraser
        ? Number(body.querySelector(".paint-size").value) * 3
        : Number(body.querySelector(".paint-size").value);
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(last.x, last.y);
      c.lineTo(p.x, p.y);
      c.stroke();
      last = p;
    });
    const end = () => { drawing = false; };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);

    body.querySelector(".paint-eraser").addEventListener("click", e => {
      eraser = !eraser;
      e.currentTarget.classList.toggle("ghost", !eraser);
    });
    body.querySelector(".paint-clear").addEventListener("click", () => {
      const c = canvas.getContext("2d");
      c.clearRect(0, 0, canvas.width, canvas.height);
    });
  }
});

const Widgets = {
  initialized: false,

  init() {
    this.initialized = true;
    this.render();
    setInterval(() => this.tick(), 1000);
  },

  render() {
    const root = document.getElementById("widgets");
    if (!root) return;
    if (!Settings.get().widgets) { root.innerHTML = ""; return; }
    root.innerHTML =
      '<div class="widget" id="widgetClock">' +
        '<div class="widget-time">--:--</div>' +
        '<div class="widget-date"></div>' +
      "</div>" +
      '<div class="widget">' +
        '<div class="widget-title">System</div>' +
        '<div class="widget-row"><span>Windows</span><span id="widgetWins">0</span></div>' +
        '<div class="widget-row"><span>Storage</span><span id="widgetStore">0 KB</span></div>' +
        '<div class="widget-row"><span>Network</span><span id="widgetNet">—</span></div>' +
        '<div class="widget-row"><span>Battery</span><span id="widgetBat">—</span></div>' +
      "</div>";
    this.tick();
    if (navigator.getBattery) {
      navigator.getBattery().then(b => {
        const el = document.getElementById("widgetBat");
        if (el) el.textContent = Math.round(b.level * 100) + "%";
      }).catch(() => {});
    }
  },

  toggle() {
    Settings.set({ widgets: !Settings.get().widgets });
    this.render();
  },

  tick() {
    const timeEl = document.querySelector("#widgetClock .widget-time");
    if (!timeEl) return;
    const s = Settings.get();
    const now = new Date();
    let h = now.getHours();
    let text;
    if (!s.clock24) {
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      text = h + ":" + String(now.getMinutes()).padStart(2, "0") + " " + ampm;
    } else {
      text = String(h).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
    }
    timeEl.textContent = text;
    document.querySelector("#widgetClock .widget-date").textContent =
      now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    document.getElementById("widgetWins").textContent = String(Object.keys(WM.windows).length);
    document.getElementById("widgetStore").textContent = (Storage.usageBytes() / 1024).toFixed(1) + " KB";
    document.getElementById("widgetNet").textContent = navigator.onLine ? "Online" : "Offline";
  }
};

const Boot = {
  init() {
    const screen = document.getElementById("bootScreen");
    if (!screen) return;
    if (Storage.get("powered", true) === false) {
      screen.classList.add("shutdown");
      screen.innerHTML = '<div class="boot-logo">⏻</div><div class="boot-hint">Click to power on</div>';
      screen.addEventListener("click", () => {
        Storage.set("powered", true);
        location.reload();
      });
      return;
    }
    document.getElementById("restartBtn").addEventListener("click", () => Boot.restart());
    document.getElementById("shutdownBtn").addEventListener("click", () => Boot.shutdown());
    const finish = () => screen.classList.add("hide");
    screen.addEventListener("click", finish);
    setTimeout(finish, 1800);
  },

  restart() {
    Storage.set("powered", true);
    location.reload();
  },

  shutdown() {
    Storage.set("powered", false);
    location.reload();
  }
};

document.addEventListener("DOMContentLoaded", () => {
  VFS.load();
  WM.init();
  Taskbar.init();
  StartMenu.init();
  Panels.init();
  Shortcuts.init();
  Desktop.init();
  Installer.init();
  Widgets.init();
  Settings.apply();
  Clock.start();
  Boot.init();

  setTimeout(() => NotifCenter.push("Welcome to Web OS 3.0",
    "New in v3: App Store, desktop widgets. Install Weather, Music, Games and Paint.", "🚀", 5000), 2300);
});
