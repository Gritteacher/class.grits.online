import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import "./shell.css";

const root = createRoot(document.getElementById("root")!);
const renderApp = () => root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

renderApp();
