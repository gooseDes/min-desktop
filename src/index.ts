import * as electron from "electron";
const { app, BrowserWindow, ipcMain } = electron;
import simpleGit from "simple-git";
import path from "path";
import { rm } from "fs/promises";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import { cwd } from "process";
config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function downloadOfflineVersion(repo: string, branch: string) {
    const targetDir = path.resolve(path.join(app.getPath("userData"), "site"));
    await rm(targetDir, { recursive: true, force: true });
    const git = simpleGit();
    await git.clone(repo, targetDir, ["--branch", branch, "--single-branch"]);
    await win.loadFile(path.join(targetDir, "index.html"));
    win.maximize();
}

let win: electron.BrowserWindow;

function createWindow() {
    win = new BrowserWindow({
        width: 800,
        height: 600,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            preload: process.env.DEBUG ? path.join(cwd(), "dist", "preload.js") : path.join(app.getAppPath(), "dist", "preload.js"),
            nodeIntegration: false,
            contextIsolation: true,
        },
        transparent: true,
        backgroundColor: "#00000000",
        vibrancy: "under-window",
    });

    if (!process.env.DEBUG || process.env.DEBUG !== "TRUE") {
        win.setMenuBarVisibility(false);
        win.setMenu(null);
    }
    
    win.loadFile(process.env.DEBUG ? "index.html" : "src/index.html");
}

ipcMain.handle("download-offline-version", async (event, repo: string, branch: string) => {
    await downloadOfflineVersion(repo, branch);
});

app.setName("MinDesktop");

app.whenReady().then(() => {
    createWindow();
});
