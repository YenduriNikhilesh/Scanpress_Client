/**
 * preload.js — Electron Preload Script
 *
 * Thin secure bridge only. All real logic (scanning, mDNS, TCP probing,
 * printing) lives in main.js. The renderer never gets ipcRenderer,
 * require, fs, net, or child_process — only the specific functions
 * exposed below.
 */

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('printerAPI', {

    // ============================
    // Printer Discovery
    // ============================

    scanPrinters: () =>
        ipcRenderer.invoke('scan-printers'),

    connectPrinter: (ip) =>
        ipcRenderer.invoke('connect-printer', ip),

    getStatus: (ip) =>
        ipcRenderer.invoke('get-printer-status', ip),

    getMachineInfo: () =>
        ipcRenderer.invoke('get-machine-id'),

    // ============================
    // Existing Raw Print
    // ============================

    print: (ip, dataBase64, port) =>
        ipcRenderer.invoke('print-job', {
            ip,
            dataBase64,
            port
        }),

    // ============================
    // New File Printing
    // ============================

    printFile: (printJob) =>
        ipcRenderer.invoke('print-file', printJob),

    cancelJob: (jobId) =>
        ipcRenderer.invoke('cancel-job', jobId),

    // ============================
    // Live Status Updates
    // ============================

    onStatusUpdate: (callback) => {

        const listener = (_event, message) => {
            callback(message);
        };

        ipcRenderer.on(
            'printer-status-update',
            listener
        );

        return () => {
            ipcRenderer.removeListener(
                'printer-status-update',
                listener
            );
        };

    }

});