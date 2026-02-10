import { whatsappService } from '../services/WhatsAppService';
import { aiService } from '../services/AIService';
import { databaseService } from '../services/DatabaseService';
import { settingsService } from '../services/SettingsService';
import { automationService } from '../services/AutomationService';
import { downloadMediaMessage } from '@whiskeysockets/baileys';

export class BotController {
    private initialized = false;
    private seenJids = new Set<string>();

    public init() {
        if (this.initialized) return;
        this.initialized = true;

        whatsappService.on('message', async (msg) => {
            try {
                await this.handleMessage(msg);
            } catch (error) {
                console.error('Error handling message:', error);
            }
        });

        whatsappService.connect();
        console.log('BotController initialized and connecting to WhatsApp...');
    }

    async handleMessage(msg: any) {
        const jid = msg.key.remoteJid;
        if (!jid) return;

        // Ignorar mensagens de newsletters e broadcasts
        if (jid.endsWith('@newsletter') || jid.endsWith('@broadcast')) return;

        console.log('[BotController] Received message from:', jid);

        // Lazy init database if needed
        databaseService.init();

        // Check if auto reply is enabled
        const autoReply = databaseService.getSetting('auto_reply');
        if (autoReply === 'false') return;

        const isGroup = jid.endsWith('@g.us');

        const respondGroups = databaseService.getSetting('respond_groups') === 'true';
        if (isGroup && !respondGroups) return;

        const allowedGroupsRaw = databaseService.getSetting('allowed_groups') || '';
        const allowedGroups = allowedGroupsRaw.split(',').map(s => s.trim()).filter(s => s);
        if (isGroup && allowedGroups.length > 0 && !allowedGroups.includes(jid)) return;

        const body = msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            msg.message.imageMessage?.caption ||
            '';

        // 1. Verificar lista de contatos bloqueados
        const blockedContacts = settingsService.getBlockedContacts();
        if (blockedContacts.includes(jid)) {
            console.log(`[BotController] JID ${jid} está na lista negra. Ignorando.`);
            return;
        }

        // 2. Verificar comando de bloqueio vindo do próprio dono (bot/self)
        const blockWord = (settingsService.get('block_word') || 'parar').toLowerCase().trim();
        const normalizedBody = body.toLowerCase().trim();

        if (msg.key.fromMe && normalizedBody === blockWord) {
            console.log(`[BotController] Comando de bloqueio "${blockWord}" enviado pelo dono no chat ${jid}.`);
            settingsService.blockContact(jid);
            return;
        }

        // 3. Ignorar mensagens do próprio bot (evitar loop de IA)
        if (msg.key.fromMe) return;

        // 4. Verificar palavra de bloqueio enviada pelo contato
        if (blockWord && normalizedBody.includes(blockWord)) {
            console.log(`[BotController] Palavra de bloqueio "${blockWord}" detectada! Bloqueando ${jid}.`);
            settingsService.blockContact(jid);
            return; // Interrompe a resposta atual
        }

        // 5. Verificar fluxos de automação
        const isFirstMessage = !this.seenJids.has(jid);
        if (isFirstMessage) this.seenJids.add(jid);

        const hasMedia = !!msg.message.imageMessage || !!msg.message.videoMessage || !!msg.message.audioMessage;
        const matchingResult = automationService.findMatchingFlow(body, isFirstMessage, hasMedia);

        if (matchingResult) {
            const { flow, triggerNodeId } = matchingResult;
            console.log(`[BotController] Fluxo de automação "${flow.name}" ativado para ${jid}`);
            await automationService.executeFlow(flow, jid, body, triggerNodeId);
            databaseService.incrementStat('total_messages');
            databaseService.incrementStat('monthly_messages');
            whatsappService.emit('activity', {
                jid, message: body, response: `[Fluxo: ${flow.name}]`, isGroup, timestamp: Date.now()
            });
            return;
        }

        // 6. Fallback: Resposta IA padrão
        let imageData: { data: string, mimeType: string } | undefined;

        if (msg.message.imageMessage) {
            try {
                const buffer = (await downloadMediaMessage(msg, 'buffer', {})) as Buffer;
                imageData = {
                    data: buffer.toString('base64'),
                    mimeType: msg.message.imageMessage.mimetype || 'image/jpeg'
                };
            } catch (e) {
                console.error('Error downloading media:', e);
            }
        }

        const systemPrompt = databaseService.getSetting('agent_prompt') || 'Você é um assistente prestativo.';

        const response = await aiService.generateResponse(
            body,
            systemPrompt,
            imageData
        );

        if (response) {
            await whatsappService.sendMessage(jid, { text: response });
            databaseService.incrementStat('total_messages');
            databaseService.incrementStat('monthly_messages');

            whatsappService.emit('activity', {
                jid,
                message: body,
                response: response,
                isGroup,
                timestamp: Date.now()
            });
        }
    }
}

export const botController = new BotController();
