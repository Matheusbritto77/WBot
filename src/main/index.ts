console.log('--- MAIN PROCESS STARTING ---');
import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { setupIpc } from './ipc'
import { botController } from './controllers/BotController'
import { databaseService } from './services/DatabaseService'
import { webService } from './services/WebService'
import { IS_HEADLESS } from './utils/paths'

function createWindow(): void {
    console.log('--- createWindow called ---');
    let preloadPath = join(__dirname, '../preload/index.js')

    if (!existsSync(preloadPath)) {
        preloadPath = join(__dirname, '../preload/index.mjs')
    }

    console.log('Using preload path:', preloadPath)
    console.log('Preload path exists:', existsSync(preloadPath))

    const mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        show: false,
        autoHideMenuBar: true,
        webPreferences: {
            preload: preloadPath,
            sandbox: false,
            contextIsolation: true,
            nodeIntegration: false
        }
    })

    mainWindow.on('ready-to-show', () => {
        mainWindow.show()
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return { action: 'deny' }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
}

app.whenReady().then(() => {
    console.log('--- app ready ---');
    electronApp.setAppUserModelId('com.electron.bot')

    app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
    })

    // Init DB and controller
    databaseService.init()
    setupIpc()
    botController.init()
    webService.init()

    if (!IS_HEADLESS) {
        createWindow()
    } else {
        console.log('--- HEADLESS MODE DETECTED: Skipping window creation ---');
    }

    app.on('activate', function () {
        if (!IS_HEADLESS && BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' && !IS_HEADLESS) {
        app.quit()
    }
})
