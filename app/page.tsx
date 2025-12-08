'use client';

import { useMqtt, MqttProvider } from "@/lib/mqttContext";
import BoatControls from "@/components/BoatControls";
import Compass from "@/components/Compass";
import { useEffect, useState } from "react";
import { Ship, Anchor, Send, LogIn, MessageSquare } from "lucide-react";

function BoatDashboard() {
  const { status, connect, publish, subscribe, lastMessage } = useMqtt();

  // States
  const [boatId, setBoatId] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [lcdMessage, setLcdMessage] = useState("");
  const [sensorData, setSensorData] = useState<any>({});
  const [lastSentTopic, setLastSentTopic] = useState<string | null>(null);
  const [lastSentPayload, setLastSentPayload] = useState<string | null>(null);

  // Form State for Login
  const [tempId, setTempId] = useState("");

  // Handle Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempId.trim().length > 0) {
      setBoatId(tempId.trim());
      setIsLoggedIn(true);
      connect('wss://mqtt.dev.icam.school:443/mqtt');
    }
  };

  // Subscribe when connected & ID Set
  useEffect(() => {
    if (status === 'connected' && boatId) {
      const baseTopic = `bzh/iot/boat/${boatId}`;
      const capteursTopic = `${baseTopic}/capteurs`;

      subscribe(`${baseTopic}/status`);
      subscribe(`${capteursTopic}/cap`);
      subscribe(`${capteursTopic}/potentiometer`);
    }
  }, [status, subscribe, boatId]);

  // Handle Messages
  useEffect(() => {
    if (lastMessage) {
      const topic = lastMessage.topic;
      const parts = topic.split('/');
      const key = parts[parts.length - 1];
      setSensorData((prev: any) => ({
        ...prev,
        [key]: lastMessage.payload
      }));
    }
  }, [lastMessage]);

  const doPublish = (topic: string, msg: string) => {
    publish(topic, msg);
    setLastSentTopic(topic);
    setLastSentPayload(msg);
  }

  // Command handlers
  const handleSafran = (angle: number) => {
    if (!boatId) return;
    doPublish(`bzh/iot/boat/${boatId}/actionneurs/safran`, angle.toString());
  };

  const handleVoile = (angle: number) => {
    if (!boatId) return;
    doPublish(`bzh/iot/boat/${boatId}/actionneurs/voile`, angle.toString());
  };

  const sendLcdMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!boatId || !lcdMessage) return;

    // Auto passage ligne logic
    let formattedMsg = lcdMessage;
    if (lcdMessage.length > 16 && !lcdMessage.includes('\n')) {
      // Si pas de saut de ligne manuel et > 16, on coupe a 16
      formattedMsg = lcdMessage.slice(0, 16) + '\n' + lcdMessage.slice(16);
    }

    doPublish(`bzh/iot/boat/${boatId}/actionneurs/lcd`, formattedMsg);
    setLcdMessage("");
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white/5 backdrop-blur-xl p-8 rounded-3xl border border-white/10 w-full max-w-md shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-400">
              <Ship size={40} />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Boat Control</h1>
            <p className="text-white/40">Enter your Boat ID to connect</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs text-blue-300 font-mono uppercase tracking-wider ml-1">Boat Identifier</label>
              <div className="relative mt-1">
                <Anchor className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={20} />
                <input
                  type="text"
                  value={tempId}
                  onChange={(e) => setTempId(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder-white/20 focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="ex: monBateau01"
                  autoFocus
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
            >
              <LogIn size={20} /> Connect Interface
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Main Interface
  return (
    <main className="min-h-screen bg-slate-900 text-white pb-20 font-sans overflow-x-hidden">

      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-md sticky top-0 z-50 border-b border-white/5 px-4 py-3 flex flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${status === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          <h1 className="font-bold text-lg tracking-tight">Boat <span className="text-blue-400 font-mono">@{boatId}</span></h1>
        </div>

        {/* Status Badge */}
        <div className="flex gap-2 text-xs font-mono">
          <span className="px-2 py-1 bg-white/5 rounded border border-white/10 hidden sm:inline-block">
            {status === 'connected' ? 'CONNECTED' : 'WAITING...'}
          </span>
        </div>
      </header>

      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">

        {/* Top Section: Visu Capteurs (Compass + Pot) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Compass Card */}
          <div className="col-span-2 bg-slate-800/40 rounded-2xl p-6 border border-white/5 flex flex-col items-center justify-center gap-4 relative overflow-hidden h-64">
            <div className="absolute top-3 left-4 text-xs font-mono text-white/30 uppercase">Compas Magnétique</div>
            <Compass heading={parseInt(sensorData.cap || 0)} />
            <div className="font-mono text-2xl font-bold">{sensorData.cap || 0}°</div>
            <div className="absolute bottom-2 text-[10px] text-white/20 break-all">Topic: .../capteurs/cap</div>
          </div>

          {/* Potentiometer Card */}
          <div className="col-span-2 bg-slate-800/40 rounded-2xl p-6 border border-white/5 flex flex-col items-center justify-center gap-4 relative overflow-hidden h-64">
            <div className="absolute top-3 left-4 text-xs font-mono text-white/30 uppercase">Potentiomètre</div>

            {/* Gauge */}
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-700" />
                <circle
                  cx="64" cy="64" r="56"
                  stroke="currentColor" strokeWidth="8" fill="transparent"
                  className="text-orange-500 transition-all duration-300 ease-out"
                  strokeDasharray={351}
                  strokeDashoffset={351 - (351 * parseInt(sensorData.potentiometer || 0) / 100)}
                />
              </svg>
              <span className="absolute text-2xl font-bold font-mono text-orange-400">{sensorData.potentiometer || 0}</span>
            </div>
            <div className="absolute bottom-2 text-[10px] text-white/20 break-all">Topic: .../capteurs/potentiometer</div>
          </div>
        </div>

        {/* Controls Section */}
        <div>
          <h2 className="text-white/40 text-sm font-bold uppercase tracking-wider mb-4 ml-1">Actionneurs</h2>
          <BoatControls onSafranUpdate={handleSafran} onVoileUpdate={handleVoile} boatId={boatId} disabled={status !== 'connected'} />
        </div>

        {/* LCD Display Section */}
        <div className="bg-slate-800/40 rounded-2xl p-6 border border-white/5">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare size={18} className="text-purple-400" />
            <h3 className="font-semibold text-white/90">Ecran LCD</h3>
          </div>

          <form onSubmit={sendLcdMessage} className="gap-2 flex flex-col">
            <textarea
              maxLength={32}
              value={lcdMessage}
              onChange={(e) => setLcdMessage(e.target.value)}
              placeholder={"Message (Max 32 chars). Saut ligne auto > 16 chars."}
              rows={2}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 font-mono text-sm focus:outline-none focus:border-purple-500 transition-colors resize-none"
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-white/30">{lcdMessage.length}/32 caractères</span>
              <button
                type="submit"
                disabled={!lcdMessage || status !== 'connected'}
                className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Send size={16} /> Envoyer
              </button>
            </div>
          </form>
          <p className="text-[10px] text-white/20 mt-2 font-mono break-all text-center">Topic: .../actionneurs/lcd</p>
        </div>

        {/* Debug Footer: Dernière commande */}
        {lastSentTopic && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-xl flex items-center gap-3 text-xs font-mono max-w-[90vw] whitespace-nowrap overflow-hidden text-ellipsis z-50 animate-in fade-in slide-in-from-bottom-4">
            <span className="text-green-400 font-bold">TX &rarr;</span>
            <span className="text-white/50">{lastSentTopic.split('/').slice(-2).join('/')}:</span>
            <span className="text-white font-bold max-w-[150px] truncate">{lastSentPayload}</span>
          </div>
        )}

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
