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
let tray: Tray | null = null;
let isQuitting = false;

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
