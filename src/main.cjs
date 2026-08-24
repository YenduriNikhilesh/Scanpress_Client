/**
 * main.cjs — Electron Main Process
 *
 * Everything the app needs to find and talk to LAN printers lives in
 * this single file: OS-native printer lookup, real mDNS/Bonjour
 * discovery, a real TCP port scan across the local /24, dedupe, a
 * reachability check used by "Connect", and an in-memory print-job
 * queue. No browser/web fallback, no separate discovery modules —
 * this is an Electron-only desktop app, and the renderer only ever
 * talks to it through preload.js's IPC bridge.
 */
'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const fs              = require('fs');
const https           = require('https');
const http            = require('http');
const { print }       = require('pdf-to-printer');
const tmp             = require('tmp');
const path            = require('path');
const os              = require('os');
const net             = require('net');
const dns             = require('dns').promises;
const dgram           = require('dgram');
const crypto          = require('crypto');
const { execSync }    = require('child_process');
const { EventEmitter } = require('events');

// ======================================================
// SumatraPDF Location
// ======================================================

const SUMATRA_PATH = path.join(
    __dirname,
    "..",
    "tools",
    "SumatraPDF",
    "SumatraPDF.exe"
);


const PRINTER_PORTS = [9100, 631, 515]; // RAW/JetDirect, IPP, LPD

/* ═══════════════════════════════════════════════════════════
   NETWORK INFO
   ═══════════════════════════════════════════════════════════ */
function getNetworkInfo() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254')) {
        const parts = iface.address.split('.');
        return { subnet: `${parts[0]}.${parts[1]}.${parts[2]}`, myIP: iface.address, interface: name };
      }
    }
  }
  return null;
}

function getMachineInfo() {
  const netInfo = getNetworkInfo();
  return {
    hostname:  os.hostname(),
    platform:  process.platform,
    myIP:      netInfo ? netInfo.myIP      : 'unknown',
    interface: netInfo ? netInfo.interface : 'unknown',
  };
}

/* ═══════════════════════════════════════════════════════════
   METHOD 1 — OS-NATIVE PRINTER LIST
   ═══════════════════════════════════════════════════════════ */

function getNativePrinters() {

    const list = [];

    try {

        const platform = process.platform;

        // =====================================================
        // WINDOWS
        // =====================================================
        if (platform === "win32") {

            const raw = execSync(
                `powershell -NoProfile -Command "Get-Printer | Select-Object Name,DriverName,PortName,Type,Shared,ComputerName | ConvertTo-Json -Compress"`,
                {
                    encoding: "utf8",
                    windowsHide: true,
                    timeout: 10000
                }
            );

            let printers = JSON.parse(raw);

            if (!Array.isArray(printers)) {
                printers = [printers];
            }

            console.log("=================================");
            console.log("Windows Installed Printers");
            console.log(printers);

            const ignoreWords = [
                "print to pdf",
                "pdf",
                "onenote",
                "xps",
                "fax",
                "document writer",
                "microsoft print",
                "virtual",
                "cutepdf",
                "adobe pdf"
            ];

            for (const printer of printers) {

                const name = (printer.Name || "").trim();
                const driver = (printer.DriverName || "").trim();
                const port = (printer.PortName || "").trim();

                if (!name) continue;

                const lowerName = name.toLowerCase();
                const lowerDriver = driver.toLowerCase();

                // Skip virtual printers
                if (
                    ignoreWords.some(word => lowerName.includes(word)) ||
                    ignoreWords.some(word => lowerDriver.includes(word))
                ) {
                    continue;
                }

                let ip = "";

                // Standard TCP/IP port
                const ipMatch = port.match(/(\d{1,3}(?:\.\d{1,3}){3})/);

                if (ipMatch) {
                    ip = ipMatch[1];
                }

                list.push({

                    // Exact Windows printer queue
                    printerName: name,

                    // UI name
                    displayName: name,

                    // Used throughout app
                    name: name,

                    driverName: driver,

                    portName: port,

                    ip,

                    source: "os",

                    status: "online"

                });

            }

        }

        // =====================================================
        // macOS / Linux
        // =====================================================

        else if (platform === "darwin" || platform === "linux") {

            const raw = execSync(
                "lpstat -p 2>/dev/null || true",
                {
                    timeout: 6000,
                    encoding: "utf8"
                }
            );

            for (const line of raw.split("\n")) {

                const m = line.match(/^printer\s+(\S+)/);

                if (!m) continue;

                const printerName = m[1];

                try {

                    const v = execSync(
                        `lpstat -v "${printerName}" 2>/dev/null || true`,
                        {
                            timeout: 3000,
                            encoding: "utf8"
                        }
                    );

                    let ip = "";

                    const ipMatch = v.match(/(\d{1,3}(?:\.\d{1,3}){3})/);

                    if (ipMatch) {
                        ip = ipMatch[1];
                    }

                    list.push({

                        printerName,

                        displayName: printerName,

                        name: printerName,

                        driverName: "",

                        portName: "",

                        ip,

                        source: "os",

                        status: "online"

                    });

                }
                catch (_) {}

            }

        }

    }
    catch (err) {

        console.error("getNativePrinters failed");

        console.error(err);

    }

    return list;

}
/* ═══════════════════════════════════════════════════════════
   METHOD 2 — mDNS / BONJOUR MULTICAST DISCOVERY
   ═══════════════════════════════════════════════════════════ */
function discoverMDNS(timeoutMs = 6000) {
  return new Promise((resolve) => {
    const found = new Map();

    function buildDNSQuery(serviceType) {
      const labels  = `${serviceType}.local`.split('.');
      const buffers = [Buffer.from([0,0, 0,0, 0,1, 0,0, 0,0, 0,0])];
      for (const label of labels) {
        if (label === '') continue;
        const b = Buffer.from(label, 'utf8');
        buffers.push(Buffer.from([b.length]), b);
      }
      buffers.push(Buffer.from([0x00]), Buffer.from([0x00, 0x0c, 0x80, 0x01]));
      return Buffer.concat(buffers);
    }

    function parseResponse(msg) {
      const names = [];
      try {
        let i = 12;
        while (i < msg.length - 1) {
          const len = msg[i];
          if (len === 0) { i++; break; }
          if ((len & 0xc0) === 0xc0) { i += 2; break; }
          if (len > 63 || i + 1 + len > msg.length) break;
          const label = msg.slice(i + 1, i + 1 + len).toString('utf8');
          if (!label.startsWith('_') && label !== 'local' && label.length > 1 && !/^[0-9]+$/.test(label)) {
            names.push(label);
          }
          i += 1 + len;
        }
      } catch (_) {}
      return { names };
    }

    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    const MDNS_ADDR = '224.0.0.251';
    const MDNS_PORT = 5353;

    sock.on('error', () => { try { sock.close(); } catch (_) {} resolve(Array.from(found.values())); });

    sock.on('message', (msg, rinfo) => {
      const { names } = parseResponse(msg);
      const ip = rinfo.address;
      if (!ip || ip.startsWith('0.') || ip === '255.255.255.255') return;
      if (!found.has(ip)) {
        const name = names.length ? names[0].replace(/-/g, ' ').replace(/\s+/g, ' ').trim() : `Network Printer (${ip})`;
        found.set(ip, { name, ip, source: 'mdns', status: 'online' });
      } else if (names.length) {
        const existing = found.get(ip);
        if (!existing.name || existing.name.startsWith('Network Printer')) {
          found.set(ip, { ...existing, name: names[0] });
        }
      }
    });

    sock.bind(MDNS_PORT, () => {
      try {
        sock.addMembership(MDNS_ADDR);
        sock.setMulticastTTL(255);
        sock.setBroadcast(true);
        const services = ['_ipp._tcp', '_printer._tcp', '_pdl-datastream._tcp', '_ipps._tcp', '_http._tcp'];
        services.forEach((svc, idx) => {
          setTimeout(() => { try { sock.send(buildDNSQuery(svc), MDNS_PORT, MDNS_ADDR, () => {}); } catch (_) {} }, idx * 300);
        });
      } catch (_) {
        try { sock.close(); } catch (_) {}
        resolve([]);
      }
    });

    setTimeout(() => { try { sock.close(); } catch (_) {} resolve(Array.from(found.values())); }, timeoutMs);
  });
}

/* ═══════════════════════════════════════════════════════════
   METHOD 3 — REAL TCP PORT SCAN ACROSS THE LOCAL /24
   ═══════════════════════════════════════════════════════════ */
function tcpScan(subnet, hostTimeoutMs = 600) {
  return new Promise((resolve) => {
    const found         = new Map();
    const pendingReverse = new Set();
    const total          = 254 * PRINTER_PORTS.length;
    let   completed      = 0;
    let   resolved       = false;

    const tryResolve = () => {
      completed++;
      if (completed >= total && !resolved) { resolved = true; resolve(Array.from(found.values())); }
    };

    for (let i = 1; i <= 254; i++) {
      const ip = `${subnet}.${i}`;
      for (const port of PRINTER_PORTS) {
        const sock = new net.Socket();
        sock.setTimeout(hostTimeoutMs);
        sock.connect(port, ip, () => {
          sock.destroy();
          if (!found.has(ip) && !pendingReverse.has(ip)) {
            pendingReverse.add(ip);
            dns.reverse(ip)
              .then((hostnames) => {
                const name = hostnames?.[0]
                  ? hostnames[0].replace(/\.local\.?$/, '').replace(/\.$/, '').split('.')[0].replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
                  : `Network Printer (${ip})`;
                if (!found.has(ip)) found.set(ip, { name, displayName: name, printerName: name, ip, source: 'tcp', port, status: 'online' });
              })
              .catch(() => { if (!found.has(ip)) found.set(ip, { name: `Network Printer (${ip})`, ip, source: 'tcp', port, status: 'online' }); })
              .finally(() => pendingReverse.delete(ip));
          }
        });
        sock.on('timeout', () => sock.destroy());
        sock.on('error',   () => sock.destroy());
        sock.on('close',   () => tryResolve());
      }
    }

    setTimeout(() => { if (!resolved) { resolved = true; resolve(Array.from(found.values())); } }, hostTimeoutMs * 2 + 5000);
  });
}

/* ═══════════════════════════════════════════════════════════
   DEDUPE + MERGE (by IP, OS result wins over mDNS wins over TCP)
   ═══════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════
   SMART MERGE (OS > mDNS > TCP)
   ═══════════════════════════════════════════════════════════ */

function normalizePrinterName(name = "") {
    return name
        .toLowerCase()
        .replace(/kyocera/g, "")
        .replace(/hp/g, "")
        .replace(/canon/g, "")
        .replace(/epson/g, "")
        .replace(/brother/g, "")
        .replace(/xerox/g, "")
        .replace(/ricoh/g, "")
        .replace(/lexmark/g, "")
        .replace(/pantum/g, "")
        .replace(/samsung/g, "")
        .replace(/sharp/g, "")
        .replace(/konica/g, "")
        .replace(/minolta/g, "")
        .replace(/toshiba/g, "")
        .replace(/oki/g, "")
        .replace(/dell/g, "")
        .replace(/\becosys\b/g, "ecosys")
        .replace(/\bprinter\b/g, "")
        .replace(/\bseries\b/g, "")
        .replace(/\bclass\b/g, "")
        .replace(/\bdriver\b/g, "")
        .replace(/[^a-z0-9]/g, "")
        .trim();
}

function mergePrinters(...lists) {

    const merged = [];

    const priority = {
        os: 3,
        mdns: 2,
        tcp: 1
    };

    const all = lists.flat();

    for (const printer of all) {

        if (!printer) continue;

        const printerIP = printer.ip || "";

        const normalized =
            normalizePrinterName(
                printer.printerName ||
                printer.displayName ||
                printer.name
            );

        let existing = merged.find(p => {

            if (printerIP && p.ip && printerIP === p.ip)
                return true;

            const pNorm =
                normalizePrinterName(
                    p.printerName ||
                    p.displayName ||
                    p.name
                );

           if (!normalized || !pNorm)
    return false;

if (normalized === pNorm)
    return true;

// One name contains the other
if (
    normalized.includes(pNorm) ||
    pNorm.includes(normalized)
)
    return true;

// Same model number
const model1 = normalized.match(/[a-z]{1,5}\d{3,6}[a-z]*/i);
const model2 = pNorm.match(/[a-z]{1,5}\d{3,6}[a-z]*/i);

if (
    model1 &&
    model2 &&
    model1[0] === model2[0]
)
    return true;

return false;

        });

        if (!existing) {

            merged.push({

                ip: printer.ip || "",

                name:
                    printer.displayName ||
                    printer.name,

                displayName:
                    printer.displayName ||
                    printer.name,

                printerName:
                    printer.printerName ||
                    printer.name,

                driverName:
                    printer.driverName || "",

                portName:
                    printer.portName || "",

                source:
                    printer.source,

                status:
                    printer.status || "online"

            });

            continue;

        }

        const existingPriority =
            priority[existing.source] || 0;

        const newPriority =
            priority[printer.source] || 0;

        if (newPriority >= existingPriority) {

            existing.source = printer.source;

            existing.status =
                printer.status ||
                existing.status;

            if (!existing.ip && printer.ip)
                existing.ip = printer.ip;

            if (
                printer.printerName &&
                printer.printerName.length
            ) {
                existing.printerName =
                    printer.printerName;
            }

            if (
                printer.displayName &&
                printer.displayName.length
            ) {
                existing.name =
                    printer.displayName;

                existing.displayName =
                    printer.displayName;
            }

            if (
                printer.driverName &&
                printer.driverName.length
            ) {
                existing.driverName =
                    printer.driverName;
            }

            if (
                printer.portName &&
                printer.portName.length
            ) {
                existing.portName =
                    printer.portName;
            }

        }

    }

    return merged.sort((a, b) => {

        const aa =
            parseInt((a.ip || "0.0.0.0").split(".").pop()) || 0;

        const bb =
            parseInt((b.ip || "0.0.0.0").split(".").pop()) || 0;

        return aa - bb;

    });

}
async function scanForPrinters() {
  const netInfo = getNetworkInfo();
  const [nativeList, mdnsList, tcpList] = await Promise.all([
    Promise.resolve().then(getNativePrinters).catch(() => []),
    discoverMDNS(6000).catch(() => []),
    netInfo ? tcpScan(netInfo.subnet, 600).catch(() => []) : Promise.resolve([]),
  ]);
  return mergePrinters(nativeList, mdnsList, tcpList);
}

/* ── reachability check, used by the Connect button + status polling ── */
function checkReachable(ip) {
  const tryPort = (port) => new Promise((res) => {
    const s = new net.Socket();
    s.setTimeout(4000);
    s.connect(port, ip, () => { s.destroy(); res({ reachable: true, port }); });
    s.on('timeout', () => { s.destroy(); res({ reachable: false, port }); });
    s.on('error',   () => { s.destroy(); res({ reachable: false, port }); });
  });
  return Promise.all(PRINTER_PORTS.map(tryPort)).then((results) => {
    const success = results.find(r => r.reachable);
    return success ? { reachable: true, ip, port: success.port } : { reachable: false, ip, port: null };
  });
}

/* ═══════════════════════════════════════════════════════════
   PRINT QUEUE — sends raw bytes straight to the printer's
   RAW/JetDirect port (9100 by default)
   ═══════════════════════════════════════════════════════════ */
const jobEmitter = new EventEmitter();
const jobs        = new Map();

function emitJobUpdate(job) { jobEmitter.emit('job-update', { ...job }); }

function queuePrintJob(ip, data, port = 9100) {
  if (!ip || !net.isIPv4(ip)) throw new Error('Invalid printer IP address');
  if (!Buffer.isBuffer(data) || data.length === 0) throw new Error('Print job has no data');

  const jobId = crypto.randomBytes(8).toString('hex');
  const job = { id: jobId, ip, port, status: 'queued', createdAt: Date.now(), error: null };
  jobs.set(jobId, job);
  emitJobUpdate(job);

  const sock = new net.Socket();
  sock.setTimeout(15000);

  job.status = 'sending';
  emitJobUpdate(job);

  sock.connect(port, ip, () => {
    sock.write(data, (err) => {
      if (err) {
        job.status = 'error';
        job.error  = err.message;
        emitJobUpdate(job);
        sock.destroy();
        return;
      }
      job.status = 'sent';
      emitJobUpdate(job);
      sock.end();
    });
  });

  sock.on('timeout', () => {
    if (job.status === 'cancelled') return;
    job.status = 'error';
    job.error  = 'Connection timed out';
    emitJobUpdate(job);
    sock.destroy();
  });

  sock.on('error', (err) => {
    if (job.status === 'cancelled') return;
    job.status = 'error';
    job.error  = err.message;
    emitJobUpdate(job);
  });

  return jobId;
}

function cancelJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) return false;
  // Can only cancel while still queued — once bytes are streaming to
  // the printer's socket, the job can't be recalled.
  if (job.status === 'queued') {
    job.status = 'cancelled';
    emitJobUpdate(job);
    return true;
  }
  return false;
}

/* ═══════════════════════════════════════════════════════════
   IPC HANDLERS — the only channel the renderer talks through
   ═══════════════════════════════════════════════════════════ */
ipcMain.handle('scan-printers', async () => {
  try { return await scanForPrinters(); }
  catch (e) { console.error('[Scan] error:', e); return []; }
});

ipcMain.handle('connect-printer', async (_event, ip) => {
  const result = await checkReachable(ip);
  if (!result.reachable) throw new Error(`Printer at ${ip} is not reachable`);
  return { success: true, ip, port: result.port };
});

ipcMain.handle('get-printer-status', async (_event, ip) => {
  const result = await checkReachable(ip);
  return { ip, online: result.reachable, port: result.port };
});

ipcMain.handle('print-job', async (_event, { ip, dataBase64, port }) => {
    const buffer = Buffer.from(dataBase64, 'base64');
    return {
        jobId: queuePrintJob(ip, buffer, port || 9100)
    };
});

// ======================================================
// Print File From Signed URL
// ======================================================

ipcMain.handle("print-file", async (_event, job) => {

    try {

        console.log("=================================");
        console.log("Electron Print Started");
        console.log(job);

        const {
            url,
            fileName,
            extension,
            printerName,
            printerIP,
            copies = 1,
            paperSize = "A4",
            colorMode = "Color",
            duplex = "1-sided"
        } = job;

        console.log("fileName =", fileName);
console.log("extension =", extension);
console.log("path.extname(fileName) =", path.extname(fileName));

let ext = extension || path.extname(fileName);

if (ext && !ext.startsWith(".")) {
    ext = "." + ext;
}

console.log("Final ext =", ext);

        const tempFile = path.join(
            os.tmpdir(),
            `ScanPress-${Date.now()}${ext}`
        );

        console.log("Downloading...");
        console.log(tempFile);

        await downloadFile(
            url,
            tempFile
        );

        const fs = require("fs");

console.log("Exists:", fs.existsSync(tempFile));

const stat = fs.statSync(tempFile);

console.log("Downloaded Size:", stat.size);

const firstBytes = fs.readFileSync(tempFile).subarray(0, 32);

console.log("First Bytes:", firstBytes);

        console.log("Download Complete");

        console.log("Printer Name:", printerName);
        console.log("Printer IP:", printerIP);

        console.log("Starting Sumatra Print...");

        await printWithSumatra(tempFile, {
            printerName,
            copies,
            paperSize,
            colorMode,
            duplex
        });

        console.log("Printing Finished");

        return {
            success: true,
            tempFile
        };

    } catch (err) {

        console.error(err);

        return {
            success: false,
            error: err.message
        };

    }

});

ipcMain.handle('cancel-job', async (_event, jobId) => {
    return {
        cancelled: cancelJob(jobId)
    };
});

ipcMain.handle('get-machine-id', () => getMachineInfo());

// ======================================================
/* Forward live job-status updates to every renderer window */
// ======================================================

jobEmitter.on('job-update', (job) => {
    for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send(
            'printer-status-update',
            {
                type: 'job-update',
                payload: job
            }
        );
    }
});

/* ═══════════════════════════════════════════════════════════
   WINDOW
   ═══════════════════════════════════════════════════════════ */
function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,
    },
    backgroundColor: '#060c16',
    titleBarStyle:   'default',
    show: false,
  });

  win.once('ready-to-show', () => win.show());

  const isDev = !app.isPackaged;

if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
} else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// ======================================================
// Download file from Signed URL
// ======================================================

function downloadFile(url, destination) {
    return new Promise((resolve, reject) => {

        const file = fs.createWriteStream(destination);

        https.get(url, (response) => {

            if (response.statusCode !== 200) {
                reject(new Error(`Download failed (${response.statusCode})`));
                return;
            }

            response.pipe(file);

            file.on("finish", () => {
                file.close(() => resolve());
            });

        }).on("error", (err) => {

            fs.unlink(destination, () => {});
            reject(err);

        });

    });
}

// ======================================================
// Print using SumatraPDF
// ======================================================

async function printWithSumatra(filePath, options = {}) {

    return new Promise((resolve, reject) => {

        try {

            const {
                printerName,
                copies = 1
            } = options;

            if (!printerName) {
                throw new Error("No printer selected.");
            }

            const args = [
                "-print-to",
                printerName,
                "-silent",
                filePath
            ];

            const { spawn } = require("child_process");

            console.log("=================================");
            console.log("Sumatra Command");
            console.log(SUMATRA_PATH);
            console.log(args);

            const process = spawn(
                SUMATRA_PATH,
                args,
                {
                    windowsHide: true,
                    detached: false
                }
            );

            process.on("error", reject);

            process.on("exit", (code) => {

                if (code === 0) {

                    resolve();

                } else {

                    reject(
                        new Error(
                            `Sumatra exited with code ${code}`
                        )
                    );

                }

            });

        } catch (err) {

            reject(err);

        }

    });

}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});