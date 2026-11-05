import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ActivityStatus } from "./components/ActivityStatus";
import "./styles.css";
import "./shell.css";

const root = createRoot(document.getElementById("root")!);
const renderApp = () => root.render(
  <React.StrictMode>
    <App />
    <ActivityStatus />
  </React.StrictMode>,
);

renderApp();
