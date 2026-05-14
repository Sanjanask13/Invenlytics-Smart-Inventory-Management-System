import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

function AdminLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "",
    password: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const validateForm = () => {
    const nextErrors = {};
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!form.email.trim()) {
      nextErrors.email = "This field is required";
    } else if (!emailPattern.test(form.email.trim())) {
      nextErrors.email = "Enter valid email";
    }

    if (!form.password.trim()) {
      nextErrors.password = "This field is required";
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      await API.post("/admin/login", form, { withCredentials: true });
      await API.get("/admin/session", { withCredentials: true });
      window.location.href = "/admin";
    } catch (err) {
      setError(err.response?.data?.error || "Invalid admin login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #f4efe6 0%, #dfe9f3 100%)",
      padding: "24px"
    }}>
      <div style={{
        width: "100%",
        maxWidth: "420px",
        background: "#ffffff",
        borderRadius: "20px",
        boxShadow: "0 20px 60px rgba(32, 54, 84, 0.15)",
        padding: "32px"
      }}>
        <button style={backButtonStyle} onClick={() => navigate("/")}>
          Back
        </button>

        <p style={{ margin: 0, color: "#8a6f4d", fontWeight: 700, letterSpacing: "0.08em" }}>
          ADMIN ACCESS
        </p>
        <h2 style={{ marginTop: "10px", marginBottom: "8px", color: "#1b2a41" }}>Invenlytics Admin Login</h2>
        <p style={{ marginTop: 0, color: "#5c6b7a" }}>
          Sign in to manage merchants, products, and platform activity.
        </p>

        <input
          placeholder="Enter admin email"
          value={form.email}
          onChange={e => {
            setForm({ ...form, email: e.target.value });
            setFieldErrors((current) => ({ ...current, email: "" }));
          }}
          className="theme-input"
          style={inputStyle(fieldErrors.email)}
        />
        {fieldErrors.email && <div style={fieldErrorStyle}>{fieldErrors.email}</div>}

        <input
          placeholder="Enter admin password"
          type="password"
          value={form.password}
          onChange={e => {
            setForm({ ...form, password: e.target.value });
            setFieldErrors((current) => ({ ...current, password: "" }));
          }}
          className="theme-input"
          style={inputStyle(fieldErrors.password)}
        />
        {fieldErrors.password && <div style={fieldErrorStyle}>{fieldErrors.password}</div>}

        {error && (
          <div style={{
            background: "#fff1f2",
            color: "#be123c",
            borderRadius: "12px",
            padding: "12px 14px",
            marginBottom: "16px"
          }}>
            {error}
          </div>
        )}

        <button onClick={handleLogin} disabled={loading} style={buttonStyle}>
          {loading ? "Signing In..." : "Login"}
        </button>
      </div>
    </div>
  );
}

const inputStyle = (hasError) => ({
  width: "100%",
  padding: "14px 16px",
  borderRadius: "12px",
  border: hasError ? "1px solid #be123c" : "1px solid #d5dce5",
  marginBottom: "16px",
  boxSizing: "border-box",
  fontSize: "15px"
});

const buttonStyle = {
  width: "100%",
  padding: "14px 16px",
  border: "none",
  borderRadius: "12px",
  background: "#1b5e7a",
  color: "#ffffff",
  fontWeight: 700,
  cursor: "pointer"
};

const backButtonStyle = {
  border: "none",
  background: "transparent",
  color: "#1b5e7a",
  fontWeight: 700,
  cursor: "pointer",
  marginBottom: "18px",
  padding: 0
};

const fieldErrorStyle = {
  color: "#be123c",
  fontSize: "13px",
  marginTop: "-8px",
  marginBottom: "14px"
};

export default AdminLogin;
