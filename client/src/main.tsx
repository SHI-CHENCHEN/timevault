import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import "./apparatus-theme.css";
import "./exhibition-v4.css";
import "./exhibition-v4-refinement.css";
import "./exhibition-v4-receipt.css";
import "./exhibition-v4-outcome.css";
import "./exhibition-v4-blue.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
