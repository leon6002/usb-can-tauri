import React from "react";
import ReactDOM from "react-dom/client";
import SystemMonitorWindow from "./components/SystemMonitor/SystemMonitorWindow";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SystemMonitorWindow />
  </React.StrictMode>
);
