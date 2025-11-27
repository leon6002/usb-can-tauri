import React from "react";
import { isDemoMode } from "../../config/appConfig";
import LightControl from "./LightControl";
import SuspensionControl from "./SuspensionControl";
import FanControl from "./FanControl";
import DriveControl from "./DriveControl";
import AudioControl from "./AudioControl";


export const CarControlPanel: React.FC = () => {
  return (
    <div className="flex flex-col gap-3 w-full max-w-[280px]">
      {/* Main Controls */}
      <DriveControl />

      {/* Suspension Controls */}
      <SuspensionControl />

      {/* Fan Controls */}
      {!isDemoMode() && <FanControl />}

      {/* Light Controls */}
      <LightControl />

      {/* Audio Controls */}
      <AudioControl />
    </div>
  );
};
