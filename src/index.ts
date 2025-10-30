import * as electron from "electron";
const { app, BrowserWindow, ipcMain, Tray, Menu } = electron;
import fs from "fs";
import * as git from "isomorphic-git";
import http from "isomorphic-git/http/node";
import path from "path";
import { rm } from "fs/promises";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import { cwd } from "process";
import { nativeImage } from "electron/common";
import axios from "axios";

config({ quiet: true });

// Ensure Windows toast system uses our app id
if (process.platform === "win32") {
    app.setAppUserModelId("com.goosedes.mindesktop");
}

const customApp = app as electron.App & { isQuiting: boolean };
customApp.isQuiting = false; // Variable that determines if the app is fully quiting or just closing the window

// Prevent multiple instances
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
    app.quit();
} else {
    app.on("second-instance", () => {
        if (win) {
            if (win.isMinimized()) win.restore();
            win.show();
            win.focus();
        }
    });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function downloadOfflineVersion(repo: string, branch: string) {
    // Cloning website from repos
    const targetDir = path.resolve(path.join(app.getPath("userData"), "site"));
    await rm(targetDir, { recursive: true, force: true });
    await fs.promises.mkdir(targetDir, { recursive: true });
    await git.clone({ fs, http, dir: targetDir, url: repo, singleBranch: true, ref: branch, depth: 1 });

    // Launching offline copy and maximazing
    await win.loadFile(path.join(targetDir, "index.html"));
    win.maximize();
}

let win: electron.BrowserWindow;
let tray: electron.Tray;
let assetsPath: string;

if (process.env.DEBUG) {
    assetsPath = path.join(__dirname, "..", "assets");
} else {
    if (process.resourcesPath) {
        assetsPath = path.join(process.resourcesPath, "assets");
    } else {
        assetsPath = path.join(app.getAppPath(), "assets");
    }
}

const logo512Path = path.join(assetsPath, "logo512.png");
const logo32Path = path.join(assetsPath, "logo32.png");
const iconPath = path.join(assetsPath, process.platform === "win32" ? "icon.ico" : "icon.png");

async function createWindow() {
    win = new BrowserWindow({
        width: 800,
        height: 600,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            preload: process.env.DEBUG ? path.join(cwd(), "dist", "preload.js") : path.join(cwd(), "preload.js"),
            nodeIntegration: false,
            contextIsolation: true,
        },
        transparent: false,
        backgroundColor: "#00000000",
        vibrancy: "under-window",
    });
    if (process.argv.includes("--hidden")) {
        win.hide();
    }

    // Checking if the app is running in production mode
    if (process.env.DEBUG !== "TRUE") {
        // Disabling top bar and dev tools
        win.setMenuBarVisibility(false);
        win.setMenu(null);
    }

    await win.loadFile(process.env.DEBUG ? "index.html" : "src/index.html");
    const client_repo = await win.webContents.executeJavaScript('localStorage.getItem("client_repo");');
    const branch = await win.webContents.executeJavaScript('localStorage.getItem("branch");');

    if (client_repo !== null && branch !== null) {
        await downloadOfflineVersion(client_repo, branch);
    }
}

ipcMain.handle("download-offline-version", async (event, repo: string, branch: string) => {
    await downloadOfflineVersion(repo, branch);
});

ipcMain.on("show-notification", async (_, { title, body, icon }) => {
    let img = null;

    if (icon?.startsWith("http")) {
        // Downloading icon if it's a URL
        try {
            icon = icon.replace(".webp", ".png");
            const res = await axios.get(icon, { responseType: "arraybuffer" });
            img = nativeImage.createFromBuffer(res.data);
        } catch (e) {
            console.warn("Failed to load icon from URL:", e);
        }
    } else if (icon) {
        // Just using if icon is a path
        img = nativeImage.createFromPath(icon);
    }

    new electron.Notification({ title, body, icon: img || iconPath }).show();
});

app.setName("MinDesktop");

// Adding app to autostart
app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: true,
    args: ["--hidden"],
});

app.whenReady().then(async () => {
    await createWindow();

    tray = new Tray(logo32Path);

    // Creating context menu for tray
    const contextMenu = Menu.buildFromTemplate([
        { icon: logo32Path, label: "Min Desktop", enabled: false }, // Semi-transparent icon with text
        { type: "separator" },
        { label: "Open Window", click: () => win.show() },
        { label: "Hide Window", click: () => win.hide() },
        {
            label: "Quit",
            click: () => {
                customApp.isQuiting = true;
                app.quit();
            },
        },
    ]);
    tray.setToolTip("Min Desktop");
    tray.setContextMenu(contextMenu);

    tray.on("double-click", () => win.show());

    win.on("close", (event) => {
        if (!customApp.isQuiting) {
            event.preventDefault();
            win.hide();
        }
    });

    if (process.argv.includes("--hidden")) {
        customApp.isQuiting = false;
        app.quit();
    }
});
