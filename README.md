# 🖥️ Web OS 3.0

A desktop environment in the browser. Plain HTML, CSS and JavaScript. No frameworks, no build step. Open `index.html` and it runs.

## Version History

### V1 — Basic Desktop Interface
Desktop icons, start menu, taskbar, clock. Notes, File Manager, Browser placeholder. localStorage persistence.

### V2 — Advanced Desktop Features
8-direction resizable windows with remembered sizes. File Manager with copy/cut/paste, sort, search, breadcrumbs. Recycle Bin. Notification Center. Accent colors, glass/solid windows, icon sizes. Global shortcuts (Ctrl+K, Alt+Tab, Alt+F4). Browser simulator with history and bookmarks. Central app registry.

### V3 — App Installer and Dynamic Features (this release)
- 🛍️ **App Store** — install and uninstall apps; the choice persists in `webos.installed` and survives reload. Uninstalled apps disappear from the Start menu and desktop; installed ones appear everywhere through the shared registry.
- 🌤️ **Weather** — simulated 5-day forecast for five cities, stable per city and day, refresh action.
- 🎮 **Tic-Tac-Toe** — two players, win-line highlight, scoreboard persisted in localStorage, round and score resets.
- 🎵 **Music Player** — three synth tracks with Web Audio, play/pause/stop, prev/next, live frequency-bar visualizer.
- 🖌️ **Paint** — canvas drawing with pointer events, color picker, brush size, eraser, clear.
- 🧩 **Desktop widgets** — clock widget plus a live system widget (open windows, storage used, network, battery when the browser reports it). Toggle in Settings or the desktop right-click menu.
- ⚡ **Boot, restart, shutdown** — boot splash on load, Restart and Shut down in the Start menu; after shutdown the machine stays off until clicked.
- Core apps (Notes, Files, Calculator, Browser, Store, Settings, System Info, About, Recycle Bin) are always present; store apps layer on top of the same registry.

## Getting Started

```bash
open index.html
# or
python3 -m http.server 8000
```

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Ctrl/⌘ + K | Start menu and search |
| Ctrl/⌘ + S | Save note |
| Alt + Tab | Cycle windows |
| Alt + F4 | Close active window |
| Esc | Close menus and panels |

## Project Structure

```
web-os-desktop/
├── index.html   desktop shell, taskbar, panels, boot screen
├── style.css    themes, accent variables, app and widget styles
├── script.js    storage, VFS, Trash, window manager, registry, installer, apps
└── README.md
```

## Architecture

- `Storage` — localStorage wrapper, JSON values, `webos.` namespace.
- `VFS` — file system tree with created/modified timestamps.
- `Trash` — recycle bin with original paths for restore.
- `WM` — window manager: drag, 8-direction resize, maximize, minimize, z-order, saved geometry.
- `Apps` + `registerApp` — every app registers `{ name, core, title, icon, width, height, mount }`. The Start menu, desktop, taskbar and search render from this registry; `core: true` marks built-in apps, everything else needs an install.
- `CATALOG` + `Installer` — installable app definitions and the install/uninstall lifecycle persisted to localStorage, refreshing the launcher and desktop on change.
- `Widgets`, `Boot`, `NotifCenter`, `Settings`, `Clock` — desktop widgets, boot/power state, notifications, appearance and time.

## Tech Stack

HTML5, CSS3, Vanilla ES6+, Pointer Events, Canvas, Web Audio, localStorage.

All data stays on the device.
