export const isElectron = !!(window as any).botApp;

const API_BASE = 'http://localhost:3000/api';

const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

const webFetch = async (path: string, options: any = {}) => {
    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
            ...(options.headers || {})
        }
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Erro na requisição');
    }
    return response.json();
};

export interface APIBridge {
    auth: {
        login: (creds: any) => Promise<any>;
        register: (creds: any) => Promise<any>;
    };
    settings: {
        get: (key: string) => Promise<any>;
        set: (key: string, value: any) => Promise<any>;
        onSettingsChanged: (cb: (data: { key: string, value: any }) => void) => () => void;
    };
    stats: {
        getSummary: () => Promise<any>;
    };
    whatsapp: {
        getStatus: () => Promise<string>;
        getQR: () => Promise<string | null>;
        connect: () => Promise<any>;
        logout: () => Promise<any>;
        onStatusChanged: (cb: (s: string) => void) => () => void;
        onQRReceived: (cb: (q: string) => void) => () => void;
        onActivity: (cb: (data: any) => void) => () => void;
        getGroups: (force?: boolean) => Promise<any[]>;
    };
    mcp: {
        getAll: () => Promise<any[]>;
        add: (server: any) => Promise<any>;
        remove: (id: string) => Promise<any>;
        toggle: (id: string, enabled: boolean) => Promise<any>;
    };
    cron: {
        getAll: () => Promise<any[]>;
        add: (job: any) => Promise<any>;
        remove: (id: string) => Promise<any>;
        toggle: (id: string, enabled: boolean) => Promise<any>;
    };
    loop: {
        getAll: () => Promise<any[]>;
        add: (task: any) => Promise<any>;
        remove: (id: string) => Promise<any>;
        start: (id: string) => Promise<any>;
        stop: (id: string) => Promise<any>;
        onStatusChanged: (cb: () => void) => () => void;
    };
    automation: {
        getAll: () => Promise<any[]>;
        get: (id: string) => Promise<any>;
        save: (flow: any) => Promise<any>;
        remove: (id: string) => Promise<any>;
        toggle: (id: string, enabled: boolean) => Promise<any>;
    };
}

export const api: APIBridge = {
    auth: {
        login: async (creds: any) => {
            if (isElectron) return (window as any).botApp.auth.login(creds);
            const res = await webFetch('/auth/login', { method: 'POST', body: JSON.stringify(creds) });
            localStorage.setItem('auth_token', res.token);
            return res.user;
        },
        register: async (creds: any) => {
            if (isElectron) return (window as any).botApp.auth.register(creds);
            return webFetch('/auth/register', { method: 'POST', body: JSON.stringify(creds) });
        }
    },
    settings: {
        get: async (key: string) => {
            if (isElectron) return (window as any).botApp.settings.get(key);
            const res = await webFetch(`/settings/${key}`);
            return res.value;
        },
        set: async (key: string, value: any) => {
            if (isElectron) return (window as any).botApp.settings.set(key, value);
            return webFetch('/settings', { method: 'POST', body: JSON.stringify({ key, value }) });
        },
        onSettingsChanged: (cb: (data: { key: string, value: any }) => void) => {
            if (isElectron) return (window as any).botApp.settings.onSettingsChanged(cb);
            return () => { };
        }
    },
    stats: {
        getSummary: async () => {
            if (isElectron) return (window as any).botApp.stats.getSummary();
            return webFetch('/stats/summary');
        }
    },
    whatsapp: {
        getStatus: async () => {
            if (isElectron) return (window as any).botApp.whatsapp.getStatus();
            return webFetch('/whatsapp/status');
        },
        getQR: async () => {
            if (isElectron) return (window as any).botApp.whatsapp.getQR();
            return webFetch('/whatsapp/qr');
        },
        connect: async () => {
            if (isElectron) return (window as any).botApp.whatsapp.connect();
            return webFetch('/whatsapp/connect', { method: 'POST' });
        },
        logout: async () => {
            if (isElectron) return (window as any).botApp.whatsapp.logout();
            return webFetch('/whatsapp/logout', { method: 'POST' });
        },
        onStatusChanged: (cb: (s: string) => void) => {
            if (isElectron) return (window as any).botApp.whatsapp.onStatusChanged(cb);
            const interval = setInterval(async () => {
                try {
                    const status = await webFetch('/whatsapp/status');
                    cb(status);
                } catch (e) { }
            }, 3000);
            return () => clearInterval(interval);
        },
        onQRReceived: (cb: (q: string) => void) => {
            if (isElectron) return (window as any).botApp.whatsapp.onQRReceived(cb);
            const interval = setInterval(async () => {
                try {
                    const q = await webFetch('/whatsapp/qr');
                    if (q) cb(q);
                } catch (e) { }
            }, 5000);
            return () => clearInterval(interval);
        },
        onActivity: (cb: (data: any) => void) => {
            if (isElectron) return (window as any).botApp.whatsapp.onActivity(cb);
            return () => { };
        },
        getGroups: async (force = false) => {
            if (isElectron) return (window as any).botApp.whatsapp.getGroups(force);
            return webFetch(`/whatsapp/groups?force=${force}`);
        }
    },
    mcp: {
        getAll: async () => {
            if (isElectron) return (window as any).botApp.mcp.getAll();
            return webFetch('/mcp');
        },
        add: async (server: any) => {
            if (isElectron) return (window as any).botApp.mcp.add(server);
            return webFetch('/mcp', { method: 'POST', body: JSON.stringify(server) });
        },
        remove: async (id: string) => {
            if (isElectron) return (window as any).botApp.mcp.remove(id);
            return webFetch(`/mcp/${id}`, { method: 'DELETE' });
        },
        toggle: async (id: string, enabled: boolean) => {
            if (isElectron) return (window as any).botApp.mcp.toggle(id, enabled);
            return webFetch(`/mcp/${id}/toggle`, { method: 'PATCH', body: JSON.stringify({ enabled }) });
        }
    },
    cron: {
        getAll: async () => {
            if (isElectron) return (window as any).botApp.cron.getAll();
            return webFetch('/cron');
        },
        add: async (job: any) => {
            if (isElectron) return (window as any).botApp.cron.add(job);
            return webFetch('/cron', { method: 'POST', body: JSON.stringify(job) });
        },
        remove: async (id: string) => {
            if (isElectron) return (window as any).botApp.cron.remove(id);
            return webFetch(`/cron/${id}`, { method: 'DELETE' });
        },
        toggle: async (id: string, enabled: boolean) => {
            if (isElectron) return (window as any).botApp.cron.toggle(id, enabled);
            return webFetch(`/cron/${id}/toggle`, { method: 'PATCH', body: JSON.stringify({ enabled }) });
        }
    },
    loop: {
        getAll: async () => {
            if (isElectron) return (window as any).botApp.loop.getAll();
            return webFetch('/loop');
        },
        add: async (task: any) => {
            if (isElectron) return (window as any).botApp.loop.add(task);
            return webFetch('/loop', { method: 'POST', body: JSON.stringify(task) });
        },
        remove: async (id: string) => {
            if (isElectron) return (window as any).botApp.loop.remove(id);
            return webFetch(`/loop/${id}`, { method: 'DELETE' });
        },
        start: async (id: string) => {
            if (isElectron) return (window as any).botApp.loop.start(id);
            return webFetch(`/loop/${id}/start`, { method: 'POST' });
        },
        stop: async (id: string) => {
            if (isElectron) return (window as any).botApp.loop.stop(id);
            return webFetch(`/loop/${id}/stop`, { method: 'POST' });
        },
        onStatusChanged: (cb: () => void) => {
            if (isElectron) return (window as any).botApp.loop.onStatusChanged(cb);
            return () => { };
        }
    },
    automation: {
        getAll: async () => {
            if (isElectron) return (window as any).botApp.automation.getAll();
            return webFetch('/automation');
        },
        get: async (id: string) => {
            if (isElectron) return (window as any).botApp.automation.get(id);
            return webFetch(`/automation/${id}`);
        },
        save: async (flow: any) => {
            if (isElectron) return (window as any).botApp.automation.save(flow);
            return webFetch('/automation', { method: 'POST', body: JSON.stringify(flow) });
        },
        remove: async (id: string) => {
            if (isElectron) return (window as any).botApp.automation.remove(id);
            return webFetch(`/automation/${id}`, { method: 'DELETE' });
        },
        toggle: async (id: string, enabled: boolean) => {
            if (isElectron) return (window as any).botApp.automation.toggle(id, enabled);
            return webFetch(`/automation/${id}/toggle`, { method: 'PATCH', body: JSON.stringify({ enabled }) });
        }
    }
};
