import { createSignal, createEffect } from 'solid-js';
import { useNavigate, useLocation } from '@solidjs/router';

export const [user, setUser] = createSignal<any>(null);

function App(props: any) {
    const navigate = useNavigate();
    const location = useLocation();

    createEffect(() => {
        // Only redirect to login if not already there or in register
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
