import { createSignal, Show } from 'solid-js';
import { useNavigate, A } from '@solidjs/router';
import { UserPlus, ArrowLeft } from 'lucide-solid';
import { api } from '../lib/api';

function Register() {
    const [username, setUsername] = createSignal('');
    const [password, setPassword] = createSignal('');
    const [error, setError] = createSignal('');
    const navigate = useNavigate();

    const handleRegister = async (e: Event) => {
        e.preventDefault();
        setError('');

        try {
            const result = await api.auth.register({ username: username(), password: password() });
            if (result.success) {
                navigate('/login');
            } else {
                setError(result.error || 'Erro ao registrar');
            }
        } catch (e: any) {
            setError(e.message || 'Erro de conexão.');
        }
    };

    return (
        <div class="min-h-screen flex items-center justify-center bg-zinc-950 p-6">
            <div class="w-full max-w-md glass rounded-2xl p-8 shadow-2xl">
                <div class="flex flex-col items-center mb-8">
                    <div class="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-4">
                        <UserPlus size={32} class="text-blue-500" />
                    </div>
                    <h1 class="text-3xl font-bold tracking-tight">Criar Conta</h1>
                    <p class="text-zinc-400 mt-2 text-center text-sm">Junte-se a nós para automatizar seu WhatsApp</p>
                </div>

                <form onSubmit={handleRegister} class="space-y-5">
                    <div class="space-y-2">
                        <label class="text-sm font-medium text-zinc-400">Usuário</label>
                        <input
                            type="text"
                            class="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 focus:border-blue-500 outline-none"
                            onInput={e => setUsername(e.currentTarget.value)}
                            required
                        />
                    </div>
                    <div class="space-y-2">
                        <label class="text-sm font-medium text-zinc-400">Senha</label>
                        <input
                            type="password"
                            class="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 focus:border-blue-500 outline-none"
                            onInput={e => setPassword(e.currentTarget.value)}
                            required
                        />
                    </div>

                    <Show when={error()}>
                        <p class="text-red-400 text-sm bg-red-400/10 p-3 rounded-lg border border-red-400/20">{error()}</p>
                    </Show>

                    <button
                        type="submit"
                        class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]"
                    >
                        Registrar
                    </button>
                </form>

                <div class="mt-8 text-center">
                    <A href="/login" class="text-zinc-500 hover:text-white text-sm flex items-center justify-center gap-2 transition-colors">
                        <ArrowLeft size={16} /> Voltar para o login
                    </A>
                </div>
            </div>
        </div>
    );
}

export default Register;
