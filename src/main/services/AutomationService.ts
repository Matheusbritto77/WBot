import { databaseService } from './DatabaseService';
import { whatsappService } from './WhatsAppService';
import { aiService } from './AIService';
import { EventEmitter } from 'events';

export interface FlowNode {
    id: string;
    type: 'trigger' | 'send_text' | 'send_image' | 'send_audio' | 'send_video' | 'send_poll' | 'send_buttons' | 'ai_response' | 'delay' | 'condition' | 'set_variable' | 'http_request';
    data: Record<string, any>;
    position: { x: number; y: number };
}

export interface FlowEdge {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    label?: string;
}

export interface AutomationFlow {
    id: string;
    name: string;
    description: string;
    nodes: FlowNode[];
    edges: FlowEdge[];
    trigger_type: 'keyword' | 'exact' | 'starts_with' | 'regex' | 'any_message' | 'first_message' | 'media';
    trigger_value: string;
    enabled: boolean;
    created_at: string;
    updated_at: string;
}

export class AutomationService extends EventEmitter {

    public getAll(): AutomationFlow[] {
        const rows = databaseService.query('SELECT * FROM automation_flows ORDER BY created_at DESC') as any[];
        return rows.map(this.parseRow);
    }

    public getById(id: string): AutomationFlow | null {
        const row = databaseService.get('SELECT * FROM automation_flows WHERE id = ?', [id]) as any;
        return row ? this.parseRow(row) : null;
    }

    public save(flow: Partial<AutomationFlow> & { id: string }) {
        const existing = this.getById(flow.id);
        const nodes = JSON.stringify(flow.nodes || []);
        const edges = JSON.stringify(flow.edges || []);

        existing
            ? databaseService.run(
                'UPDATE automation_flows SET name = ?, description = ?, nodes = ?, edges = ?, trigger_type = ?, trigger_value = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [flow.name || existing.name, flow.description ?? existing.description, nodes, edges, flow.trigger_type || existing.trigger_type, flow.trigger_value ?? existing.trigger_value, flow.enabled ? 1 : 0, flow.id]
            )
            : databaseService.run(
                'INSERT INTO automation_flows (id, name, description, nodes, edges, trigger_type, trigger_value, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [flow.id, flow.name || 'Novo Fluxo', flow.description || '', nodes, edges, flow.trigger_type || 'keyword', flow.trigger_value || '', flow.enabled ? 1 : 0]
            );

        return this.getById(flow.id);
    }

    public remove(id: string) {
        databaseService.run('DELETE FROM automation_flows WHERE id = ?', [id]);
    }

    public toggle(id: string, enabled: boolean) {
        databaseService.run('UPDATE automation_flows SET enabled = ? WHERE id = ?', [enabled ? 1 : 0, id]);
    }

    /**
     * Checks if an incoming message matches any flow trigger
     */
    public findMatchingFlow(body: string, isFirstMessage: boolean, hasMedia: boolean): { flow: AutomationFlow, triggerNodeId: string } | null {
        const flows = this.getAll().filter(f => f.enabled);

        for (const flow of flows) {
            const triggerNodes = flow.nodes.filter(n => n.type === 'trigger');

            for (const node of triggerNodes) {
                const type = node.data.trigger_type || flow.trigger_type || 'keyword';
                const val = (node.data.trigger_value || flow.trigger_value || '').toLowerCase();
                const msg = body.toLowerCase().trim();

                let match = false;
                switch (type) {
                    case 'keyword':
                        if (msg.includes(val)) match = true;
                        break;
                    case 'exact':
                        if (msg === val) match = true;
                        break;
                    case 'starts_with':
                        if (msg.startsWith(val)) match = true;
                        break;
                    case 'regex':
                        try { if (new RegExp(val, 'i').test(msg)) match = true; } catch { }
                        break;
                    case 'any_message':
                        match = true;
                        break;
                    case 'first_message':
                        if (isFirstMessage) match = true;
                        break;
                    case 'media':
                        if (hasMedia) match = true;
                        break;
                }

                if (match) return { flow, triggerNodeId: node.id };
            }
        }
        return null;
    }

    /**
     * Executes a full flow for a given JID starting from a specific trigger node
     */
    public async executeFlow(flow: AutomationFlow, jid: string, messageBody: string, triggerNodeId?: string, variables: Record<string, any> = {}) {
        const startNodeId = triggerNodeId || flow.nodes.find(n => n.type === 'trigger')?.id;
        if (!startNodeId) return;

        const vars: Record<string, any> = {
            ...variables,
            _jid: jid,
            _message: messageBody,
            _timestamp: Date.now()
        };

        const visited = new Set<string>();
        await this.executeNode(flow, startNodeId, jid, vars, visited);
    }

    private async executeNode(flow: AutomationFlow, nodeId: string, jid: string, vars: Record<string, any>, visited: Set<string>) {
        if (visited.has(nodeId)) return; // Prevent infinite loops
        visited.add(nodeId);

        const node = flow.nodes.find(n => n.id === nodeId);
        if (!node) return;

        try {
            await this.processNode(node, jid, vars);
        } catch (e: any) {
            console.error(`[Automation] Error in node ${node.id} (${node.type}):`, e.message);
        }

        // Find next nodes via edges
        const outEdges = flow.edges.filter(e => e.source === nodeId);

        for (const edge of outEdges) {
            // For condition nodes, check the handle match
            if (node.type === 'condition' && edge.sourceHandle) {
                const condResult = vars._conditionResult ? 'true' : 'false';
                if (edge.sourceHandle !== condResult) continue;
            }
            await this.executeNode(flow, edge.target, jid, vars, visited);
        }
    }

    private async processNode(node: FlowNode, jid: string, vars: Record<string, any>) {
        const interpolate = (text: string) =>
            text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');

        switch (node.type) {
            case 'trigger':
                break; // Just an entry point

            case 'send_text':
                await whatsappService.sendMessage(jid, { text: interpolate(node.data.text || '') });
                break;

            case 'send_image':
                await whatsappService.sendMessage(jid, {
                    image: { url: interpolate(node.data.url || '') },
                    caption: interpolate(node.data.caption || '')
                });
                break;

            case 'send_audio':
                await whatsappService.sendMessage(jid, {
                    audio: { url: interpolate(node.data.url || '') },
                    mimetype: 'audio/mpeg',
                    ptt: node.data.ptt ?? true
                });
                break;

            case 'send_video':
                await whatsappService.sendMessage(jid, {
                    video: { url: interpolate(node.data.url || '') },
                    caption: interpolate(node.data.caption || '')
                });
                break;

            case 'send_poll': {
                const optionsRaw = node.data.options || '';
                const options = Array.isArray(optionsRaw)
                    ? optionsRaw
                    : optionsRaw.split('\n').map((s: string) => s.trim()).filter(Boolean);

                await whatsappService.sendMessage(jid, {
                    poll: {
                        name: interpolate(node.data.question || ''),
                        values: options.map((o: string) => interpolate(o)),
                        selectableCount: node.data.multiSelect ? 0 : 1
                    }
                });
                break;
            }

            case 'send_buttons': {
                const buttonsRaw = node.data.buttons || '';
                const buttonsText = Array.isArray(buttonsRaw)
                    ? buttonsRaw
                    : buttonsRaw.split('\n').map((s: string) => s.trim()).filter(Boolean);

                const buttons = buttonsText.map((text: string, i: number) => ({
                    buttonId: `btn_${i}`,
                    buttonText: { displayText: interpolate(text) },
                    type: 1
                }));

                await whatsappService.sendMessage(jid, {
                    text: interpolate(node.data.text || ''),
                    buttons,
                    footer: 'Bot Automation',
                    headerType: 1
                });
                break;
            }

            case 'ai_response': {
                const prompt = interpolate(node.data.prompt || 'Responda à mensagem do usuário.');
                const userMsg = vars._message || '';
                const aiReply = await aiService.generateResponse(userMsg, prompt);
                vars._aiResponse = aiReply;
                await whatsappService.sendMessage(jid, { text: aiReply });
                break;
            }

            case 'delay': {
                const ms = (node.data.seconds || 1) * 1000;
                await new Promise(r => setTimeout(r, ms));
                break;
            }

            case 'condition': {
                const left = interpolate(node.data.left || '');
                const op = node.data.operator || '==';
                const right = interpolate(node.data.right || '');

                let result = false;
                switch (op) {
                    case '==': result = left === right; break;
                    case '!=': result = left !== right; break;
                    case 'contains': result = left.includes(right); break;
                    case 'not_contains': result = !left.includes(right); break;
                    case '>': result = parseFloat(left) > parseFloat(right); break;
                    case '<': result = parseFloat(left) < parseFloat(right); break;
                }
                vars._conditionResult = result;
                break;
            }

            case 'set_variable':
                vars[node.data.name || 'var'] = interpolate(node.data.value || '');
                break;

            case 'http_request': {
                const res = await fetch(interpolate(node.data.url || ''), {
                    method: node.data.method || 'GET',
                    headers: node.data.headers ? JSON.parse(interpolate(node.data.headers)) : {},
                    body: node.data.body ? interpolate(node.data.body) : undefined
                });
                vars._httpResponse = await res.text();
                vars._httpStatus = res.status;
                break;
            }
        }
    }

    private parseRow(row: any): AutomationFlow {
        try {
            return {
                ...row,
                nodes: JSON.parse(row.nodes || '[]'),
                edges: JSON.parse(row.edges || '[]'),
                enabled: !!row.enabled
            };
        } catch (e) {
            console.error("[AutomationService] Error parsing flow row:", row.id, e);
            return {
                ...row,
                nodes: [],
                edges: [],
                enabled: false
            } as any;
        }
    }
}

export const automationService = new AutomationService();
