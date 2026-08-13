import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./mockApi.js";
import "./index.css";
import App from "./App.jsx";
import { createMockFetch } from "./mockApi.js";

const mockMode = ["true", "1", "yes"].includes(
  String(import.meta.env.VITE_MOCK_MODE || "").toLowerCase(),
);

if (mockMode) {
  window.fetch = createMockFetch();
  console.info("Beneficiary Update mock mode is enabled.");
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
