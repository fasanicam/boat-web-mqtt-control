'use client';

import React from 'react';

interface CompassProps {
    heading: number; // 0 - 359
}

export default function Compass({ heading }: CompassProps) {
    return (
        <div className="relative w-32 h-32 md:w-48 md:h-48 rounded-full border-4 border-slate-700 bg-slate-800 flex items-center justify-center shadow-inner">
            {/* Marques cardinales */}
            <div className="absolute top-2 text-xs font-bold text-red-500">N</div>
            <div className="absolute bottom-2 text-xs font-bold text-slate-400">S</div>
            <div className="absolute left-2 text-xs font-bold text-slate-400">W</div>
            <div className="absolute right-2 text-xs font-bold text-slate-400">E</div>

            {/* Aiguille / Indicateur */}
            <div
                className="w-full h-full absolute transition-transform duration-500 ease-out flex justify-center p-2"
            >
                {/* L'aiguille pointe vers le Nord (fixe ici par rapport au repère rotatif, ou inversement ?) 
                    Si 'heading' est le cap du bateau, la boussole tourne pour montrer le Nord relative.
                    Si on veut montrer le cap du bateau, on tourne une flèche.
                    Standard : Le cadran tourne ou la flèche tourne. 
                    Ici : On affiche le CAP. Donc le bateau est fixe (en haut) et la rose des vents tourne, OU la flèche indique le cap sur une rose fixe.
                    Simplifions : Une flèche qui indique le cap 0-360.
                */}
                <div className="w-1 h-16 bg-gradient-to-t from-transparent to-cyan-400 rounded-full origin-bottom mt-2" style={{ transform: `rotate(${heading}deg)`, transformOrigin: 'bottom center', height: '50%', position: 'absolute', bottom: '50%' }}></div>
            </div>

            {/* Center Display */}
            <div className="z-10 bg-slate-900 rounded-full w-12 h-12 flex items-center justify-center border border-slate-700">
                <span className="text-sm font-mono font-bold text-cyan-400">{Math.round(heading)}°</span>
            </div>

            {/* Visual Arc for Boat direction if needed (Optional) */}
        </div>
    );
}
