export interface IBotApp {
    auth: {
        login: (credentials: any) => Promise<any>
        register: (credentials: any) => Promise<{ success: boolean; error?: string }>
    }
    settings: {
        get: (key: string) => Promise<any>
        set: (key: string, value: any) => Promise<{ success: boolean }>
    }
    whatsapp: {
        getStatus: () => Promise<string>
        getQR: () => Promise<string | null>
        logout: () => Promise<{ success: boolean }>
        connect: () => Promise<{ success: boolean }>
        getGroups: (forceRefresh?: boolean) => Promise<{ id: string; subject: string }[]>
        onStatusChanged: (callback: (status: string) => void) => () => void
        onQRReceived: (callback: (qr: string) => void) => () => void
        onActivity: (callback: (data: any) => void) => () => void
    }
    stats: {
        getSummary: () => Promise<{
            totalMessages: number;
            monthlyMessages: number;
            groupsCount: number;
            modelName: string;
        }>
    }
    mcp: {
        getAll: () => Promise<any[]>
        add: (server: any) => Promise<{ success: boolean }>
        remove: (id: string) => Promise<{ success: boolean }>
        toggle: (id: string, enabled: boolean) => Promise<{ success: boolean }>
    }
    cron: {
        getAll: () => Promise<any[]>
        add: (job: any) => Promise<{ success: boolean }>
        remove: (id: string) => Promise<{ success: boolean }>
        toggle: (id: string, enabled: boolean) => Promise<{ success: boolean }>
    }
    loop: {
        getAll: () => Promise<any[]>
        add: (task: any) => Promise<{ success: boolean }>
        remove: (id: string) => Promise<{ success: boolean }>
        start: (id: string) => Promise<{ success: boolean }>
        stop: (id: string) => Promise<{ success: boolean }>
        get: (id: string) => Promise<any>
        onStatusChanged: (callback: (data: any) => void) => () => void
        onProgress: (callback: (data: any) => void) => () => void
    }
}

declare global {
    interface Window {
        botApp: IBotApp
    }
}
