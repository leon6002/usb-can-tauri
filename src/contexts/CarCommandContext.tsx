import React, { createContext, useContext, ReactNode } from "react";
import { CanCommand } from "../types";

interface CarCommandContextType {
  canCommands: CanCommand[];
  sendCarCommand: (commandId: string) => Promise<void>;
  updateCanCommand: (
    commandId: string,
    field: keyof CanCommand,
    value: string
  ) => void;
}

const CarCommandContext = createContext<CarCommandContextType | undefined>(
  undefined
);

interface CarCommandProviderProps {
  children: ReactNode;
  canCommands: CanCommand[];
  sendCarCommand: (commandId: string) => Promise<void>;
  updateCanCommand: (
    commandId: string,
    field: keyof CanCommand,
    value: string
  ) => void;
}

export const CarCommandProvider: React.FC<CarCommandProviderProps> = ({
  children,
  canCommands,
  sendCarCommand,
  updateCanCommand,
}) => {
  const value: CarCommandContextType = {
    canCommands,
    sendCarCommand,
    updateCanCommand,
  };

  return (
    <CarCommandContext.Provider value={value}>
      {children}
    </CarCommandContext.Provider>
  );
};

export const useCarCommand = () => {
  const context = useContext(CarCommandContext);
  if (!context) {
    throw new Error("useCarCommand must be used within CarCommandProvider");
  }
  return context;
};
