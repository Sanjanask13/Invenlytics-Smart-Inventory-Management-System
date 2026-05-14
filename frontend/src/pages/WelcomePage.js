import React from "react";
import { Link, useNavigate } from "react-router-dom";

function WelcomePage() {
  const navigate = useNavigate();

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <p style={eyebrowStyle}>SMART INVENTORY MANAGEMENT</p>
        <h1 style={titleStyle}>Invenlytics</h1>
        <p style={subtitleStyle}>
          Manage products, track stock movement, and access merchant or admin tools from one place.
        </p>

        <div style={buttonGroupStyle}>
          <button style={primaryButtonStyle} onClick={() => navigate("/login")}>
            Merchant Login
          </button>

          <button style={secondaryButtonStyle} onClick={() => navigate("/admin-login")}>
            Admin Login
          </button>
        </div>

        <p style={footerTextStyle}>
          New merchant?{" "}
          <Link to="/signup" style={linkStyle}>
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  background: "linear-gradient(135deg, #f5efe5 0%, #ddeaf2 100%)"
};

const cardStyle = {
  width: "100%",
  maxWidth: "520px",
  background: "#ffffff",
  borderRadius: "24px",
  padding: "40px 32px",
  textAlign: "center",
  boxShadow: "0 24px 70px rgba(26, 51, 77, 0.14)"
};

const eyebrowStyle = {
  margin: 0,
  color: "#8c6d46",
  fontSize: "12px",
  fontWeight: 800,
  letterSpacing: "0.14em"
};

const titleStyle = {
  margin: "14px 0 10px",
  color: "#18344c",
  fontSize: "42px"
};

const subtitleStyle = {
  margin: "0 auto 28px",
  maxWidth: "420px",
  color: "#5e7285",
  lineHeight: 1.6
};

const buttonGroupStyle = {
  display: "grid",
  gap: "14px",
  marginBottom: "22px"
};

const primaryButtonStyle = {
  border: "none",
  borderRadius: "14px",
  padding: "14px 18px",
  background: "#1b5e7a",
  color: "#ffffff",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: "15px"
};

const secondaryButtonStyle = {
  border: "1px solid #cad6e0",
  borderRadius: "14px",
  padding: "14px 18px",
  background: "#f8fbfd",
  color: "#18344c",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: "15px"
};

const footerTextStyle = {
  margin: 0,
  color: "#5e7285"
};

const linkStyle = {
  color: "#1b5e7a",
  fontWeight: 700,
  textDecoration: "none"
};

export default WelcomePage;
