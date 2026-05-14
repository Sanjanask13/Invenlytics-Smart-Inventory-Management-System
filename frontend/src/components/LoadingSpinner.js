import React from "react";

function LoadingSpinner({ label = "Loading..." }) {
  return (
    <div style={overlayStyle} role="status" aria-live="polite">
      <div style={spinnerCardStyle}>
        <div style={spinnerStyle} />
        <div style={labelStyle}>{label}</div>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: "absolute",
  inset: 0,
  background: "rgba(255, 255, 255, 0.72)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 20,
  borderRadius: "inherit"
};

const spinnerCardStyle = {
  display: "grid",
  justifyItems: "center",
  gap: "12px",
  padding: "16px 18px",
  borderRadius: "16px",
  background: "rgba(255, 255, 255, 0.96)",
  boxShadow: "0 16px 40px rgba(15, 37, 55, 0.12)"
};

const spinnerStyle = {
  width: "36px",
  height: "36px",
  borderRadius: "50%",
  border: "3px solid rgba(27, 94, 122, 0.18)",
  borderTopColor: "#1b5e7a",
  animation: "theme-spin 0.8s linear infinite"
};

const labelStyle = {
  color: "#183247",
  fontWeight: 700,
  fontSize: "14px"
};

export default LoadingSpinner;
