'use client';

import { useMqtt, MqttProvider } from "@/lib/mqttContext";
import BoatControls from "@/components/BoatControls";
import Compass from "@/components/Compass";
import { useEffect, useState } from "react";
import { Wifi, WifiOff, Ship, Anchor, Send, LogIn, Lock, MessageSquare } from "lucide-react";

function BoatDashboard() {
  const { client, status, connect, publish, subscribe, lastMessage } = useMqtt();

  // States
  const [boatId, setBoatId] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [lcdMessage, setLcdMessage] = useState("");
  const [sensorData, setSensorData] = useState<any>({});

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
      console.log(`Subscribing to ${baseTopic}/#`);
      subscribe(`${baseTopic}/status`);
      subscribe(`${baseTopic}/cap`);         // Compass
      subscribe(`${baseTopic}/potentiometer`); // Pot
      // subscribe(`${baseTopic}/#`); // Debug catch-all if needed
    }
  }, [status, subscribe, boatId]);

  // Handle Messages
  useEffect(() => {
    if (lastMessage) {
      const topic = lastMessage.topic;
      // Extract last part
      const parts = topic.split('/');
      const key = parts[parts.length - 1]; // ex: 'cap', 'status', 'potentiometer'

      // Update sensor data
      setSensorData((prev: any) => ({
        ...prev,
        [key]: lastMessage.payload
      }));
    }
  }, [lastMessage]);

  // Command handlers
  const handleSafran = (angle: number) => {
    if (!boatId) return;
    publish(`bzh/iot/boat/${boatId}/cmd/safran`, angle.toString());
  };

  const handleVoile = (val: number) => {
    if (!boatId) return;
    publish(`bzh/iot/boat/${boatId}/cmd/voile`, val.toString());
  };

  const sendLcdMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!boatId || !lcdMessage) return;
    // Limit to 16 chars or handle standard 8x2
    publish(`bzh/iot/boat/${boatId}/cmd/lcd`, lcdMessage);
    setLcdMessage(""); // Clear after send? Or keep? Let's clear.
  };

  // Login Screen
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

      {/* Header Content */}
      <header className="bg-slate-800/50 backdrop-blur-md sticky top-0 z-50 border-b border-white/5 px-4 py-3 pb-6 md:pb-3 md:px-8 flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${status === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          <h1 className="font-bold text-lg tracking-tight">Boat Control <span className="text-blue-400 font-mono">@{boatId}</span></h1>
        </div>

        {/* Status Badge */}
        <div className="flex gap-2 text-xs font-mono">
          <span className="px-2 py-1 bg-white/5 rounded border border-white/10">
            {status === 'connected' ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </header>

      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">

        {/* Top Section: Visu Capteurs (Compass + Pot) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Compass Card */}
          <div className="col-span-2 bg-slate-800/40 rounded-2xl p-6 border border-white/5 flex flex-col items-center justify-center gap-4 relative overflow-hidden">
            <div className="absolute top-3 left-4 text-xs font-mono text-white/30 uppercase">Compas Magnétique</div>
            <Compass heading={parseInt(sensorData.cap || 0)} />
            <div className="font-mono text-2xl font-bold">{sensorData.cap || 0}°</div>
          </div>

          {/* Potentiometer Card */}
          <div className="col-span-2 bg-slate-800/40 rounded-2xl p-6 border border-white/5 flex flex-col items-center justify-center gap-4 relative overflow-hidden">
            <div className="absolute top-3 left-4 text-xs font-mono text-white/30 uppercase">Potentiomètre</div>

            {/* Gauge Visualization */}
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-700" />
                <circle
                  cx="64" cy="64" r="56"
                  stroke="currentColor" strokeWidth="8" fill="transparent"
                  className="text-orange-500 transition-all duration-300 ease-out"
                  strokeDasharray={351}
                  strokeDashoffset={351 - (351 * parseInt(sensorData.potentiometer || 0) / 100)} // Assuming 0-100 or map accordingly
                />
              </svg>
              <span className="absolute text-2xl font-bold font-mono text-orange-400">{sensorData.potentiometer || 0}</span>
            </div>
            <div className="text-xs text-white/30 text-center px-4 w-full">Topic: .../potentiometer</div>
          </div>
        </div>

        {/* Controls Section */}
        <div>
          <h2 className="text-white/40 text-sm font-bold uppercase tracking-wider mb-4 ml-1">Commandes Actuateurs</h2>
          <BoatControls onSafranUpdate={handleSafran} onVoileUpdate={handleVoile} disabled={status !== 'connected'} />
        </div>

        {/* LCD Display Section */}
        <div className="bg-slate-800/40 rounded-2xl p-6 border border-white/5">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare size={18} className="text-purple-400" />
            <h3 className="font-semibold text-white/90">LCD Messenger</h3>
          </div>

          <form onSubmit={sendLcdMessage} className="flex gap-2">
            <input
              type="text"
              maxLength={16}
              value={lcdMessage}
              onChange={(e) => setLcdMessage(e.target.value)}
              placeholder="Message (max 16 chars)..."
              className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 font-mono text-sm focus:outline-none focus:border-purple-500 transition-colors"
            />
            <button
              type="submit"
              disabled={!lcdMessage || status !== 'connected'}
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 rounded-xl transition-colors flex items-center justify-center"
            >
              <Send size={18} />
            </button>
          </form>
          <p className="text-xs text-white/20 mt-2 font-mono ml-1">Topic: bzh/iot/boat/{boatId}/cmd/lcd</p>
        </div>

        {/* Debug / Topics Info Footer */}
        <div className="mt-12 pt-8 border-t border-white/5">
          <h4 className="text-xs font-bold text-white/30 uppercase tracking-wider mb-4">Configuration MQTT Topics</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono text-white/50 bg-black/20 p-4 rounded-xl">
            <div className="flex justify-between border-b border-white/5 pb-2"><span>Servo (Safran)</span> <span className="text-blue-300">.../{boatId}/cmd/safran</span></div>
            <div className="flex justify-between border-b border-white/5 pb-2"><span>Stepper (Voile)</span> <span className="text-blue-300">.../{boatId}/cmd/voile</span></div>
            <div className="flex justify-between border-b border-white/5 pb-2"><span>LCD Text</span> <span className="text-purple-300">.../{boatId}/cmd/lcd</span></div>
            <div className="flex justify-between border-b border-white/5 pb-2"><span>Compass (Cap)</span> <span className="text-green-300">.../{boatId}/cap</span></div>
            <div className="flex justify-between"><span>Potentiometre</span> <span className="text-orange-300">.../{boatId}/potentiometer</span></div>
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
