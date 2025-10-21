import React from "react";
import { RadarDistances } from "../../types";

interface RadarDistancePanelProps {
  radarDistances: RadarDistances;
  isConnected?: boolean;
  compact?: boolean;
}

export const RadarDistancePanel: React.FC<RadarDistancePanelProps> = ({
  radarDistances,
  isConnected = false,
  compact = false,
}) => {
  const getRadarColor = (distance: number | null): string => {
    if (distance === null) return "bg-gray-100";
    if (distance < 300) return "bg-red-100 border-red-300";
    if (distance < 600) return "bg-yellow-100 border-yellow-300";
    return "bg-green-100 border-green-300";
  };

  const getRadarTextColor = (distance: number | null): string => {
    if (distance === null) return "text-gray-600";
    if (distance < 300) return "text-red-700";
    if (distance < 600) return "text-yellow-700";
    return "text-green-700";
  };

  const radarList = [
    { name: "雷达1", data: radarDistances.radar1, id: "0x00000521" },
    { name: "雷达2", data: radarDistances.radar2, id: "0x00000522" },
    { name: "雷达3", data: radarDistances.radar3, id: "0x00000523" },
    { name: "雷达4", data: radarDistances.radar4, id: "0x00000524" },
  ];

  if (compact) {
    return (
      <div className="px-3 py-2 border-b border-gray-200">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-gray-800 whitespace-nowrap">
            雷达:
          </span>
          <div className="flex gap-1">
            {radarList.map((radar) => (
              <div
                key={radar.id}
                className={`px-2 py-1 rounded border text-xs font-medium ${getRadarColor(
                  radar.data?.distance ?? null
                )} ${getRadarTextColor(radar.data?.distance ?? null)}`}
              >
                {radar.data?.distance !== null &&
                radar.data?.distance !== undefined
                  ? `${radar.data.distance}mm`
                  : isConnected
                  ? "已连"
                  : "未连"}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 border-b border-gray-200">
      <h3 className="text-sm font-semibold text-gray-800 mb-2">雷达距离</h3>
      <div className="grid grid-cols-2 gap-2">
        {radarList.map((radar) => (
          <div
            key={radar.id}
            className={`p-2 rounded border text-xs ${getRadarColor(
              radar.data?.distance ?? null
            )}`}
          >
            <div className="text-gray-600 font-medium mb-0.5">{radar.name}</div>
            <div
              className={`text-sm font-bold ${getRadarTextColor(
                radar.data?.distance ?? null
              )}`}
            >
              {radar.data?.distance !== null &&
              radar.data?.distance !== undefined
                ? `${radar.data.distance} mm`
                : isConnected
                ? "已连接"
                : "未连接"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
