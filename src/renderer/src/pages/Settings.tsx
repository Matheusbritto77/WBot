import { createSignal, onMount, onCleanup, Show, For } from 'solid-js';
import { api } from '../lib/api';
import {
    Settings as SettingsIcon,
    Wifi,
    Zap,
    Save,
    RefreshCw,
    Shield,
    Database,
    Bot,
    Key,
    Users,
    Power,
    Loader2,
    Server,
    Clock,
    Repeat,
    Plus,
    Trash2,
    Play,
    Square,
    ToggleLeft,
    ToggleRight,
    Ban
} from 'lucide-solid';

const formatJID = (jid: string) => {
    if (!jid) return '';
    return jid.split('@')[0];
};

function Settings() {
    const [activeTab, setActiveTab] = createSignal('whatsapp');
    const [qr, setQr] = createSignal<string | null>(null);
    const [status, setStatus] = createSignal('disconnected');
    const [loading, setLoading] = createSignal(false);

    // AI Settings
    const [apiKey, setApiKey] = createSignal('');
    const [modelName, setModelName] = createSignal('gemini-1.5-flash');
    const [systemPrompt, setSystemPrompt] = createSignal('');
    const [autoReply, setAutoReply] = createSignal(true);
    const [blockWord, setBlockWord] = createSignal('');

    // Bot Rules
    const [respondGroups, setRespondGroups] = createSignal(false);
    const [allowedGroups, setAllowedGroups] = createSignal('');
    const [blockedContacts, setBlockedContacts] = createSignal('');
    const [groupsList, setGroupsList] = createSignal<{ id: string; subject: string }[]>([]);
    const [loadingGroups, setLoadingGroups] = createSignal(false);

    // MCP Servers
    const [mcpServers, setMcpServers] = createSignal<any[]>([]);
    const [mcpName, setMcpName] = createSignal('');
    const [mcpType, setMcpType] = createSignal('sse');
    const [mcpUrl, setMcpUrl] = createSignal('');
    const [mcpCommand, setMcpCommand] = createSignal('');
    const [mcpArgs, setMcpArgs] = createSignal('');

    // Cron Jobs
    const [cronJobs, setCronJobs] = createSignal<any[]>([]);
    const [cronName, setCronName] = createSignal('');
    const [cronSchedule, setCronSchedule] = createSignal('');
    const [cronPrompt, setCronPrompt] = createSignal('');
    const [cronTarget, setCronTarget] = createSignal('');

    // Loop Tasks
    const [loopTasks, setLoopTasks] = createSignal<any[]>([]);
    const [loopName, setLoopName] = createSignal('');
    const [loopPrompt, setLoopPrompt] = createSignal('');

    const selectedGroupIds = () => {
        const raw = allowedGroups();
        return raw ? raw.split(',').map(s => s.trim()).filter(Boolean) : [];
    };

    const toggleGroup = (groupId: string) => {
        const current = selectedGroupIds();
        const updated = current.includes(groupId)
            ? current.filter(id => id !== groupId)
            : [...current, groupId];
        setAllowedGroups(updated.join(', '));
    };

    const fetchGroups = async (force = false) => {
        setLoadingGroups(true);
        try {
            const groups = await api.whatsapp.getGroups(force);
            setGroupsList(groups);
        } catch (e) {
            console.error('Error fetching groups:', e);
        } finally {
            setLoadingGroups(false);
        }
    };

    const loadMcp = async () => {
        const servers = await api.mcp.getAll();
        setMcpServers(servers);
    };

    const loadCron = async () => {
        const jobs = await api.cron.getAll();
        setCronJobs(jobs);
    };

    const loadLoop = async () => {
        const tasks = await api.loop.getAll();
        setLoopTasks(tasks);
    };

    const genId = () => Math.random().toString(36).substring(2, 10);

    onMount(async () => {

        const currentStatus = await api.whatsapp.getStatus();
        setStatus(currentStatus);

        const currentQr = await api.whatsapp.getQR();
        setQr(currentQr);

        setApiKey(await api.settings.get('gemini_api_key') || '');
        setModelName(await api.settings.get('gemini_model') || 'gemini-1.5-flash');
        setSystemPrompt(await api.settings.get('agent_prompt') || '');

        const autoReplySetting = await api.settings.get('auto_reply');
        setAutoReply(autoReplySetting !== 'false');

        setRespondGroups((await api.settings.get('respond_groups')) === 'true');
        setAllowedGroups(await api.settings.get('allowed_groups') || '');
        setBlockWord(await api.settings.get('block_word') || '');
        setBlockedContacts(await api.settings.get('blocked_contacts') || '');

        if (currentStatus === 'connected') fetchGroups();

        loadMcp();
        loadCron();
        loadLoop();

        const cleanupStatus = api.whatsapp.onStatusChanged((s) => {
            setStatus(s);
            if (s === 'connected') fetchGroups();
        });
        const cleanupQR = api.whatsapp.onQRReceived((q) => setQr(q));
        const cleanupLoop = api.loop.onStatusChanged(() => loadLoop());
        const cleanupSettings = api.settings.onSettingsChanged((data) => {
            if (data.key === 'blocked_contacts') setBlockedContacts(data.value);
            if (data.key === 'auto_reply') setAutoReply(data.value !== 'false');
            if (data.key === 'respond_groups') setRespondGroups(data.value === 'true');
        });

        onCleanup(() => {
            cleanupStatus();
            cleanupQR();
            cleanupLoop();
            cleanupSettings();
        });
    });

    const saveSettings = async () => {
        setLoading(true);
        try {
            await api.settings.set('gemini_api_key', apiKey());
            await api.settings.set('gemini_model', modelName());
            await api.settings.set('agent_prompt', systemPrompt());
            await api.settings.set('auto_reply', autoReply().toString());
            await api.settings.set('respond_groups', respondGroups().toString());
            await api.settings.set('allowed_groups', allowedGroups());
            await api.settings.set('block_word', blockWord());
            await api.settings.set('blocked_contacts', blockedContacts());
            alert('Configurações salvas com sucesso!');
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = async () => {
        await api.whatsapp.connect();
    };

    const handleLogout = async () => {
        if (confirm('Deseja realmente desconectar o WhatsApp?')) {
            await api.whatsapp.logout();
            setQr(null);
            setGroupsList([]);
        }
    };

    // MCP Actions
    const addMcp = async () => {
        if (!mcpName()) return;
        await api.mcp.add({
            id: genId(), name: mcpName(), type: mcpType(),
            url: mcpUrl() || null, command: mcpCommand() || null, args: mcpArgs() || null
        });
        setMcpName(''); setMcpUrl(''); setMcpCommand(''); setMcpArgs('');
        loadMcp();
    };

    const removeMcp = async (id: string) => {
        await api.mcp.remove(id);
        loadMcp();
    };

    const toggleMcp = async (id: string, enabled: boolean) => {
        await api.mcp.toggle(id, !enabled);
        loadMcp();
    };

    // Cron Actions
    const addCron = async () => {
        if (!cronName() || !cronSchedule() || !cronPrompt()) return;
        await api.cron.add({
            id: genId(), name: cronName(), schedule: cronSchedule(),
            prompt: cronPrompt(), target_jid: cronTarget() || null
        });
        setCronName(''); setCronSchedule(''); setCronPrompt(''); setCronTarget('');
        loadCron();
    };

    const removeCron = async (id: string) => {
        await api.cron.remove(id);
        loadCron();
    };

    const toggleCron = async (id: string, enabled: boolean) => {
        await api.cron.toggle(id, !enabled);
        loadCron();
    };

    // Loop Actions
    const addLoop = async () => {
        if (!loopName() || !loopPrompt()) return;
        await api.loop.add({ id: genId(), name: loopName(), prompt: loopPrompt() });
        setLoopName(''); setLoopPrompt('');
        loadLoop();
    };

    const removeLoop = async (id: string) => {
        await api.loop.remove(id);
        loadLoop();
    };

    const startLoop = async (id: string) => {
        await api.loop.start(id);
        loadLoop();
    };

    const stopLoop = async (id: string) => {
        await api.loop.stop(id);
        loadLoop();
    };

    const tabs = [
        { id: 'whatsapp', name: 'WhatsApp', icon: Wifi },
        { id: 'ai', name: 'Inteligência Artificial', icon: Zap },
        { id: 'rules', name: 'Regras do Bot', icon: Shield },
        { id: 'mcp', name: 'MCP Servers', icon: Server },
        { id: 'cron', name: 'Cron Jobs', icon: Clock },
        { id: 'loop', name: 'Loop Tasks', icon: Repeat },
    ];

    return (
        <div class="pt-24 pb-20 space-y-12 animate-in fade-in duration-700">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 class="text-3xl font-bold flex items-center gap-3">
                        <SettingsIcon size={28} class="text-zinc-500" /> Configurações
                    </h1>
                    <p class="text-zinc-400 mt-1">Personalize o comportamento do seu assistente</p>
                </div>
                <button
                    onClick={saveSettings}
                    disabled={loading()}
                    class="bg-brand hover:bg-brand-dark text-white font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-brand/20 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                >
                    <Save size={18} />
                    {loading() ? 'Salvando...' : 'Salvar Alterações'}
                </button>
            </div>

            <div class="flex flex-col lg:flex-row gap-8">
                {/* Tabs Sidebar */}
                <div class="lg:w-64 flex flex-row lg:flex-col p-1 bg-zinc-900/50 rounded-2xl border border-white/5 h-fit sticky top-24 overflow-x-auto no-scrollbar">
                    <For each={tabs}>
                        {(tab) => (
                            <button
                                onClick={() => setActiveTab(tab.id)}
                                class={`flex-1 lg:flex-none flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab() === tab.id
                                    ? 'bg-brand/10 text-brand shadow-sm'
                                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                                    }`}
                            >
                                <tab.icon size={18} />
                                <span class="hidden md:inline">{tab.name}</span>
                            </button>
                        )}
                    </For>
                </div>

                {/* Content Area */}
                <div class="flex-1 space-y-6">
                    {/* ========== WHATSAPP TAB ========== */}
                    <Show when={activeTab() === 'whatsapp'}>
                        <div class="glass p-8 rounded-3xl space-y-8 animate-in fade-in duration-300">
                            <div class="flex items-center justify-between">
                                <div>
                                    <h2 class="text-xl font-bold">Conexão WhatsApp</h2>
                                    <p class="text-sm text-zinc-500 mt-1">Gerencie a conta do WhatsApp que o bot usará</p>
                                </div>
                                <div class={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${status() === 'connected' ? 'bg-brand/10 text-brand' : 'bg-zinc-800 text-zinc-500'}`}>
                                    <div class={`w-2 h-2 rounded-full ${status() === 'connected' ? 'bg-brand animate-pulse' : 'bg-zinc-600'}`}></div>
                                    {status() === 'connected' ? 'Conectado' : 'Desconectado'}
                                </div>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                                <div class="space-y-6">
                                    <div class="p-6 bg-zinc-950/50 rounded-2xl border border-white/5 space-y-4">
                                        <h3 class="font-bold flex items-center gap-2"><Bot size={18} class="text-brand" /> Status do serviço</h3>
                                        <p class="text-sm text-zinc-400 text-pretty">
                                            {status() === 'connected'
                                                ? 'Seu WhatsApp está conectado e pronto para responder mensagens automaticamente.'
                                                : 'Aguardando conexão. Escaneie o QR Code ao lado para ativar o serviço.'}
                                        </p>
                                        <div class="flex gap-3">
                                            <button
                                                onClick={handleConnect}
                                                class="flex-1 bg-white text-black font-bold py-2 rounded-lg text-sm hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <RefreshCw size={14} /> Reintentar
                                            </button>
                                            <button
                                                onClick={handleLogout}
                                                class="flex-1 border border-zinc-800 text-zinc-400 font-bold py-2 rounded-lg text-sm hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all"
                                            >
                                                Desconectar
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div class="flex flex-col items-center justify-center p-8 bg-white rounded-[2rem] min-h-[300px] shadow-2xl relative overflow-hidden group">
                                    <Show when={qr()} fallback={
                                        <div class="flex flex-col items-center gap-4 text-zinc-300">
                                            <Show when={status() === 'connected'} fallback={<div class="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>}>
                                                <div class="w-20 h-20 bg-brand/10 text-brand rounded-full flex items-center justify-center">
                                                    <Wifi size={40} />
                                                </div>
                                                <p class="text-zinc-600 font-bold text-lg animate-pulse">Conectado!</p>
                                            </Show>
                                        </div>
                                    }>
                                        <img src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr()!)}&size=250x250`} alt="WhatsApp QR Code" class="w-full max-w-[250px] mix-blend-multiply transition-transform group-hover:scale-105 duration-500" />
                                        <p class="mt-6 text-zinc-600 font-bold text-sm uppercase tracking-tighter">Escaneie com seu celular</p>
                                    </Show>
                                </div>
                            </div>
                        </div>
                    </Show>

                    {/* ========== AI TAB ========== */}
                    <Show when={activeTab() === 'ai'}>
                        <div class="glass p-8 rounded-3xl space-y-10 animate-in fade-in duration-300">
                            <div>
                                <h2 class="text-xl font-bold">Configuração da IA</h2>
                                <p class="text-sm text-zinc-500 mt-1">Configure o cérebro do seu assistente (Google Gemini)</p>
                            </div>

                            <div class="flex items-center justify-between p-5 bg-zinc-950/30 rounded-2xl border border-white/5">
                                <div class="flex items-center gap-4">
                                    <div class={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${autoReply() ? 'bg-brand/20 text-brand' : 'bg-zinc-900 text-zinc-600'}`}>
                                        <Power size={24} />
                                    </div>
                                    <div>
                                        <p class="font-bold">Modo de Resposta Automática</p>
                                        <p class="text-[11px] text-zinc-500">Quando desativado, o bot não responderá a NENHUMA mensagem.</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setAutoReply(!autoReply())}
                                    class={`w-14 h-8 rounded-full transition-all relative ${autoReply() ? 'bg-brand' : 'bg-zinc-800'}`}
                                >
                                    <div class={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all ${autoReply() ? 'right-1' : 'left-1'}`}></div>
                                </button>
                            </div>

                            <div class="space-y-6">
                                <div class="space-y-2">
                                    <label class="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <Key size={12} /> Gemini API Key
                                    </label>
                                    <input
                                        type="password"
                                        value={apiKey()}
                                        onInput={e => setApiKey(e.currentTarget.value)}
                                        placeholder="Cole sua API key aqui..."
                                        class="w-full bg-zinc-950/50 border border-white/10 rounded-xl px-4 py-3 focus:border-brand outline-none transition-all font-mono text-sm"
                                    />
                                </div>

                                <div class="space-y-2">
                                    <label class="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Modelo da IA</label>
                                    <input
                                        type="text"
                                        value={modelName()}
                                        onInput={e => setModelName(e.currentTarget.value)}
                                        placeholder="Ex: gemini-2.0-flash"
                                        class="w-full bg-zinc-950/50 border border-white/10 rounded-xl px-4 py-3 focus:border-brand outline-none transition-all text-sm"
                                    />
                                </div>

                                <div class="space-y-2">
                                    <label class="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Persona/Prompt do Sistema</label>
                                    <textarea
                                        rows={8}
                                        value={systemPrompt()}
                                        onInput={e => setSystemPrompt(e.currentTarget.value)}
                                        placeholder="Ex: Você é um assistente de vendas gentil e direto..."
                                        class="w-full bg-zinc-950/50 border border-white/10 rounded-2xl px-4 py-4 focus:border-brand outline-none transition-all text-sm resize-none"
                                    ></textarea>
                                </div>

                                <div class="space-y-2">
                                    <label class="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <Ban size={12} class="text-red-500" /> Palavra de Bloqueio (Auto-Stop)
                                    </label>
                                    <input
                                        type="text"
                                        value={blockWord()}
                                        onInput={e => setBlockWord(e.currentTarget.value)}
                                        placeholder="Ex: encerrar, parar, humano..."
                                        class="w-full bg-zinc-950/50 border border-white/10 rounded-xl px-4 py-3 focus:border-red-500/50 outline-none transition-all text-sm"
                                    />
                                    <p class="text-[10px] text-zinc-600 ml-1">Se o contato disser esta palavra, ele será bloqueado automaticamente.</p>
                                </div>
                            </div>
                        </div>
                    </Show>

                    {/* ========== RULES TAB ========== */}
                    <Show when={activeTab() === 'rules'}>
                        <div class="glass p-8 rounded-3xl space-y-8 animate-in fade-in duration-300">
                            <div>
                                <h2 class="text-xl font-bold">Regras de Resposta</h2>
                                <p class="text-sm text-zinc-500 mt-1">Controle onde e como o bot deve agir</p>
                            </div>

                            <div class="space-y-8">
                                <div class="space-y-4">
                                    <label class="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <Ban size={12} class="text-red-500" /> Contatos Bloqueados (JIDs)
                                    </label>

                                    <div class="space-y-2">
                                        <div class="flex flex-wrap gap-2 min-h-[50px] p-4 bg-zinc-950/30 rounded-2xl border border-white/5">
                                            <For each={blockedContacts().split(',').map(s => s.trim()).filter(Boolean)} fallback={
                                                <p class="text-xs text-zinc-600 italic py-2">Nenhum contato bloqueado manualmente.</p>
                                            }>
                                                {(jid) => (
                                                    <div class="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-500 px-3 py-1.5 rounded-full text-xs animate-in zoom-in duration-200">
                                                        <span class="font-mono">{formatJID(jid)}</span>
                                                        <button
                                                            onClick={() => {
                                                                const list = blockedContacts().split(',').map(s => s.trim()).filter(Boolean);
                                                                const updated = list.filter(id => id !== jid);
                                                                setBlockedContacts(updated.join(', '));
                                                                api.settings.set('blocked_contacts', updated.join(', '));
                                                            }}
                                                            class="hover:text-white transition-colors"
                                                            title="Desbloquear"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                )}
                                            </For>
                                        </div>

                                        <div class="flex gap-2">
                                            <textarea
                                                rows={1}
                                                value={blockedContacts()}
                                                onInput={e => setBlockedContacts(e.currentTarget.value)}
                                                placeholder="Adicione JIDs manualmente (separados por vírgula)..."
                                                class="flex-1 bg-zinc-950/50 border border-white/10 rounded-xl px-4 py-3 focus:border-brand outline-none transition-all text-sm font-mono resize-none"
                                            ></textarea>
                                        </div>
                                    </div>
                                    <p class="text-[10px] text-zinc-600 ml-1">Para bloquear um chat instantaneamente, digite "parar" no chat usando o próprio WhatsApp do bot.</p>
                                </div>

                                <div class="flex items-center justify-between p-4 bg-zinc-950/30 rounded-2xl border border-white/5">
                                    <div class="flex items-center gap-4">
                                        <div class={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${respondGroups() ? 'bg-brand/20 text-brand' : 'bg-zinc-900 text-zinc-600'}`}>
                                            <Users size={24} />
                                        </div>
                                        <div>
                                            <p class="font-bold">Responder em Grupos</p>
                                            <p class="text-[11px] text-zinc-500">Ativar ou desativar respostas automáticas em grupos</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setRespondGroups(!respondGroups())}
                                        class={`w-14 h-8 rounded-full transition-all relative ${respondGroups() ? 'bg-brand' : 'bg-zinc-800'}`}
                                    >
                                        <div class={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all ${respondGroups() ? 'right-1' : 'left-1'}`}></div>
                                    </button>
                                </div>

                                <Show when={respondGroups()}>
                                    <div class="space-y-4 animate-in slide-in-from-top-4 duration-300">
                                        <div class="flex items-center justify-between">
                                            <label class="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Selecione os Grupos Permitidos</label>
                                            <button
                                                onClick={() => fetchGroups(true)}
                                                disabled={loadingGroups() || status() !== 'connected'}
                                                class="text-xs text-brand hover:text-white transition-colors flex items-center gap-1 disabled:opacity-50"
                                            >
                                                {loadingGroups() ? <Loader2 size={12} class="animate-spin" /> : <RefreshCw size={12} />}
                                                Atualizar Lista
                                            </button>
                                        </div>

                                        <Show when={status() !== 'connected'}>
                                            <div class="bg-amber-500/5 border border-amber-500/10 p-4 rounded-xl flex gap-3">
                                                <Database size={18} class="text-amber-500 shrink-0" />
                                                <p class="text-xs text-amber-500/80">Conecte o WhatsApp primeiro para carregar a lista de grupos.</p>
                                            </div>
                                        </Show>

                                        <Show when={groupsList().length > 0}>
                                            <div class="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1">
                                                <For each={groupsList()}>
                                                    {(group) => {
                                                        const isSelected = () => selectedGroupIds().includes(group.id);
                                                        return (
                                                            <button
                                                                onClick={() => toggleGroup(group.id)}
                                                                class={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${isSelected()
                                                                    ? 'bg-brand/10 border-brand/30 text-white'
                                                                    : 'bg-zinc-950/30 border-white/5 text-zinc-400 hover:border-white/20'
                                                                    }`}
                                                            >
                                                                <div class={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${isSelected()
                                                                    ? 'bg-brand border-brand'
                                                                    : 'border-zinc-700'
                                                                    }`}>
                                                                    <Show when={isSelected()}>
                                                                        <svg class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                                                                            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                                                                        </svg>
                                                                    </Show>
                                                                </div>
                                                                <span class="text-sm truncate">{group.subject}</span>
                                                            </button>
                                                        );
                                                    }}
                                                </For>
                                            </div>
                                        </Show>

                                        <Show when={groupsList().length === 0 && !loadingGroups() && status() === 'connected'}>
                                            <p class="text-xs text-zinc-600 ml-1 italic">Nenhum grupo encontrado. Clique em "Atualizar Lista".</p>
                                        </Show>

                                        <p class="text-[10px] text-zinc-600 ml-1">Deixe todos desmarcados para responder em TODOS os grupos.</p>
                                    </div>
                                </Show>
                            </div>
                        </div>
                    </Show>

                    {/* ========== MCP SERVERS TAB ========== */}
                    <Show when={activeTab() === 'mcp'}>
                        <div class="glass p-8 rounded-3xl space-y-8 animate-in fade-in duration-300">
                            <div>
                                <h2 class="text-xl font-bold flex items-center gap-2"><Server size={22} class="text-brand" /> MCP Servers</h2>
                                <p class="text-sm text-zinc-500 mt-1">Conecte servidores MCP para expandir as capacidades da IA</p>
                            </div>

                            {/* Add MCP Form */}
                            <div class="p-6 bg-zinc-950/50 rounded-2xl border border-white/5 space-y-4">
                                <h3 class="font-bold text-sm uppercase tracking-wider text-zinc-400">Novo Servidor</h3>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <input
                                        type="text"
                                        value={mcpName()}
                                        onInput={e => setMcpName(e.currentTarget.value)}
                                        placeholder="Nome do servidor..."
                                        class="bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 focus:border-brand outline-none text-sm"
                                    />
                                    <select
                                        value={mcpType()}
                                        onChange={e => setMcpType(e.currentTarget.value)}
                                        class="bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 focus:border-brand outline-none text-sm"
                                    >
                                        <option value="sse">SSE (Server-Sent Events)</option>
                                        <option value="local">Local (Comando)</option>
                                    </select>
                                </div>

                                <Show when={mcpType() === 'sse'}>
                                    <input
                                        type="text"
                                        value={mcpUrl()}
                                        onInput={e => setMcpUrl(e.currentTarget.value)}
                                        placeholder="URL do servidor SSE (ex: http://localhost:3001/sse)"
                                        class="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 focus:border-brand outline-none text-sm"
                                    />
                                </Show>

                                <Show when={mcpType() === 'local'}>
                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <input
                                            type="text"
                                            value={mcpCommand()}
                                            onInput={e => setMcpCommand(e.currentTarget.value)}
                                            placeholder="Comando (ex: npx, python)"
                                            class="bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 focus:border-brand outline-none text-sm"
                                        />
                                        <input
                                            type="text"
                                            value={mcpArgs()}
                                            onInput={e => setMcpArgs(e.currentTarget.value)}
                                            placeholder="Argumentos (ex: -y @mcp/server)"
                                            class="bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 focus:border-brand outline-none text-sm"
                                        />
                                    </div>
                                </Show>

                                <button
                                    onClick={addMcp}
                                    class="bg-brand hover:bg-brand-dark text-white font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all active:scale-95 text-sm"
                                >
                                    <Plus size={16} /> Adicionar Servidor
                                </button>
                            </div>

                            {/* MCP List */}
                            <div class="space-y-3">
                                <For each={mcpServers()} fallback={
                                    <div class="text-center py-12 text-zinc-600">
                                        <Server size={40} class="mx-auto mb-3 opacity-30" />
                                        <p class="text-sm">Nenhum servidor MCP configurado</p>
                                    </div>
                                }>
                                    {(server) => (
                                        <div class="flex items-center justify-between p-4 bg-zinc-950/30 rounded-xl border border-white/5 group hover:border-white/10 transition-all">
                                            <div class="flex items-center gap-4">
                                                <div class={`w-3 h-3 rounded-full ${server.enabled ? 'bg-brand animate-pulse' : 'bg-zinc-700'}`}></div>
                                                <div>
                                                    <p class="font-bold text-sm">{server.name}</p>
                                                    <p class="text-[11px] text-zinc-500">{server.type === 'sse' ? server.url : `${server.command} ${server.args || ''}`}</p>
                                                </div>
                                            </div>
                                            <div class="flex items-center gap-2">
                                                <button onClick={() => toggleMcp(server.id, server.enabled)} class="p-2 hover:bg-white/5 rounded-lg transition-colors">
                                                    {server.enabled ? <ToggleRight size={20} class="text-brand" /> : <ToggleLeft size={20} class="text-zinc-600" />}
                                                </button>
                                                <button onClick={() => removeMcp(server.id)} class="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-zinc-600 hover:text-red-400">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </div>
                    </Show>

                    {/* ========== CRON JOBS TAB ========== */}
                    <Show when={activeTab() === 'cron'}>
                        <div class="glass p-8 rounded-3xl space-y-8 animate-in fade-in duration-300">
                            <div>
                                <h2 class="text-xl font-bold flex items-center gap-2"><Clock size={22} class="text-brand" /> Cron Jobs</h2>
                                <p class="text-sm text-zinc-500 mt-1">Agende tarefas para a IA executar automaticamente</p>
                            </div>

                            {/* Add Cron Form */}
                            <div class="p-6 bg-zinc-950/50 rounded-2xl border border-white/5 space-y-4">
                                <h3 class="font-bold text-sm uppercase tracking-wider text-zinc-400">Novo Agendamento</h3>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <input
                                        type="text"
                                        value={cronName()}
                                        onInput={e => setCronName(e.currentTarget.value)}
                                        placeholder="Nome do job..."
                                        class="bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 focus:border-brand outline-none text-sm"
                                    />
                                    <input
                                        type="text"
                                        value={cronSchedule()}
                                        onInput={e => setCronSchedule(e.currentTarget.value)}
                                        placeholder="Cron (ex: */5 * * * * = a cada 5min)"
                                        class="bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 focus:border-brand outline-none text-sm font-mono"
                                    />
                                </div>
                                <textarea
                                    rows={3}
                                    value={cronPrompt()}
                                    onInput={e => setCronPrompt(e.currentTarget.value)}
                                    placeholder="Prompt para a IA executar (ex: Gere um resumo das últimas notícias de tecnologia)"
                                    class="w-full bg-zinc-900/50 border border-white/10 rounded-2xl px-4 py-3 focus:border-brand outline-none text-sm resize-none"
                                ></textarea>
                                <input
                                    type="text"
                                    value={cronTarget()}
                                    onInput={e => setCronTarget(e.currentTarget.value)}
                                    placeholder="JID do destinatário (opcional - envia resultado via WhatsApp)"
                                    class="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 focus:border-brand outline-none text-sm font-mono"
                                />
                                <div class="flex items-center justify-between">
                                    <p class="text-[10px] text-zinc-600">Formatos: * * * * * (min hora dia mês semana)</p>
                                    <button
                                        onClick={addCron}
                                        class="bg-brand hover:bg-brand-dark text-white font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all active:scale-95 text-sm"
                                    >
                                        <Plus size={16} /> Criar Job
                                    </button>
                                </div>
                            </div>

                            {/* Cron List */}
                            <div class="space-y-3">
                                <For each={cronJobs()} fallback={
                                    <div class="text-center py-12 text-zinc-600">
                                        <Clock size={40} class="mx-auto mb-3 opacity-30" />
                                        <p class="text-sm">Nenhum cron job configurado</p>
                                    </div>
                                }>
                                    {(job) => (
                                        <div class="p-4 bg-zinc-950/30 rounded-xl border border-white/5 space-y-2 hover:border-white/10 transition-all">
                                            <div class="flex items-center justify-between">
                                                <div class="flex items-center gap-3">
                                                    <div class={`w-3 h-3 rounded-full ${job.enabled ? 'bg-brand animate-pulse' : 'bg-zinc-700'}`}></div>
                                                    <p class="font-bold text-sm">{job.name}</p>
                                                    <code class="text-[10px] bg-zinc-800 px-2 py-0.5 rounded-md text-zinc-400 font-mono">{job.schedule}</code>
                                                </div>
                                                <div class="flex items-center gap-2">
                                                    <button onClick={() => toggleCron(job.id, job.enabled)} class="p-2 hover:bg-white/5 rounded-lg transition-colors">
                                                        {job.enabled ? <ToggleRight size={20} class="text-brand" /> : <ToggleLeft size={20} class="text-zinc-600" />}
                                                    </button>
                                                    <button onClick={() => removeCron(job.id)} class="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-zinc-600 hover:text-red-400">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                            <p class="text-xs text-zinc-500 ml-6 line-clamp-2">{job.prompt}</p>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </div>
                    </Show>

                    {/* ========== LOOP TASKS TAB ========== */}
                    <Show when={activeTab() === 'loop'}>
                        <div class="glass p-8 rounded-3xl space-y-8 animate-in fade-in duration-300">
                            <div>
                                <h2 class="text-xl font-bold flex items-center gap-2"><Repeat size={22} class="text-brand" /> Loop Tasks</h2>
                                <p class="text-sm text-zinc-500 mt-1">Tarefas contínuas que a IA executa até concluir. Funcionam por dias se necessário.</p>
                            </div>

                            {/* Add Loop Form */}
                            <div class="p-6 bg-zinc-950/50 rounded-2xl border border-white/5 space-y-4">
                                <h3 class="font-bold text-sm uppercase tracking-wider text-zinc-400">Nova Tarefa</h3>
                                <input
                                    type="text"
                                    value={loopName()}
                                    onInput={e => setLoopName(e.currentTarget.value)}
                                    placeholder="Nome da tarefa..."
                                    class="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 focus:border-brand outline-none text-sm"
                                />
                                <textarea
                                    rows={4}
                                    value={loopPrompt()}
                                    onInput={e => setLoopPrompt(e.currentTarget.value)}
                                    placeholder="Descreva a tarefa completa que a IA deve executar em loop (ex: Monitore o site X a cada iteração e me avise se o preço cair abaixo de R$100)"
                                    class="w-full bg-zinc-900/50 border border-white/10 rounded-2xl px-4 py-3 focus:border-brand outline-none text-sm resize-none"
                                ></textarea>
                                <div class="flex items-center justify-between">
                                    <p class="text-[10px] text-zinc-600">A IA inclui [TAREFA_CONCLUIDA] quando terminar naturalmente.</p>
                                    <button
                                        onClick={addLoop}
                                        class="bg-brand hover:bg-brand-dark text-white font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all active:scale-95 text-sm"
                                    >
                                        <Plus size={16} /> Criar Tarefa
                                    </button>
                                </div>
                            </div>

                            {/* Loop List */}
                            <div class="space-y-3">
                                <For each={loopTasks()} fallback={
                                    <div class="text-center py-12 text-zinc-600">
                                        <Repeat size={40} class="mx-auto mb-3 opacity-30" />
                                        <p class="text-sm">Nenhuma tarefa de loop criada</p>
                                    </div>
                                }>
                                    {(task) => (
                                        <div class="p-5 bg-zinc-950/30 rounded-xl border border-white/5 space-y-3 hover:border-white/10 transition-all">
                                            <div class="flex items-center justify-between">
                                                <div class="flex items-center gap-3">
                                                    <div class={`w-3 h-3 rounded-full ${task.status === 'running' ? 'bg-amber-400 animate-pulse'
                                                        : task.status === 'done' ? 'bg-brand'
                                                            : 'bg-zinc-700'
                                                        }`}></div>
                                                    <p class="font-bold text-sm">{task.name}</p>
                                                    <span class={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${task.status === 'running' ? 'bg-amber-400/10 text-amber-400'
                                                        : task.status === 'done' ? 'bg-brand/10 text-brand'
                                                            : 'bg-zinc-800 text-zinc-500'
                                                        }`}>
                                                        {task.status === 'running' ? 'Executando' : task.status === 'done' ? 'Concluída' : 'Parada'}
                                                    </span>
                                                    <code class="text-[10px] text-zinc-600">{task.iterations} iterações</code>
                                                </div>
                                                <div class="flex items-center gap-2">
                                                    {task.status === 'running'
                                                        ? <button onClick={() => stopLoop(task.id)} class="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-red-400">
                                                            <Square size={16} />
                                                        </button>
                                                        : <button onClick={() => startLoop(task.id)} class="p-2 hover:bg-brand/10 rounded-lg transition-colors text-brand">
                                                            <Play size={16} />
                                                        </button>
                                                    }
                                                    <button onClick={() => removeLoop(task.id)} class="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-zinc-600 hover:text-red-400">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                            <p class="text-xs text-zinc-500 ml-6 line-clamp-2">{task.prompt}</p>
                                            <Show when={task.last_result}>
                                                <div class="ml-6 p-3 bg-zinc-900/50 rounded-lg border border-white/5">
                                                    <p class="text-[10px] font-bold text-zinc-500 mb-1">Último resultado:</p>
                                                    <p class="text-xs text-zinc-400 line-clamp-3">{task.last_result}</p>
                                                </div>
                                            </Show>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </div>
                    </Show>

                </div>
            </div>
        </div>
    );
}

export default Settings;
