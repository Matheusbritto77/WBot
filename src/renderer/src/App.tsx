import { createSignal, createEffect } from 'solid-js';
import { useNavigate, useLocation } from '@solidjs/router';

export const [user, setUser] = createSignal<any>(null);

function App(props: any) {
    const navigate = useNavigate();
    const location = useLocation();

    createEffect(() => {
        // Tentar restaurar sessão do localStorage ao iniciar
        const savedToken = localStorage.getItem('auth_token');
        if (savedToken && !user()) {
            // Decodifica o payload do JWT basicamente (sem validar assinatura no front)
            try {
                const payload = JSON.parse(atob(savedToken.split('.')[1]));
                setUser({ id: payload.id, username: payload.username });
            } catch (e) {
                localStorage.removeItem('auth_token');
            }
        }

        // Global error handler
        window.onunhandledrejection = (event) => {
            console.error('Erro Assíncrono:', event.reason);
            if (event.reason?.message === 'Sessão expirada') {
                navigate('/login');
            }
        };

        // Redirecionamento de segurança
        if (!user() && location.pathname !== '/login' && location.pathname !== '/register') {
            navigate('/login');
        }
    });

    return (
        <div class="h-screen w-screen overflow-hidden">
            {props.children}
        </div>
    );
}

export default App;
