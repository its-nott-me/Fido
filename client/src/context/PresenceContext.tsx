import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { env } from '../../loadenv';

type PresenceContextType = {
    connected: boolean;
    activeClients?: number;
};

const PresenceContext = createContext<PresenceContextType>({
    connected: false
});

export function PresenceProvider({ children }: { children: React.ReactNode }) {
    const wsRef = useRef<WebSocket | null>(null);
    const heartbeatRef = useRef<number | null>(null);

    const [connected, setConnected] = useState(false);
    const [activeClients, setActiveClients] = useState<number>();

    useEffect(() => {
        const ws = new WebSocket(env.WS_SERVER_URL);
        wsRef.current = ws;

        ws.onopen = () => {
            setConnected(true);
            console.log('connected');

            ws.send(JSON.stringify({
                type: 'presence-join',
            }));

            heartbeatRef.current = window.setInterval(() => {
                ws.send(JSON.stringify({ type: 'presence-heartbeat' }));
            }, 3000);
        };

        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);

            if (message.type === 'presence-count') {
                setActiveClients(message.count);
            }
        };

        ws.onclose = () => {
            setConnected(false);
        };

        return () => {
            heartbeatRef.current && clearInterval(heartbeatRef.current);
            ws.close();
        };
    }, []);

    return (
        <PresenceContext.Provider value={{ connected, activeClients }}>
            {children}
        </PresenceContext.Provider>
    );
}

export const usePresence = () => useContext(PresenceContext);
