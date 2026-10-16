// src/main.jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

// Start MSW first (dev only), then render. Otherwise the first API calls
// fire before the mock is ready and fail.
async function enableMocking() {
  if (import.meta.env.VITE_USE_MOCKS !== "true") return;
  const { worker } = await import("./mocks/browser");
  return worker.start({ onUnhandledRequest: "bypass" });
}

enableMocking().then(() => {
  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});