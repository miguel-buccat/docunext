import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openNewWindow: (routePath: string, width: number, height: number) => ipcRenderer.send('open-new-window', routePath, width, height),
  closeCurrentWindow: () => ipcRenderer.send('close-current-window'),
  uploadDocs: () => ipcRenderer.invoke('upload-docs'),
  createSession: (paths: string[]) => ipcRenderer.send('create-session', paths)
});