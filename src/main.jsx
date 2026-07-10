import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";

// Surfaces crashes that happen outside React's render cycle (e.g. a stray async
// callback) to the console with full context, since those won't be caught by
// the ErrorBoundary below.
window.addEventListener("error", (e) => {
  console.error("[Global error]", e.error || e.message, e);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("[Unhandled promise rejection]", e.reason);
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
