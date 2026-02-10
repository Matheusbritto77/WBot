import * as cron from 'node-cron';
import { databaseService } from './DatabaseService';
import { aiService } from './AIService';
import { whatsappService } from './WhatsAppService';

interface CronJob {
    id: string;
    name: string;
    schedule: string;
    prompt: string;
    target_jid: string | null;
    enabled: number;
}

export class CronService {
    private tasks = new Map<string, any>();

    init() {
        this.loadAndSchedule();
    }

    private loadAndSchedule() {
        this.stopAll();
        const jobs = databaseService.query('SELECT * FROM cron_jobs WHERE enabled = 1') as CronJob[];
        jobs.forEach(job => this.scheduleJob(job));
        console.log(`[CronService] ${jobs.length} job(s) agendado(s)`);
    }

    private scheduleJob(job: CronJob) {
        if (!cron.validate(job.schedule)) {
            console.error(`[CronService] Cron inválido para "${job.name}": ${job.schedule}`);
            return;
        }

        const task = cron.schedule(job.schedule, async () => {
            console.log(`[CronService] Executando job "${job.name}"`);
            try {
                const systemPrompt = databaseService.getSetting('agent_prompt') || 'Você é um assistente.';
                const response = await aiService.generateResponse(job.prompt, systemPrompt);

                if (job.target_jid && whatsappService.getStatus() === 'connected') {
                    await whatsappService.sendMessage(job.target_jid, { text: response });
                }

                console.log(`[CronService] Job "${job.name}" concluído.`);
            } catch (e: any) {
                console.error(`[CronService] Erro no job "${job.name}":`, e.message);
            }
        });

        this.tasks.set(job.id, task);
    }

    private stopAll() {
        this.tasks.forEach(t => t.stop());
        this.tasks.clear();
    }

    getAll(): CronJob[] {
        return databaseService.query('SELECT * FROM cron_jobs ORDER BY created_at DESC') as CronJob[];
    }

    add(job: Omit<CronJob, 'enabled'>) {
        databaseService.run(
            'INSERT INTO cron_jobs (id, name, schedule, prompt, target_jid) VALUES (?, ?, ?, ?, ?)',
            [job.id, job.name, job.schedule, job.prompt, job.target_jid || null]
        );
        this.loadAndSchedule();
    }

    remove(id: string) {
        const task = this.tasks.get(id);
        if (task) task.stop();
        this.tasks.delete(id);
        databaseService.run('DELETE FROM cron_jobs WHERE id = ?', [id]);
    }

    toggle(id: string, enabled: boolean) {
        databaseService.run('UPDATE cron_jobs SET enabled = ? WHERE id = ?', [enabled ? 1 : 0, id]);
        this.loadAndSchedule();
    }

    reload() {
        this.loadAndSchedule();
    }
}

export const cronService = new CronService();
