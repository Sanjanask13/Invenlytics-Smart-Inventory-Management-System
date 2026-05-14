import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import { persistMerchantSession } from "../utils/auth";

function Login() {
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
      const res = await API.post("/login", form);
      const merchant = res.data?.merchant;

      persistMerchantSession(merchant, res.data?.token);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <button style={backButtonStyle} onClick={() => navigate("/")}>
          Back
        </button>

      <h2 style={headingStyle}>Merchant Login</h2>

      <input
        placeholder="Email Address"
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
        placeholder="Password"
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

      {error && <div style={errorStyle}>{error}</div>}

      <button onClick={handleLogin} style={actionButtonStyle} disabled={loading}>
        {loading ? "Signing In..." : "Login"}
      </button>
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
  maxWidth: "420px",
  background: "#ffffff",
  borderRadius: "20px",
  boxShadow: "0 20px 60px rgba(32, 54, 84, 0.15)",
  padding: "32px"
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

const headingStyle = {
  marginTop: 0,
  marginBottom: "18px",
  color: "#1b2a41"
};

const inputStyle = (hasError) => ({
  width: "100%",
  padding: "14px 16px",
  borderRadius: "12px",
  border: hasError ? "1px solid #be123c" : "1px solid #d5dce5",
  marginBottom: "16px",
  boxSizing: "border-box",
  fontSize: "15px"
});

const actionButtonStyle = {
  width: "100%",
  padding: "14px 16px",
  border: "none",
  borderRadius: "12px",
  background: "#1b5e7a",
  color: "#ffffff",
  fontWeight: 700,
  cursor: "pointer"
};

const errorStyle = {
  background: "#fff1f2",
  color: "#be123c",
  borderRadius: "12px",
  padding: "12px 14px",
  marginBottom: "16px"
};

const fieldErrorStyle = {
  color: "#be123c",
  fontSize: "13px",
  marginTop: "-8px",
  marginBottom: "14px"
};

export default Login;
