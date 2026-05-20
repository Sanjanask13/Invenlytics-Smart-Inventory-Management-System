import React, { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import LoadingSpinner from "../components/LoadingSpinner";
import Toast from "../components/Toast";
import API from "../services/api";
import { theme } from "../theme";
import { getStoredMerchant, getStoredStoreId } from "../utils/auth";

function BarcodeScanner() {
  const merchant = getStoredMerchant() || {};
  const activeStoreId = merchant?.store_id || getStoredStoreId() || "";
  const [products, setProducts] = useState([]);
  const [barcode, setBarcode] = useState("");
  const [manualItem, setManualItem] = useState({
    product_id: "",
    quantity: "",
    discount: ""
  });
  const [cart, setCart] = useState([]);
  const [billHistory, setBillHistory] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [anomalyWarning, setAnomalyWarning] = useState("");
  const [confirmationWarnings, setConfirmationWarnings] = useState([]);
  const [pendingBillPayload, setPendingBillPayload] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [toast, setToast] = useState({ tone: "success", message: "" });
  const isBusy = submitting;

  useEffect(() => {
    if (!message && !error && !historyError) {
      return undefined;
    }

    setToast({
      tone: error || historyError ? "error" : "success",
      message: error || historyError || message
    });

    const timeoutId = window.setTimeout(() => {
      setToast({ tone: "success", message: "" });
    }, 2500);

    return () => window.clearTimeout(timeoutId);
  }, [error, historyError, message]);

  useEffect(() => {
    if (!showInvoiceModal && !showConfirmationModal) {
      return undefined;
    }

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setShowInvoiceModal(false);
        setShowConfirmationModal(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow || "auto";
      window.removeEventListener("keydown", handleEscape);
    };
  }, [showConfirmationModal, showInvoiceModal]);

  const loadProducts = useCallback(async () => {
    const res = await API.get(`/products/${activeStoreId}`);
    setProducts(res.data);
  }, [activeStoreId]);

  const loadBillHistory = useCallback(async () => {
    try {
      const res = await API.get("/bill-history", { params: { store_id: activeStoreId } });
      setBillHistory(res.data);
    } catch (err) {
      setHistoryError("Unable to load bill history right now.");
    }
  }, [activeStoreId]);

  useEffect(() => {
    const initialize = async () => {
      try {
        await Promise.all([loadProducts(), loadBillHistory()]);
      } catch (err) {
        setError("Unable to load billing data right now.");
      }
    };

    initialize();
  }, [activeStoreId, loadBillHistory, loadProducts]);

  const totalAmount = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.line_total || 0), 0),
    [cart]
  );
  const barcodeSuggestions = useMemo(
    () => products.filter((product) => product.barcode).slice(0, 10),
    [products]
  );

  const calculateLineTotal = (unitPrice, quantity, discount) =>
    Math.max(
      Number(unitPrice || 0) * Number(quantity || 0) * (1 - Number(discount || 0) / 100),
      0
    );

  const addToCart = (product, quantity = 1, discount = 0) => {
    if (!product) {
      return;
    }

    const qty = Number(quantity);
    const discountPercent = Number(discount || 0);
    const lineTotal = calculateLineTotal(product.price, qty, discountPercent);

    setCart((current) => [
      ...current,
      {
        product_id: product.product_id,
        product_name: product.product_name,
        barcode: product.barcode,
        category: product.category,
        quantity: qty,
        discount: discountPercent,
        unit_price: Number(product.price || 0),
        line_total: lineTotal
      }
    ]);
  };

  const handleQtyChange = (index, value) => {
    const parsedQuantity = Number(value);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity < 1) {
      return;
    }

    setCart((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const nextQuantity = Math.max(1, Math.floor(parsedQuantity));
        const nextLineTotal = calculateLineTotal(
          item.unit_price,
          nextQuantity,
          item.discount
        );

        return {
          ...item,
          quantity: nextQuantity,
          line_total: nextLineTotal
        };
      })
    );
  };

  const handleDiscountChange = (index, value) => {
    if (value === "") {
      setCart((current) =>
        current.map((item, itemIndex) => {
          if (itemIndex !== index) {
            return item;
          }

          return {
            ...item,
            discount: "",
            line_total: calculateLineTotal(item.unit_price, item.quantity, 0)
          };
        })
      );
      return;
    }

    const parsedDiscount = Number(value);
    if (!Number.isFinite(parsedDiscount) || parsedDiscount < 0) {
      return;
    }

    setCart((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const nextDiscount = Math.min(parsedDiscount, 100);
        const nextLineTotal = calculateLineTotal(
          item.unit_price,
          item.quantity,
          nextDiscount
        );

        return {
          ...item,
          discount: nextDiscount,
          line_total: nextLineTotal
        };
      })
    );
  };

  const handleScan = async () => {
    setError("");
    setMessage("");
    setAnomalyWarning("");

    if (!barcode.trim()) {
      setFieldErrors((current) => ({ ...current, barcode: "This field is required" }));
      setError("Enter a barcode first.");
      return;
    }

    try {
      const res = await API.post("/scan-barcode", {
        barcode: barcode.trim(),
        store_id: activeStoreId,
      });
      addToCart(res.data.product, 1, 0);
      setMessage(`${res.data.product.product_name} added to bill.`);
      setBarcode("");
    } catch (err) {
      setError(err.response?.data?.error || "Unable to fetch product by barcode.");
    }
  };

  const handleAddManualItem = () => {
    setError("");
    setMessage("");
    setAnomalyWarning("");

    const product = products.find((item) => item.product_id === manualItem.product_id);
    const nextErrors = {};
    if (!product) {
      nextErrors.product_id = "This field is required";
    }

    if (!manualItem.quantity || Number(manualItem.quantity) <= 0) {
      nextErrors.quantity = "This field is required";
    }

    setFieldErrors((current) => ({ ...current, ...nextErrors }));

    if (Object.keys(nextErrors).length > 0) {
      setError(!product ? "Select a valid product for manual billing." : "Quantity must be greater than 0.");
      return;
    }

    addToCart(product, manualItem.quantity, manualItem.discount);
    setManualItem({
      product_id: "",
      quantity: "",
      discount: ""
    });
    setMessage(`${product.product_name} added to bill.`);
  };

  const handleRemoveCartItem = (index) => {
    setCart((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleGenerateBillLegacy = async () => {
    setSubmitting(true);
    setError("");
    setMessage("");
    setAnomalyWarning("");

    if (!cart.length) {
      setError("Add at least one item before generating a bill.");
      setSubmitting(false);
      return;
    }

    try {
      const payload = {
        store_id: activeStoreId,
        items: cart.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.unit_price,
          discount: Number(item.discount || 0)
        }))
      };
      console.log("Creating bill with payload:", payload);

      const res = await API.post("/create-bill", payload);
      console.log("Create bill response:", res.data);

      if (res.data?.success) {
        setSelectedInvoice(res.data.invoice);
        setShowInvoiceModal(true);
        setAnomalyWarning(
          res.data?.has_anomaly ? "⚠️ Unusual transaction detected" : ""
        );
        setCart([]);
        setMessage(res.data.message || `Bill ${res.data.bill_id} generated successfully.`);
        await Promise.all([loadProducts(), loadBillHistory()]);
      } else {
        setError(res.data?.error || "Unable to generate bill.");
      }
    } catch (err) {
      console.error("Create bill failed:", err.response?.data || err.message);
      setError(err.response?.data?.error || "Unable to generate bill.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitBill = async (payload, confirmationAccepted = false) => {
    try {
      const res = await API.post("/create-bill", {
        ...payload,
        confirmation_accepted: confirmationAccepted
      });
      console.log("Create bill response:", res.data);

      if (res.data?.success) {
        setSelectedInvoice(res.data.invoice);
        setShowInvoiceModal(true);
        setShowConfirmationModal(false);
        setConfirmationWarnings([]);
        setPendingBillPayload(null);
        setAnomalyWarning(
          res.data?.has_anomaly ? "Warning: Unusual transaction detected" : ""
        );
        setCart([]);
        setMessage(res.data.message || `Bill ${res.data.bill_id} generated successfully.`);
        await Promise.all([loadProducts(), loadBillHistory()]);
      } else {
        setError(res.data?.error || "Unable to generate bill.");
      }
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.requires_confirmation) {
        setPendingBillPayload(payload);
        setConfirmationWarnings(err.response?.data?.confirmation_warnings || []);
        setShowConfirmationModal(true);
        return;
      }
      console.error("Create bill failed:", err.response?.data || err.message);
      setError(err.response?.data?.error || "Unable to generate bill.");
    }
  };

  const handleGenerateBill = async () => {
    setSubmitting(true);
    setError("");
    setMessage("");
    setAnomalyWarning("");

    if (!cart.length) {
      setError("Add at least one item before generating a bill.");
      setSubmitting(false);
      return;
    }

    const payload = {
      store_id: activeStoreId,
      items: cart.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.unit_price,
        discount: Number(item.discount || 0)
      }))
    };
    console.log("Creating bill with payload:", payload);

    try {
      await submitBill(payload, false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmBillGeneration = async () => {
    if (!pendingBillPayload) {
      return;
    }

    setSubmitting(true);
    try {
      await submitBill(pendingBillPayload, true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelConfirmation = () => {
    setShowConfirmationModal(false);
    setPendingBillPayload(null);
    setConfirmationWarnings([]);
    setMessage("Bill generation cancelled.");
    setError("");
  };

  const handleViewInvoice = async (billId) => {
    try {
      const res = await API.get(`/invoice/${billId}`);
      setSelectedInvoice(res.data);
      setShowInvoiceModal(true);
      setAnomalyWarning("");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Unable to open invoice.");
    }
  };

  return (
    <Layout>
      <div className="theme-page" style={pageStyle}>
        <Toast
          tone={toast.tone}
          message={toast.message || (error || historyError ? "Something went wrong" : "")}
        />
        {isBusy && <LoadingSpinner label="Processing bill..." />}
        <div style={heroStyle}>
          <div>
            <div style={eyebrowStyle}>BILLING DESK</div>
            <h2 style={titleStyle}>Barcode + Manual Billing</h2>
            <p style={subtitleStyle}>
              Scan products into a cart, add manual items, generate one invoice per customer,
              and reopen stored bills from history whenever needed.
            </p>
          </div>
          <div style={heroMetaStyle}>
            <div>Total Items</div>
            <strong>{cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0)}</strong>
            <div style={{ marginTop: 8 }}>Bill Total</div>
            <strong>Rs. {totalAmount.toFixed(2)}</strong>
          </div>
        </div>

        {anomalyWarning && <div style={warningMessageStyle}>{anomalyWarning}</div>}

        <div className="theme-grid-2" style={sectionGridStyle}>
          <div className="theme-card" style={cardStyle}>
            <h3 style={sectionTitleStyle}>Scan Barcode</h3>
            <div style={inlineRowStyle}>
              <input
                value={barcode}
                list="barcode-suggestion-list"
                onChange={(e) => {
                  setBarcode(e.target.value);
                  setFieldErrors((current) => ({ ...current, barcode: "" }));
                }}
                placeholder="Barcode"
                className="theme-input"
                style={inputStyle(fieldErrors.barcode)}
              />
              {fieldErrors.barcode && <div style={fieldErrorStyle}>{fieldErrors.barcode}</div>}
              <datalist id="barcode-suggestion-list">
                {barcodeSuggestions.map((product) => (
                  <option
                    key={product.product_id}
                    value={product.barcode}
                    label={`${product.product_name} - ${product.barcode}`}
                  />
                ))}
              </datalist>
              <button onClick={handleScan} style={primaryButtonStyle}>
                Add Scan
              </button>
            </div>
            {!!barcodeSuggestions.length && (
              <div style={suggestionWrapStyle}>
                <div style={suggestionTitleStyle}>Quick barcode suggestions</div>
                <div style={suggestionListStyle}>
                  {barcodeSuggestions.map((product) => (
                    <button
                      key={product.product_id}
                      onClick={() => setBarcode(product.barcode)}
                      style={suggestionChipStyle}
                    >
                      {product.product_name} : {product.barcode}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="theme-card" style={cardStyle}>
            <h3 style={sectionTitleStyle}>Manual Billing</h3>
            <div className="theme-form-grid theme-equal-inputs" style={manualGridStyle}>
              <select
                value={manualItem.product_id}
                onChange={(e) => {
                  setManualItem({ ...manualItem, product_id: e.target.value });
                  setFieldErrors((current) => ({ ...current, product_id: "" }));
                }}
                className="theme-input"
                style={inputStyle(fieldErrors.product_id)}
              >
                <option value="" disabled>
                  Select Product
                </option>
                {products.map((product) => (
                  <option key={product.product_id} value={product.product_id}>
                    {product.product_name}
                  </option>
                ))}
              </select>
              {fieldErrors.product_id && <div style={fieldErrorStyle}>{fieldErrors.product_id}</div>}
              <input
                type="number"
                min="1"
                value={manualItem.quantity}
                onChange={(e) => {
                  setManualItem({ ...manualItem, quantity: e.target.value });
                  setFieldErrors((current) => ({ ...current, quantity: "" }));
                }}
                placeholder="Quantity"
                className="theme-input"
                style={inputStyle(fieldErrors.quantity)}
              />
              {fieldErrors.quantity && <div style={fieldErrorStyle}>{fieldErrors.quantity}</div>}
              <input
                type="number"
                min="0"
                step="0.01"
                value={manualItem.discount}
                onChange={(e) => setManualItem({ ...manualItem, discount: e.target.value })}
                placeholder="Discount (%)"
                className="theme-input"
                style={inputStyle(false)}
              />
              <button onClick={handleAddManualItem} style={secondaryButtonStyle}>
                Add Manual Item
              </button>
            </div>
          </div>
        </div>

        <div className="theme-card" style={cardStyle}>
          <div style={listHeaderStyle}>
            <h3 style={sectionTitleStyle}>Current Bill</h3>
            <button onClick={handleGenerateBill} disabled={submitting} style={primaryButtonStyle}>
              {submitting ? "Generating..." : "Generate Bill"}
            </button>
          </div>

          {!cart.length ? (
            <div className="theme-empty-state highlight" style={cartEmptyStateStyle}>
              <div className="theme-empty-icon">+</div>
              <span>No items in the cart yet</span>
            </div>
          ) : (
            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Product</th>
                    <th style={thStyle}>Qty</th>
                    <th style={thStyle}>Price</th>
                    <th style={thStyle}>Discount</th>
                    <th style={thStyle}>Line Total</th>
                    <th style={thStyle}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, index) => (
                    <tr key={`${item.product_id}-${index}`}>
                      <td style={tdStyle}>{item.product_name}</td>
                      <td style={tdStyle}>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity}
                          onChange={(e) => handleQtyChange(index, e.target.value)}
                          className="theme-input"
                          style={qtyInputStyle}
                        />
                      </td>
                      <td style={tdStyle}>Rs. {item.unit_price.toFixed(2)}</td>
                      <td style={tdStyle}>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={item.discount === 0 ? "" : item.discount}
                          onChange={(e) => handleDiscountChange(index, e.target.value)}
                          onFocus={(e) => e.target.select()}
                          placeholder="0"
                          className="theme-input"
                          style={discountInputStyle}
                        />
                      </td>
                      <td style={tdStyle}>Rs. {item.line_total.toFixed(2)}</td>
                      <td style={tdStyle}>
                        <button onClick={() => handleRemoveCartItem(index)} style={dangerButtonStyle}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="theme-grid-2" style={sectionGridStyle}>
          <div className="theme-card" style={cardStyle}>
            <h3 style={sectionTitleStyle}>Bill History</h3>
            {!billHistory.length ? (
              <div className="theme-empty-state">
                <span>No orders yet</span>
              </div>
            ) : (
              <div style={historyListStyle}>
                {billHistory.map((bill) => (
                  <div key={bill.bill_id} className="theme-history-card" style={historyCardStyle}>
                    <div>
                      <strong className="theme-invoice-id">{bill.invoice_no}</strong>
                      <div style={mutedTextStyle}>{bill.created_at}</div>
                      <div style={mutedTextStyle}>
                        {bill.total_items} items, Rs. {bill.total_amount.toFixed(2)}
                      </div>
                    </div>
                    <button
                      onClick={() => handleViewInvoice(bill.bill_id)}
                      style={secondaryButtonStyle}
                    >
                      View Invoice
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
        {showConfirmationModal && (
          <div
            style={invoiceModalBackdropStyle}
            onClick={handleCancelConfirmation}
            role="presentation"
          >
            <div
              className="theme-card"
              style={invoiceModalCardStyle}
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Bill confirmation required"
            >
              <div style={invoiceModalHeaderStyle}>
                <div>
                  <h3 style={invoiceModalTitleStyle}>Confirmation Required</h3>
                  <div style={invoiceModalSubtitleStyle}>
                    Suspicious billing activity was detected. Please review these warnings before continuing.
                  </div>
                </div>
                <button onClick={handleCancelConfirmation} style={invoiceCloseButtonStyle}>
                  Close
                </button>
              </div>
              <div style={confirmationListStyle}>
                {confirmationWarnings.map((warning, index) => (
                  <div key={`${warning.product_id}-${warning.scenario}-${index}`} style={confirmationItemStyle}>
                    <strong>{warning.scenario}</strong>
                    <div style={invoiceItemMetaStyle}>{warning.message}</div>
                  </div>
                ))}
              </div>
              <div style={invoiceActionsStyle}>
                <button onClick={handleCancelConfirmation} style={dangerButtonStyle}>
                  Cancel
                </button>
                <button onClick={handleConfirmBillGeneration} style={invoicePrintButtonStyle}>
                  Confirm And Generate
                </button>
              </div>
            </div>
          </div>
        )}
        {showInvoiceModal && selectedInvoice && (
          <div
            style={invoiceModalBackdropStyle}
            onClick={() => setShowInvoiceModal(false)}
            role="presentation"
          >
            <div
              className="theme-card"
              style={invoiceModalCardStyle}
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Invoice preview"
            >
              <div style={invoiceModalHeaderStyle}>
                <div>
                  <h3 style={invoiceModalTitleStyle}>Invoice Preview</h3>
                  <div style={invoiceModalSubtitleStyle}>
                    Review the fetched invoice details before printing.
                  </div>
                </div>
                <button
                  onClick={() => setShowInvoiceModal(false)}
                  style={invoiceCloseButtonStyle}
                >
                  Close
                </button>
              </div>
              <div style={invoiceStyle}>
                <div style={invoiceSectionStyle}>
                  <div style={invoiceLabelStyle}>Bill ID</div>
                  <div style={invoiceValueStyle}>
                    {selectedInvoice.invoice_no || selectedInvoice.bill_id || "N/A"}
                  </div>
                </div>

                <div style={invoiceSectionStyle}>
                  <div style={invoiceLabelStyle}>Date</div>
                  <div style={invoiceMetaStyle}>{selectedInvoice.created_at || "N/A"}</div>
                </div>

                <div style={invoiceSectionStyle}>
                  <div style={invoiceLabelStyle}>Items</div>
                  <div style={invoiceTableWrapStyle}>
                    <table style={invoiceTableStyle}>
                      <thead>
                        <tr>
                          <th style={invoiceTableHeadStyle}>Item</th>
                          <th style={invoiceTableHeadStyle}>Qty</th>
                          <th style={invoiceTableHeadStyle}>Price</th>
                          <th style={invoiceTableHeadStyle}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedInvoice.items || []).map((item, index) => (
                          <tr key={`${item.product_id}-${index}`}>
                            <td style={invoiceTableCellStyle}>
                              <div style={invoiceItemNameStyle}>
                                {item.product_name || item.product_id || "N/A"}
                              </div>
                              <div style={invoiceItemMetaStyle}>
                                Predicted demand: {Number(item.predicted_demand || 0).toFixed(2)}
                              </div>
                            </td>
                            <td style={invoiceTableCellStyle}>{item.quantity}</td>
                            <td style={invoiceTableCellStyle}>
                              Rs. {Number(item.unit_price || 0).toFixed(2)}
                            </td>
                            <td style={invoiceTableCellStyle}>
                              Rs. {Number(item.line_total || 0).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={invoiceSectionStyle}>
                  <div style={invoiceLabelStyle}>Total</div>
                  <div style={invoiceTotalStyle}>
                    Rs. {Number(selectedInvoice.total_amount || 0).toFixed(2)}
                  </div>
                </div>

                <div style={invoiceActionsStyle}>
                  <button onClick={() => window.print()} style={invoicePrintButtonStyle}>
                    Print Invoice
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
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
const eyebrowStyle = { fontSize: 12, letterSpacing: "0.16em", color: "rgba(255,255,255,0.78)", fontWeight: 800 };
const titleStyle = { margin: "10px 0 8px", fontSize: 30 };
const subtitleStyle = { margin: 0, lineHeight: 1.6, maxWidth: 760, color: "rgba(255,255,255,0.88)" };
const heroMetaStyle = {
  minWidth: 180,
  borderRadius: 12,
  background: "rgba(255,255,255,0.12)",
  padding: 16
};
const sectionGridStyle = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 20 };
const cardStyle = {
  background: theme.colors.card,
  borderRadius: 16,
  padding: 24,
  boxShadow: theme.shadow.soft
};
const sectionTitleStyle = { marginTop: 0, marginBottom: 16, color: theme.colors.secondary };
const inlineRowStyle = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, alignItems: "start" };
const manualGridStyle = { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, alignItems: "start" };
const suggestionWrapStyle = { marginTop: 14, display: "grid", gap: 10 };
const suggestionTitleStyle = { fontSize: 13, color: theme.colors.textMuted, fontWeight: 700 };
const suggestionListStyle = { display: "flex", gap: 10, flexWrap: "wrap" };
const suggestionChipStyle = {
  border: `1px solid ${theme.colors.border}`,
  background: "#FFE8DF",
  color: theme.colors.secondary,
  padding: "8px 12px",
  borderRadius: 999,
  cursor: "pointer",
  fontWeight: 600,
  transition: theme.transition
};
const inputStyle = (hasError) => ({
  width: "100%",
  padding: "13px 14px",
  borderRadius: 12,
  border: hasError ? "1px solid #be123c" : `1px solid ${theme.colors.border}`,
  background: theme.colors.cardStrong,
  boxSizing: "border-box",
  minHeight: 48
});
const primaryButtonStyle = {
  padding: "12px 18px",
  borderRadius: 12,
  border: "none",
  background: theme.colors.primary,
  color: theme.colors.textLight,
  fontWeight: 700,
  cursor: "pointer",
  transition: theme.transition
};
const secondaryButtonStyle = {
  padding: "12px 18px",
  borderRadius: 12,
  border: `1px solid ${theme.colors.secondary}`,
  background: theme.colors.secondary,
  color: theme.colors.textLight,
  fontWeight: 700,
  cursor: "pointer",
  transition: theme.transition
};
const dangerButtonStyle = {
  padding: "8px 12px",
  borderRadius: 10,
  border: `1px solid ${theme.colors.danger}`,
  background: "#FDEDEC",
  color: theme.colors.danger,
  cursor: "pointer",
  transition: theme.transition
};
const warningMessageStyle = {
  background: "#fffaeb",
  border: `1px solid ${theme.colors.warning}`,
  color: theme.colors.warning,
  padding: "14px 16px",
  borderRadius: 12,
  fontWeight: 700
};
const listHeaderStyle = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" };
const tableWrapStyle = { overflowX: "auto" };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const thStyle = { textAlign: "left", padding: "12px 10px", borderBottom: `1px solid ${theme.colors.border}`, color: theme.colors.secondary };
const tdStyle = { padding: "12px 10px", borderBottom: `1px solid ${theme.colors.border}`, color: theme.colors.textDark };
const qtyInputStyle = {
  width: 80,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #d4dde5",
  background: "#fbfdff",
  boxSizing: "border-box"
};
const discountInputStyle = {
  width: 100,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #d4dde5",
  background: "#fbfdff",
  boxSizing: "border-box"
};
const fieldErrorStyle = {
  color: "#be123c",
  fontSize: "13px",
  marginTop: "-4px"
};
const historyListStyle = { display: "grid", gap: 12 };
const historyCardStyle = {
  border: `1px solid ${theme.colors.border}`,
  borderRadius: 12,
  padding: 16,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  transition: theme.transition
};
const mutedTextStyle = { color: theme.colors.textMuted, marginTop: 4 };
const invoiceStyle = { display: "grid", gap: 10 };
const invoiceSectionStyle = {
  marginBottom: 10
};
const invoiceLabelStyle = {
  fontSize: 12,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#8a5a44",
  marginBottom: 10
};
const invoiceValueStyle = {
  fontSize: 20,
  fontWeight: 800,
  color: "#173042"
};
const invoiceMetaStyle = {
  color: "#627789",
  fontSize: 14
};
const invoiceTableWrapStyle = {
  overflowX: "auto"
};
const invoiceTableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  background: "#fffaf7",
  borderRadius: 12
};
const invoiceTableHeadStyle = {
  padding: 8,
  borderBottom: "1px solid #eee",
  textAlign: "left",
  color: "#5e6f7d",
  fontSize: 13
};
const invoiceTableCellStyle = {
  padding: 8,
  borderBottom: "1px solid #eee",
  color: "#183247",
  verticalAlign: "top"
};
const invoiceItemNameStyle = {
  fontWeight: 700
};
const invoiceItemMetaStyle = {
  marginTop: 6,
  color: "#6f8190",
  fontSize: 13
};
const invoiceTotalStyle = {
  fontSize: 24,
  fontWeight: 800,
  color: "#183247"
};
const invoiceActionsStyle = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 12,
  marginTop: 8
};
const confirmationListStyle = {
  display: "grid",
  gap: 12
};
const confirmationItemStyle = {
  border: `1px solid ${theme.colors.border}`,
  borderRadius: 12,
  padding: 14,
  background: "#fffaf7"
};
const invoiceModalBackdropStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "100vh",
  backgroundColor: "rgba(0, 0, 0, 0.6)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 9999
};
const invoiceModalCardStyle = {
  background: "#ffffff",
  borderRadius: "16px",
  width: "600px",
  maxWidth: "90%",
  padding: "24px",
  boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
  position: "relative",
  maxHeight: "90vh",
  overflowY: "auto",
  display: "grid",
  gap: 20
};
const invoiceModalHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap"
};
const invoiceModalTitleStyle = {
  margin: 0,
  fontSize: 24,
  color: "#163047"
};
const invoiceModalSubtitleStyle = {
  marginTop: 8,
  color: "#647c90",
  fontSize: 14
};
const invoiceCloseButtonStyle = {
  background: "transparent",
  border: "1px solid #FF6B35",
  borderRadius: "8px",
  padding: "6px 12px",
  color: "#FF6B35",
  fontWeight: 700,
  cursor: "pointer"
};
const invoicePrintButtonStyle = {
  padding: "12px 18px",
  borderRadius: 12,
  border: "none",
  background: "#FF6B35",
  color: "#ffffff",
  fontWeight: 700,
  cursor: "pointer"
};
const cartEmptyStateStyle = {
  color: theme.colors.primary
};

export default BarcodeScanner;
