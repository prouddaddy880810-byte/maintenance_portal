import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    // eslint-disable-next-line no-console
    console.error("App crashed:", error, info);
  }

  render() {
    if (this.state.error) {
      const err = this.state.error;
      return (
        <div style={{
          fontFamily: "monospace",
          background: "#1e1e1e",
          color: "#ff6b6b",
          minHeight: "100vh",
          padding: "20px",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}>
          <h2 style={{ color: "#ff6b6b", marginTop: 0 }}>⚠️ App crashed</h2>
          <p style={{ color: "#fff" }}>
            {err && err.message ? err.message : String(err)}
          </p>
          <details open style={{ color: "#aaa", fontSize: 12 }}>
            <summary style={{ cursor: "pointer", color: "#fff" }}>Stack trace</summary>
            {err && err.stack ? err.stack : "No stack available"}
            {this.state.info && this.state.info.componentStack
              ? "\n\nComponent stack:" + this.state.info.componentStack
              : ""}
          </details>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 20,
              padding: "10px 16px",
              background: "#ff6b6b",
              color: "#1e1e1e",
              border: "none",
              borderRadius: 8,
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
