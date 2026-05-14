import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    shop_name: "",
    owner_name: "",
    email: "",
    password: "",
    region: ""
  });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    const nextErrors = {};
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!form.shop_name.trim()) {
      nextErrors.shop_name = "This field is required";
    }
    if (!form.owner_name.trim()) {
      nextErrors.owner_name = "This field is required";
    }
    if (!form.email.trim()) {
      nextErrors.email = "This field is required";
    } else if (!emailPattern.test(form.email.trim())) {
      nextErrors.email = "Enter valid email";
    }
    if (!form.password.trim()) {
      nextErrors.password = "This field is required";
    }
    if (!form.region.trim()) {
      nextErrors.region = "This field is required";
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      await API.post("/register", form);
      navigate("/login");
    } catch (err) {
      setError(err.response?.data?.error || "Unable to register right now.");
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

      <h2 style={headingStyle}>Merchant Sign Up</h2>

      <input
        placeholder="Shop Name"
        value={form.shop_name}
        onChange={e => {
          setForm({...form, shop_name: e.target.value});
          setFieldErrors((current) => ({ ...current, shop_name: "" }));
        }}
        className="theme-input"
        style={inputStyle(fieldErrors.shop_name)}
      />
      {fieldErrors.shop_name && <div style={fieldErrorStyle}>{fieldErrors.shop_name}</div>}

      <input
        placeholder="Owner Name"
        value={form.owner_name}
        onChange={e => {
          setForm({...form, owner_name: e.target.value});
          setFieldErrors((current) => ({ ...current, owner_name: "" }));
        }}
        className="theme-input"
        style={inputStyle(fieldErrors.owner_name)}
      />
      {fieldErrors.owner_name && <div style={fieldErrorStyle}>{fieldErrors.owner_name}</div>}

      <input
        placeholder="Email Address"
        value={form.email}
        onChange={e => {
          setForm({...form, email: e.target.value});
          setFieldErrors((current) => ({ ...current, email: "" }));
        }}
        className="theme-input"
        style={inputStyle(fieldErrors.email)}
      />
      {fieldErrors.email && <div style={fieldErrorStyle}>{fieldErrors.email}</div>}

      <input placeholder="Password"
        type="password"
        value={form.password}
        onChange={e => {
          setForm({...form, password: e.target.value});
          setFieldErrors((current) => ({ ...current, password: "" }));
        }}
        className="theme-input"
        style={inputStyle(fieldErrors.password)}
      />
      {fieldErrors.password && <div style={fieldErrorStyle}>{fieldErrors.password}</div>}

      <input
        placeholder="Region"
        value={form.region}
        onChange={e => {
          setForm({...form, region: e.target.value});
          setFieldErrors((current) => ({ ...current, region: "" }));
        }}
        className="theme-input"
        style={inputStyle(fieldErrors.region)}
      />
      {fieldErrors.region && <div style={fieldErrorStyle}>{fieldErrors.region}</div>}

      {error && <div style={errorStyle}>{error}</div>}

      <button onClick={handleRegister} style={actionButtonStyle} disabled={loading}>
        {loading ? "Registering..." : "Register"}
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
  maxWidth: "460px",
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

export default Register;
