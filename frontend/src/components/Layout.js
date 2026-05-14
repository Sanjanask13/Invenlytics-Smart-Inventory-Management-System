import React from "react";
import { theme } from "../theme";
import { clearMerchantSession, getStoredMerchant } from "../utils/auth";

function Layout({ children }) {
  const currentPath = window.location.pathname;
  const merchant = getStoredMerchant();
  const navItems = [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Products", path: "/products" },
    { label: "Billing", path: "/barcode-scanner" },
    { label: "Predictions", path: "/predictions" },
    { label: "Suggestions", path: "/discussion" },
    { label: "Reorder", path: "/reorder" },
  ];

  const handleLogout = () => {
    clearMerchantSession();
    window.location.href = "/login";
  };

  return (
    <div className="app-shell" style={shellStyle}>
      <div className="app-sidebar" style={sidebarStyle}>
        <div style={brandStyle}>
          <div style={brandEyebrowStyle}>SMART RETAIL</div>
          <h3 style={brandTitleStyle}>Invenlytics</h3>
          {merchant?.shop_name && (
            <p style={merchantNameStyle}>{merchant.shop_name}</p>
          )}
        </div>

        <div style={navStyle}>
          {navItems.map((item) => {
            const isActive = currentPath === item.path;
            return (
              <button
                key={item.path}
                className={`sidebar-item${isActive ? " active" : ""}`}
                onClick={() => { window.location.href = item.path; }}
                style={{
                  ...navItemStyle,
                  ...(isActive ? activeNavItemStyle : {}),
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <button onClick={handleLogout} style={logoutButtonStyle}>
          Logout
        </button>
      </div>

      <div className="app-content" style={contentStyle}>
        {children}
      </div>
    </div>
  );
}

const shellStyle = {
  display: "flex",
  minHeight: "100vh",
  background: `linear-gradient(180deg, ${theme.colors.background} 0%, ${theme.colors.backgroundAlt} 100%)`,
};

const sidebarStyle = {
  width: "240px",
  background: theme.colors.background,
  color: theme.colors.textLight,
  minHeight: "100vh",
  padding: "24px 18px",
  boxShadow: "inset -1px 0 0 rgba(255,255,255,0.06)",
  position: "sticky",
  top: 0
};

const brandStyle = {
  padding: "8px 10px 22px",
};

const brandEyebrowStyle = {
  color: "rgba(255,255,255,0.72)",
  fontSize: "11px",
  letterSpacing: "0.16em",
  fontWeight: 800,
};

const brandTitleStyle = {
  margin: "10px 0 0",
  fontSize: "28px",
  color: theme.colors.textLight,
};

const merchantNameStyle = {
  margin: "10px 0 0",
  color: "rgba(255,255,255,0.72)",
  fontSize: "13px",
  lineHeight: 1.5
};

const navStyle = {
  display: "grid",
  gap: "10px",
};

const logoutButtonStyle = {
  width: "100%",
  marginTop: "18px",
  textAlign: "left",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: theme.radius.md,
  padding: "14px 16px",
  background: "rgba(255,255,255,0.08)",
  color: theme.colors.textLight,
  cursor: "pointer",
  fontWeight: 700
};

const navItemStyle = {
  width: "100%",
  textAlign: "left",
  border: "none",
  borderRadius: theme.radius.md,
  padding: "14px 16px",
  background: "transparent",
  color: "rgba(255,255,255,0.84)",
  cursor: "pointer",
  fontWeight: 700,
};

const activeNavItemStyle = {
  background: theme.colors.primary,
  color: theme.colors.textLight,
};

const contentStyle = {
  flex: 1,
  padding: "24px",
  minWidth: 0
};

export default Layout;
