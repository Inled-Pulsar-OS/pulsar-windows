import { app, BrowserWindow, ipcMain, session, Tray, Menu } from "electron";
import { join } from "path";
import fs from "fs";
import { initialize, enable } from "@electron/remote/main/index.js";
import Store from "electron-store";

// Ensure single instance lock first
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    // If this is a secondary instance (e.g. from a .desktop shortcut with --launch),
    // the CLI arguments are already sent to the running instance via the 'second-instance' event.
    app.exit(0);
}

initialize();

// Window Constants
const WINDOW_MIN_WIDTH = 1280;
const WINDOW_MIN_HEIGHT = 800;

// For electron-store Type-Safety
type SchemaType = {
    dimensions: {
        width: number;
        height: number;
    };
    position: {
        x: number;
        y: number;
    };
};

const windowStore = new Store<SchemaType>({
    schema: {
        dimensions: {
            type: "object",
            properties: {
                width: {
                    type: "number",
                    default: WINDOW_MIN_WIDTH,
                },
                height: {
                    type: "number",
                    default: WINDOW_MIN_HEIGHT,
                },
            },
            required: ["width", "height"],
        },
        position: {
            type: "object",
            properties: {
                x: {
                    type: "number",
                },
                y: {
                    type: "number",
                },
            },
            required: ["x", "y"],
        },
    },
});

function extractLaunchArg(argv: string[]): string | null {
    // 1. Check for --launch=Target or -l=Target
    for (const arg of argv) {
        if (arg.startsWith("--launch=")) {
            return arg.slice("--launch=".length).trim().replace(/^["']|["']$/g, "");
        }
        if (arg.startsWith("-l=")) {
            return arg.slice("-l=".length).trim().replace(/^["']|["']$/g, "");
        }
    }

    // 2. Check for --launch or -l flag, skipping any Chromium flags (e.g. --ozone-platform, etc.)
    const launchIdx = argv.findIndex(arg => arg === "--launch" || arg === "-l");
    if (launchIdx !== -1) {
        for (let i = launchIdx + 1; i < argv.length; i++) {
            if (!argv[i].startsWith("-")) {
                return argv[i].trim().replace(/^["']|["']$/g, "");
            }
        }
        const nonFlags = argv.filter(a => !a.startsWith("-") && !a.includes("pulsar-windows") && !a.includes("electron"));
        if (nonFlags.length > 0) {
            return nonFlags[nonFlags.length - 1].trim().replace(/^["']|["']$/g, "");
        }
    }

    // 3. Check for standalone file paths (e.g. from file manager "Open with..." or MIME association)
    for (let i = 1; i < argv.length; i++) {
        const arg = argv[i].trim().replace(/^["']|["']$/g, "");
        if (arg.startsWith("-")) continue;
        if (arg.includes("pulsar-windows") || arg.includes("electron") || arg.includes("main.js")) continue;

        const lower = arg.toLowerCase();
        if (
            lower.endsWith(".exe") ||
            lower.endsWith(".msi") ||
            lower.endsWith(".bat") ||
            lower.endsWith(".cmd") ||
            lower.endsWith(".lnk") ||
            (arg.startsWith("/") && fs.existsSync(arg))
        ) {
            return arg;
        }
    }

    return null;
}

function isBackgroundRequested(argv: string[]): boolean {
    return argv.includes("--background") || argv.includes("--hidden") || argv.includes("-b");
}

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let splashTimer: NodeJS.Timeout | null = null;
let tray: Tray | null = null;
let isQuitting = false;

function showLaunchSplash(appName: string) {
    if (splashTimer) {
        clearTimeout(splashTimer);
        splashTimer = null;
    }
    const base = (appName || "").replace(/^[⚙️🖥️]\s*/, "");
    const cleanName = base ? base.replace(/\.[a-zA-Z0-9]+$/, "") : "Aplicación";
    const title = `Iniciando ${cleanName}...`;

    if (!splashWindow || splashWindow.isDestroyed()) {
        splashWindow = new BrowserWindow({
            width: 320,
            height: 110,
            frame: false,
            transparent: true,
            alwaysOnTop: true,
            skipTaskbar: true,
            resizable: false,
            show: false,
            center: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
            },
        });
    }

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
        body {
            width: 100vw;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: transparent;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            overflow: hidden;
        }
        .container {
            width: 290px;
            height: 84px;
            background: rgba(20, 20, 24, 0.90);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border: 1px solid rgba(139, 92, 246, 0.4);
            border-radius: 18px;
            box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6), 0 0 25px rgba(139, 92, 246, 0.3);
            display: flex;
            align-items: center;
            padding: 0 18px;
            gap: 15px;
            animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes popIn {
            from { opacity: 0; transform: scale(0.94); }
            to { opacity: 1; transform: scale(1); }
        }
        .spinner {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border: 3.5px solid rgba(139, 92, 246, 0.2);
            border-top-color: #a855f7;
            border-right-color: #8b5cf6;
            animation: spin 0.8s cubic-bezier(0.5, 0.1, 0.5, 0.9) infinite;
            flex-shrink: 0;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .text-wrap {
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .title {
            color: #ffffff;
            font-size: 14px;
            font-weight: 600;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .subtitle {
            color: #a1a1aa;
            font-size: 11px;
            margin-top: 3px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="spinner"></div>
        <div class="text-wrap">
            <div class="title">${title}</div>
            <div class="subtitle">Pulsar Windows • Cargando</div>
        </div>
    </div>
</body>
</html>`;

    splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    splashWindow.once("ready-to-show", () => {
        splashWindow?.show();
    });

    splashTimer = setTimeout(() => {
        hideLaunchSplash();
    }, 12000);
}

function hideLaunchSplash() {
    if (splashTimer) {
        clearTimeout(splashTimer);
        splashTimer = null;
    }
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
    }
}

const initialLaunch = extractLaunchArg(process.argv);
const startInBackground = isBackgroundRequested(process.argv) || !!initialLaunch;

function createTray() {
    if (tray) return;
    try {
        const candidates = [
            "/usr/share/pixmaps/pulsar-windows.png",
            "/usr/share/icons/hicolor/128x128/apps/pulsar-windows.png",
            "/usr/share/icons/hicolor/scalable/apps/pulsar-windows.svg",
            join(app.getAppPath(), "renderer", "img", "winboat_logo.png"),
        ];
        const iconPath = candidates.find(p => fs.existsSync(p)) || candidates[0];

        tray = new Tray(iconPath);
        const contextMenu = Menu.buildFromTemplate([
            {
                label: "Abrir Pulsar Windows",
                click: () => {
                    mainWindow?.show();
                    mainWindow?.focus();
                },
            },
            { type: "separator" },
            {
                label: "Salir de Pulsar Windows",
                click: () => {
                    isQuitting = true;
                    app.quit();
                },
            },
        ]);
        tray.setToolTip("Pulsar Windows");
        tray.setContextMenu(contextMenu);
        tray.on("click", () => {
            if (mainWindow?.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow?.show();
                mainWindow?.focus();
            }
        });
    } catch (e) {
        console.warn("Could not initialize system tray:", e);
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        minWidth: WINDOW_MIN_WIDTH,
        minHeight: WINDOW_MIN_HEIGHT,
        width: windowStore.get("dimensions.width"),
        height: windowStore.get("dimensions.height"),
        x: windowStore.get("position.x"),
        y: windowStore.get("position.y"),
        show: !startInBackground,
        transparent: false,
        frame: false,
        title: "Pulsar Windows",
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    mainWindow.on("close", event => {
        if (!isQuitting) {
            // Keep running in background so .desktop shortcuts can trigger apps instantly
            event.preventDefault();
            mainWindow?.hide();
        } else {
            const bounds = mainWindow?.getBounds();
            if (bounds) {
                windowStore.set("dimensions", {
                    width: bounds.width,
                    height: bounds.height,
                });
                windowStore.set("position", {
                    x: bounds.x,
                    y: bounds.y,
                });
            }
        }
    });

    enable(mainWindow.webContents);

    if (process.env.NODE_ENV === "development") {
        const rendererPort = process.argv[2] && !process.argv[2].startsWith("-") ? process.argv[2] : "5173";
        mainWindow.loadURL(`http://localhost:${rendererPort}`);
    } else {
        mainWindow.loadFile(join(app.getAppPath(), "renderer", "index.html"));
    }

    mainWindow.webContents.on("did-finish-load", () => {
        if (initialLaunch) {
            console.log(`[Pulsar Windows] Forwarding initial launch request: ${initialLaunch}`);
            showLaunchSplash(initialLaunch);
            mainWindow?.webContents.send("launch-app-request", initialLaunch);
            setTimeout(() => {
                mainWindow?.webContents.send("launch-app-request", initialLaunch);
            }, 1000);
        }
    });

    ipcMain.on("pulsar-ready", () => {
        if (initialLaunch) {
            console.log(`[Pulsar Windows] Forwarding initial launch request via pulsar-ready: ${initialLaunch}`);
            mainWindow?.webContents.send("launch-app-request", initialLaunch);
        }
    });
}

app.whenReady().then(() => {
    createWindow();
    createTray();

    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                "Content-Security-Policy": [
                    "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' 'unsafe-inline'",
                    "worker-src 'self' blob:",
                    "media-src 'self' blob:",
                    "font-src 'self' 'unsafe-inline' https://fonts.gstatic.com;",
                    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                ],
            },
        });
    });

    app.on("activate", function () {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        } else {
            mainWindow?.show();
            mainWindow?.focus();
        }
    });
});

app.on("before-quit", () => {
    isQuitting = true;
});

app.on("window-all-closed", function () {
    // Keep alive on Linux in background if not explicitly quitting
    if (isQuitting || process.platform === "darwin") {
        app.quit();
    }
});

app.on("second-instance", (_event, commandLine) => {
    console.log("[Pulsar Windows] Second instance detected. CommandLine:", commandLine);
    const target = extractLaunchArg(commandLine);
    if (target) {
        console.log(`[Pulsar Windows] Received launch request for app: ${target}`);
        showLaunchSplash(target);
        mainWindow?.webContents.send("launch-app-request", target);
    } else {
        if (mainWindow) {
            if (!mainWindow.isVisible()) {
                mainWindow.show();
            }
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            }
            mainWindow.focus();
        }
    }
});

ipcMain.on("show-launch-splash", (_event, appName: string) => {
    showLaunchSplash(appName);
});

ipcMain.on("hide-launch-splash", () => {
    hideLaunchSplash();
});

ipcMain.on("quit-app", () => {
    isQuitting = true;
    app.quit();
});

ipcMain.on("show-window", () => {
    mainWindow?.show();
    mainWindow?.focus();
});

ipcMain.on("hide-window", () => {
    mainWindow?.hide();
});
