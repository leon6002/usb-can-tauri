import React, { memo } from "react";
import { Radar } from "lucide-react";

// import { useCarControlStore } from "@/store/carControlStore";
import { useRadarStore } from "@/store/radarStore";

interface CarStatusPanelProps {
  className?: string;
}

const CarStatusPanelComponent: React.FC<CarStatusPanelProps> = ({ className }) => {

  // const carStates = useCarControlStore((state) => state.carStates);

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

  if (!radarDistances) return null;

  return (
    <div className={`flex flex-col gap-1 bg-black/20 backdrop-blur-md px-3 py-2 rounded-2xl border border-white/10 ${className}`}>
      <div className="flex items-center gap-2 mb-1">
        <Radar className="w-3 h-3 text-cyan-400" />
        <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Radar System</span>
      </div>

      <div className="flex gap-1 justify-between">
        {radarList.map((radar) => (
          <div
            key={radar.id}
            className={`flex-1 h-6 flex items-center justify-center rounded border text-[10px] font-bold transition-all ${getRadarColor(
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
  );
};

export const CarStatusPanel = memo(CarStatusPanelComponent);
