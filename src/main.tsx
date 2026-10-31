import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/noto-sans-hebrew/hebrew-400.css";
import "@fontsource/noto-sans-hebrew/hebrew-600.css";
import "@fontsource/noto-sans-hebrew/hebrew-700.css";
import "@fontsource/noto-sans-hebrew/latin-400.css";
import "@fontsource/noto-sans-hebrew/latin-600.css";
import "@fontsource/noto-sans-hebrew/latin-700.css";
import "@fontsource/noto-naskh-arabic/arabic-400.css";
import "@fontsource/noto-naskh-arabic/arabic-600.css";
import "@fontsource/noto-naskh-arabic/arabic-700.css";
import App from "./App";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("missing root");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
