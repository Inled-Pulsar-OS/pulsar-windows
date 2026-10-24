import type { WinApp } from "../../types";
import { WINBOAT_DIR } from "./constants";

const fs: typeof import("fs") = require("node:fs");
const path: typeof import("path") = require("node:path");
const os: typeof import("os") = require("node:os");
const { exec } = require("node:child_process");

const HOME = os.homedir();
const APPS_DIR = path.join(HOME, ".local", "share", "applications");
const ICONS_DIR = path.join(HOME, ".local", "share", "icons", "pulsar-windows");
const BIN_DIR = path.join(HOME, ".local", "bin");
const LAUNCHER_SCRIPT = path.join(BIN_DIR, "pulsar-windows");
const AUTOSTART_DIR = path.join(HOME, ".config", "autostart");
const AUTOSTART_FILE = path.join(AUTOSTART_DIR, "pulsar-windows.desktop");

/**
 * Ensures Pulsar Windows autostarts in background on system boot
 */
export function ensureAutostartEntry(): void {
    try {
        if (!fs.existsSync(AUTOSTART_DIR)) {
            fs.mkdirSync(AUTOSTART_DIR, { recursive: true });
        }
        const content = `[Desktop Entry]
Type=Application
Name=Pulsar Windows Background Service
Comment=Inicia Pulsar Windows en segundo plano para abrir aplicaciones rápidamente
Exec=pulsar-windows --background
Icon=pulsar-windows
Terminal=false
Categories=Utility;
X-GNOME-Autostart-enabled=true
X-Pulsar-Autostart=true
`;
        fs.writeFileSync(AUTOSTART_FILE, content, "utf-8");
    } catch (err) {
        console.error("Failed to ensure autostart desktop entry:", err);
    }
}

/**
 * Registers Pulsar Windows as default handler in GNOME for .exe and .msi files
 */
export function ensureMimeHandler(): void {
    try {
        if (!fs.existsSync(APPS_DIR)) {
            fs.mkdirSync(APPS_DIR, { recursive: true });
        }
        const mimeDesktopPath = path.join(APPS_DIR, "pulsar-windows-installer.desktop");
        const content = `[Desktop Entry]
Version=1.0
Type=Application
Name=Pulsar Windows (Ejecutar en Windows)
Comment=Ejecutar archivos .exe y .msi con Pulsar Windows
Exec=pulsar-windows %f
Icon=pulsar-windows
Terminal=false
Categories=Utility;System;
MimeType=application/x-ms-dos-executable;application/x-msdownload;application/exe;application/x-exe;application/x-msi;application/vnd.microsoft.portable-executable;
NoDisplay=false
`;
        fs.writeFileSync(mimeDesktopPath, content, "utf-8");
        exec(
            "xdg-mime default pulsar-windows.desktop application/x-ms-dos-executable application/x-msdownload application/exe application/x-exe application/x-msi application/vnd.microsoft.portable-executable",
            () => {}
        );
        exec("update-desktop-database ~/.local/share/applications", () => {});
    } catch (err) {
        console.error("Failed to register MIME handler for .exe/.msi:", err);
    }
}

/**
 * Normalizes app name to a filesystem-friendly slug
 */
export function slugify(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^\w\d-_]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "");
}

/**
 * Ensures ~/.local/bin/pulsar-windows exists so .desktop Exec commands work everywhere
 */
export function ensureLauncherScript(): void {
    try {
        if (!fs.existsSync(BIN_DIR)) {
            fs.mkdirSync(BIN_DIR, { recursive: true });
        }

        const execPath = process.execPath;
        const scriptContent = `#!/usr/bin/env bash\nexec "${execPath}" "$@"\n`;

        fs.writeFileSync(LAUNCHER_SCRIPT, scriptContent, { mode: 0o755 });
    } catch (err) {
        console.error("Failed to create ~/.local/bin/pulsar-windows launcher script:", err);
    }
}

/**
 * Saves a base64 encoded icon to disk and returns the full absolute path
 */
export function saveIconToDisk(slug: string, iconData: string): string | null {
    try {
        if (!fs.existsSync(ICONS_DIR)) {
            fs.mkdirSync(ICONS_DIR, { recursive: true });
        }

        const iconPath = path.join(ICONS_DIR, `${slug}.png`);

        // If already exists and iconData has not changed, we can keep it
        const cleanBase64 = iconData.replace(/^data:image\/[a-z]+;base64,/, "").trim();
        if (!cleanBase64) return null;

        const buffer = Buffer.from(cleanBase64, "base64");
        fs.writeFileSync(iconPath, buffer);
        return iconPath;
    } catch (err) {
        console.error(`Error saving icon for ${slug}:`, err);
        return null;
    }
}

/**
 * Generates and synchronizes native Linux .desktop files for all Windows applications
 */
export async function syncNativeDesktopEntries(apps: WinApp[]): Promise<void> {
    try {
        if (!fs.existsSync(APPS_DIR)) {
            fs.mkdirSync(APPS_DIR, { recursive: true });
        }

        ensureLauncherScript();
        ensureAutostartEntry();
        ensureMimeHandler();

        const currentSlugs = new Set<string>();

        for (const app of apps) {
            // Skip browser vnc command if present
            if (app.Path === "NOVNC_COMMAND") continue;

            const cleanAppName = app.Name.replaceAll(/[,.'"]/g, "").trim();
            const displayName = cleanAppName.replace(/^[⚙️🖥️]\s*/, "");
            const slug = slugify(cleanAppName || "app");
            currentSlugs.add(slug);

            const desktopFilePath = path.join(APPS_DIR, `pulsar-win-${slug}.desktop`);

            // Save icon if available
            let iconPath = "application-x-executable";
            if (app.Icon) {
                const savedIcon = saveIconToDisk(slug, app.Icon);
                if (savedIcon) {
                    iconPath = savedIcon;
                }
            }

            const safeAppPath = (app.Path || "").replace(/\\/g, "/");

            const desktopContent = `[Desktop Entry]
Version=1.0
Type=Application
Name=${displayName} (Windows)
GenericName=Windows Application
Comment=Ejecutar ${displayName} en Pulsar Windows
Exec=pulsar-windows --launch="${displayName}"
Icon=${iconPath}
Terminal=false
Categories=PulsarWindows;Utility;
StartupWMClass=winboat-${cleanAppName}
X-Pulsar-Managed=true
X-Pulsar-App-Path=${safeAppPath}
`;

            fs.writeFileSync(desktopFilePath, desktopContent, "utf-8");
        }

        // Clean up orphaned .desktop files managed by Pulsar
        const files = fs.readdirSync(APPS_DIR);
        for (const file of files) {
            if (file.startsWith("pulsar-win-") && file.endsWith(".desktop")) {
                const slug = file.replace(/^pulsar-win-/, "").replace(/\.desktop$/, "");
                if (!currentSlugs.has(slug)) {
                    try {
                        const fullPath = path.join(APPS_DIR, file);
                        const content = fs.readFileSync(fullPath, "utf-8");
                        if (content.includes("X-Pulsar-Managed=true")) {
                            fs.unlinkSync(fullPath);
                            const iconPath = path.join(ICONS_DIR, `${slug}.png`);
                            if (fs.existsSync(iconPath)) {
                                fs.unlinkSync(iconPath);
                            }
                        }
                    } catch (e) {
                        console.warn(`Could not remove stale desktop file: ${file}`, e);
                    }
                }
            }
        }

        // Notify GNOME / desktop environment of desktop file changes
        exec("update-desktop-database ~/.local/share/applications", () => {});
    } catch (err) {
        console.error("Failed to synchronize native desktop entries:", err);
    }
}
