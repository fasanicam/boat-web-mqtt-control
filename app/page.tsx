'use client';

import { useMqtt, MqttProvider } from "@/lib/mqttContext";
import DifferentialControl from "@/components/DifferentialControl";
import { useEffect, useState } from "react";
import { Wifi, WifiOff, Ship, Activity, Anchor, Navigation, Battery } from "lucide-react";

// Nom du groupe par defaut (A CHANGER SI BESOIN)
const DEFAULT_GROUP = "monBateau";

function BoatDashboard() {
  const { client, status, connect, publish, subscribe, lastMessage } = useMqtt();
  const [groupName, setGroupName] = useState(DEFAULT_GROUP);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [sensorData, setSensorData] = useState<any>({});

  // Connexion au montage du composant
  useEffect(() => {
    connect('wss://mqtt.dev.icam.school:443/mqtt'); // Utilisation du WSS 443 comme demandé
  }, [connect]);

  // Abonnement aux topics
  useEffect(() => {
    if (status === 'connected') {
      const baseTopic = `bzh/iot/boat/${groupName}`;
      subscribe(`${baseTopic}/status`);
      subscribe(`${baseTopic}/capteurs/#`); // On écoute tout ce qui est capteurs
      // subscribe(`${baseTopic}/gps`); 
      // subscribe(`${baseTopic}/batterie`);
    }
  }, [status, subscribe, groupName]);

  // Traitement des messages reçus
  useEffect(() => {
    if (lastMessage) {
      if (lastMessage.topic.includes('/status')) {
        setSensorData((prev: any) => ({ ...prev, status: lastMessage.payload }));
      } else {
        // Pour les autres topics capteurs, on extrait la fin du topic comme clé
        const parts = lastMessage.topic.split('/');
        const key = parts[parts.length - 1]; // ex: 'distance', 'temp', etc.
        setSensorData((prev: any) => ({ ...prev, [key]: lastMessage.payload }));
      }
    }
  }, [lastMessage]);

  const handleMotorUpdate = (left: number, right: number) => {
    if (status === 'connected') {
      const topic = `bzh/iot/boat/${groupName}/cmd`;
      const payload = JSON.stringify({ traingauche: left, traindroit: right });
      publish(topic, payload);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header avec Status & Config */}
        <header className="flex flex-col md:flex-row justify-between items-center bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 shadow-2xl">
          <div className="flex items-center gap-4 mb-4 md:mb-0">
            <div className={`p-3 rounded-full ${status === 'connected' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              <Ship size={32} />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-200 to-cyan-200">
                Boat Command Center
              </h1>
              <div className="flex items-center gap-2 text-sm text-white/50">
                {status === 'connected' ? (
                  <span className="flex items-center gap-1 text-green-400"><Wifi size={14} /> Connecté</span>
                ) : (
                  <span className="flex items-center gap-1 text-red-400"><WifiOff size={14} /> Déconnecté</span>
                )}
                <span className="text-white/20">|</span>
                <span>Broker: mqtt.dev.icam.school</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-black/20 px-4 py-2 rounded-xl">
            <div className="text-right">
              <p className="text-xs text-white/40 uppercase tracking-wider">Identifiant Bateau</p>
              {isConfiguring ? (
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  onBlur={() => setIsConfiguring(false)}
                  className="bg-transparent border-b border-blue-400 focus:outline-none text-blue-200 text-sm w-32 text-right"
                  autoFocus
                />
              ) : (
                <p onClick={() => setIsConfiguring(true)} className="font-mono text-blue-300 cursor-pointer hover:text-blue-100 transition-colors">
                  {groupName}
                </p>
              )}
            </div>
            <Anchor className="text-blue-400/50" size={24} />
          </div>
        </header>

        {/* Contenu Principal Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Colonne Gauche: Contrôle */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <DifferentialControl onUpdate={handleMotorUpdate} disabled={status !== 'connected'} />
          </div>

          {/* Colonne Droite: Dashboard Capteurs / Info */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Carte Status Système */}
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 relative overflow-hidden group hover:border-blue-500/30 transition-all">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Activity size={64} />
              </div>
              <h3 className="text-white/60 text-sm font-medium mb-1">Status Système</h3>
              <div className="text-3xl font-bold font-mono">
                {sensorData.status || "N/A"}
              </div>
              <div className="mt-4 flex gap-2">
                <span className="inline-flex items-center px-2 py-1 rounded bg-green-500/10 text-green-400 text-xs border border-green-500/20">
                  MQTT OK
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded bg-blue-500/10 text-blue-400 text-xs border border-blue-500/20">
                  Latency: ~24ms
                </span>
              </div>
            </div>

            {/* Carte Capteur Distance (Exemple) */}
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 relative overflow-hidden group hover:border-cyan-500/30 transition-all">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Navigation size={64} />
              </div>
              <h3 className="text-white/60 text-sm font-medium mb-1">Sonar Avant</h3>
              <div className="text-3xl font-bold font-mono text-cyan-300">
                {sensorData.distance ? `${sensorData.distance} cm` : "--"}
              </div>
              <div className="w-full bg-slate-700 h-1.5 mt-4 rounded-full overflow-hidden">
                <div
                  className="bg-cyan-500 h-full transition-all duration-500"
                  style={{ width: `${Math.min(parseInt(sensorData.distance || 0), 200) / 2}%` }}
                />
              </div>
            </div>

            {/* Carte Batterie (Exemple Placeholder) */}
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 relative overflow-hidden group hover:border-yellow-500/30 transition-all">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Battery size={64} />
              </div>
              <h3 className="text-white/60 text-sm font-medium mb-1">Batterie</h3>
              <div className="text-3xl font-bold font-mono text-yellow-300">
                {sensorData.vbat ? `${sensorData.vbat} V` : "N/A"}
              </div>
              <p className="text-xs text-white/40 mt-2">Dernière maj: {new Date().toLocaleTimeString()}</p>
            </div>

            {/* Console Log Rapide */}
            <div className="bg-black/40 rounded-2xl p-4 border border-white/5 font-mono text-xs text-green-400/80 overflow-y-auto h-32 md:col-span-2">
              <p className="text-white/30 border-b border-white/10 pb-1 mb-2">System Logs</p>
              {status === 'connected' && <p>{">"} Connected to MQTT Broker</p>}
              {lastMessage && <p>{">"} RX [{lastMessage.topic}]: {lastMessage.payload}</p>}
              {!status && <p className="text-yellow-500/50">{">"} Waiting for connection...</p>}
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <MqttProvider>
      <BoatDashboard />
    </MqttProvider>
  );
}
