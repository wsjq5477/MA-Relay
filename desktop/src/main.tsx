import React from "react";
import { createRoot } from "react-dom/client";
import App from "./NetworkApp";
import "./style.css";
import "./workbench.css";
import "./workspace-pages.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
