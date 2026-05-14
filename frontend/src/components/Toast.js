import React from "react";

function Toast({ tone = "success", message }) {
  if (!message) {
    return null;
  }

  const toneStyle = tone === "error" ? errorStyle : successStyle;

  return (
    <div style={{ ...baseStyle, ...toneStyle }} role="status" aria-live="polite">
      {message}
    </div>
  );
}

const baseStyle = {
  position: "fixed",
  top: "24px",
  right: "24px",
  zIndex: 2000,
  minWidth: "240px",
  maxWidth: "360px",
  padding: "14px 16px",
  borderRadius: "14px",
  boxShadow: "0 18px 40px rgba(15, 37, 55, 0.18)",
  fontWeight: 700
};

const successStyle = {
  background: "#ecfdf3",
  border: "1px solid #15803d",
  color: "#15803d"
};

const errorStyle = {
  background: "#fff1ec",
  border: "1px solid #c0392b",
  color: "#c0392b"
};

export default Toast;
