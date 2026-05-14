import React, { useCallback, useEffect, useState } from "react";
import Layout from "../components/Layout";
import LoadingSpinner from "../components/LoadingSpinner";
import Toast from "../components/Toast";
import API from "../services/api";
import { theme } from "../theme";
import { getStoredStoreId } from "../utils/auth";

function ReorderRecommendations() {
  const merchant = JSON.parse(localStorage.getItem("merchant") || "{}");
  const merchantId = merchant?.merchant_id;
  const storeId = merchant?.store_id || getStoredStoreId() || "";

  const [recommendations, setRecommendations] = useState([]);
  const [editedOrders, setEditedOrders] = useState({});
  const [safetyBuffer, setSafetyBuffer] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orderMessage, setOrderMessage] = useState("");
  const [sendingProductId, setSendingProductId] = useState(null);
  const [orderStatus, setOrderStatus] = useState({});
  const [orderRecords, setOrderRecords] = useState({});
  const [previewData, setPreviewData] = useState(null);
  const [previewProductId, setPreviewProductId] = useState(null);
  const [toast, setToast] = useState({ tone: "success", message: "" });
  const isBusy = loading || Boolean(sendingProductId);

  useEffect(() => {
    if (!orderMessage && !error) {
      return undefined;
    }

    setToast({
      tone: error ? "error" : "success",
      message: error || orderMessage
    });

    const timeoutId = window.setTimeout(() => {
      setToast({ tone: "success", message: "" });
    }, 2500);

    return () => window.clearTimeout(timeoutId);
  }, [error, orderMessage]);

  const loadRecommendations = useCallback(async (bufferValue = "0") => {
    if (!merchantId) {
      setRecommendations([]);
      setLoading(false);
      setError("Merchant session not found.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [recommendationsRes, ordersRes] = await Promise.all([
        API.get(`/reorder-recommendations/${merchantId}`, {
          params: {
            safety_buffer: Number(bufferValue || 0),
            store_id: storeId
          }
        }),
        API.get(`/orders/${storeId}`)
      ]);
      const nextRecommendations = Array.isArray(recommendationsRes.data) ? recommendationsRes.data : [];
      const orders = Array.isArray(ordersRes.data) ? ordersRes.data : [];
      const latestOrdersByProduct = Object.fromEntries(
        orders.map((order) => [order.product_id, order])
      );

      setRecommendations(nextRecommendations);
      setEditedOrders(
        Object.fromEntries(
          nextRecommendations.map((item) => [item.product_id, String(item.recommended_reorder ?? 0)])
        )
      );
      setOrderRecords(latestOrdersByProduct);
      setOrderStatus(
        Object.fromEntries(
          nextRecommendations.map((item) => [
            item.product_id,
            latestOrdersByProduct[item.product_id]?.status || "idle"
          ])
        )
      );
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load reorder recommendations right now.");
    } finally {
      setLoading(false);
    }
  }, [merchantId, storeId]);

  useEffect(() => {
    loadRecommendations("0");
  }, [loadRecommendations]);

  const totalRecommended = recommendations.reduce(
    (sum, item) => sum + Number(editedOrders[item.product_id] ?? item.recommended_reorder ?? 0),
    0
  );

  const highPriorityCount = recommendations.filter(
    (item) => Number(editedOrders[item.product_id] ?? item.recommended_reorder ?? 0) > 0
  ).length;

  const handleEditedOrderChange = (productId, value) => {
    setEditedOrders((current) => ({
      ...current,
      [productId]: value
    }));
    setOrderMessage("");
  };

  const handleUseForOrdering = () => {
    const orderPayload = recommendations
      .map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        supplier_name: item.supplier_name,
        supplier_email: item.supplier_email,
        order_quantity: Math.max(Number(editedOrders[item.product_id] ?? item.recommended_reorder ?? 0), 0)
      }))
      .filter((item) => item.order_quantity > 0);

    setOrderMessage(
      orderPayload.length
        ? `Prepared ${orderPayload.length} products for ordering using your updated quantities.`
        : "No products selected for ordering."
    );
  };

  const handleSendOrder = (item) => {
    const quantity = Math.max(
      Number(editedOrders[item.product_id] ?? item.recommended_reorder ?? 0),
      0
    );

    if (!item.supplier_email) {
      setError("Supplier email is missing for this product.");
      setOrderMessage("");
      return;
    }

    if (quantity <= 0) {
      setError("Quantity must be greater than 0 before sending an order.");
      setOrderMessage("");
      return;
    }

    setError("");
    setOrderMessage("");
    setPreviewData({
      product_id: item.product_id,
      supplier_email: item.supplier_email,
      supplier_name: item.supplier_name,
      product_name: item.product_name,
      quantity
    });
    setPreviewProductId(item.product_id);
  };

  const handleConfirmPreview = async () => {
    if (!previewData || !previewProductId) {
      return;
    }

    setSendingProductId(previewProductId);
    setError("");
    setOrderMessage("");

    try {
      const res = await API.post("/send-order", {
        product_id: previewData.product_id,
        supplier_email: previewData.supplier_email,
        supplier_name: previewData.supplier_name,
        product_name: previewData.product_name,
        quantity: previewData.quantity,
      });
      const savedOrder = res.data?.order;
      setOrderStatus((current) => ({
        ...current,
        [previewProductId]: "sent"
      }));
      if (savedOrder?.id) {
        setOrderRecords((current) => ({
          ...current,
          [previewProductId]: savedOrder
        }));
      }
      setOrderMessage("Order sent successfully");
      setPreviewData(null);
      setPreviewProductId(null);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to send order right now.");
    } finally {
      setSendingProductId(null);
    }
  };

  const handleCancelOrder = (productId) => {
    const currentOrder = orderRecords[productId];

    if (!currentOrder?.id) {
      setOrderStatus((current) => ({
        ...current,
        [productId]: "cancelled"
      }));
      setOrderMessage("Order cancelled by user");
      setError("");
      return;
    }

    const runCancel = async () => {
      setSendingProductId(productId);
      setError("");
      setOrderMessage("");

      try {
        const res = await API.post("/cancel-order", { id: currentOrder.id });
        setOrderStatus((current) => ({
          ...current,
          [productId]: "cancelled"
        }));
        if (res.data?.order) {
          setOrderRecords((current) => ({
            ...current,
            [productId]: res.data.order
          }));
        }
        setOrderMessage(res.data?.message || "Order cancelled by user");
      } catch (err) {
        setError(err.response?.data?.error || "Unable to cancel order right now.");
      } finally {
        setSendingProductId(null);
      }
    };

    runCancel();
  };

  const handleCancelPreview = () => {
    if (!previewProductId) {
      return;
    }

    setOrderStatus((current) => ({
      ...current,
      [previewProductId]: "cancelled"
    }));
    setPreviewData(null);
    setPreviewProductId(null);
    setOrderMessage("Order cancelled by user");
    setError("");
  };

  return (
    <Layout>
      <div className="theme-page" style={pageStyle}>
        <Toast tone={toast.tone} message={toast.message || (error ? "Something went wrong" : "")} />
        {isBusy && <LoadingSpinner label={sendingProductId ? "Sending order..." : "Loading orders..."} />}
        <div style={heroStyle}>
          <div>
            <div style={eyebrowStyle}>REORDER PLANNING</div>
            <h2 style={titleStyle}>Recommended Purchase Quantities</h2>
            <p style={subtitleStyle}>
              Each recommendation uses current stock, the reorder threshold,
              predicted demand, and your safety buffer to suggest how much to
              reorder next.
            </p>
          </div>
          <div style={heroMetaStyle}>
            <div>Products To Reorder</div>
            <strong>{highPriorityCount}</strong>
            <div style={{ marginTop: 8 }}>Total Suggested Units</div>
            <strong>{totalRecommended}</strong>
          </div>
        </div>

        <div className="theme-card" style={toolbarStyle}>
          <div style={toolbarCopyStyle}>
            Adjust the extra safety buffer and refresh the list of products that
            are below threshold or demand coverage.
          </div>
          <div style={toolbarControlsStyle}>
            <input
              type="number"
              min="0"
              step="1"
              value={safetyBuffer}
              onChange={(e) => setSafetyBuffer(e.target.value)}
              placeholder="Safety Buffer"
              className="theme-input"
              style={inputStyle}
            />
            <button onClick={() => loadRecommendations(safetyBuffer)} style={primaryButtonStyle}>
              Refresh
            </button>
            <button onClick={handleUseForOrdering} style={secondaryButtonStyle}>
              Use Updated Quantities
            </button>
          </div>
        </div>

        {previewData && (
          <div style={modalOverlayStyle}>
            <div style={modalStyle}>
              <h3 style={modalTitleStyle}>Email Preview</h3>
              <div style={previewBlockStyle}>
                <p style={previewLineStyle}><strong>To:</strong> {previewData.supplier_email}</p>
                <pre style={previewBodyStyle}>
{`Order Request:
Supplier: ${previewData.supplier_name}
Product: ${previewData.product_name}
Quantity: ${previewData.quantity} units`}
                </pre>
              </div>
              <div style={modalActionsStyle}>
                <button
                  onClick={handleConfirmPreview}
                  disabled={sendingProductId === previewProductId}
                  style={confirmButtonStyle}
                >
                  {sendingProductId === previewProductId ? "Sending..." : "Confirm"}
                </button>
                <button
                  onClick={handleCancelPreview}
                  disabled={sendingProductId === previewProductId}
                  style={inlineCancelButtonStyle}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="theme-card" style={cardStyle}>
          <div style={headerRowStyle}>
            <h3 style={sectionTitleStyle}>Reorder Recommendations</h3>
            <span style={metaStyle}>
              {loading ? "Loading..." : `${recommendations.length} products`}
            </span>
          </div>

          {loading ? (
            <div className="theme-empty-state">
              <span>Loading recommendations...</span>
            </div>
          ) : recommendations.length === 0 ? (
            <div className="theme-empty-state">
              <span>No orders yet</span>
            </div>
          ) : (
            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Product ID</th>
                    <th style={thStyle}>Product Name</th>
                    <th style={thStyle}>Current Stock</th>
                    <th style={thStyle}>Threshold</th>
                    <th style={thStyle}>Predicted Demand</th>
                    <th style={thStyle}>Recommended Reorder</th>
                    <th style={thStyle}>Updated Order Qty</th>
                    <th style={thStyle}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recommendations.map((item) => (
                    <tr key={item.product_id}>
                      <td style={tdStyle}>{item.product_id}</td>
                      <td style={tdStyle}>{item.product_name}</td>
                      <td style={tdStyle}>{item.current_stock}</td>
                      <td style={tdStyle}>{item.threshold ?? 0}</td>
                      <td style={tdStyle}>{Number(item.predicted_demand || 0).toFixed(2)}</td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            ...badgeStyle,
                            background:
                              item.recommended_reorder > 0 ? "#ecfdf3" : "#f8fafc",
                            color:
                              item.recommended_reorder > 0 ? "#067647" : "#475467"
                          }}
                        >
                          {item.recommended_reorder}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={editedOrders[item.product_id] ?? item.recommended_reorder}
                          onChange={(e) => handleEditedOrderChange(item.product_id, e.target.value)}
                          placeholder="Quantity"
                          className="theme-input"
                          style={tableInputStyle}
                        />
                      </td>
                      <td style={tdStyle}>
                        {orderStatus[item.product_id] === "sent" ? (
                          <div style={actionButtonsStyle}>
                            <button
                              disabled
                              title="Order successfully placed"
                              style={sentButtonStyle}
                            >
                              Sent
                            </button>
                            <button
                              onClick={() => handleCancelOrder(item.product_id)}
                              disabled={sendingProductId === item.product_id}
                              style={inlineCancelButtonStyle}
                            >
                              {sendingProductId === item.product_id ? "Cancelling..." : "Cancel"}
                            </button>
                          </div>
                        ) : orderStatus[item.product_id] === "cancelled" ? (
                          <div style={actionButtonsStyle}>
                            <button
                              disabled
                              title="Order cancelled by user"
                              style={cancelledButtonStyle}
                            >
                              Cancelled
                            </button>
                            <button
                              onClick={() => handleSendOrder(item)}
                              disabled={sendingProductId === item.product_id}
                              style={rowButtonStyle}
                            >
                              {sendingProductId === item.product_id ? "Sending..." : "Send Order"}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleSendOrder(item)}
                            disabled={sendingProductId === item.product_id}
                            style={rowButtonStyle}
                          >
                            {sendingProductId === item.product_id ? "Sending..." : "Send Order"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

const pageStyle = { display: "grid", gap: 24, position: "relative" };
const heroStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  flexWrap: "wrap",
  padding: 24,
  borderRadius: 20,
  background: `linear-gradient(135deg, ${theme.colors.secondary} 0%, ${theme.colors.primary} 100%)`,
  color: theme.colors.textLight,
  boxShadow: theme.shadow.strong
};
const eyebrowStyle = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.16em",
  color: "rgba(255,255,255,0.78)"
};
const titleStyle = { margin: "10px 0 8px", fontSize: 30 };
const subtitleStyle = { margin: 0, color: "rgba(255,255,255,0.88)", maxWidth: 760, lineHeight: 1.6 };
const heroMetaStyle = {
  minWidth: 200,
  borderRadius: 12,
  background: "rgba(255,255,255,0.12)",
  padding: 16
};
const toolbarStyle = {
  background: theme.colors.card,
  borderRadius: 16,
  padding: 24,
  boxShadow: theme.shadow.soft,
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "center",
  flexWrap: "wrap"
};
const toolbarCopyStyle = { color: theme.colors.textMuted, maxWidth: 540 };
const toolbarControlsStyle = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap"
};
const inputStyle = {
  width: 180,
  padding: "13px 14px",
  borderRadius: 12,
  border: `1px solid ${theme.colors.border}`,
  background: theme.colors.cardStrong,
  boxSizing: "border-box"
};
const primaryButtonStyle = {
  padding: "12px 18px",
  borderRadius: 12,
  border: "none",
  background: theme.colors.primary,
  color: theme.colors.textLight,
  fontWeight: 700,
  cursor: "pointer"
};
const secondaryButtonStyle = {
  padding: "12px 18px",
  borderRadius: 12,
  border: `1px solid ${theme.colors.secondary}`,
  background: theme.colors.secondary,
  color: theme.colors.textLight,
  fontWeight: 700,
  cursor: "pointer"
};
const cardStyle = {
  background: theme.colors.card,
  borderRadius: 16,
  padding: 24,
  boxShadow: theme.shadow.soft
};
const headerRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
  marginBottom: 12
};
const sectionTitleStyle = { margin: 0, color: theme.colors.secondary };
const metaStyle = { color: theme.colors.textMuted, fontWeight: 600 };
const tableWrapStyle = { overflowX: "auto" };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const thStyle = {
  textAlign: "left",
  padding: "12px 10px",
  borderBottom: "1px solid #e4e9ee",
  color: theme.colors.secondary
};
const tdStyle = {
  padding: "14px 10px",
  borderBottom: `1px solid ${theme.colors.border}`,
  color: theme.colors.textDark
};
const tableInputStyle = {
  width: 110,
  padding: "10px 12px",
  borderRadius: 10,
  border: `1px solid ${theme.colors.border}`,
  background: theme.colors.cardStrong,
  boxSizing: "border-box"
};
const rowButtonStyle = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  background: theme.colors.primary,
  color: theme.colors.textLight,
  fontWeight: 700,
  cursor: "pointer"
};
const sentButtonStyle = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  background: theme.colors.success,
  color: theme.colors.textLight,
  fontWeight: 700,
  cursor: "not-allowed",
  opacity: 0.95
};
const cancelledButtonStyle = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  background: theme.colors.danger,
  color: theme.colors.textLight,
  fontWeight: 700,
  cursor: "not-allowed",
  opacity: 0.95
};
const actionButtonsStyle = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap"
};
const inlineCancelButtonStyle = {
  padding: "10px 14px",
  borderRadius: 10,
  border: `1px solid ${theme.colors.danger}`,
  background: "#FDEDEC",
  color: theme.colors.danger,
  fontWeight: 700,
  cursor: "pointer"
};
const badgeStyle = {
  display: "inline-block",
  minWidth: 64,
  textAlign: "center",
  padding: "6px 12px",
  borderRadius: 999,
  fontWeight: 700
};
const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(11, 31, 51, 0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  zIndex: 1000
};
const modalStyle = {
  width: "100%",
  maxWidth: 520,
  background: theme.colors.cardStrong,
  borderRadius: 16,
  padding: 24,
  boxShadow: theme.shadow.strong
};
const modalTitleStyle = {
  margin: "0 0 16px",
  color: theme.colors.secondary,
  fontSize: 24
};
const previewBlockStyle = {
  background: theme.colors.card,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: 12,
  padding: 18
};
const previewLineStyle = {
  margin: "0 0 12px",
  color: theme.colors.secondary
};
const previewBodyStyle = {
  margin: 0,
  whiteSpace: "pre-wrap",
  fontFamily: "inherit",
  lineHeight: 1.7,
  color: theme.colors.textDark
};
const modalActionsStyle = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 12,
  marginTop: 18
};
const confirmButtonStyle = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  background: theme.colors.primary,
  color: theme.colors.textLight,
  fontWeight: 700,
  cursor: "pointer"
};
export default ReorderRecommendations;
