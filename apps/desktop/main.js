const { app, BrowserWindow, dialog, shell, utilityProcess } = require("electron");
const net = require("node:net");
const path = require("node:path");

// The port is part of the page's origin, and the web app keeps its session token
// (localStorage) and timeline cache (IndexedDB) per origin — a random port would log the
// user out on every launch. It is also the origin Nimlet's CORS config has to allow.
const PORT = Number(process.env.NIMCHAT_PORT) || 3170;
const HOST = "127.0.0.1";
// Point at an already-running web app (e.g. `next dev`) instead of the bundled server.
const DEV_URL = process.env.NIMCHAT_DESKTOP_URL;

let server;
let win;
let appUrl;

function waitForPort(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect(port, HOST);
      socket.once("connect", () => { socket.end(); resolve(); });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() > deadline) reject(new Error(`server did not open ${HOST}:${port}`));
        else setTimeout(attempt, 100);
      });
    };
    attempt();
  });
}

function portInUse(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(true));
    probe.once("listening", () => probe.close(() => resolve(false)));
    probe.listen(port, HOST);
  });
}

async function startServer() {
  if (await portInUse(PORT)) {
    throw new Error(`Port ${PORT} is already in use. Free it or set NIMCHAT_PORT (and allow the new origin in Nimlet).`);
  }
  const root = app.isPackaged
    ? path.join(process.resourcesPath, "server")
    : path.join(__dirname, "server");
  const cwd = path.join(root, "apps", "web");
  server = utilityProcess.fork(path.join(cwd, "server.js"), [], {
    cwd,
    env: { ...process.env, NODE_ENV: "production", PORT: String(PORT), HOSTNAME: HOST },
    stdio: "inherit",
    serviceName: "NimChat web server",
  });
  server.once("exit", (code) => {
    server = undefined;
    if (!app.isQuitting) {
      dialog.showErrorBox("NimChat", `The embedded web server stopped (exit code ${code}).`);
      app.quit();
    }
  });
  await waitForPort(PORT, 20000);
  return `http://${HOST}:${PORT}`;
}

function createWindow(url) {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 480,
    minHeight: 480,
    title: "NimChat",
    icon: path.join(__dirname, "build", "icon.png"),
    autoHideMenuBar: true,
    backgroundColor: "#0b0b0f",
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  const origin = new URL(url).origin;
  // Message links use target="_blank"; anything leaving the app opens in the system browser.
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:|^mailto:/.test(target)) shell.openExternal(target);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, target) => {
    if (new URL(target).origin !== origin) {
      event.preventDefault();
      shell.openExternal(target);
    }
  });
  win.loadURL(url);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!win || win.isDestroyed()) {
      if (appUrl) createWindow(appUrl);
      return;
    }
    if (win.isFocused()) return;
    // Wayland compositors (Hyprland with focus_on_activate off, GNOME) ignore focus
    // requests, so the window would stay on another workspace and the launch would look
    // like it did nothing. A fresh window maps on the current workspace; the session and
    // timeline cache live in the profile, so only the page reloads.
    const old = win;
    createWindow(appUrl);
    old.destroy();
  });

  app.whenReady().then(async () => {
    try {
      const url = DEV_URL || (await startServer());
      appUrl = url;
      createWindow(url);
      app.on("activate", () => { if (!BrowserWindow.getAllWindows().length) createWindow(url); });
    } catch (err) {
      dialog.showErrorBox("NimChat", String(err.message ?? err));
      app.quit();
    }
  });

  app.on("before-quit", () => {
    app.isQuitting = true;
    server?.kill();
  });
  app.on("window-all-closed", () => app.quit());
}
