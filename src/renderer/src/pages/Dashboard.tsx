import { useNavigate, A } from '@solidjs/router';
import { user, setUser } from '../App';
import {
    Settings as SettingsIcon,
    LogOut,
    User,
    MessageSquare,
    ChevronDown
} from 'lucide-solid';
import { createSignal, Show } from 'solid-js';

function Dashboard(props: any) {
    const navigate = useNavigate();
    const [showProfile, setShowProfile] = createSignal(false);

    const handleLogout = () => {
        setUser(null);
        navigate('/login');
    };

    return (
        <Show when={user()} fallback={<div class="h-screen bg-zinc-950" />}>
            <div class="h-screen flex flex-col bg-zinc-950 overflow-hidden">
                {/* Top Menu */}
                <header class="h-16 border-b border-white/5 bg-zinc-900/50 backdrop-blur-xl px-6 flex items-center justify-between sticky top-0 z-50">
                    <div class="flex items-center gap-8">
                        <div class="flex items-center gap-2">
                            <div class="w-8 h-8 bg-brand rounded-lg flex items-center justify-center">
                                <MessageSquare size={18} class="text-white" />
                            </div>
                            <span class="font-bold text-lg tracking-tight">BotAI <span class="text-brand text-xs align-top">SaaS</span></span>
                        </div>

                        <nav class="hidden md:flex items-center gap-1">
                            <A
                                href="/"
                                class="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
                                activeClass="bg-brand/10 text-brand"
                                end
                            >
                                Dashboard
                            </A>
                            <A
                                href="/automations"
                                class="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
                                activeClass="bg-brand/10 text-brand"
                            >
                                ⚡ Automações
                            </A>
                            <A
                                href="/settings"
                                class="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
                                activeClass="bg-brand/10 text-brand"
                            >
                                Configurações
                            </A>
                        </nav>
                    </div>

                    <div class="relative">
                        <button
                            onClick={() => setShowProfile(!showProfile())}
                            class="flex items-center gap-3 pl-3 pr-2 py-1.5 rounded-full hover:bg-white/5 transition-all outline-none group"
                        >
                            <div class="text-right flex flex-col justify-center">
                                <span class="text-sm font-semibold truncate max-w-[120px]">{user()?.username}</span>
                                <span class="text-[10px] text-zinc-500 uppercase font-bold tracking-tighter">Admin</span>
                            </div>
                            <div class="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold ring-2 ring-transparent group-hover:ring-brand/30 transition-all">
                                {user()?.username?.substring(0, 2).toUpperCase()}
                            </div>
                            <ChevronDown size={14} class={`text-zinc-500 transition-transform ${showProfile() ? 'rotate-180' : ''}`} />
                        </button>

                        <Show when={showProfile()}>
                            <div
                                class="absolute right-0 mt-2 w-56 glass rounded-2xl shadow-2xl p-2 animate-in fade-in slide-in-from-top-2 duration-200 z-[60]"
                                onClick={() => setShowProfile(false)}
                            >
                                <div class="p-3 mb-1">
                                    <p class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Sua Conta</p>
                                </div>
                                <button class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-white/10 transition-colors">
                                    <User size={16} class="text-zinc-400" /> Perfil
                                </button>
                                <button
                                    onClick={() => navigate('/settings')}
                                    class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-white/10 transition-colors"
                                >
                                    <SettingsIcon size={16} class="text-zinc-400" /> Configurações
                                </button>
                                <div class="h-px bg-white/5 my-2"></div>
                                <button
                                    onClick={handleLogout}
                                    class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-400/10 transition-colors"
                                >
                                    <LogOut size={16} /> Sair do Sistema
                                </button>
                            </div>
                        </Show>
                    </div>
                </header>

                {/* Main Content */}
                <main class="flex-1 overflow-y-auto overflow-x-hidden p-8 max-w-7xl mx-auto w-full custom-scrollbar">
                    {props.children}
                </main>
            </div>
        </Show>
    );
}

export default Dashboard;
