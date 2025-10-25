const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
    downloadAndRun: (repo: string, branch: string) => {
        ipcRenderer.invoke("download-offline-version", repo, branch);
        console.log(repo, branch);
    },
    notify: (title: string, body: string, icon: string) => {
        ipcRenderer.send("show-notification", { title, body, icon });
    },
});
