import React from "react";
import ReactDOM from "react-dom/client";
import DebugPanelWindow from "./components/DebugPanel/DebugPanelWindow";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DebugPanelWindow />
  </React.StrictMode>
);
