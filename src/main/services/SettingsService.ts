import { BrowserWindow } from 'electron';
import { databaseService } from './DatabaseService';

export class SettingsService {
    public get(key: string): string | null {
        return databaseService.getSetting(key);
    }

    public set(key: string, value: string) {
        databaseService.setSetting(key, value);
        this.notify(key, value);
    }

    private notify(key: string, value: any) {
        const wins = BrowserWindow.getAllWindows();
        wins.forEach((w: BrowserWindow) => {
            if (!w.isDestroyed()) {
                w.webContents.send('settings:changed', { key, value });
            }
        });
    }

    private normalizeJid(id: string): string {
        id = id.trim();
        if (!id) return '';
        if (id.includes('@')) return id;
        // Assume it's a private number if no @ is present
        return `${id}@s.whatsapp.net`;
    }

    public getBlockedContacts(): string[] {
        const raw = this.get('blocked_contacts') || '';
        return raw.split(',').map(s => s.trim()).filter(Boolean).map(id => this.normalizeJid(id));
    }

    public blockContact(jid: string) {
        const normalized = this.normalizeJid(jid);
        const list = this.getBlockedContacts();
        if (!list.includes(normalized)) {
            const newList = [...list, normalized].join(', ');
            this.set('blocked_contacts', newList);
            console.log(`[SettingsService] Contato bloqueado: ${normalized}`);
        }
    }

    public unblockContact(jid: string) {
        const normalized = this.normalizeJid(jid);
        const list = this.getBlockedContacts();
        const updated = list.filter(id => id !== normalized);
        this.set('blocked_contacts', updated.join(', '));
        console.log(`[SettingsService] Contato desbloqueado: ${normalized}`);
    }
}

export const settingsService = new SettingsService();
