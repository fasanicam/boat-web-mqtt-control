'use client';

import React, { useState, useCallback } from 'react';
import { Wind, Navigation } from 'lucide-react';

interface BoatControlsProps {
    onSafranUpdate: (angle: number) => void;
    onVoileUpdate: (value: number) => void;
    disabled?: boolean;
}

export default function BoatControls({ onSafranUpdate, onVoileUpdate, disabled }: BoatControlsProps) {
    const [safran, setSafran] = useState(0); // -90 (G) to 90 (D)
    const [voile, setVoile] = useState(0);   // 0 (Fermé) to 100 (Ouvert)

    const handleSafranChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value);
        setSafran(val);
        onSafranUpdate(val);
    };

    const handleVoileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value);
        setVoile(val);
        onVoileUpdate(val);
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">

            {/* Contrôle Voile (Stepper) */}
            <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10 flex flex-col items-center gap-4">
                <div className="flex items-center gap-2 text-white/80 mb-2">
                    <Wind size={24} className="text-blue-300" />
                    <span className="font-semibold text-lg">Voile (Step)</span>
                </div>
                <div className="flex flex-col h-64 items-center justify-center w-full">
                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={voile}
                        onChange={handleVoileChange}
                        disabled={disabled}
                        className="h-full w-16 appearance-none rounded-2xl bg-slate-700/50 outline-none 
                                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-8 [&::-webkit-slider-thumb]:w-16 
                                   [&::-webkit-slider-thumb]:rounded-xl [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:shadow-lg
                                   cursor-pointer transition-all hover:[&::-webkit-slider-thumb]:bg-blue-400"
                        style={{
                            writingMode: 'vertical-lr',
                            direction: 'rtl',
                            appearance: 'slider-vertical' as any
                        }}
                    />
                </div>
                <div className="w-full flex justify-between px-8 text-xs text-white/40 font-mono">
                    <span>Slack</span>
                    <span className="text-blue-300 font-bold text-lg">{voile}%</span>
                    <span>Taut</span>
                </div>
            </div>

            {/* Contrôle Safran (Servo) */}
            <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10 flex flex-col items-center gap-4">
                <div className="flex items-center gap-2 text-white/80 mb-2">
                    <Navigation size={24} className="text-green-300 transform rotate-90" />
                    <span className="font-semibold text-lg">Safran (Servo)</span>
                </div>

                <div className="w-full flex-1 flex flex-col justify-center items-center gap-6">
                    {/* Visual Indication */}
                    <div className="relative w-32 h-16 border-b-2 border-white/10 overflow-hidden">
                        <div
                            className="absolute bottom-0 left-1/2 w-2 h-12 bg-green-500 rounded-t-full origin-bottom transition-transform duration-200"
                            style={{ transform: `translateX(-50%) rotate(${safran}deg)` }}
                        ></div>
                    </div>

                    <input
                        type="range"
                        min="-90"
                        max="90"
                        step="1"
                        value={safran}
                        onChange={handleSafranChange}
                        disabled={disabled}
                        className="w-full h-12 appearance-none rounded-xl bg-slate-700/50 outline-none 
                                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-12 [&::-webkit-slider-thumb]:w-8 
                                   [&::-webkit-slider-thumb]:rounded-lg [&::-webkit-slider-thumb]:bg-green-500 [&::-webkit-slider-thumb]:shadow-lg
                                   cursor-pointer transition-all hover:[&::-webkit-slider-thumb]:bg-green-400"
                    />

                    <div className="flex justify-between w-full text-xs text-white/40 font-mono">
                        <span>-90° (L)</span>
                        <span className="text-green-300 font-bold text-lg">{safran}°</span>
                        <span>+90° (R)</span>
                    </div>
                </div>

                <button
                    onClick={() => { setSafran(0); onSafranUpdate(0); }}
                    className="mt-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors text-white/70"
                >
                    Recentrer
                </button>
            </div>

        </div>
    );
}
