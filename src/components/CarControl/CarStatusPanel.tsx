import React, { memo } from "react";
import { CarStates, Scene3DStatus, RadarDistances } from "../../types";
import { Radar } from "lucide-react";

interface CarStatusPanelProps {
  carStates: CarStates;
  scene3DStatus?: Scene3DStatus; // 保留但不使用，为了向后兼容
  gear?: string; // 档位
  steeringAngleDegrees?: number; // 转向角（度数）
  radarDistances?: RadarDistances; // 雷达距离
  isConnected?: boolean;
}

const CarStatusPanelComponent: React.FC<CarStatusPanelProps> = ({
  carStates,
  gear,
  steeringAngleDegrees,
  radarDistances,
  isConnected = false,
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

  const radarList = radarDistances
    ? [
        { name: "雷达1", data: radarDistances.radar1, id: "0x00000521" },
        { name: "雷达2", data: radarDistances.radar2, id: "0x00000522" },
        { name: "雷达3", data: radarDistances.radar3, id: "0x00000523" },
        { name: "雷达4", data: radarDistances.radar4, id: "0x00000524" },
      ]
    : [];

  return (
    <div className="p-3 border-b border-gray-200">
      {/* First Row: Gear and Radar (2 rows) */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        {/* Gear - Highlighted */}
        <div className="bg-orange-50 p-2 rounded border border-orange-200">
          <div className="text-orange-600 text-xs font-medium mb-1">档位</div>
          <div className="text-base font-bold text-orange-900">
            {gear || "P"}
          </div>
        </div>

        {/* Radar Status - Two Rows */}
        {radarDistances && (
          <div className="flex flex-col gap-1.5 bg-gradient-to-br from-cyan-50 to-blue-50 p-2.5 rounded-lg border border-cyan-200 shadow-sm">
            {/* Radar Label */}
            <div className="flex items-center gap-1.5">
              <span className="text-cyan-600 text-xs font-bold flex gap-1">
                <Radar className="w-4 h-4" />
                雷达
              </span>
              <div className="flex-1 h-px bg-gradient-to-r from-cyan-300 to-transparent"></div>
            </div>
            {/* First row of radars (1-2) */}
            <div className="flex gap-1">
              {radarList.slice(0, 2).map((radar) => (
                <div
                  key={radar.id}
                  className={`flex-1 px-1.5 py-1 rounded-md border text-xs font-semibold text-center transition-all ${getRadarColor(
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
            {/* Second row of radars (3-4) */}
            <div className="flex gap-1">
              {radarList.slice(2, 4).map((radar) => (
                <div
                  key={radar.id}
                  className={`flex-1 px-1.5 py-1 rounded-md border text-xs font-semibold text-center transition-all ${getRadarColor(
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
        )}
      </div>

      {/* Second Row: Speed and Steering Angle */}
      <div className="grid grid-cols-2 gap-2">
        {/* Real-time Speed - Highlighted */}
        <div className="bg-blue-50 p-2 rounded border border-blue-200">
          <div className="text-blue-600 text-xs font-medium mb-1">实时速度</div>
          <div className="text-base font-bold text-blue-900">
            {((carStates.currentSpeed / 1000) * 3.6).toFixed(1)} km/h
          </div>
        </div>

        {/* Steering Angle - Highlighted */}
        <div className="bg-purple-50 p-2 rounded border border-purple-200">
          <div className="text-purple-600 text-xs font-medium mb-1">转向角</div>
          <div className="text-base font-bold text-purple-900">
            {steeringAngleDegrees !== undefined
              ? steeringAngleDegrees.toFixed(1)
              : ((carStates.currentSteeringAngle * 180) / Math.PI).toFixed(1)}
            °
          </div>
        </div>
      </div>
    </div>
  );
};

// 自定义比较函数：只比较实际的数据值，忽略对象引用
const arePropsEqual = (
  prevProps: CarStatusPanelProps,
  nextProps: CarStatusPanelProps
): boolean => {
  // 比较基本属性
  if (
    prevProps.isConnected !== nextProps.isConnected ||
    prevProps.gear !== nextProps.gear ||
    prevProps.steeringAngleDegrees !== nextProps.steeringAngleDegrees
  ) {
    return false;
  }

  // 比较 carStates
  if (
    prevProps.carStates.isDriving !== nextProps.carStates.isDriving ||
    prevProps.carStates.leftDoorStatus !== nextProps.carStates.leftDoorStatus ||
    prevProps.carStates.rightDoorStatus !==
      nextProps.carStates.rightDoorStatus ||
    prevProps.carStates.fanLevel !== nextProps.carStates.fanLevel ||
    prevProps.carStates.lightMode !== nextProps.carStates.lightMode ||
    prevProps.carStates.suspensionStatus !==
      nextProps.carStates.suspensionStatus ||
    prevProps.carStates.currentSpeed !== nextProps.carStates.currentSpeed ||
    prevProps.carStates.currentSteeringAngle !==
      nextProps.carStates.currentSteeringAngle
  ) {
    return false;
  }

  // 比较 radarDistances
  if (prevProps.radarDistances && nextProps.radarDistances) {
    if (
      prevProps.radarDistances.radar1?.distance !==
        nextProps.radarDistances.radar1?.distance ||
      prevProps.radarDistances.radar2?.distance !==
        nextProps.radarDistances.radar2?.distance ||
      prevProps.radarDistances.radar3?.distance !==
        nextProps.radarDistances.radar3?.distance ||
      prevProps.radarDistances.radar4?.distance !==
        nextProps.radarDistances.radar4?.distance
    ) {
      return false;
    }
  } else if (prevProps.radarDistances !== nextProps.radarDistances) {
    return false;
  }

  return true;
};

export const CarStatusPanel = memo(CarStatusPanelComponent, arePropsEqual);
