import { contextBridge, ipcRenderer } from 'electron'

// Custom APIs for renderer
const api = {
    auth: {
        login: (credentials: any) => ipcRenderer.invoke('auth:login', credentials),
        register: (credentials: any) => ipcRenderer.invoke('auth:register', credentials)
    },
    settings: {
        get: (key: string) => ipcRenderer.invoke('settings:get', key),
        set: (key: string, value: any) => ipcRenderer.invoke('settings:set', { key, value }),
        onSettingsChanged: (callback: (data: { key: string, value: any }) => void) => {
            const listener = (_: any, data: any) => callback(data)
            ipcRenderer.on('settings:changed', listener)
            return () => ipcRenderer.removeListener('settings:changed', listener)
        }
    },
    whatsapp: {
        getStatus: () => ipcRenderer.invoke('whatsapp:get-status'),
        getQR: () => ipcRenderer.invoke('whatsapp:get-qr'),
        logout: () => ipcRenderer.invoke('whatsapp:logout'),
        connect: () => ipcRenderer.invoke('whatsapp:connect'),
        getGroups: (forceRefresh?: boolean) => ipcRenderer.invoke('whatsapp:get-groups', forceRefresh),
        onStatusChanged: (callback: (status: string) => void) => {
            const listener = (_: any, status: string) => callback(status)
            ipcRenderer.on('whatsapp:status-changed', listener)
            return () => ipcRenderer.removeListener('whatsapp:status-changed', listener)
        },
        onQRReceived: (callback: (qr: string) => void) => {
            const listener = (_: any, qr: string) => callback(qr)
            ipcRenderer.on('whatsapp:qr-received', listener)
            return () => ipcRenderer.removeListener('whatsapp:qr-received', listener)
        },
        onActivity: (callback: (data: any) => void) => {
            const listener = (_: any, data: any) => callback(data)
            ipcRenderer.on('whatsapp:activity', listener)
            return () => ipcRenderer.removeListener('whatsapp:activity', listener)
        }
    },
    stats: {
        getSummary: () => ipcRenderer.invoke('stats:get-summary')
    },
    mcp: {
        getAll: () => ipcRenderer.invoke('mcp:getAll'),
        add: (server: any) => ipcRenderer.invoke('mcp:add', server),
        remove: (id: string) => ipcRenderer.invoke('mcp:remove', id),
        toggle: (id: string, enabled: boolean) => ipcRenderer.invoke('mcp:toggle', { id, enabled })
    },
    cron: {
        getAll: () => ipcRenderer.invoke('cron:getAll'),
        add: (job: any) => ipcRenderer.invoke('cron:add', job),
        remove: (id: string) => ipcRenderer.invoke('cron:remove', id),
        toggle: (id: string, enabled: boolean) => ipcRenderer.invoke('cron:toggle', { id, enabled })
    },
    loop: {
        getAll: () => ipcRenderer.invoke('loop:getAll'),
        add: (task: any) => ipcRenderer.invoke('loop:add', task),
        remove: (id: string) => ipcRenderer.invoke('loop:remove', id),
        start: (id: string) => ipcRenderer.invoke('loop:start', id),
        stop: (id: string) => ipcRenderer.invoke('loop:stop', id),
        get: (id: string) => ipcRenderer.invoke('loop:get', id),
        onStatusChanged: (callback: (data: any) => void) => {
            const listener = (_: any, data: any) => callback(data)
            ipcRenderer.on('loop:status-changed', listener)
            return () => ipcRenderer.removeListener('loop:status-changed', listener)
        },
        onProgress: (callback: (data: any) => void) => {
            const listener = (_: any, data: any) => callback(data)
            ipcRenderer.on('loop:progress', listener)
            return () => ipcRenderer.removeListener('loop:progress', listener)
        }
    },
    automation: {
        getAll: () => ipcRenderer.invoke('automation:getAll'),
        get: (id: string) => ipcRenderer.invoke('automation:get', id),
        save: (flow: any) => ipcRenderer.invoke('automation:save', flow),
        remove: (id: string) => ipcRenderer.invoke('automation:remove', id),
        toggle: (id: string, enabled: boolean) => ipcRenderer.invoke('automation:toggle', { id, enabled })
    }
}

// Expose with a unique name
try {
    contextBridge.exposeInMainWorld('botApp', api)
    console.log('Preload: botApp exposed successfully')
} catch (error) {
    console.error('Preload: Failed to expose botApp:', error)
}
