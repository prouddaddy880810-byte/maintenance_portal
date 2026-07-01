import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";

// Catch errors that happen outside React's render cycle (e.g. during
// useState initializers, before the ErrorBoundary can even mount) so we
// never fall back to a silent blank screen again.
window.addEventListener("error", (e) => {
  const root = document.getElementById("root");
  if (root && !root.innerHTML) {
    root.innerHTML = `<div style="font-family:monospace;background:#1e1e1e;color:#ff6b6b;min-height:100vh;padding:20px;white-space:pre-wrap;">
      <h2>⚠️ App failed to start</h2>
      <p style="color:#fff">${(e.error && e.error.message) || e.message || "Unknown error"}</p>
      <pre style="color:#aaa;font-size:12px">${(e.error && e.error.stack) || ""}</pre>
    </div>`;
  }
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
