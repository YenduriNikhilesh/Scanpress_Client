/**
 * ==========================================================
 * PrintService
 * ----------------------------------------------------------
 * Single entry point for every print operation.
 *
 * Flow
 * Customer
 *    ↓
 * Supabase Storage
 *    ↓
 * Signed URL
 *    ↓
 * Electron / Browser
 * ==========================================================
 */

import { supabase } from "./supabase";

class PrintService {

    // ==========================================================
    // Detect Platform
    // ==========================================================
    static getPlatform() {

        if (window.printerAPI) {
            return "electron";
        }

        const ua = navigator.userAgent.toLowerCase();

        if (ua.includes("android")) {
            return "android";
        }

        if (
            ua.includes("iphone") ||
            ua.includes("ipad") ||
            ua.includes("ipod")
        ) {
            return "ios";
        }

        return "browser";
    }

    // ==========================================================
    // Create Temporary Signed URL
    // ==========================================================
    static async getSignedUrl(filePath) {

        const { data, error } = await supabase
            .storage
            .from("ScanPress-temp")
            .createSignedUrl(filePath, 60);

        if (error) {
            throw new Error(error.message);
        }

        return data.signedUrl;
    }

    // ==========================================================
    // Main Print Function
    // ==========================================================
    static async print(job) {

        try {

            const platform = this.getPlatform();

            console.log("=================================");
            console.log("PrintService Started");
            console.log("Platform:", platform);

            const file = job.file;

            console.log("Customer File:");
            console.log(file);

            if (!file) {
                throw new Error("Job file missing.");
            }

            if (!file.path) {
                throw new Error("File path missing.");
            }

            //--------------------------------------------------
            // Generate Signed URL
            //--------------------------------------------------

            const signedUrl = await this.getSignedUrl(file.path);

            console.log("Signed URL:");
            console.log(signedUrl);

            //--------------------------------------------------
            // ELECTRON
            //--------------------------------------------------

            if (platform === "electron") {

                if (!window.printerAPI) {
                    throw new Error("printerAPI unavailable.");
                }

                if (!window.printerAPI.printFile) {
                    throw new Error("printerAPI.printFile unavailable.");
                }

                console.log("Calling Electron printFile...");

                // Read connected printer from Printer Hub
const connectedPrinter = JSON.parse(
    localStorage.getItem("connectedPrinter") || "null"
);

console.log("Connected Printer:");
console.log(connectedPrinter);

const result = await window.printerAPI.printFile({

    url: signedUrl,

    fileName: file.name,

    extension: file.ext,

    printerName: connectedPrinter?.printerName ?? connectedPrinter?.name ?? null,

    printerIP: connectedPrinter?.ip ?? null,

    copies: job.copies ?? 1,

    paperSize: job.size ?? "A4",

    colorMode: job.mode ?? "color",

    duplex: job.side ?? "single"

});

                console.log("Electron Result:");
                console.log(result);

                return result;
            }

            //--------------------------------------------------
            // Browser / Android / iPhone
            //--------------------------------------------------

            console.log("Opening browser fallback...");

            window.open(signedUrl, "_blank");

            return {

                success: true,
                fallback: true,
                signedUrl

            };

        }
        catch (err) {

            console.error("PrintService Error:");
            console.error(err);

            return {

                success: false,
                error: err.message

            };

        }

    }

}

export default PrintService;