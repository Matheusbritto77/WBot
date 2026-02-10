import { ipcMain, BrowserWindow } from 'electron';
import { databaseService } from './services/DatabaseService';
import { whatsappService } from './services/WhatsAppService';
import { cronService } from './services/CronService';
import { loopService } from './services/LoopService';
import { authSecurityService } from './services/AuthSecurityService';
import { settingsService } from './services/SettingsService';
import { automationService } from './services/AutomationService';

export function setupIpc() {
    // Auth
    ipcMain.handle('auth:login', async (_, { username, password }) => {
        // Validate character counts (Security)
        const val = authSecurityService.validateCredentials(username, password);
        if (!val.valid) throw new Error(val.error);

        // Check attempts (Rate Limiting)
        if (!authSecurityService.canAttempt(username)) {
            throw new Error('Muitas tentativas falhas. Aguarde 15 minutos.');
        }

        const user = databaseService.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);

        if (user) {
            authSecurityService.recordSuccess(username);
            return user;
        } else {
            authSecurityService.recordFailure(username);
            return null;
        }
    });

    ipcMain.handle('auth:register', async (_, { username, password }) => {
        // Validate character counts
        const val = authSecurityService.validateCredentials(username, password);
        if (!val.valid) return { success: false, error: val.error };

        try {
            databaseService.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, password]);
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    });

    // Settings
    ipcMain.handle('settings:get', async (_, key) => {
        return settingsService.get(key);
    });

    ipcMain.handle('settings:set', async (_, { key, value }) => {
        settingsService.set(key, value);
        return { success: true };
    });

    // WhatsApp
    ipcMain.handle('whatsapp:get-status', () => {
        return whatsappService.getStatus();
    });

    ipcMain.handle('whatsapp:get-qr', () => {
        return whatsappService.getQR();
    });

    ipcMain.handle('whatsapp:logout', async () => {
        await whatsappService.logout();
        return { success: true };
    });

    ipcMain.handle('whatsapp:connect', async () => {
        await whatsappService.connect();
        return { success: true };
    });

    ipcMain.handle('whatsapp:get-groups', async (_, forceRefresh = false) => {
        return await whatsappService.getGroups(forceRefresh);
    });

    ipcMain.handle('stats:get-summary', async () => {
        const total = databaseService.getStat('total_messages');
        const monthly = databaseService.getStat('monthly_messages');
        const model = databaseService.getSetting('gemini_model') || 'gemini-1.5-flash';

        let groupsCount = 0;
        try {
            const groups = await whatsappService.getGroups(false);
            groupsCount = groups.length;
        } catch (e) {
            console.error('Error fetching groups count:', e);
        }

        return {
            totalMessages: total,
            monthlyMessages: monthly,
            groupsCount: groupsCount,
            modelName: model
        };
    });

    // ========== MCP SERVERS ==========
    ipcMain.handle('mcp:getAll', () => {
        return databaseService.query('SELECT * FROM mcp_servers ORDER BY created_at DESC');
    });

    ipcMain.handle('mcp:add', (_, server) => {
        databaseService.run(
            'INSERT INTO mcp_servers (id, name, type, url, command, args) VALUES (?, ?, ?, ?, ?, ?)',
            [server.id, server.name, server.type, server.url || null, server.command || null, server.args || null]
        );
        return { success: true };
    });

    ipcMain.handle('mcp:remove', (_, id) => {
        databaseService.run('DELETE FROM mcp_servers WHERE id = ?', [id]);
        return { success: true };
    });

    ipcMain.handle('mcp:toggle', (_, { id, enabled }) => {
        databaseService.run('UPDATE mcp_servers SET enabled = ? WHERE id = ?', [enabled ? 1 : 0, id]);
        return { success: true };
    });

    // ========== CRON JOBS ==========
    ipcMain.handle('cron:getAll', () => {
        return cronService.getAll();
    });

    ipcMain.handle('cron:add', (_, job) => {
        cronService.add(job);
        return { success: true };
    });

    ipcMain.handle('cron:remove', (_, id) => {
        cronService.remove(id);
        return { success: true };
    });

    ipcMain.handle('cron:toggle', (_, { id, enabled }) => {
        cronService.toggle(id, enabled);
        return { success: true };
    });

    // ========== LOOP TASKS ==========
    ipcMain.handle('loop:getAll', () => {
        return loopService.getAll();
    });

    ipcMain.handle('loop:add', (_, task) => {
        loopService.add(task);
        return { success: true };
    });

    ipcMain.handle('loop:remove', (_, id) => {
        loopService.remove(id);
        return { success: true };
    });

    ipcMain.handle('loop:start', (_, id) => {
        loopService.start(id);
        return { success: true };
    });

    ipcMain.handle('loop:stop', (_, id) => {
        loopService.stop(id);
        return { success: true };
    });

    ipcMain.handle('loop:get', (_, id) => {
        return loopService.get(id);
    });

    // Events Bridge
    whatsappService.on('status', (status) => {
        const wins = BrowserWindow.getAllWindows();
        wins.forEach((w: BrowserWindow) => w.webContents.send('whatsapp:status-changed', status));
    });

    whatsappService.on('qr', (qr) => {
        const wins = BrowserWindow.getAllWindows();
        wins.forEach((w: BrowserWindow) => w.webContents.send('whatsapp:qr-received', qr));
    });

    whatsappService.on('activity', (data) => {
        const wins = BrowserWindow.getAllWindows();
        wins.forEach((w: BrowserWindow) => w.webContents.send('whatsapp:activity', data));
    });

    loopService.on('status', (data) => {
        const wins = BrowserWindow.getAllWindows();
        wins.forEach((w: BrowserWindow) => w.webContents.send('loop:status-changed', data));
    });

    loopService.on('progress', (data) => {
        const wins = BrowserWindow.getAllWindows();
        wins.forEach((w: BrowserWindow) => w.webContents.send('loop:progress', data));
    });

    // ========== AUTOMATION FLOWS ==========
    ipcMain.handle('automation:getAll', () => automationService.getAll());
    ipcMain.handle('automation:get', (_, id) => automationService.getById(id));
    ipcMain.handle('automation:save', (_, flow) => automationService.save(flow));
    ipcMain.handle('automation:remove', (_, id) => {
        automationService.remove(id);
        return { success: true };
    });
    ipcMain.handle('automation:toggle', (_, { id, enabled }) => {
        automationService.toggle(id, enabled);
        return { success: true };
    });

    // Init cron service
    cronService.init();
}

