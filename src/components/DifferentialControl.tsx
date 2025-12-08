'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Settings2 } from 'lucide-react';

interface DifferentialControlProps {
    onUpdate: (left: number, right: number) => void;
    disabled?: boolean;
}

export default function DifferentialControl({ onUpdate, disabled }: DifferentialControlProps) {
    const [leftSpeed, setLeftSpeed] = useState(0);
    const [rightSpeed, setRightSpeed] = useState(0);
    const lastSentRef = useRef(0);

    const handleUpdate = (l: number, r: number) => {
        setLeftSpeed(l);
        setRightSpeed(r);

        const now = Date.now();
        if (now - lastSentRef.current > 100) { // Throttle 100ms
            onUpdate(l, r);
            lastSentRef.current = now;
        }
    };

    const handleStop = () => {
        setLeftSpeed(0);
        setRightSpeed(0);
        onUpdate(0, 0);
    }

    // Au relâchement souris/doigt, on remet à 0 (comportement type homme mort pour bateau/drone souvent préférable)
    // Ou on laisse tel quel. Ici, c'est un slider fixe comme demandé sur la voiture. 
    // Si on veut un retour automatique à 0, il faudrait `onMouseUp`. 
    // Pour l'instant on garde le comportement "commande maintenue".

    return (
        <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10 flex flex-col items-center gap-4 w-full max-w-sm">
            <div className="flex items-center gap-2 text-white/80 mb-2">
                <Settings2 size={20} />
                <span className="font-semibold">Contrôle Moteurs</span>
            </div>

            <div className="flex gap-12 h-64">
                {/* Left Slider */}
                <div className="flex flex-col items-center h-full gap-2 relative">
                    <input
                        type="range"
                        min="-65535"
                        max="65535"
                        step="100"
                        value={leftSpeed}
                        onChange={(e) => handleUpdate(parseInt(e.target.value), rightSpeed)}
                        disabled={disabled}
                        className="h-full w-12 appearance-none rounded-full bg-slate-700/50 outline-none 
                                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-8 [&::-webkit-slider-thumb]:w-12 
                                   [&::-webkit-slider-thumb]:rounded-md [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:shadow-lg
                                   cursor-pointer transition-all hover:[&::-webkit-slider-thumb]:bg-blue-400"
                        style={{
                            writingMode: 'vertical-lr',
                            direction: 'rtl',
                            appearance: 'slider-vertical' as any
                        }}
                    />
                    <div className="absolute inset-x-0 top-1/2 h-0.5 bg-white/20 -z-10 pointer-events-none"></div>
                    <span className="text-xs text-blue-300 font-mono font-bold">{leftSpeed}</span>
                    <span className="text-xs text-white/40">GAUCHE</span>
                </div>

                {/* Right Slider */}
                <div className="flex flex-col items-center h-full gap-2 relative">
                    <input
                        type="range"
                        min="-65535"
                        max="65535"
                        step="100"
                        value={rightSpeed}
                        onChange={(e) => handleUpdate(leftSpeed, parseInt(e.target.value))}
                        disabled={disabled}
                        className="h-full w-12 appearance-none rounded-full bg-slate-700/50 outline-none 
                                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-8 [&::-webkit-slider-thumb]:w-12 
                                   [&::-webkit-slider-thumb]:rounded-md [&::-webkit-slider-thumb]:bg-green-500 [&::-webkit-slider-thumb]:shadow-lg
                                   cursor-pointer transition-all hover:[&::-webkit-slider-thumb]:bg-green-400"
                        style={{
                            writingMode: 'vertical-lr',
                            direction: 'rtl',
                            appearance: 'slider-vertical' as any
                        }}
                    />
                    <div className="absolute inset-x-0 top-1/2 h-0.5 bg-white/20 -z-10 pointer-events-none"></div>
                    <span className="text-xs text-green-300 font-mono font-bold">{rightSpeed}</span>
                    <span className="text-xs text-white/40">DROITE</span>
                </div>
            </div>

            <button
                onClick={handleStop}
                className="mt-4 px-8 py-3 bg-red-500/80 hover:bg-red-500 text-white font-bold rounded-xl transition-all shadow-lg active:scale-95 w-full border border-red-400/50"
            >
                STOP URGENCE
            </button>
        </div>
    );
}
