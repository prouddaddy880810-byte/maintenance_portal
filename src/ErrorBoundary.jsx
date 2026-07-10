import React from "react";

// Class component required — componentDidCatch has no Hook equivalent.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Visible in browser devtools console even though the UI shows a fallback screen.
    console.error("[ErrorBoundary] Caught render error:", error, info?.componentStack);
    this.setState({ info });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, info: null });
  };

  handleClearLocalData = () => {
    if (window.confirm("This clears all locally saved Maintenance Portal data on this device (assets, logs, machines, watch list, work entries). This cannot be undone. Continue?")) {
      Object.keys(window.localStorage)
        .filter((k) => k.startsWith("cbv3_"))
        .forEach((k) => window.localStorage.removeItem(k));
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { error, info } = this.state;

    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#1e1b4b",
          color: "#f1f5f9",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "32px 20px",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div style={{ maxWidth: 720, width: "100%" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>Maintenance Portal hit an error</h1>
          <p style={{ color: "#cbd5e1", marginBottom: 20, lineHeight: 1.5 }}>
            Something crashed while rendering the app. Your saved data on this device is untouched — this
            screen is just here so you can see what broke instead of staring at a blank page.
          </p>

          <div
            style={{
              background: "rgba(0,0,0,0.35)",
              border: "1px solid rgba(248,113,113,0.4)",
              borderRadius: 12,
              padding: 16,
              marginBottom: 20,
              overflowX: "auto",
            }}
          >
            <div style={{ color: "#f87171", fontWeight: 600, marginBottom: 8 }}>
              {error?.name || "Error"}: {error?.message || "Unknown error"}
            </div>
            {error?.stack && (
              <pre
                style={{
                  fontSize: 12,
                  color: "#94a3b8",
                  whiteSpace: "pre-wrap",
                  margin: 0,
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                {error.stack}
              </pre>
            )}
            {info?.componentStack && (
              <>
                <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 12, marginBottom: 4 }}>
                  Component stack:
                </div>
                <pre
                  style={{
                    fontSize: 11,
                    color: "#64748b",
                    whiteSpace: "pre-wrap",
                    margin: 0,
                    fontFamily: "ui-monospace, monospace",
                  }}
                >
                  {info.componentStack}
                </pre>
              </>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={this.handleReset}
              style={{
                background: "#6366f1",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 16px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: "rgba(255,255,255,0.1)",
                color: "#f1f5f9",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 8,
                padding: "10px 16px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reload page
            </button>
            <button
              onClick={this.handleClearLocalData}
              style={{
                background: "transparent",
                color: "#f87171",
                border: "1px solid rgba(248,113,113,0.4)",
                borderRadius: 8,
                padding: "10px 16px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Clear saved data &amp; reload
            </button>
          </div>
          <p style={{ color: "#64748b", fontSize: 12, marginTop: 16 }}>
            "Clear saved data" only removes Maintenance Portal's local cache on this device — it does not touch
            anything in Google Sheets.
          </p>
        </div>
      </div>
    );
  }
}
