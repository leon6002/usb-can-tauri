import React, { createContext, useContext, ReactNode } from "react";
import { CarStates, RadarDistances, Scene3DStatus } from "../types";

interface CarStateContextType {
  carStates: CarStates;
  mergedCarStates: CarStates;
  scene3DStatus: Scene3DStatus;
  radarDistances: RadarDistances;
  updateCarState: (commandId: string) => void;
  updateVehicleControl: (
    speed: number,
    steeringAngle: number,
    gear?: string
  ) => void;
}

const CarStateContext = createContext<CarStateContextType | undefined>(
  undefined
);

interface CarStateProviderProps {
  children: ReactNode;
  carStates: CarStates;
  mergedCarStates: CarStates;
  scene3DStatus: Scene3DStatus;
  radarDistances: RadarDistances;
  updateCarState: (commandId: string) => void;
  updateVehicleControl: (
    speed: number,
    steeringAngle: number,
    gear?: string
  ) => void;
}

export const CarStateProvider: React.FC<CarStateProviderProps> = ({
  children,
  carStates,
  mergedCarStates,
  scene3DStatus,
  radarDistances,
  updateCarState,
  updateVehicleControl,
}) => {
  const value: CarStateContextType = {
    carStates,
    mergedCarStates,
    scene3DStatus,
    radarDistances,
    updateCarState,
    updateVehicleControl,
  };

  return (
    <CarStateContext.Provider value={value}>
      {children}
    </CarStateContext.Provider>
  );
};

export const useCarState = () => {
  const context = useContext(CarStateContext);
  if (!context) {
    throw new Error("useCarState must be used within CarStateProvider");
  }
  return context;
};

