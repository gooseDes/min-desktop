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

config({ quiet: true });

const customApp = app as electron.App & { isQuiting: boolean };
customApp.isQuiting = false;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function downloadOfflineVersion(repo: string, branch: string) {
    const targetDir = path.resolve(path.join(app.getPath("userData"), "site"));
    await rm(targetDir, { recursive: true, force: true });
    await fs.promises.mkdir(targetDir, { recursive: true });
    await git.clone({
        fs,
        http,
        dir: targetDir,
        url: repo,
        singleBranch: true,
        ref: branch,
        depth: 1,
    });
    await win.loadFile(path.join(targetDir, "index.html"));
    win.maximize();
}

let win: electron.BrowserWindow;
let tray: electron.Tray;

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

    if (process.env.DEBUG !== "TRUE") {
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

ipcMain.on("show-notification", (_, { title, body, icon }) => {
    new electron.Notification({ title, body, icon }).show();
});

app.setName("MinDesktop");

app.whenReady().then(async () => {
    await createWindow();

    let iconPath: string;
    if (process.env.DEBUG) {
        iconPath = path.join(__dirname, "..", "assets", "logo512.png");
    } else {
        if (process.resourcesPath) {
            iconPath = path.join(process.resourcesPath, "assets", "logo512.png");
        } else {
            iconPath = path.join(app.getAppPath(), "assets", "logo512.png");
        }
    }

    tray = new Tray(iconPath);

    const contextMenu = Menu.buildFromTemplate([
        { label: "Open", click: () => win.show() },
        {
            label: "Exit",
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
});
