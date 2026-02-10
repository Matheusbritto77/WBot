import { databaseService } from './DatabaseService';
import { aiService } from './AIService';
import { EventEmitter } from 'events';

interface LoopTask {
    id: string;
    name: string;
    prompt: string;
    status: string;
    last_result: string | null;
    iterations: number;
}

const DONE_KEYWORDS = ['[TAREFA_CONCLUIDA]', '[TASK_DONE]', '[FINALIZADO]'];

export class LoopService extends EventEmitter {
    private running = new Map<string, boolean>();

    getAll(): LoopTask[] {
        return databaseService.query('SELECT * FROM loop_tasks ORDER BY created_at DESC') as LoopTask[];
    }

    get(id: string): LoopTask | null {
        return (databaseService.get('SELECT * FROM loop_tasks WHERE id = ?', [id]) as LoopTask) || null;
    }

    add(task: { id: string; name: string; prompt: string }) {
        databaseService.run(
            'INSERT INTO loop_tasks (id, name, prompt) VALUES (?, ?, ?)',
            [task.id, task.name, task.prompt]
        );
    }

    remove(id: string) {
        this.stop(id);
        databaseService.run('DELETE FROM loop_tasks WHERE id = ?', [id]);
    }

    async start(id: string) {
        const task = this.get(id);
        if (!task) return;

        this.running.set(id, true);
        databaseService.run('UPDATE loop_tasks SET status = ? WHERE id = ?', ['running', id]);
        this.emit('status', { id, status: 'running' });

        console.log(`[LoopService] Iniciando loop "${task.name}"`);

        const systemPrompt = databaseService.getSetting('agent_prompt') || 'Você é um assistente.';

        const loopPrompt = `${task.prompt}

INSTRUÇÕES DE LOOP:
- Você está executando uma tarefa contínua em loop.
- Iteração atual: ${task.iterations + 1}
- Após cada iteração, continue trabalhando na próxima etapa.
- SOMENTE quando a tarefa estiver 100% concluída, inclua [TAREFA_CONCLUIDA] na resposta.
- Se houver mais trabalho, descreva o progresso e o próximo passo.`;

        let iteration = task.iterations;

        while (this.running.get(id)) {
            iteration++;
            console.log(`[LoopService] "${task.name}" - Iteração ${iteration}`);

            try {
                const contextPrompt = iteration === 1
                    ? loopPrompt
                    : `Continue a tarefa. Iteração ${iteration}. Resultado anterior: ${task.last_result?.slice(0, 2000) || 'N/A'}`;

                const response = await aiService.generateResponse(contextPrompt, systemPrompt);

                databaseService.run(
                    'UPDATE loop_tasks SET iterations = ?, last_result = ? WHERE id = ?',
                    [iteration, response?.slice(0, 5000) || '', id]
                );

                this.emit('progress', { id, iteration, result: response?.slice(0, 500) });

                // Check if task declared itself done
                const isDone = DONE_KEYWORDS.some(kw => response?.includes(kw));
                if (isDone) {
                    console.log(`[LoopService] "${task.name}" - CONCLUÍDA após ${iteration} iterações`);
                    this.running.set(id, false);
                    databaseService.run('UPDATE loop_tasks SET status = ? WHERE id = ?', ['done', id]);
                    this.emit('status', { id, status: 'done' });
                    break;
                }

                // Small delay between iterations to avoid overloading
                await new Promise(r => setTimeout(r, 3000));

            } catch (e: any) {
                console.error(`[LoopService] Erro na iteração ${iteration}:`, e.message);
                databaseService.run(
                    'UPDATE loop_tasks SET last_result = ? WHERE id = ?',
                    [`Erro: ${e.message}`, id]
                );
                // Wait before retrying
                await new Promise(r => setTimeout(r, 10000));
            }
        }
    }

    stop(id: string) {
        this.running.set(id, false);
        databaseService.run('UPDATE loop_tasks SET status = ? WHERE id = ?', ['stopped', id]);
        this.emit('status', { id, status: 'stopped' });
        console.log(`[LoopService] "${id}" parado.`);
    }
}

export const loopService = new LoopService();
