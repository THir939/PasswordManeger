import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("pmDesktop", {
  call(action, payload = {}) {
    return ipcRenderer.invoke("pm:action", { action, ...payload });
  },
  openExternal(url) {
    return ipcRenderer.invoke("pm:open-external", url);
  },
  openPath(targetPath) {
    return ipcRenderer.invoke("pm:open-path", targetPath);
  },
  copyText(text) {
    return ipcRenderer.invoke("pm:copy", text);
  },
  getPlatformInfo() {
    return ipcRenderer.invoke("pm:platform");
  }
});
