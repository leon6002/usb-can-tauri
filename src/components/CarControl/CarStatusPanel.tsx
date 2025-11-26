import React, { memo } from "react";
import { Radar, Gauge } from "lucide-react";

import { useCarControlStore } from "@/store/carControlStore";
import { useRadarStore } from "@/store/radarStore";

const CarStatusPanelComponent: React.FC = () => {

  const carStates = useCarControlStore((state) => state.carStates);

  const getRadarColor = (distance: number | null): string => {
    if (distance === null) return "bg-white/10 border-white/20 text-white/40";
    if (distance < 300) return "bg-red-500/80 border-red-400 text-white";
    if (distance < 600) return "bg-yellow-500/80 border-yellow-400 text-white";
    return "bg-green-500/80 border-green-400 text-white";
  };

  const radarDistances = useRadarStore((state) => state.radarDistances);
  const radarList = radarDistances
    ? [
      { name: "Radar1", data: radarDistances.radar1, id: "0x00000521" },
      { name: "Radar2", data: radarDistances.radar2, id: "0x00000522" },
      { name: "Radar3", data: radarDistances.radar3, id: "0x00000523" },
      { name: "Radar4", data: radarDistances.radar4, id: "0x00000524" },
    ]
    : [];

  return (
    <div className="flex items-center gap-4">
      {/* Speed & Gear Group */}
      <div className="flex items-center gap-2 bg-black/20 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
        {/* Gear */}
        <div className="flex flex-col items-center px-2 border-r border-white/10">
          <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Gear</span>
          <span className="text-xl font-bold text-orange-400">
            {carStates.gear || "P"}
          </span>
        </div>

        {/* Speed */}
        <div className="flex flex-col items-start px-2 min-w-[80px]">
          <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider flex items-center gap-1">
            <Gauge className="w-3 h-3" /> Speed
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-white">
              {((carStates.currentSpeed / 1000) * 3.6).toFixed(1)}
            </span>
            <span className="text-xs font-medium text-white/60">km/h</span>
          </div>
        </div>
      </div>

      {/* Radar Group */}
      {radarDistances && (
        <div className="flex flex-col gap-1 bg-black/20 backdrop-blur-md px-3 py-2 rounded-2xl border border-white/10">
          <div className="flex items-center gap-2 mb-1">
            <Radar className="w-3 h-3 text-cyan-400" />
            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Radar System</span>
          </div>

          <div className="flex gap-1">
            {radarList.map((radar) => (
              <div
                key={radar.id}
                className={`w-8 h-6 flex items-center justify-center rounded border text-[10px] font-bold transition-all ${getRadarColor(
                  radar.data?.distance ?? null
                )}`}
                title={radar.name}
              >
                {radar.data?.distance !== null && radar.data?.distance !== undefined
                  ? (radar.data.distance / 1000).toFixed(1) + "m"
                  : "-"}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const CarStatusPanel = memo(CarStatusPanelComponent);
