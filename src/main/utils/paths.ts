import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Check if we are running in Electron
const isElectron = !!process.versions.electron;

// Detect Headless Mode (CLI/VPS)
export const IS_HEADLESS = !isElectron || process.env.HEADLESS === 'true';

/**
 * Gets the base path for storing persistent data.
 * In Electron, it uses the appData directory.
 * In Headless/Server mode, it uses the current working directory or an env var.
 */
export function getDataPath(): string {
    if (isElectron && !IS_HEADLESS) {
        // We can't use type import here because it might be executed in a non-electron environment
        const { app } = require('electron');
        return app.getPath('userData');
    }

    // fallback for VPS/Dokploy
    const vpsPath = process.env.DATA_PATH || join(process.cwd(), 'data');
    if (!existsSync(vpsPath)) {
        mkdirSync(vpsPath, { recursive: true });
    }
    return vpsPath;
}
