'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from 'react';
import mqtt, { MqttClient } from 'mqtt';

interface MqttContextType {
    client: MqttClient | null;
    status: 'connected' | 'disconnected' | 'connecting' | 'error';
    lastMessage: { topic: string; payload: string } | null;
    publish: (topic: string, message: string) => void;
    subscribe: (topic: string) => void;
    unsubscribe: (topic: string) => void;
    connect: (brokerUrl: string, options?: any) => void;
    disconnect: () => void;
}

const MqttContext = createContext<MqttContextType>({
    client: null,
    status: 'disconnected',
    lastMessage: null,
    publish: () => { },
    subscribe: () => { },
    unsubscribe: () => { },
    connect: () => { },
    disconnect: () => { },
});

export const useMqtt = () => useContext(MqttContext);

export const MqttProvider = ({ children }: { children: ReactNode }) => {
    const [client, setClient] = useState<MqttClient | null>(null);
    const [status, setStatus] = useState<'connected' | 'disconnected' | 'connecting' | 'error'>('disconnected');
    const [lastMessage, setLastMessage] = useState<{ topic: string; payload: string } | null>(null);
    const clientRef = useRef<MqttClient | null>(null);

    const connect = useCallback((brokerUrl: string, options?: any) => {
        if (clientRef.current?.connected) {
            console.log('MQTT Client already connected'); // Avoid reconnecting if already fine
            return;
        }
        if (status === 'connecting') return;

        setStatus('connecting');
        const mqttOptions = {
            keepalive: 60,
            protocolId: 'MQTT',
            protocolVersion: 4,
            clean: true,
            reconnectPeriod: 1000,
            connectTimeout: 30 * 1000,
            ...options,
        };

        console.log(`Connecting to ${brokerUrl}...`);
        const newClient = mqtt.connect(brokerUrl, mqttOptions);
        clientRef.current = newClient;
        setClient(newClient);

        newClient.on('connect', () => {
            console.log('MQTT Connected');
            setStatus('connected');
        });

        newClient.on('error', (err) => {
            console.error('MQTT Error:', err);
            setStatus('error');
        });

        newClient.on('close', () => {
            console.log('MQTT Disconnected');
            if (status !== 'disconnected') { // Only update if not manually disconnected
                setStatus('disconnected');
            }
        });

        newClient.on('message', (topic, message) => {
            setLastMessage({ topic, payload: message.toString() });
        });
    }, [status]);

    const disconnect = useCallback(() => {
        if (clientRef.current) {
            console.log('Manual Disconnect');
            clientRef.current.end();
            clientRef.current = null;
            setClient(null);
            setStatus('disconnected');
        }
    }, []);

    const publish = useCallback((topic: string, message: string) => {
        if (clientRef.current?.connected) {
            clientRef.current.publish(topic, message);
        } else {
            console.warn('MQTT not connected, cannot publish');
        }
    }, [])

    const subscribe = useCallback((topic: string) => {
        if (clientRef.current?.connected) {
            clientRef.current.subscribe(topic);
        }
    }, [])

    const unsubscribe = useCallback((topic: string) => {
        if (clientRef.current?.connected) {
            clientRef.current.unsubscribe(topic);
        }
    }, [])

    return (
        <MqttContext.Provider value={{ client, status, lastMessage, publish, subscribe, unsubscribe, connect, disconnect }}>
            {children}
        </MqttContext.Provider>
    );
};
