import React from "react";
import { isDemoMode } from "../../config/appConfig";
import LightControl from "./LightControl";
import { SteeringWheelUI } from "./SteeringWheelUI";
import SuspensionControl from "./SuspensionControl";
import FanControl from "./FanControl";
import DriveControl from "./DriveControl";
import { isShowSteeringWheel } from "@/config/appConfig";

export const CarControlPanel: React.FC = () => {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      {/* Main Controls */}
      <DriveControl />
      {/* todo 方向盘UI - 暂时隐藏 */}
      {isShowSteeringWheel() && (
        <div className="mt-4 flex justify-center">
          <SteeringWheelUI />
        </div>
      )}

      {/* Suspension Controls */}
      <SuspensionControl />

      {/* Fan Controls */}
      {!isDemoMode() && <FanControl />}

      {/* Light Controls */}
      <LightControl />
    </div>
  );
};
