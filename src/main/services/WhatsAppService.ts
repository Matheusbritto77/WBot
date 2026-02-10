import * as BaileysModule from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import path from 'path';
import pino from 'pino';
import { EventEmitter } from 'events';
import { getDataPath } from '../utils/paths';

function getSocketFactory(b: any) {
    if (typeof b.default === 'function') return b.default;
    if (typeof b.makeWASocket === 'function') return b.makeWASocket;
    if (b.default && typeof b.default.default === 'function') return b.default.default;
    if (b.default && typeof b.default.makeWASocket === 'function') return b.default.makeWASocket;
    if (typeof b === 'function') return b;
    return null;
}

export class WhatsAppService extends EventEmitter {
    private socket: any;
    private qr: string | null = null;
    private status: 'connecting' | 'connected' | 'disconnected' = 'disconnected';
    private connectionTimeout: any = null;
    private lastEmitTime: number = 0;
    private emitDebounce: any = null;
    private isInitializing: boolean = false;

    constructor() {
        super();
    }

    private stabilizedEmitStatus(newStatus: 'connecting' | 'connected' | 'disconnected') {
        if (this.status === newStatus && Date.now() - this.lastEmitTime < 5000) return;

        this.status = newStatus;
        if (this.emitDebounce) clearTimeout(this.emitDebounce);

        const delay = newStatus === 'connected' ? 0 : 2000; // Immediate for connected, delayed for others

        this.emitDebounce = setTimeout(() => {
            this.lastEmitTime = Date.now();
            this.emit('status', this.status);
        }, delay);
    }

    async connect() {
        if (this.isInitializing || this.status === 'connected') return;

        this.isInitializing = true;
        this.stabilizedEmitStatus('connecting');

        try {
            console.log('[WhatsAppService] Iniciando tentativa de conexão...');
            const authPath = path.join(getDataPath(), 'baileys_auth');

            const b = BaileysModule as any;
            const useMultiFileAuthState = b.useMultiFileAuthState || (b.default && b.default.useMultiFileAuthState) || (b.default && b.default.default && b.default.default.useMultiFileAuthState);
            const fetchLatestBaileysVersion = b.fetchLatestBaileysVersion || (b.default && b.default.fetchLatestBaileysVersion) || (b.default && b.default.default && b.default.default.fetchLatestBaileysVersion);

            const { state, saveCreds } = await useMultiFileAuthState(authPath);
            const { version } = await fetchLatestBaileysVersion();
            const socketFactory = getSocketFactory(b);

            if (this.socket) {
                try { this.socket.ev.removeAllListeners('connection.update'); } catch (e) { }
            }

            this.socket = socketFactory({
                version,
                printQRInTerminal: false,
                auth: state,
                logger: pino({ level: 'silent' }),
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 30000,
                emitOwnEvents: true,
                retryRequestDelayMs: 5000
            });

            this.socket.ev.on('creds.update', saveCreds);

            this.socket.ev.on('connection.update', (update: any) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    this.qr = qr;
                    this.emit('qr', qr);
                }

                const DisconnectReason = b.DisconnectReason || (b.default && b.default.DisconnectReason) || (b.default && b.default.default && b.default.default.DisconnectReason);

                if (connection === 'close') {
                    const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                    console.log(`[WhatsAppService] Conexão encerrada. Status: ${statusCode}. Reenviando em 30s: ${shouldReconnect}`);

                    this.stabilizedEmitStatus('disconnected');
                    this.socket = null;
                    this.isInitializing = false;

                    if (shouldReconnect) {
                        if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
                        this.connectionTimeout = setTimeout(() => this.connect(), 30000);
                    }
                } else if (connection === 'open') {
                    console.log('[WhatsAppService] STATUS: CONECTADO');
                    this.stabilizedEmitStatus('connected');
                    this.qr = null;
                    this.emit('qr', null);
                    this.isInitializing = false;
                    if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
                }
            });

            this.socket.ev.on('messages.upsert', async (m: any) => {
                const msg = m.messages[0];
                if (!msg.message) return;
                this.emit('message', msg);
            });

        } catch (err: any) {
            console.error('[WhatsAppService] Erro ao conectar:', err.message);
            this.isInitializing = false;
            this.stabilizedEmitStatus('disconnected');
        }
    }

    async sendMessage(jid: string, content: any) {
        if (!this.socket || this.status !== 'connected') return;
        await this.socket.sendMessage(jid, content);
    }

    getStatus() {
        return this.status;
    }

    getQR() {
        return this.qr;
    }

    async logout() {
        if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
        if (this.socket) {
            try { await this.socket.logout(); } catch (e) { }
            this.socket = null;
        }
        this.status = 'disconnected';
        this.emit('status', 'disconnected');
        this.qr = null;
        this.isInitializing = false;
    }

    private groupsCache: { data: any[], timestamp: number } | null = null;
    private readonly GROUPS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    async getGroups(forceRefresh = false) {
        if (!this.socket || this.status !== 'connected') return [];

        if (!forceRefresh && this.groupsCache && Date.now() - this.groupsCache.timestamp < this.GROUPS_CACHE_TTL) {
            return this.groupsCache.data;
        }

        try {
            const chats = await this.socket.groupFetchAllParticipating() || {};
            const groups = Object.values(chats).map((group: any) => ({
                id: group.id,
                subject: group.subject
            }));

            this.groupsCache = {
                data: groups,
                timestamp: Date.now()
            };

            return groups;
        } catch (e) {
            console.error('Error fetching groups:', e);
            return this.groupsCache ? this.groupsCache.data : [];
        }
    }
}

export const whatsappService = new WhatsAppService();
