import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register Service Worker for PWA & Notifications support
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => console.log("Service Worker registered on scope:", reg.scope))
      .catch((err) => console.log("Service Worker registration failed:", err));
  });
}

createRoot(document.getElementById("root")!).render(<App />);
