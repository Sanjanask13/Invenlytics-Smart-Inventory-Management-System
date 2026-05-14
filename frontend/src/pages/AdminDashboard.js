import React, { useEffect, useState } from "react";
import API from "../services/api";

function AdminDashboard() {
  const [admin, setAdmin] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUserDetails, setSelectedUserDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [regionFilter, setRegionFilter] = useState("All");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState("info");
  const [deletingUserId, setDeletingUserId] = useState(null);

  useEffect(() => {
    if (!selectedUserId) {
      return undefined;
    }

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        closeModal();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [selectedUserId]);

  const setFeedback = (message, tone = "info") => {
    setStatusMessage(message);
    setStatusTone(tone);
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await API.get("/admin/users", { withCredentials: true });
      setUsers(res.data);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        const res = await API.get("/admin/session", { withCredentials: true });
        setAdmin(res.data.admin);
        await fetchUsers();
      } catch (err) {
        if (err.response?.status === 401) {
          window.location.href = "/admin-login";
        }
      } finally {
        setCheckingSession(false);
      }
    };

    initializeDashboard();
  }, []);

  const closeModal = () => {
    setSelectedUserId(null);
    setSelectedUserDetails(null);
    setLoadingDetails(false);
  };

  const fetchUserDetails = async (id) => {
    setSelectedUserId(id);
    setSelectedUserDetails(null);
    setLoadingDetails(true);
    setFeedback("");

    try {
      const res = await API.get(`/admin/user/${id}`, { withCredentials: true });
      setSelectedUserDetails(res.data);
    } catch (err) {
      if (err.response?.status === 401) {
        window.location.href = "/admin-login";
        return;
      }

      setFeedback("Failed to load user details.", "error");
      closeModal();
    } finally {
      setLoadingDetails(false);
    }
  };

  const deleteUser = async (id) => {
    const targetUser = users.find((user) => user.merchant_id === id);
    const displayName =
      targetUser?.owner_name || targetUser?.shop_name || `merchant #${id}`;
    const confirmed = window.confirm(
      `Delete ${displayName}? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingUserId(id);

    try {
      await API.delete(`/admin/user/${id}`, { withCredentials: true });
      setFeedback("User deleted successfully.", "success");

      if (selectedUserId === id) {
        closeModal();
      }

      await fetchUsers();
    } catch (err) {
      if (err.response?.status === 401) {
        window.location.href = "/admin-login";
        return;
      }

      setFeedback("Failed to delete user.", "error");
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleLogout = async () => {
    try {
      await API.post("/admin/logout", {}, { withCredentials: true });
    } finally {
      window.location.href = "/admin-login";
    }
  };

  if (checkingSession) {
    return <div style={loadingPageStyle}>Checking admin session...</div>;
  }

  const uniqueRegions = [
    "All",
    ...new Set(users.map((user) => user.region).filter(Boolean))
  ];

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      normalizedSearch === "" ||
      [user.owner_name, user.shop_name, user.email, user.region].some((value) =>
        value?.toLowerCase().includes(normalizedSearch)
      );

    const matchesRegion =
      regionFilter === "All" || user.region === regionFilter;

    return matchesSearch && matchesRegion;
  });

  const activeUser = selectedUserDetails?.user;
  const summary = selectedUserDetails?.summary || {};

  return (
    <div style={pageStyle}>
      <div style={pageGlowStyle} />

      <div style={heroCardStyle}>
        <div>
          <p style={eyebrowStyle}>ADMIN DASHBOARD</p>
          <h1 style={titleStyle}>User Administration Center</h1>
          <p style={subtitleStyle}>
            Review merchants, inspect account activity, and take admin actions
            from a cleaner, more reliable workspace.
          </p>
        </div>

        <div style={heroAsideStyle}>
          <div style={adminChipStyle}>
            {admin?.name || admin?.email || "Authenticated Admin"}
          </div>
          <button onClick={handleLogout} style={logoutButtonStyle}>
            Logout
          </button>
        </div>
      </div>

      <div style={statsGridStyle}>
        <div style={metricCardStyle}>
          <span style={metricLabelStyle}>Total Users</span>
          <strong style={metricValueStyle}>{users.length}</strong>
          <span style={metricSubtextStyle}>All registered merchants</span>
        </div>
      </div>

      {statusMessage && (
        <div
          style={{
            ...statusMessageStyle,
            ...(statusTone === "success"
              ? statusSuccessStyle
              : statusTone === "error"
                ? statusErrorStyle
                : null)
          }}
        >
          {statusMessage}
        </div>
      )}

      <div style={mainPanelStyle}>
        <div style={panelHeaderStyle}>
          <div>
            <h2 style={panelTitleStyle}>Users</h2>
            <p style={panelDescriptionStyle}>
              Open a record for more detail or remove a merchant after
              confirmation.
            </p>
          </div>
          <span style={panelMetaStyle}>
            {loadingUsers ? "Loading users..." : `${filteredUsers.length} shown`}
          </span>
        </div>

        <div style={toolbarStyle}>
          <input
            placeholder="Search by owner, shop, email, or region"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={filterInputStyle}
          />

          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            style={filterSelectStyle}
          >
            {uniqueRegions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </div>

        <div style={tableShellStyle}>
          <div style={tableWrapperStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={tableHeadStyle}>Owner</th>
                  <th style={tableHeadStyle}>Shop</th>
                  <th style={tableHeadStyle}>Email</th>
                  <th style={tableHeadStyle}>Region</th>
                  <th style={tableHeadStyle}>Joined</th>
                  <th style={{ ...tableHeadStyle, textAlign: "right" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.merchant_id} style={tableRowStyle}>
                    <td style={tableCellStyle}>
                      <strong style={primaryCellTextStyle}>
                        {user.owner_name || "N/A"}
                      </strong>
                      <div style={tableSubtextStyle}>
                        ID: {user.merchant_id || "N/A"}
                      </div>
                    </td>
                    <td style={tableCellStyle}>{user.shop_name || "N/A"}</td>
                    <td style={tableCellStyle}>{user.email || "N/A"}</td>
                    <td style={tableCellStyle}>
                      <span style={regionBadgeStyle}>
                        {user.region || "No region"}
                      </span>
                    </td>
                    <td style={tableCellStyle}>{formatDate(user.created_at)}</td>
                    <td style={{ ...tableCellStyle, textAlign: "right" }}>
                      <div style={rowActionsStyle}>
                        <button
                          onClick={() => fetchUserDetails(user.merchant_id)}
                          style={secondaryButtonStyle}
                        >
                          View Details
                        </button>
                        <button
                          onClick={() => deleteUser(user.merchant_id)}
                          style={deleteButtonStyle}
                          disabled={deletingUserId === user.merchant_id}
                        >
                          {deletingUserId === user.merchant_id
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!loadingUsers && filteredUsers.length === 0 && (
              <div style={emptyStateStyle}>
                No users match the current search or region filter.
              </div>
            )}

            {loadingUsers && (
              <div style={emptyStateStyle}>Loading users...</div>
            )}
          </div>
        </div>
      </div>

      {selectedUserId && (
        <div style={modalBackdropStyle} onClick={closeModal} role="presentation">
          <div
            style={modalCardStyle}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="User details"
          >
            <div style={modalHeaderStyle}>
              <div>
                <p style={modalEyebrowStyle}>USER DETAILS</p>
                <h2 style={modalTitleStyle}>
                  {activeUser?.owner_name || activeUser?.shop_name || "Loading user"}
                </h2>
                <p style={modalSubtitleStyle}>
                  {activeUser?.email || "Fetching merchant record"}
                </p>
              </div>
              <button onClick={closeModal} style={closeButtonStyle}>
                Close
              </button>
            </div>

            {loadingDetails && (
              <div style={emptyStateStyle}>Loading user details...</div>
            )}

            {!loadingDetails && selectedUserDetails && (
              <div style={modalBodyStyle}>
                <div style={detailGridStyle}>
                  <div style={detailCardStyle}>
                    <span style={detailLabelStyle}>Merchant ID</span>
                    <strong style={detailValueStyle}>
                      {activeUser?.merchant_id || "N/A"}
                    </strong>
                  </div>
                  <div style={detailCardStyle}>
                    <span style={detailLabelStyle}>Shop Name</span>
                    <strong style={detailValueStyle}>
                      {activeUser?.shop_name || "N/A"}
                    </strong>
                  </div>
                  <div style={detailCardStyle}>
                    <span style={detailLabelStyle}>Region</span>
                    <strong style={detailValueStyle}>
                      {activeUser?.region || "N/A"}
                    </strong>
                  </div>
                  <div style={detailCardStyle}>
                    <span style={detailLabelStyle}>Joined On</span>
                    <strong style={detailValueStyle}>
                      {formatDate(activeUser?.created_at)}
                    </strong>
                  </div>
                </div>

                <div style={summarySectionStyle}>
                  <div style={sectionHeaderStyle}>
                    <h3 style={sectionTitleStyle}>Merchant Summary</h3>
                    <span style={sectionMetaStyle}>
                      Snapshot of account activity
                    </span>
                  </div>

                  <div style={summaryGridStyle}>
                    <div style={summaryCardStyle}>
                      <span style={detailLabelStyle}>Total Products</span>
                      <strong style={summaryValueStyle}>
                        {Number(summary.total_products || 0)}
                      </strong>
                    </div>
                    <div style={summaryCardStyle}>
                      <span style={detailLabelStyle}>Total Sales</span>
                      <strong style={summaryValueStyle}>
                        {Number(summary.total_sales || 0)}
                      </strong>
                    </div>
                    <div style={summaryCardStyle}>
                      <span style={detailLabelStyle}>Total Revenue</span>
                      <strong style={summaryValueStyle}>
                        {formatCurrency(summary.total_revenue)}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const formatDate = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

const formatCurrency = (value) => {
  const amount = Number(value);
  if (Number.isNaN(amount)) return value || "N/A";
  return `Rs. ${amount.toFixed(2)}`;
};

const loadingPageStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "32px",
  background:
    "radial-gradient(circle at top, rgba(214, 229, 255, 0.9), transparent 40%), linear-gradient(180deg, #f4f7fb 0%, #edf2f7 100%)",
  color: "#163047",
  fontSize: "18px",
  fontWeight: 600
};

const pageStyle = {
  minHeight: "100vh",
  padding: "32px",
  background:
    "linear-gradient(180deg, #f4f7fb 0%, #eef3f7 42%, #f7f9fc 100%)",
  color: "#183247",
  boxSizing: "border-box",
  position: "relative"
};

const pageGlowStyle = {
  position: "absolute",
  inset: "0 auto auto 0",
  width: "100%",
  height: "320px",
  background:
    "radial-gradient(circle at 10% 10%, rgba(111, 168, 220, 0.18), transparent 32%), radial-gradient(circle at 90% 0%, rgba(244, 195, 122, 0.16), transparent 28%)",
  pointerEvents: "none"
};

const heroCardStyle = {
  position: "relative",
  zIndex: 1,
  display: "flex",
  justifyContent: "space-between",
  gap: "24px",
  alignItems: "flex-start",
  padding: "28px",
  marginBottom: "24px",
  borderRadius: "28px",
  background: "linear-gradient(135deg, #0f2537 0%, #1b3f59 58%, #275673 100%)",
  color: "#ffffff",
  boxShadow: "0 30px 60px rgba(15, 37, 55, 0.22)",
  flexWrap: "wrap"
};

const eyebrowStyle = {
  margin: 0,
  color: "rgba(233, 241, 248, 0.86)",
  fontWeight: 800,
  letterSpacing: "0.18em",
  fontSize: "12px"
};

const titleStyle = {
  margin: "10px 0 10px",
  fontSize: "36px",
  lineHeight: 1.1
};

const subtitleStyle = {
  margin: 0,
  color: "rgba(234, 241, 247, 0.86)",
  maxWidth: "720px",
  lineHeight: 1.6,
  fontSize: "15px"
};

const heroAsideStyle = {
  display: "flex",
  gap: "12px",
  alignItems: "center",
  flexWrap: "wrap"
};

const adminChipStyle = {
  padding: "12px 16px",
  borderRadius: "999px",
  background: "rgba(255, 255, 255, 0.12)",
  border: "1px solid rgba(255, 255, 255, 0.16)",
  fontWeight: 600,
  backdropFilter: "blur(8px)"
};

const logoutButtonStyle = {
  border: "1px solid rgba(255, 255, 255, 0.18)",
  borderRadius: "999px",
  padding: "11px 18px",
  background: "#ffffff",
  color: "#183247",
  fontWeight: 700,
  cursor: "pointer"
};

const statsGridStyle = {
  position: "relative",
  zIndex: 1,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "16px",
  marginBottom: "24px"
};

const metricCardStyle = {
  background: "rgba(255, 255, 255, 0.88)",
  border: "1px solid rgba(220, 229, 237, 0.95)",
  borderRadius: "24px",
  padding: "22px",
  boxShadow: "0 18px 38px rgba(30, 56, 76, 0.08)",
  backdropFilter: "blur(8px)"
};

const metricLabelStyle = {
  display: "block",
  color: "#61778b",
  fontSize: "13px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: "10px"
};

const metricValueStyle = {
  display: "block",
  fontSize: "34px",
  lineHeight: 1,
  marginBottom: "10px"
};

const metricSubtextStyle = {
  color: "#6d8296",
  fontSize: "14px"
};

const statusMessageStyle = {
  position: "relative",
  zIndex: 1,
  borderRadius: "18px",
  padding: "14px 18px",
  marginBottom: "20px",
  border: "1px solid #d8e5f0",
  background: "#f8fbff",
  color: "#1c4861",
  fontWeight: 600
};

const statusSuccessStyle = {
  background: "#effcf5",
  borderColor: "#bce3c8",
  color: "#1f6b42"
};

const statusErrorStyle = {
  background: "#fff1f2",
  borderColor: "#fecdd3",
  color: "#9f1239"
};

const mainPanelStyle = {
  position: "relative",
  zIndex: 1,
  background: "rgba(255, 255, 255, 0.92)",
  borderRadius: "28px",
  padding: "24px",
  boxShadow: "0 20px 44px rgba(21, 47, 68, 0.08)",
  border: "1px solid rgba(223, 231, 238, 0.95)"
};

const panelHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "flex-start",
  marginBottom: "20px",
  flexWrap: "wrap"
};

const panelTitleStyle = {
  margin: 0,
  fontSize: "24px"
};

const panelDescriptionStyle = {
  margin: "8px 0 0",
  color: "#678095",
  lineHeight: 1.6
};

const panelMetaStyle = {
  color: "#70859a",
  fontSize: "14px",
  fontWeight: 600
};

const toolbarStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(240px, 1fr) minmax(180px, 220px)",
  gap: "14px",
  marginBottom: "20px"
};

const filterInputStyle = {
  width: "100%",
  border: "1px solid #d5e1eb",
  borderRadius: "16px",
  padding: "14px 16px",
  boxSizing: "border-box",
  fontSize: "14px",
  background: "#ffffff",
  color: "#183247"
};

const filterSelectStyle = {
  width: "100%",
  border: "1px solid #d5e1eb",
  borderRadius: "16px",
  padding: "14px 16px",
  background: "#ffffff",
  fontSize: "14px",
  color: "#183247"
};

const tableShellStyle = {
  border: "1px solid #e1e8ef",
  borderRadius: "22px",
  overflow: "hidden",
  background: "#ffffff"
};

const tableWrapperStyle = {
  overflowX: "auto"
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "940px"
};

const tableHeadStyle = {
  textAlign: "left",
  padding: "16px 18px",
  background: "#f7fafc",
  color: "#5a7488",
  fontSize: "12px",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  borderBottom: "1px solid #e6edf2"
};

const tableRowStyle = {
  background: "#ffffff"
};

const tableCellStyle = {
  padding: "16px 18px",
  borderTop: "1px solid #edf2f6",
  verticalAlign: "top",
  color: "#27465d",
  fontSize: "14px"
};

const primaryCellTextStyle = {
  color: "#153247"
};

const tableSubtextStyle = {
  marginTop: "5px",
  color: "#7a8ea1",
  fontSize: "12px"
};

const regionBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  padding: "7px 11px",
  borderRadius: "999px",
  background: "#fef3c7",
  color: "#854d0e",
  fontSize: "12px",
  fontWeight: 700,
  whiteSpace: "nowrap"
};

const rowActionsStyle = {
  display: "inline-flex",
  justifyContent: "flex-end",
  gap: "10px",
  flexWrap: "wrap"
};

const secondaryButtonStyle = {
  border: "1px solid #cfe0eb",
  borderRadius: "12px",
  padding: "10px 14px",
  background: "#f9fcff",
  color: "#183247",
  fontWeight: 700,
  cursor: "pointer"
};

const deleteButtonStyle = {
  border: "none",
  borderRadius: "12px",
  padding: "10px 14px",
  background: "#a61b47",
  color: "#ffffff",
  fontWeight: 700,
  cursor: "pointer",
  opacity: 1
};

const emptyStateStyle = {
  margin: "18px",
  border: "1px dashed #c8d5df",
  borderRadius: "18px",
  padding: "24px",
  color: "#6a7f92",
  background: "#fafcff"
};

const modalBackdropStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(10, 20, 30, 0.58)",
  display: "flex",
  justifyContent: "center",
  alignItems: "stretch",
  padding: "32px 20px",
  zIndex: 1000
};

const modalCardStyle = {
  width: "min(1080px, 100%)",
  maxHeight: "100%",
  overflowY: "auto",
  background: "#f9fbfd",
  borderRadius: "28px",
  boxShadow: "0 34px 80px rgba(7, 18, 28, 0.3)",
  display: "flex",
  flexDirection: "column"
};

const modalHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  padding: "24px 24px 18px",
  borderBottom: "1px solid #e6edf2",
  background: "linear-gradient(135deg, #fdfefe 0%, #f3f8fb 100%)",
  flexWrap: "wrap"
};

const modalEyebrowStyle = {
  margin: 0,
  fontSize: "12px",
  fontWeight: 800,
  letterSpacing: "0.14em",
  color: "#8d6f47"
};

const modalTitleStyle = {
  margin: "8px 0 8px",
  fontSize: "28px",
  color: "#163047"
};

const modalSubtitleStyle = {
  margin: 0,
  color: "#647c90"
};

const closeButtonStyle = {
  border: "1px solid #d5e1eb",
  borderRadius: "999px",
  padding: "11px 16px",
  background: "#ffffff",
  color: "#183247",
  fontWeight: 700,
  cursor: "pointer"
};

const modalBodyStyle = {
  padding: "24px"
};

const detailGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "14px",
  marginBottom: "24px"
};

const detailCardStyle = {
  borderRadius: "20px",
  padding: "18px",
  background: "linear-gradient(135deg, #fffaf0 0%, #f2f8fb 100%)",
  border: "1px solid #e6edf2"
};

const detailLabelStyle = {
  display: "block",
  fontSize: "12px",
  fontWeight: 800,
  color: "#8d6f47",
  letterSpacing: "0.08em",
  marginBottom: "8px",
  textTransform: "uppercase"
};

const detailValueStyle = {
  fontSize: "16px",
  color: "#183247"
};

const summarySectionStyle = {
  display: "grid",
  gap: "16px"
};

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  marginBottom: "12px",
  flexWrap: "wrap"
};

const sectionTitleStyle = {
  margin: 0,
  color: "#163047"
};

const sectionMetaStyle = {
  color: "#70859a",
  fontSize: "14px",
  fontWeight: 600
};

const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "14px"
};

const summaryCardStyle = {
  borderRadius: "20px",
  padding: "20px",
  background: "linear-gradient(135deg, #ffffff 0%, #f4f8fb 100%)",
  border: "1px solid #e6edf2",
  boxShadow: "0 14px 30px rgba(21, 47, 68, 0.06)"
};

const summaryValueStyle = {
  fontSize: "28px",
  color: "#183247",
  lineHeight: 1.1
};

export default AdminDashboard;
