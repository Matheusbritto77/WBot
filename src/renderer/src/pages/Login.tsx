import { createSignal, Show } from 'solid-js';
import { useNavigate, A } from '@solidjs/router';
import { setUser } from '../App';
import { LogIn } from 'lucide-solid';

import { api } from '../lib/api';

function Login() {
    const [username, setUsername] = createSignal('');
    const [password, setPassword] = createSignal('');
    const [error, setError] = createSignal('');
    const [loading, setLoading] = createSignal(false);
    const navigate = useNavigate();

    const handleLogin = async (e: Event) => {
        e.preventDefault();
        setError('');

        if (username().length < 3) {
            setError('O usuário deve ter pelo menos 3 caracteres.');
            return;
        }

        setLoading(true);
        try {
            const result = await api.auth.login({ username: username(), password: password() });
            if (result) {
                setUser(result);
                navigate('/');
            } else {
                setError('Usuário ou senha inválidos');
            }
        } catch (e: any) {
            setError(e.message || 'Erro ao realizar login.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-6">
            <div class="w-full max-w-md glass rounded-2xl p-8 shadow-2xl animate-in fade-in zoom-in duration-500">
                <div class="flex flex-col items-center mb-8">
                    <div class="w-16 h-16 bg-brand/20 rounded-2xl flex items-center justify-center mb-4">
                        <LogIn size={32} class="text-brand" />
                    </div>
                    <h1 class="text-3xl font-bold tracking-tight">Bem-vindo</h1>
                    <p class="text-zinc-400 mt-2 text-center text-sm">Acesse sua conta para gerenciar seu assistente</p>
                </div>

                <form onSubmit={handleLogin} class="space-y-5">
                    <div class="space-y-2">
                        <label class="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">Usuário</label>
                        <input
                            type="text"
                            autocomplete="username"
                            class="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all"
                            onInput={e => setUsername(e.currentTarget.value)}
                            required
                        />
                    </div>
                    <div class="space-y-2">
                        <label class="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">Senha</label>
                        <input
                            type="password"
                            autocomplete="current-password"
                            class="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all"
                            onInput={e => setPassword(e.currentTarget.value)}
                            required
                        />
                    </div>

                    <Show when={error()}>
                        <p class="text-red-400 text-sm bg-red-400/10 p-3 rounded-lg border border-red-400/20">{error()}</p>
                    </Show>

                    <button
                        type="submit"
                        disabled={loading()}
                        class="w-full bg-brand hover:bg-brand-dark text-white font-bold py-3 rounded-xl shadow-lg shadow-brand/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading() ? (
                            <>
                                <div class="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                Entrando...
                            </>
                        ) : 'Entrar'}
                    </button>
                </form>

                <div class="mt-8 text-center">
                    <p class="text-zinc-500 text-sm">
                        Não tem uma conta?
                        <A href="/register" class="text-brand hover:underline font-semibold ml-1">Registre-se agora</A>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default Login;
