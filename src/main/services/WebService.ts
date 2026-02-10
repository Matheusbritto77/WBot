import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import { databaseService } from './DatabaseService';
import { whatsappService } from './WhatsAppService';
import { authSecurityService } from './AuthSecurityService';
import { cronService } from './CronService';
import { loopService } from './LoopService';
import { z } from 'zod';

export class WebService {
    private fastify = Fastify({ logger: true });
    private readonly PORT = 3000;

    public async init() {
        // Security Plugins
        await this.fastify.register(cors, {
            origin: true // In production, refine this
        });

        await this.fastify.register(rateLimit, {
            max: 100,
            timeWindow: '1 minute'
        });

        await this.fastify.register(jwt, {
            secret: 'seu-segredo-super-seguro-aqui' // In production, use env variable
        });

        // Auth Routes
        this.fastify.post('/api/auth/login', async (request, reply) => {
            const schema = z.object({
                username: z.string().min(3).max(20),
                password: z.string().min(6)
            });

            const result = schema.safeParse(request.body);
            if (!result.success) {
                return reply.code(400).send({ error: 'Dados inválidos', details: result.error.format() });
            }

            const { username, password } = result.data;

            if (!authSecurityService.canAttempt(username)) {
                return reply.code(429).send({ error: 'Muitas tentativas. Tente novamente mais tarde.' });
            }

            const user = databaseService.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]) as any;

            if (user) {
                authSecurityService.recordSuccess(username);
                const token = this.fastify.jwt.sign({ id: user.id, username: user.username });
                return { token, user: { id: user.id, username: user.username } };
            } else {
                authSecurityService.recordFailure(username);
                return reply.code(401).send({ error: 'Credenciais inválidas' });
            }
        });

        this.fastify.post('/api/auth/register', async (request, reply) => {
            const { username, password } = request.body as any;
            const val = authSecurityService.validateCredentials(username, password);
            if (!val.valid) return reply.code(400).send({ error: val.error });

            try {
                databaseService.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, password]);
                return { success: true };
            } catch (e: any) {
                return reply.code(400).send({ error: e.message });
            }
        });

        // Protected Routes Bridge
        this.fastify.register(async (instance) => {
            instance.addHook('onRequest', async (request, reply) => {
                try {
                    await request.jwtVerify();
                } catch (err) {
                    reply.code(401).send({ error: 'Sessão expirada' });
                }
            });

            instance.post('/api/auth/logout', async () => {
                return { success: true };
            });

            // Settings
            instance.get('/api/settings/:key', async (request) => {
                const { key } = request.params as any;
                return { value: databaseService.getSetting(key) };
            });

            instance.post('/api/settings', async (request) => {
                const { key, value } = request.body as any;
                databaseService.setSetting(key, value);
                return { success: true };
            });

            // WhatsApp
            instance.get('/api/whatsapp/status', () => whatsappService.getStatus());
            instance.get('/api/whatsapp/qr', () => whatsappService.getQR());
            instance.post('/api/whatsapp/connect', async () => {
                await whatsappService.connect();
                return { success: true };
            });
            instance.post('/api/whatsapp/logout', async () => {
                await whatsappService.logout();
                return { success: true };
            });
            instance.get('/api/whatsapp/groups', async (request) => {
                const { force } = request.query as any;
                return await whatsappService.getGroups(force === 'true');
            });

            // Stats
            instance.get('/api/stats/summary', async () => {
                const total = databaseService.getStat('total_messages');
                const monthly = databaseService.getStat('monthly_messages');
                const model = databaseService.getSetting('gemini_model') || 'gemini-1.5-flash';

                let groupsCount = 0;
                try {
                    const groups = await whatsappService.getGroups(false);
                    groupsCount = groups.length;
                } catch (e) { }

                return {
                    totalMessages: total,
                    monthlyMessages: monthly,
                    modelName: model,
                    groupsCount: groupsCount
                };
            });

            // MCP Servers
            instance.get('/api/mcp', () => {
                return databaseService.query('SELECT * FROM mcp_servers ORDER BY created_at DESC');
            });
            instance.post('/api/mcp', async (request) => {
                const server = request.body as any;
                databaseService.run(
                    'INSERT INTO mcp_servers (id, name, type, url, command, args) VALUES (?, ?, ?, ?, ?, ?)',
                    [server.id, server.name, server.type, server.url || null, server.command || null, server.args || null]
                );
                return { success: true };
            });
            instance.delete('/api/mcp/:id', (request) => {
                const { id } = request.params as any;
                databaseService.run('DELETE FROM mcp_servers WHERE id = ?', [id]);
                return { success: true };
            });
            instance.patch('/api/mcp/:id/toggle', (request) => {
                const { id } = request.params as any;
                const { enabled } = request.body as any;
                databaseService.run('UPDATE mcp_servers SET enabled = ? WHERE id = ?', [enabled ? 1 : 0, id]);
                return { success: true };
            });

            // Cron Jobs
            instance.get('/api/cron', () => cronService.getAll());
            instance.post('/api/cron', (request) => {
                cronService.add(request.body as any);
                return { success: true };
            });
            instance.delete('/api/cron/:id', (request) => {
                cronService.remove((request.params as any).id);
                return { success: true };
            });
            instance.patch('/api/cron/:id/toggle', (request) => {
                const { id } = request.params as any;
                const { enabled } = request.body as any;
                cronService.toggle(id, enabled);
                return { success: true };
            });

            // Loop Tasks
            instance.get('/api/loop', () => loopService.getAll());
            instance.post('/api/loop', (request) => {
                loopService.add(request.body as any);
                return { success: true };
            });
            instance.delete('/api/loop/:id', (request) => {
                loopService.remove((request.params as any).id);
                return { success: true };
            });
            instance.post('/api/loop/:id/start', (request) => {
                loopService.start((request.params as any).id);
                return { success: true };
            });
            instance.post('/api/loop/:id/stop', (request) => {
                loopService.stop((request.params as any).id);
                return { success: true };
            });
        });

        try {
            await this.fastify.listen({ port: this.PORT, host: '0.0.0.0' });
            console.log(`[WebService] Server running at http://0.0.0.0:${this.PORT}`);
        } catch (err) {
            this.fastify.log.error(err);
        }
    }
}

export const webService = new WebService();
