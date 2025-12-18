import React from "react";

import LightControl from "./LightControl";
import SuspensionControl from "./SuspensionControl";
import FanControl from "./FanControl";
import DriveControl from "./DriveControl";



export const CarControlPanel: React.FC = () => {
  return (
    <div className="flex flex-col gap-1 w-full max-w-[240px]">
      {/* Main Controls */}
      <DriveControl />

      {/* Suspension & Fan Row */}
      <div className="flex gap-1 w-full">
        <div className="flex-[2] min-w-0">
          <SuspensionControl />
        </div>
        <div className="flex-1 min-w-0">
          <FanControl />
        </div>
      </div>

      {/* Light Controls */}
      <LightControl />

      {/* Audio Controls */}
      {/* <AudioControl /> */}
    </div>
  );
};
