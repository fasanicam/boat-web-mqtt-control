'use client';

import React, { useState } from 'react';
import { Wind, Navigation } from 'lucide-react';

interface BoatControlsProps {
    onSafranUpdate: (angle: number) => void;
    onVoileUpdate: (angle: number) => void;
    boatId: string;
    disabled?: boolean;
}

export default function BoatControls({ onSafranUpdate, onVoileUpdate, boatId, disabled }: BoatControlsProps) {
    const [safran, setSafran] = useState(0); // -90 (G) to 90 (D)
    const [voile, setVoile] = useState(0);   // -90 to 90 now (Orientation)



    return (
        <div className="grid grid-cols-1 gap-8 w-full">

            {/* Contrôle Safran (Servo) */}
            <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10 flex flex-col items-center gap-4">
                <div className="flex items-center gap-2 text-white/80 mb-2">
                    <Navigation size={24} className="text-green-300 transform rotate-90" />
                    <span className="font-semibold text-lg">Safran (Angle)</span>
                </div>

                <div className="w-full flex flex-col justify-center items-center gap-6">
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
                        onChange={(e) => setSafran(parseInt(e.target.value))}
                        onMouseUp={() => onSafranUpdate(safran)}
                        onTouchEnd={() => onSafranUpdate(safran)}
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
                    Recentrer Safran
                </button>
                <div className="text-[10px] sm:text-xs text-white/20 font-mono mt-2 break-all text-center">
                    Topic: .../actionneurs/safran
                </div>
            </div>

            {/* Contrôle Voile - Maintenant Angle -90 à 90 */}
            <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10 flex flex-col items-center gap-4">
                <div className="flex items-center gap-2 text-white/80 mb-2">
                    <Wind size={24} className="text-blue-300" />
                    <span className="font-semibold text-lg">Voile (Angle)</span>
                </div>

                <div className="w-full flex flex-col justify-center items-center gap-6">
                    {/* Visual Indication Similaire Safran mais Bleu */}
                    <div className="relative w-32 h-16 border-b-2 border-white/10 overflow-hidden">
                        <div
                            className="absolute bottom-0 left-1/2 w-1 h-12 bg-blue-500 origin-bottom transition-transform duration-200"
                            style={{ transform: `translateX(-50%) rotate(${voile}deg)` }}
                        ></div>
                        {/* Petit mât fixe */}
                        <div className="absolute bottom-0 left-1/2 w-1 h-4 bg-white/50 -translate-x-1/2"></div>
                    </div>

                    <input
                        type="range"
                        min="-90"
                        max="90"
                        step="1"
                        value={voile}
                        onChange={(e) => setVoile(parseInt(e.target.value))}
                        onMouseUp={() => onVoileUpdate(voile)}
                        onTouchEnd={() => onVoileUpdate(voile)}
                        disabled={disabled}
                        className="w-full h-12 appearance-none rounded-xl bg-slate-700/50 outline-none 
                                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-12 [&::-webkit-slider-thumb]:w-8 
                                   [&::-webkit-slider-thumb]:rounded-lg [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:shadow-lg
                                   cursor-pointer transition-all hover:[&::-webkit-slider-thumb]:bg-blue-400"
                    />
                    <div className="flex justify-between w-full text-xs text-white/40 font-mono">
                        <span>-90°</span>
                        <span className="text-blue-300 font-bold text-lg">{voile}°</span>
                        <span>+90°</span>
                    </div>
                </div>

                <button
                    onClick={() => { setVoile(0); onVoileUpdate(0); }}
                    className="mt-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors text-white/70"
                >
                    Recentrer Voile
                </button>
                <div className="text-[10px] sm:text-xs text-white/20 font-mono mt-2 break-all text-center">
                    Topic: .../actionneurs/voile
                </div>
            </div>

        </div>
    );
}
