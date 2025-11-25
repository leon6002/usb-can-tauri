import React from "react";
import { isDemoMode } from "../../config/appConfig";
import LightControl from "./LightControl";
import SuspensionControl from "./SuspensionControl";
import FanControl from "./FanControl";
import DriveControl from "./DriveControl";
import { isShowSteeringWheel } from "@/config/appConfig";
import SteeringWheel from "./SteeringWheel";

export const CarControlPanel: React.FC = () => {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      {/* Main Controls */}
      <DriveControl />
      {/* 方向盘UI */}
      {isShowSteeringWheel() && (
        <div className="mt-4 flex justify-center">
          {/* <SteeringWheelUI /> */}
          <SteeringWheel />
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
