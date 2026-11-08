import fs from "node:fs";
import path from "path";
import os from "os";

const APP_NAME = "98router";
const LEGACY_APP_NAME = "9router";

export function restoreFromLegacy(legacyDir, newDir) {
  try {
    if (!fs.existsSync(legacyDir)) return;
    const newDbFile = path.join(newDir, "db", "data.sqlite");
    if (fs.existsSync(newDbFile)) return;

    console.log(`[98router] Existing 9router directory found at ${legacyDir}. Backing up and restoring to ${newDir}...`);
    fs.mkdirSync(newDir, { recursive: true });
    fs.cpSync(legacyDir, newDir, { recursive: true, errorOnExist: false });

    const legacyDb = path.join(legacyDir, "db", "data.sqlite");
    if (fs.existsSync(legacyDb)) {
      const backupsDir = path.join(newDir, "db", "backups");
      fs.mkdirSync(backupsDir, { recursive: true });
      fs.copyFileSync(legacyDb, path.join(backupsDir, `backup-from-9router-${Date.now()}.sqlite`));
    }
    console.log(`[98router] Successfully restored and backed up data into ${newDir}.`);
  } catch (err) {
    console.warn(`[98router] Failed to restore from 9router: ${err.message}`);
  }
}

function defaultDir() {
  const newDir = process.platform === "win32"
    ? path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), APP_NAME)
    : path.join(os.homedir(), `.${APP_NAME}`);
  const legacyDir = process.platform === "win32"
    ? path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), LEGACY_APP_NAME)
    : path.join(os.homedir(), `.${LEGACY_APP_NAME}`);

  restoreFromLegacy(legacyDir, newDir);
  return newDir;
}

export function getDataDir() {
  const configured = process.env.DATA_DIR;
  if (!configured) return defaultDir();

  // On Windows, ignore Unix-style absolute paths (e.g. /var/lib/...) that come
  // from a Linux-targeted .env or Docker config — they are not valid here.
  if (process.platform === "win32" && /^\//.test(configured)) {
    console.warn(`[DATA_DIR] '${configured}' is a Unix path on Windows → fallback to default`);
    return defaultDir();
  }

  try {
    fs.mkdirSync(configured, { recursive: true });
    return configured;
  } catch (e) {
    if (e?.code === "EACCES" || e?.code === "EPERM") {
      console.warn(`[DATA_DIR] '${configured}' not writable → fallback ~/.${APP_NAME}`);
      return defaultDir();
    }
    throw e;
  }
}

export const DATA_DIR = getDataDir();
