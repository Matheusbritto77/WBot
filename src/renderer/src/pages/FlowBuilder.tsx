import { createSignal, For, Show, onMount } from 'solid-js';
import { api } from '../lib/api';

// ==================== TYPES ====================
interface FlowNode {
    id: string;
    type: string;
    data: Record<string, any>;
    position: { x: number; y: number };
}

interface FlowEdge {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    label?: string;
}

interface AutomationFlow {
    id: string;
    name: string;
    description: string;
    nodes: FlowNode[];
    edges: FlowEdge[];
    trigger_type: string;
    trigger_value: string;
    enabled: boolean;
}

// ==================== NODE CONFIG ====================
// ==================== NODE CONFIG ====================
const NODE_CATEGORIES = {
    messaging: { label: 'Envio de Mensagens', color: '#3b82f6', icon: '✉️' },
    logic: { label: 'Inteligência & Lógica', color: '#a855f7', icon: '🧠' },
    tools: { label: 'Ferramentas Avançadas', color: '#f59e0b', icon: '🛠️' }
};

const NODE_TYPES: Record<string, { label: string; color: string; icon: string; category: string; description: string; fields: any[] }> = {
    trigger: {
        label: 'Gatilho de Início', color: '#22c55e', icon: '⚡', category: 'messaging',
        description: 'Define quando esta automação deve começar a rodar.',
        fields: [
            {
                key: 'trigger_type', label: 'Como ativar?', type: 'select', options: [
                    { value: 'keyword', label: 'Se a mensagem contiver...' },
                    { value: 'exact', label: 'Se a mensagem for igual a...' },
                    { value: 'starts_with', label: 'Se a mensagem começar com...' },
                    { value: 'regex', label: 'Padrão Inteligente (Regex)' },
                    { value: 'any_message', label: 'Qualquer Mensagem' },
                    { value: 'first_message', label: 'Primeira vez que a pessoa manda oi' },
                    { value: 'media', label: 'Quando receber foto/vídeo/áudio' }
                ]
            },
            { key: 'trigger_value', label: 'Palavra ou Termo', type: 'text', placeholder: 'Ex: preço, ajuda, /start' }
        ]
    },
    send_text: {
        label: 'Enviar Texto', color: '#3b82f6', icon: '💬', category: 'messaging',
        description: 'Envia uma mensagem de texto simples para o cliente.',
        fields: [{ key: 'text', label: 'Sua Mensagem', type: 'textarea', placeholder: 'Olá! Como posso ajudar?' }]
    },
    send_image: {
        label: 'Enviar Foto', color: '#8b5cf6', icon: '🖼️', category: 'messaging',
        description: 'Envia uma imagem com ou sem legenda.',
        fields: [
            { key: 'url', label: 'Link da Imagem', type: 'text', placeholder: 'https://site.com/foto.jpg' },
            { key: 'caption', label: 'Legenda da Foto', type: 'text', placeholder: 'Confira nossa oferta!' }
        ]
    },
    send_audio: {
        label: 'Mandar Áudio', color: '#f59e0b', icon: '🎵', category: 'messaging',
        description: 'Envia áudio ou gravação de voz (simula gravação).',
        fields: [
            { key: 'url', label: 'Link do Áudio (.mp3)', type: 'text', placeholder: 'https://site.com/audio.mp3' },
            { key: 'ptt', label: 'Simular "Gravando áudio..."?', type: 'toggle' }
        ]
    },
    send_video: {
        label: 'Enviar Vídeo', color: '#ef4444', icon: '🎬', category: 'messaging',
        description: 'Envia um vídeo curto para o cliente.',
        fields: [
            { key: 'url', label: 'Link do Vídeo (.mp4)', type: 'text', placeholder: 'https://site.com/video.mp4' },
            { key: 'caption', label: 'Legenda do Vídeo', type: 'text', placeholder: 'Veja o vídeo demonstrativo.' }
        ]
    },
    send_poll: {
        label: 'Criar Enquete', color: '#06b6d4', icon: '📊', category: 'messaging',
        description: 'Faz uma pergunta com várias opções de escolha.',
        fields: [
            { key: 'question', label: 'Pergunta da Enquete', type: 'text', placeholder: 'Qual sua cor favorita?' },
            { key: 'options', label: 'Opções (Uma por linha)', type: 'textarea', placeholder: 'Azul\nVermelho\nVerde' },
            { key: 'multiSelect', label: 'Permitir escolher mais de uma?', type: 'toggle' }
        ]
    },
    send_buttons: {
        label: 'Botões de Opção', color: '#ec4899', icon: '🔘', category: 'messaging',
        description: 'Envia botões clicáveis para facilitar a resposta.',
        fields: [
            { key: 'text', label: 'Texto do Convite', type: 'textarea', placeholder: 'Escolha uma das opções abaixo:' },
            { key: 'buttons', label: 'Botões (Um por linha)', type: 'textarea', placeholder: 'Falar com Atendente\nVer Catálogo\nSair' }
        ]
    },
    ai_response: {
        label: 'Resposta com IA', color: '#a855f7', icon: '🤖', category: 'logic',
        description: 'Usa Inteligência Artificial para responder de forma natural.',
        fields: [{ key: 'prompt', label: 'Como a IA deve agir?', type: 'textarea', placeholder: 'Você é um vendedor prestativo da nossa loja...' }]
    },
    delay: {
        label: 'Esperar um pouco', color: '#64748b', icon: '⏱️', category: 'logic',
        description: 'Dá um intervalo antes de mandar a próxima mensagem.',
        fields: [{ key: 'seconds', label: 'Quantos segundos esperar?', type: 'number', placeholder: '3' }]
    },
    condition: {
        label: 'Se / Então (Filtro)', color: '#f97316', icon: '🔀', category: 'logic',
        description: 'Divide o fluxo: se algo for verdade vai pra um lado, senão vai pra outro.',
        fields: [
            { key: 'left', label: 'Valor para comparar', type: 'text', placeholder: '{{_message}}' },
            {
                key: 'operator', label: 'Regra de Comparação', type: 'select', options: [
                    { value: '==', label: 'É igual a' },
                    { value: '!=', label: 'É diferente de' },
                    { value: 'contains', label: 'Contém o texto' },
                    { value: 'not_contains', label: 'Não contém o texto' },
                    { value: '>', label: 'É maior que' },
                    { value: '<', label: 'É menor que' }
                ]
            },
            { key: 'right', label: 'Comparar com o quê?', type: 'text', placeholder: 'sim' }
        ]
    },
    set_variable: {
        label: 'Lembrar Informação', color: '#14b8a6', icon: '📝', category: 'logic',
        description: 'Guarda um dado para usar depois na conversa com {{nome}}.',
        fields: [
            { key: 'name', label: 'Nome da "Gaveta" (Variável)', type: 'text', placeholder: 'nome_cliente' },
            { key: 'value', label: 'O que guardar nela?', type: 'text', placeholder: '{{_message}}' }
        ]
    },
    http_request: {
        label: 'Conectar com Site/API', color: '#6366f1', icon: '🌐', category: 'tools',
        description: 'Busca ou envia dados para outros sistemas (Webhooks).',
        fields: [
            { key: 'url', label: 'Link do Site/API', type: 'text', placeholder: 'https://api.meusite.com/v1/pedidos' },
            {
                key: 'method', label: 'Tipo de Ação (Método)', type: 'select', options: [
                    { value: 'GET', label: 'Buscar Dados (GET)' },
                    { value: 'POST', label: 'Enviar Dados (POST)' },
                    { value: 'PUT', label: 'Atualizar Dados (PUT)' },
                    { value: 'DELETE', label: 'Apagar Dados (DELETE)' }
                ]
            },
            { key: 'headers', label: 'Chaves de Acesso (Headers JSON)', type: 'textarea', placeholder: '{"Authorization": "Bearer TOKEN"}' },
            { key: 'body', label: 'Dados para Enviar (Body JSON)', type: 'textarea', placeholder: '{"status": "concluido"}' }
        ]
    }
};

// ==================== HELPERS ====================
const genId = () => `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

// ==================== COMPONENT ====================
export default function FlowBuilder() {
    const [flows, setFlows] = createSignal<AutomationFlow[]>([]);
    const [activeFlow, setActiveFlow] = createSignal<AutomationFlow | null>(null);
    const [dragging, setDragging] = createSignal<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);
    const [connecting, setConnecting] = createSignal<{ sourceId: string; sourceHandle?: string; mx: number; my: number } | null>(null);
    const [canvasOffset, setCanvasOffset] = createSignal({ x: 0, y: 0 });
    const [panning, setPanning] = createSignal<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
    const [selectedNode, setSelectedNode] = createSignal<string | null>(null);
    const [zoom, setZoom] = createSignal(1);
    const [showPalette, setShowPalette] = createSignal(false);
    const [saving, setSaving] = createSignal(false);
    const [contextMenu, setContextMenu] = createSignal<{ x: number, y: number, nodeId?: string, canvasX?: number, canvasY?: number } | null>(null);
    const [paletteSearch, setPaletteSearch] = createSignal('');
    const [flowsSearch, setFlowsSearch] = createSignal('');

    let canvasRef: HTMLDivElement | undefined;

    onMount(loadFlows);

    async function loadFlows() {
        const data = await api.automation.getAll();
        setFlows(data);
    }

    async function createFlow() {
        const id = genId();
        const newFlow: AutomationFlow = {
            id,
            name: 'Novo Fluxo',
            description: '',
            trigger_type: 'keyword',
            trigger_value: '',
            enabled: false,
            nodes: [{ id: 'trigger_0', type: 'trigger', data: {}, position: { x: 300, y: 80 } }],
            edges: []
        };
        await api.automation.save(newFlow);
        await loadFlows();
        setActiveFlow(newFlow);
    }

    async function saveFlow() {
        const flow = activeFlow();
        if (!flow) return;
        setSaving(true);
        await api.automation.save(flow);
        await loadFlows();
        setTimeout(() => setSaving(false), 600);
    }

    async function deleteFlow(id: string) {
        await api.automation.remove(id);
        if (activeFlow()?.id === id) setActiveFlow(null);
        await loadFlows();
    }

    async function toggleFlow(id: string, enabled: boolean) {
        await api.automation.toggle(id, enabled);
        await loadFlows();
    }

    function addNode(type: string, pos?: { x: number, y: number }) {
        const flow = activeFlow();
        if (!flow) return;
        const offset = canvasOffset();
        const z = zoom();
        const ctx = contextMenu();
        const finalPos = pos || (ctx?.canvasX !== undefined ? { x: ctx.canvasX, y: ctx.canvasY! } : { x: (-offset.x + 400) / z, y: (-offset.y + 300) / z });

        const node: FlowNode = {
            id: genId(),
            type,
            data: type === 'send_poll' ? { options: [] } : type === 'send_buttons' ? { buttons: [] } : {},
            position: finalPos
        };
        setActiveFlow({ ...flow, nodes: [...flow.nodes, node] });
        setSelectedNode(node.id);
        setShowPalette(false);
        setContextMenu(null);
    }

    function duplicateNode(nodeId: string) {
        const flow = activeFlow();
        if (!flow) return;
        const original = flow.nodes.find(n => n.id === nodeId);
        if (!original) return;

        const newNode: FlowNode = {
            ...JSON.parse(JSON.stringify(original)),
            id: genId(),
            position: { x: original.position.x + 30, y: original.position.y + 30 }
        };
        setActiveFlow({ ...flow, nodes: [...flow.nodes, newNode] });
        setContextMenu(null);
    }

    function removeNode(id: string) {
        const flow = activeFlow();
        if (!flow) return;
        setActiveFlow({
            ...flow,
            nodes: flow.nodes.filter(n => n.id !== id),
            edges: flow.edges.filter(e => e.source !== id && e.target !== id)
        });
        if (selectedNode() === id) setSelectedNode(null);
    }

    function updateNodeData(nodeId: string, key: string, value: any) {
        const flow = activeFlow();
        if (!flow) return;
        setActiveFlow({
            ...flow,
            nodes: flow.nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, [key]: value } } : n)
        });
    }

    function removeEdge(edgeId: string) {
        const flow = activeFlow();
        if (!flow) return;
        setActiveFlow({ ...flow, edges: flow.edges.filter(e => e.id !== edgeId) });
    }

    // ==================== CANVAS EVENTS ====================
    function getCanvasPos(e: MouseEvent) {
        if (!canvasRef) return { x: 0, y: 0 };
        const rect = canvasRef.getBoundingClientRect();
        const z = zoom();
        return {
            x: (e.clientX - rect.left - canvasOffset().x) / z,
            y: (e.clientY - rect.top - canvasOffset().y) / z
        };
    }

    function onMouseDown(e: MouseEvent) {
        setContextMenu(null);
        if (e.button === 1 || (e.button === 0 && e.target === canvasRef)) {
            setPanning({ startX: e.clientX, startY: e.clientY, origX: canvasOffset().x, origY: canvasOffset().y });
            e.preventDefault();
        }
    }

    function onContextMenu(e: MouseEvent, nodeId?: string) {
        e.preventDefault();
        e.stopPropagation();
        const pos = getCanvasPos(e);
        setContextMenu({ x: e.clientX, y: e.clientY, nodeId, canvasX: pos.x, canvasY: pos.y });
    }

    function onMouseMove(e: MouseEvent) {
        const p = panning();
        if (p) {
            setCanvasOffset({ x: p.origX + (e.clientX - p.startX), y: p.origY + (e.clientY - p.startY) });
            return;
        }

        const d = dragging();
        if (d) {
            const pos = getCanvasPos(e);
            const flow = activeFlow();
            if (!flow) return;
            setActiveFlow({
                ...flow,
                nodes: flow.nodes.map(n => n.id === d.nodeId ? { ...n, position: { x: pos.x - d.offsetX, y: pos.y - d.offsetY } } : n)
            });
            return;
        }

        const c = connecting();
        if (c && canvasRef) {
            const rect = canvasRef.getBoundingClientRect();
            setConnecting({ ...c, mx: e.clientX - rect.left, my: e.clientY - rect.top });
        }
    }

    function onMouseUp(e: MouseEvent) {
        setPanning(null);
        setDragging(null);

        const c = connecting();
        if (c) {
            const pos = getCanvasPos(e);
            const flow = activeFlow();
            if (flow) {
                const targetNode = flow.nodes.find(n =>
                    pos.x >= n.position.x && pos.x <= n.position.x + 260 &&
                    pos.y >= n.position.y && pos.y <= n.position.y + 60
                );
                if (targetNode && targetNode.id !== c.sourceId) {
                    const exists = flow.edges.some(e => e.source === c.sourceId && e.target === targetNode.id);
                    if (!exists) {
                        const edge: FlowEdge = {
                            id: genId(),
                            source: c.sourceId,
                            target: targetNode.id,
                            sourceHandle: c.sourceHandle
                        };
                        setActiveFlow({ ...flow, edges: [...flow.edges, edge] });
                    }
                }
            }
            setConnecting(null);
        }
    }

    function onWheel(e: WheelEvent) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(z => Math.max(0.2, Math.min(2, z + delta)));
    }

    // ==================== EDGE RENDERING ====================
    function getNodeCenter(node: FlowNode, side: 'bottom' | 'top') {
        const z = zoom();
        const off = canvasOffset();
        return {
            x: node.position.x * z + off.x + 130 * z,
            y: node.position.y * z + off.y + (side === 'bottom' ? 60 : 0) * z
        };
    }

    // ==================== RENDER ====================
    return (
        <div class="pt-24 pb-20 animate-in fade-in duration-700" style="min-height: 100vh;">
            <Show when={!activeFlow()} fallback={
                <FlowEditor
                    flow={activeFlow()!}
                    onUpdate={setActiveFlow}
                    onSave={saveFlow}
                    onBack={() => setActiveFlow(null)}
                    saving={saving()}
                    canvasRef={(el: HTMLDivElement) => canvasRef = el}
                    canvasRefEl={canvasRef}
                    canvasOffset={canvasOffset()}
                    zoom={zoom()}
                    dragging={dragging()}
                    connecting={connecting()}
                    selectedNode={selectedNode()}
                    showPalette={showPalette()}
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onWheel={onWheel}
                    setDragging={setDragging}
                    setConnecting={setConnecting}
                    setSelectedNode={setSelectedNode}
                    setShowPalette={setShowPalette}
                    addNode={addNode}
                    removeNode={removeNode}
                    updateNodeData={updateNodeData}
                    removeEdge={removeEdge}
                    getNodeCenter={getNodeCenter}
                    getCanvasPos={getCanvasPos}
                    setZoom={setZoom}
                    onContextMenu={onContextMenu}
                    duplicateNode={duplicateNode}
                    contextMenu={contextMenu()}
                    setContextMenu={setContextMenu}
                    paletteSearch={paletteSearch}
                    setPaletteSearch={setPaletteSearch}
                />
            }>
                {/* ============ HEADER ============ */}
                <div class="flex items-center justify-between mb-8">
                    <div>
                        <h1 class="text-3xl font-extrabold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">Automações Inteligentes</h1>
                        <p class="text-zinc-500 text-sm mt-1">Crie fluxos de conversa visuais e poderosos.</p>
                    </div>
                    <div class="flex items-center gap-4">
                        <input
                            type="text"
                            placeholder="Pesquisar fluxo..."
                            value={flowsSearch()}
                            onInput={(e) => setFlowsSearch(e.currentTarget.value)}
                            class="bg-white/5 border border-white/10 rounded-2xl px-4 py-2 text-sm outline-none focus:border-brand transition-all w-48 hidden sm:block"
                        />
                        <button onClick={createFlow} class="bg-brand text-white px-6 py-3 rounded-2xl font-bold hover:scale-105 transition-all shadow-lg shadow-brand/20">
                            + Novo Fluxo
                        </button>
                    </div>
                </div>         <Show when={flows().length === 0}>
                    <div class="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in duration-500">
                        <div class="w-24 h-24 bg-brand/10 rounded-full flex items-center justify-center mb-6 text-4xl animate-bounce">⚡</div>
                        <h3 class="text-xl font-bold mb-2">Sua jornada de automação começa aqui!</h3>
                        <p class="text-zinc-500 max-w-sm mb-8">Crie fluxos inteligentes para responder clientes, enviar arquivos e integrar com seus sistemas favoritos.</p>
                        <button onClick={createFlow} class="bg-brand text-white px-8 py-4 rounded-2xl font-bold hover:scale-105 transition-all shadow-xl shadow-brand/20">
                            + Criar Minha Primeira Automação
                        </button>
                    </div>
                </Show>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <For each={flows().filter(f => f.name.toLowerCase().includes(flowsSearch().toLowerCase()) || f.description.toLowerCase().includes(flowsSearch().toLowerCase()))}>
                        {(flow) => (
                            <div class="glass p-6 rounded-3xl group hover:border-brand/40 transition-all hover:translate-y-[-4px]">
                                <div class="flex items-start justify-between mb-4">
                                    <div class="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-2xl group-hover:bg-brand/10 group-hover:text-brand transition-colors">🤖</div>
                                    <div class={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${flow.enabled ? 'bg-green-500/20 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>
                                        {flow.enabled ? '● Ativo' : '○ Pausado'}
                                    </div>
                                </div>
                                <h3 class="text-lg font-bold mb-1 group-hover:text-brand transition-colors">{flow.name}</h3>
                                <p class="text-sm text-zinc-500 line-clamp-2 mb-6 h-10">{flow.description || 'Nenhuma descrição adicionada.'}</p>

                                <div class="flex items-center justify-between border-t border-white/5 pt-4">
                                    <div class="flex gap-2">
                                        <button onClick={() => toggleFlow(flow.id, !flow.enabled)} class="text-xs font-bold hover:text-white transition-colors">{flow.enabled ? 'Pausar' : 'Ativar'}</button>
                                        <button onClick={() => deleteFlow(flow.id)} class="text-xs font-bold text-red-500/60 hover:text-red-400 transition-colors">Excluir</button>
                                    </div>
                                    <button
                                        onClick={() => setActiveFlow(flow)}
                                        class="bg-brand/10 text-brand px-4 py-2 rounded-xl text-xs font-bold group-hover:bg-brand group-hover:text-white transition-all"
                                    >
                                        Editar Fluxo
                                    </button>
                                </div>
                            </div>
                        )}
                    </For>
                </div>
            </Show>
        </div>
    );
}

// ==================== FLOW EDITOR ====================
function FlowEditor(props: any) {
    const flow = () => props.flow as AutomationFlow;

    return (
        <div class="space-y-4">
            {/* ===== HEADER ===== */}
            <div class="flex items-center justify-between gap-4 flex-wrap">
                <div class="flex items-center gap-4">
                    <button onClick={props.onBack} class="bg-zinc-800 hover:bg-zinc-700 w-10 h-10 rounded-xl flex items-center justify-center transition-all">←</button>
                    <div>
                        <input
                            value={flow().name}
                            onInput={(e) => props.onUpdate({ ...flow(), name: e.currentTarget.value })}
                            class="text-2xl font-bold bg-transparent outline-none border-b border-transparent hover:border-white/20 focus:border-brand transition-all"
                            style="min-width: 200px;"
                        />
                        <input
                            value={flow().description}
                            onInput={(e) => props.onUpdate({ ...flow(), description: e.currentTarget.value })}
                            placeholder="Adicionar descrição..."
                            class="block text-xs text-zinc-500 bg-transparent outline-none mt-1 w-full"
                        />
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <button onClick={() => props.setShowPalette(!props.showPalette)} class="bg-brand/20 text-brand px-4 py-2 rounded-xl hover:bg-brand/30 transition-all flex items-center gap-2 text-sm font-bold">
                        <span class="text-lg">+</span> Bloco
                    </button>
                    <button
                        onClick={props.onSave}
                        disabled={props.saving}
                        class="bg-green-500 hover:bg-green-600 text-white px-5 py-2 rounded-xl transition-all flex items-center gap-2 text-sm font-bold disabled:opacity-50"
                    >
                        {props.saving ? '✓ Salvo' : '💾 Salvar'}
                    </button>
                </div>
            </div>


            {/* ===== PALETTE ===== */}
            <Show when={props.showPalette}>
                <div class="glass p-6 rounded-3xl animate-in slide-in-from-top duration-300 max-h-[80vh] overflow-y-auto custom-scrollbar">
                    <div class="flex items-center justify-between mb-6">
                        <div class="flex-1">
                            <p class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Painel de Elementos</p>
                            <h2 class="text-lg font-bold">O que você deseja adicionar?</h2>
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar bloco..."
                            value={props.paletteSearch()}
                            onInput={(e) => props.setPaletteSearch(e.currentTarget.value)}
                            class="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-brand transition-all w-64"
                        />
                    </div>

                    <div class="space-y-8">
                        <For each={Object.entries(NODE_CATEGORIES)}>
                            {([catKey, catCfg]) => {
                                const nodes = Object.entries(NODE_TYPES).filter(([k, v]) =>
                                    v.category === catKey &&
                                    v.label.toLowerCase().includes(props.paletteSearch().toLowerCase()) &&
                                    (k !== 'trigger' || !flow().nodes.some(n => n.type === 'trigger'))
                                );

                                return (
                                    <Show when={nodes.length > 0}>
                                        <div>
                                            <div class="flex items-center gap-2 mb-3">
                                                <span class="text-xl">{catCfg.icon}</span>
                                                <span class="text-xs font-bold uppercase tracking-widest text-zinc-400">{catCfg.label}</span>
                                            </div>
                                            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                                <For each={nodes}>
                                                    {([key, cfg]) => (
                                                        <button
                                                            onClick={() => props.addNode(key)}
                                                            class="group flex flex-col items-start gap-2 p-4 rounded-2xl bg-zinc-900/60 hover:bg-zinc-800 border border-white/5 hover:border-white/20 transition-all text-left relative overflow-hidden"
                                                        >
                                                            <div class="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-white/5 to-transparent rounded-bl-full pointer-events-none transition-transform group-hover:scale-110" />
                                                            <div class="flex items-center gap-3">
                                                                <span class="text-2xl bg-zinc-800 w-10 h-10 rounded-xl flex items-center justify-center border border-white/5 shadow-lg shadow-black/20 group-hover:scale-110 transition-transform">{cfg.icon}</span>
                                                                <div>
                                                                    <span class="text-sm font-bold block" style={{ color: cfg.color }}>{cfg.label}</span>
                                                                    <span class="text-[10px] text-zinc-500 font-medium">{NODE_CATEGORIES[cfg.category as keyof typeof NODE_CATEGORIES]?.label}</span>
                                                                </div>
                                                            </div>
                                                            <p class="text-[10px] text-zinc-400 leading-relaxed mt-1">{cfg.description}</p>
                                                        </button>
                                                    )}
                                                </For>
                                            </div>
                                        </div>
                                    </Show>
                                );
                            }}
                        </For>
                    </div>

                    <button
                        onClick={() => props.setShowPalette(false)}
                        class="w-full mt-8 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold transition-all border border-white/5"
                    >
                        Fechar Painel
                    </button>
                </div>
            </Show>

            {/* ===== CANVAS ===== */}
            <div
                ref={props.canvasRef}
                onMouseDown={props.onMouseDown}
                onMouseMove={props.onMouseMove}
                onMouseUp={props.onMouseUp}
                onWheel={props.onWheel}
                class="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0c0c0e] shadow-inner"
                style="height: 65vh; cursor: grab;"
            >
                {/* SVG Canvas Content (Edges & Grid) */}
                <svg class="absolute inset-0 w-full h-full pointer-events-none" style="z-index: 1;">
                    <defs>
                        <pattern id="gridLarge" width={100 * props.zoom} height={100 * props.zoom} patternUnits="userSpaceOnUse" x={props.canvasOffset.x % (100 * props.zoom)} y={props.canvasOffset.y % (100 * props.zoom)}>
                            <path d={`M ${100 * props.zoom} 0 L 0 0 0 ${100 * props.zoom}`} fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1" />
                        </pattern>
                        <pattern id="gridSmall" width={20 * props.zoom} height={20 * props.zoom} patternUnits="userSpaceOnUse" x={props.canvasOffset.x % (20 * props.zoom)} y={props.canvasOffset.y % (20 * props.zoom)}>
                            <path d={`M ${20 * props.zoom} 0 L 0 0 0 ${20 * props.zoom}`} fill="none" stroke="rgba(255,255,255,0.02)" stroke-width="0.5" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#gridSmall)" class="pointer-events-none" />
                    <rect width="100%" height="100%" fill="url(#gridLarge)" class="pointer-events-none" />

                    <g transform={`translate(${props.canvasOffset.x}, ${props.canvasOffset.y}) scale(${props.zoom})`}>
                        <For each={flow().edges}>
                            {(edge) => {
                                const sourceNode = () => flow().nodes.find((n: FlowNode) => n.id === edge.source);
                                const targetNode = () => flow().nodes.find((n: FlowNode) => n.id === edge.target);

                                return (
                                    <Show when={sourceNode() && targetNode()}>
                                        {(() => {
                                            const s = () => props.getNodeCenter(sourceNode()!, 'bottom');
                                            const t = () => props.getNodeCenter(targetNode()!, 'top');
                                            const midY = () => (s().y + t().y) / 2;

                                            return (
                                                <g class="pointer-events-auto cursor-pointer" onClick={() => props.removeEdge(edge.id)}>
                                                    <path
                                                        d={`M ${s().x} ${s().y} C ${s().x} ${midY()}, ${t().x} ${midY()}, ${t().x} ${t().y}`}
                                                        stroke={edge.sourceHandle === 'false' ? '#ef4444' : '#22c55e'}
                                                        stroke-width="2"
                                                        fill="none"
                                                        stroke-dasharray={edge.sourceHandle === 'false' ? '6 4' : 'none'}
                                                        opacity="0.6"
                                                    />
                                                    <path
                                                        d={`M ${s().x} ${s().y} C ${s().x} ${midY()}, ${t().x} ${midY()}, ${t().x} ${t().y}`}
                                                        stroke="transparent"
                                                        stroke-width="15"
                                                        fill="none"
                                                    />
                                                    <Show when={edge.sourceHandle}>
                                                        <text x={(s().x + t().x) / 2} y={midY() - 6} fill={edge.sourceHandle === 'false' ? '#ef4444' : '#22c55e'} font-size="10" text-anchor="middle" font-weight="bold">
                                                            {edge.sourceHandle === 'true' ? 'SIM' : 'NÃO'}
                                                        </text>
                                                    </Show>
                                                </g>
                                            );
                                        })()}
                                    </Show>
                                );
                            }}
                        </For>

                        {/* Connecting line */}
                        <Show when={props.connecting}>
                            {(() => {
                                const c = () => props.connecting;
                                const sourceNode = () => flow().nodes.find((n: FlowNode) => n.id === c()?.sourceId);
                                return (
                                    <Show when={sourceNode()}>
                                        {(() => {
                                            const s = () => props.getNodeCenter(sourceNode()!, 'bottom');
                                            return (
                                                <line
                                                    x1={s().x} y1={s().y}
                                                    x2={c()?.mx ?? 0} y2={c()?.my ?? 0}
                                                    stroke="#3b82f6" stroke-width="2" stroke-dasharray="6 4" opacity="0.8"
                                                />
                                            );
                                        })()}
                                    </Show>
                                );
                            })()}
                        </Show>
                    </g>
                </svg>

                {/* Nodes */}
                <div class="absolute inset-0" style={`transform: translate(${props.canvasOffset.x}px, ${props.canvasOffset.y}px) scale(${props.zoom}); transform-origin: 0 0; z-index: 2;`}>
                    <For each={flow().nodes}>
                        {(node) => {
                            const cfg = () => NODE_TYPES[node.type] || { label: node.type, color: '#666', icon: '❓', fields: [] };
                            const isSelected = () => props.selectedNode === node.id;

                            return (
                                <div
                                    class="absolute select-none"
                                    style={`left: ${node.position.x}px; top: ${node.position.y}px; width: 260px;`}
                                    onMouseDown={(e) => {
                                        e.stopPropagation();
                                        const pos = props.getCanvasPos(e);
                                        props.setDragging({ nodeId: node.id, offsetX: pos.x - node.position.x, offsetY: pos.y - node.position.y });
                                        props.setSelectedNode(node.id);
                                    }}
                                    onContextMenu={(e) => props.onContextMenu(e, node.id)}
                                >
                                    {/* Node Box */}
                                    <div
                                        class="rounded-xl border-2 shadow-xl transition-all hover:shadow-2xl"
                                        style={`border-color: ${isSelected() ? cfg().color : 'rgba(255,255,255,0.08)'}; background: rgba(24,24,27,0.95); backdrop-filter: blur(10px);`}
                                    >
                                        {/* Node Header */}
                                        <div class="flex items-center gap-2 px-3 py-2 border-b border-white/5" style={`background: ${cfg().color}15;`}>
                                            <span class="text-lg">{cfg().icon}</span>
                                            <span class="text-xs font-bold flex-1" style={`color: ${cfg().color}`}>{cfg().label}</span>
                                            <div class="flex items-center gap-1">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); props.duplicateNode(node.id); }}
                                                    title="Duplicar"
                                                    class="text-zinc-600 hover:text-white transition-colors text-[10px] p-1"
                                                >
                                                    📋
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); props.onContextMenu(e, node.id); }}
                                                    class="text-zinc-600 hover:text-white transition-colors text-xs p-1"
                                                >
                                                    •••
                                                </button>
                                            </div>
                                        </div>

                                        {/* Node Fields (inline edit) */}
                                        <Show when={isSelected() && cfg().fields.length > 0}>
                                            <div class="p-3 space-y-2" onMouseDown={(e) => e.stopPropagation()}>
                                                <For each={cfg().fields}>
                                                    {(field) => (
                                                        <div>
                                                            <label class="text-[9px] text-zinc-500 uppercase font-bold tracking-wider mb-1 block">{field.label}</label>
                                                            {field.type === 'textarea' ? (
                                                                <>
                                                                    <textarea
                                                                        value={node.data[field.key] ?? ''}
                                                                        onInput={(e) => props.updateNodeData(node.id, field.key, e.currentTarget.value)}
                                                                        placeholder={field.placeholder}
                                                                        rows={3}
                                                                        class="w-full bg-zinc-900/80 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-brand transition-all resize-none font-medium"
                                                                    />
                                                                    <div class="flex items-center gap-1.5 mt-1.5">
                                                                        <button
                                                                            onClick={() => props.updateNodeData(node.id, field.key, (node.data[field.key] || '') + '{{_message}}')}
                                                                            class="text-[9px] bg-white/5 hover:bg-white/10 px-1.5 py-1 rounded transition-colors text-zinc-400 border border-white/5"
                                                                        >
                                                                            + Mensagem do Cliente
                                                                        </button>
                                                                        <button
                                                                            onClick={() => props.updateNodeData(node.id, field.key, (node.data[field.key] || '') + '{{_aiResponse}}')}
                                                                            class="text-[9px] bg-white/5 hover:bg-white/10 px-1.5 py-1 rounded transition-colors text-zinc-400 border border-white/5"
                                                                        >
                                                                            + Resposta da IA
                                                                        </button>
                                                                    </div>
                                                                </>
                                                            ) : field.type === 'select' ? (
                                                                <select
                                                                    value={node.data[field.key] ?? ''}
                                                                    onChange={(e) => props.updateNodeData(node.id, field.key, e.currentTarget.value)}
                                                                    class="w-full bg-zinc-900/80 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-brand transition-all"
                                                                >
                                                                    <For each={field.options || []}>
                                                                        {(opt) => <option value={opt.value}>{opt.label}</option>}
                                                                    </For>
                                                                </select>
                                                            ) : field.type === 'toggle' ? (
                                                                <button
                                                                    onClick={() => props.updateNodeData(node.id, field.key, !node.data[field.key])}
                                                                    class={`w-10 h-6 rounded-full transition-all relative ${node.data[field.key] ? 'bg-brand' : 'bg-zinc-700'}`}
                                                                >
                                                                    <div class={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${node.data[field.key] ? 'right-0.5' : 'left-0.5'}`}></div>
                                                                </button>
                                                            ) : (
                                                                <input
                                                                    type={field.type === 'number' ? 'number' : 'text'}
                                                                    value={node.data[field.key] ?? ''}
                                                                    onInput={(e) => props.updateNodeData(node.id, field.key, field.type === 'number' ? Number(e.currentTarget.value) : e.currentTarget.value)}
                                                                    placeholder={field.placeholder}
                                                                    class="w-full bg-zinc-900/80 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-brand transition-all font-mono"
                                                                />
                                                            )}
                                                        </div>
                                                    )}
                                                </For>
                                            </div>
                                        </Show>

                                        {/* Preview (when not selected) */}
                                        <Show when={!isSelected()}>
                                            <div class="px-3 py-2 bg-black/20 italic">
                                                <p class="text-[10px] text-zinc-500 truncate">
                                                    {(() => {
                                                        if (node.type === 'send_text' || node.type === 'ai_response') return node.data.text || node.data.prompt || 'Vazio...';
                                                        if (node.type === 'delay') return `Espera ${node.data.seconds || 0} segundos`;
                                                        if (node.type === 'condition') return `${node.data.left || '?'} ${node.data.operator || '=='} ${node.data.right || '?'}`;
                                                        if (node.type === 'trigger') return `${NODE_TYPES.trigger.fields[0].options?.find((o: any) => o.value === node.data.trigger_type)?.label || 'Gatilho'}: ${node.data.trigger_value || ''}`;
                                                        return node.data.url || node.data.question || node.data.name || 'Clique para ver...';
                                                    })()}
                                                </p>
                                            </div>
                                        </Show>
                                    </div>

                                    {/* Connection Points */}
                                    {/* Input (top) */}
                                    <Show when={node.type !== 'trigger'}>
                                        <div class="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-zinc-700 border-2 border-zinc-500 hover:bg-brand hover:border-brand transition-all" style="z-index: 10;" />
                                    </Show>

                                    {/* Output (bottom) */}
                                    <Show when={node.type !== 'condition'}>
                                        <div class="absolute -bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center">
                                            <div
                                                class="w-4 h-4 rounded-full bg-zinc-800 border-2 border-white/20 hover:bg-green-500 hover:border-green-400 transition-all cursor-crosshair shadow-lg"
                                                style="z-index: 10;"
                                                onMouseDown={(e) => {
                                                    e.stopPropagation();
                                                    const rect = (props.canvasRefEl as HTMLDivElement)?.getBoundingClientRect() || { left: 0, top: 0 };
                                                    props.setConnecting({ sourceId: node.id, mx: e.clientX - rect.left, my: e.clientY - rect.top });
                                                }}
                                            />
                                            <span class="text-[8px] font-bold text-zinc-500 uppercase mt-1">Próximo</span>
                                        </div>
                                    </Show>

                                    {/* Condition: TRUE / FALSE handles */}
                                    <Show when={node.type === 'condition'}>
                                        <div class="absolute -bottom-6 left-[25%] -translate-x-1/2 flex flex-col items-center">
                                            <div
                                                class="w-4 h-4 rounded-full bg-zinc-800 border-2 border-green-500/50 hover:bg-green-500 transition-all cursor-crosshair shadow-lg"
                                                style="z-index: 10;"
                                                onMouseDown={(e) => {
                                                    e.stopPropagation();
                                                    const rect = (props.canvasRefEl as HTMLDivElement)?.getBoundingClientRect() || { left: 0, top: 0 };
                                                    props.setConnecting({ sourceId: node.id, sourceHandle: 'true', mx: e.clientX - rect.left, my: e.clientY - rect.top });
                                                }}
                                            />
                                            <span class="text-[8px] font-bold text-green-500 uppercase mt-1">Verdade (Sim)</span>
                                        </div>
                                        <div class="absolute -bottom-6 left-[75%] -translate-x-1/2 flex flex-col items-center">
                                            <div
                                                class="w-4 h-4 rounded-full bg-zinc-800 border-2 border-red-500/50 hover:bg-red-500 transition-all cursor-crosshair shadow-lg"
                                                style="z-index: 10;"
                                                onMouseDown={(e) => {
                                                    e.stopPropagation();
                                                    const rect = (props.canvasRefEl as HTMLDivElement)?.getBoundingClientRect() || { left: 0, top: 0 };
                                                    props.setConnecting({ sourceId: node.id, sourceHandle: 'false', mx: e.clientX - rect.left, my: e.clientY - rect.top });
                                                }}
                                            />
                                            <span class="text-[8px] font-bold text-red-500 uppercase mt-1">Falso (Não)</span>
                                        </div>
                                    </Show>
                                </div>
                            );
                        }}
                    </For>
                </div>

                {/* Zoom Controls */}
                <div class="absolute bottom-4 right-4 flex items-center gap-2 bg-zinc-900/90 border border-white/10 rounded-xl px-3 py-2" style="z-index: 20;">
                    <button onClick={() => props.setZoom((z: number) => Math.max(0.2, z - 0.1))} class="text-zinc-400 hover:text-white transition-colors font-bold">−</button>
                    <span class="text-xs text-zinc-500 w-12 text-center">{Math.round(props.zoom * 100)}%</span>
                    <button onClick={() => props.setZoom((z: number) => Math.min(2, z + 0.1))} class="text-zinc-400 hover:text-white transition-colors font-bold">+</button>
                </div>

                {/* Help */}
                <div class="absolute bottom-4 left-4 text-[10px] text-zinc-600 space-y-1" style="z-index: 20;">
                    <p>🖱️ Scroll: Zoom | Botão Direito: Menu</p>
                    <p>🔵 Arraste os pontos para conectar nós</p>
                </div>

                {/* Context Menu */}
                <Show when={props.contextMenu}>
                    <div
                        class="fixed glass rounded-2xl shadow-2xl p-2 min-w-[160px] animate-in fade-in zoom-in-95 duration-150 z-[100]"
                        style={`left: ${props.contextMenu?.x}px; top: ${props.contextMenu?.y}px;`}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <Show when={props.contextMenu?.nodeId} fallback={
                            <>
                                <p class="px-3 py-1.5 text-[9px] font-bold text-zinc-500 uppercase tracking-widest border-b border-white/5 mb-1">Canvas</p>
                                <button onClick={() => { props.setShowPalette(true); props.setContextMenu(null); }} class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs hover:bg-white/10 transition-colors text-left">
                                    ➕ Adicionar Bloco
                                </button>
                                <button onClick={() => props.onSave()} class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs hover:bg-white/10 transition-colors text-left">
                                    💾 Salvar Fluxo
                                </button>
                                <div class="h-px bg-white/5 my-1" />
                                <button onClick={() => props.onBack()} class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs hover:bg-white/10 transition-colors text-left">
                                    ← Voltar à Lista
                                </button>
                            </>
                        }>
                            <p class="px-3 py-1.5 text-[9px] font-bold text-zinc-500 uppercase tracking-widest border-b border-white/5 mb-1">Opções do Bloco</p>
                            <button onClick={() => props.duplicateNode(props.contextMenu!.nodeId!)} class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs hover:bg-white/10 transition-colors text-left font-medium">
                                📋 Duplicar Bloco
                            </button>
                            <button onClick={() => { props.removeNode(props.contextMenu!.nodeId!); props.setContextMenu(null); }} class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs hover:bg-red-400/10 text-red-400 transition-colors text-left">
                                🗑️ Excluir Bloco
                            </button>
                        </Show>
                    </div>
                </Show>
            </div>
        </div>
    );
}
