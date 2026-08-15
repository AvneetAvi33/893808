import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./ui/App";
import "./index.css";

/**
 * Google Fonts are injected at runtime instead of sitting in the HTML head.
 * The single file bundler tries to inline anything it finds as a <link> in the
 * document, and a remote URL cannot be inlined, so it would fail the build.
 */
function loadFonts() {
  const pre1 = document.createElement("link");
  pre1.rel = "preconnect";
  pre1.href = "https://fonts.googleapis.com";

  const pre2 = document.createElement("link");
  pre2.rel = "preconnect";
  pre2.href = "https://fonts.gstatic.com";
  pre2.crossOrigin = "anonymous";

  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href =
    "https://fonts.googleapis.com/css2" +
    "?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800" +
    "&family=Hanken+Grotesk:wght@400;500;600;700" +
    "&family=Baloo+2:wght@500;700;800" +
    "&display=swap";

  document.head.append(pre1, pre2, css);
}

loadFonts();

const host = document.getElementById("root");
if (host) {
  createRoot(host).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
