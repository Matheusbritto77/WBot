import { createSignal, onMount, onCleanup, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import {
    Wifi,
    WifiOff,
    Zap,
    MessagesSquare,
    Activity,
    Settings,
    ArrowRight
} from 'lucide-solid';

import { api } from '../lib/api';

function Home() {
    const navigate = useNavigate();
    const [status, setStatus] = createSignal('disconnected');
    const [stats, setStats] = createSignal({
        totalMessages: 0,
        monthlyMessages: 0,
        groupsCount: 0,
        modelName: 'gemini-1.5-flash'
    });
    const [activityLog, setActivityLog] = createSignal<any[]>([]);

    const refreshStats = async () => {
        try {
            const summary = await api.stats.getSummary();
            setStats({
                totalMessages: summary.totalMessages || 0,
                monthlyMessages: summary.monthlyMessages || 0,
                groupsCount: summary.groupsCount || 0,
                modelName: summary.modelName || 'gemini-1.5-flash'
            });
        } catch (e) {
            console.error('Error refreshing stats:', e);
        }
    };

    onMount(async () => {
        const currentStatus = await api.whatsapp.getStatus();
        setStatus(currentStatus);

        await refreshStats();

        const cleanupStatus = api.whatsapp.onStatusChanged((newStatus: string) => {
            setStatus(newStatus);
            refreshStats();
        });

        // Listen for real-time activity
        const cleanupActivity = api.whatsapp.onActivity((data: any) => {
            setActivityLog((prev) => [data, ...prev].slice(0, 10)); // Keep last 10 items
            refreshStats(); // Also refresh stats counter
        });

        // Periodic refresh every 30s
        const interval = setInterval(refreshStats, 30000);

        onCleanup(() => {
            cleanupStatus();
            cleanupActivity();
            clearInterval(interval);
        });
    });

    return (
        <div class="pt-24 pb-20 space-y-8 animate-in fade-in duration-700">
            <div>
                <h1 class="text-3xl font-bold">Painel de Controle</h1>
                <p class="text-zinc-400">Visão geral do seu assistente inteligente</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Status Card */}
                <div class="glass p-6 rounded-2xl border-l-4 border-l-brand flex flex-col justify-between h-32">
                    <div class="flex justify-between items-start">
                        <span class="text-xs font-bold text-zinc-500 uppercase tracking-widest">WhatsApp</span>
                        <div class={`p-2 rounded-lg ${status() === 'connected' ? 'bg-brand/20 text-brand' : 'bg-red-500/20 text-red-500'}`}>
                            {status() === 'connected' ? <Wifi size={18} /> : <WifiOff size={18} />}
                        </div>
                    </div>
                    <div>
                        <p class="text-2xl font-bold">{status() === 'connected' ? 'Conectado' : 'Desconectado'}</p>
                        <div class="flex items-center gap-1.5 mt-1">
                            <div class={`w-2 h-2 rounded-full ${status() === 'connected' ? 'bg-brand animate-pulse' : 'bg-red-500'}`}></div>
                            <span class="text-[10px] text-zinc-500 font-bold uppercase">{status() === 'connected' ? 'Operacional' : 'Requer Atenção'}</span>
                        </div>
                    </div>
                </div>

                {/* AI Stats */}
                <div class="glass p-6 rounded-2xl flex flex-col justify-between h-32 hover:border-white/20 transition-all cursor-default group">
                    <div class="flex justify-between items-start">
                        <span class="text-xs font-bold text-zinc-500 uppercase tracking-widest">IA Gemini</span>
                        <div class="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 group-hover:scale-110 transition-transform">
                            <Zap size={18} />
                        </div>
                    </div>
                    <div>
                        <p class="text-2xl font-bold">{status() === 'connected' ? 'Ativa' : 'Aguardando'}</p>
                        <p class="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                            <Activity size={12} /> Modelo {stats().modelName}
                        </p>
                    </div>
                </div>

                {/* Message Stats */}
                <div class="glass p-6 rounded-2xl flex flex-col justify-between h-32">
                    <div class="flex justify-between items-start">
                        <span class="text-xs font-bold text-zinc-500 uppercase tracking-widest">Mensagens</span>
                        <div class="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                            <MessagesSquare size={18} />
                        </div>
                    </div>
                    <div>
                        <p class="text-2xl font-bold">{stats().totalMessages.toLocaleString()}</p>
                        <p class="text-xs text-zinc-500 mt-1">Processadas (Total)</p>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="lg:col-span-2 glass rounded-3xl overflow-hidden min-h-[400px] flex flex-col">
                    <div class="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                        <h2 class="font-bold flex items-center gap-2">
                            <Activity size={18} class="text-brand" /> Atividade Recente
                        </h2>
                        <div class="flex items-center gap-2">
                            <span class="relative flex h-2 w-2">
                                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span>
                                <span class="relative inline-flex rounded-full h-2 w-2 bg-brand"></span>
                            </span>
                            <span class="text-xs text-zinc-500 font-mono uppercase">Live</span>
                        </div>
                    </div>

                    <div class="flex-1 p-0 overflow-hidden relative">
                        <Show when={activityLog().length > 0} fallback={
                            <div class="absolute inset-0 flex flex-col items-center justify-center text-zinc-600">
                                <MessagesSquare size={48} class="opacity-10 mb-4" />
                                <p class="text-sm">Aguardando novas mensagens...</p>
                            </div>
                        }>
                            <div class="absolute inset-0 overflow-y-auto custom-scrollbar p-6 space-y-4">
                                <For each={activityLog()}>
                                    {(log) => (
                                        <div class="animate-in slide-in-from-top-2 duration-300">
                                            <div class="bg-zinc-900/40 rounded-xl p-4 border border-white/5 hover:border-brand/20 transition-colors">
                                                <div class="flex items-center justify-between mb-2">
                                                    <div class="flex items-center gap-2">
                                                        <span class="text-xs font-bold text-brand bg-brand/10 px-2 py-0.5 rounded-md">
                                                            {log.isGroup ? 'GRUPO' : 'DM'}
                                                        </span>
                                                        <span class="text-xs text-zinc-500 font-mono">
                                                            {log.jid.split('@')[0].slice(-4)}...
                                                        </span>
                                                    </div>
                                                    <span class="text-[10px] text-zinc-600">
                                                        {new Date(log.timestamp).toLocaleTimeString()}
                                                    </span>
                                                </div>

                                                <div class="space-y-2">
                                                    <div class="flex gap-2 text-sm">
                                                        <span class="text-zinc-500 font-bold text-xs uppercase min-w-[30px] pt-0.5">User:</span>
                                                        <p class="text-zinc-300">{log.message || '📷 [Imagem]'}</p>
                                                    </div>
                                                    <div class="flex gap-2 text-sm">
                                                        <span class="text-brand/50 font-bold text-xs uppercase min-w-[30px] pt-0.5">Bot:</span>
                                                        <p class="text-brand/90 line-clamp-2">{log.response}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </Show>
                    </div>
                </div>

                <div class="glass rounded-3xl p-6">
                    <h2 class="font-bold mb-6">Acesso Rápido</h2>
                    <div class="space-y-3">
                        <button
                            onClick={() => navigate('/settings')}
                            class="w-full p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-brand/50 transition-all text-left flex items-center gap-4 group"
                        >
                            <div class="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center group-hover:bg-brand group-hover:text-white transition-all">
                                <Settings size={20} />
                            </div>
                            <div class="flex-1">
                                <p class="text-sm font-bold">Configurar Bot</p>
                                <p class="text-[10px] text-zinc-500 uppercase">Conexão e Regras</p>
                            </div>
                            <ArrowRight size={16} class="text-zinc-600 group-hover:text-brand group-hover:translate-x-1 transition-all" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Home;
