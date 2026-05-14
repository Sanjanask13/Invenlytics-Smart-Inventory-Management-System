import React, { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import LoadingSpinner from "../components/LoadingSpinner";
import Toast from "../components/Toast";
import API from "../services/api";
import { theme } from "../theme";
import { getStoredStoreId } from "../utils/auth";

const initialForm = {
  product_id: "",
  store_id: "",
  product_name: "",
  category: "",
  cost_price: "",
  selling_price: "",
  competitor_price: "",
  initial_stock: "",
  threshold: "",
  supplier_name: "",
  supplier_email: ""
};

function Products() {
  const merchant = JSON.parse(localStorage.getItem("merchant") || "{}");
  const [form, setForm] = useState(initialForm);
  const [products, setProducts] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [stockValue, setStockValue] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [addingProduct, setAddingProduct] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingStock, setSavingStock] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState(false);
  const [productsError, setProductsError] = useState("");
  const [productMessage, setProductMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [toast, setToast] = useState({ tone: "success", message: "" });

  const activeStoreId = merchant?.store_id || getStoredStoreId() || "";
  const selectedProductId = selectedProduct?.product_id;
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  const isBusy = loadingProducts || addingProduct || savingProduct || savingStock || deletingProduct;

  useEffect(() => {
    if (!productMessage && !productsError) {
      return undefined;
    }

    setToast({
      tone: productsError ? "error" : "success",
      message: productsError || productMessage
    });

    const timeoutId = window.setTimeout(() => {
      setToast({ tone: "success", message: "" });
    }, 2500);

    return () => window.clearTimeout(timeoutId);
  }, [productMessage, productsError]);

  const fetchProducts = useCallback(async (storeId = activeStoreId, search = "") => {
    setLoadingProducts(true);
    setProductsError("");

    try {
      const res = await API.get(`/products/${storeId}`, {
        params: search ? { search } : {}
      });
      setProducts(res.data);
      if (selectedProductId) {
        const nextSelected = res.data.find((product) => product.product_id === selectedProductId);
        if (nextSelected) {
          setSelectedProduct(nextSelected);
          setEditForm({
            product_name: nextSelected.product_name || "",
            category: nextSelected.category || "",
            cost_price: nextSelected.cost_price ?? "",
            selling_price: nextSelected.selling_price ?? nextSelected.price ?? "",
            competitor_price: nextSelected.competitor_price ?? "",
            threshold: nextSelected.threshold ?? "",
            store_id: nextSelected.store_id || activeStoreId,
            supplier_name: nextSelected.supplier_name || "",
            supplier_email: nextSelected.supplier_email || ""
          });
          setStockValue(String(nextSelected.stock_left ?? 0));
        } else {
          setSelectedProduct(null);
          setEditForm({});
          setStockValue("");
        }
      }
    } catch (err) {
      setProductsError(err.response?.data?.error || "Unable to open products right now. Please refresh the page.");
    } finally {
      setLoadingProducts(false);
    }
  }, [activeStoreId, selectedProductId]);

  const fetchProductDetails = async (productId) => {
    try {
      const res = await API.get(`/product/${productId}`);
      setSelectedProduct(res.data);
      setEditForm({
        product_name: res.data.product_name || "",
        category: res.data.category || "",
        cost_price: res.data.cost_price ?? "",
        selling_price: res.data.selling_price ?? res.data.price ?? "",
        competitor_price: res.data.competitor_price ?? "",
        threshold: res.data.threshold ?? "",
        store_id: res.data.store_id || activeStoreId,
        supplier_name: res.data.supplier_name || "",
        supplier_email: res.data.supplier_email || ""
      });
      setStockValue(String(res.data.stock_left ?? 0));
    } catch (err) {
      setProductsError(err.response?.data?.error || "Unable to open that product.");
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    fetchProducts(activeStoreId, debouncedSearch);
  }, [activeStoreId, debouncedSearch, fetchProducts]);
  const categorySuggestions = useMemo(
    () =>
      [...new Set(products.map((product) => product.category).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [products]
  );

  const handleChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const validateAddForm = () => {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!form.product_id.trim()) {
      return "This field is required";
    }
    if (!form.product_name.trim()) {
      return "This field is required";
    }
    if (!form.category.trim()) {
      return "This field is required";
    }
    if (form.cost_price === "" || Number(form.cost_price) <= 0) {
      return "Cost Price must be greater than 0.";
    }
    if (form.selling_price === "" || Number(form.selling_price) <= 0) {
      return "Selling Price must be greater than 0.";
    }
    if (form.initial_stock !== "" && Number(form.initial_stock) < 0) {
      return "Initial stock cannot be negative.";
    }
    if (form.threshold !== "" && Number(form.threshold) < 0) {
      return "Threshold cannot be negative.";
    }
    if (!form.supplier_name.trim()) {
      return "This field is required";
    }
    if (!form.supplier_email.trim()) {
      return "This field is required";
    }
    if (!emailPattern.test(form.supplier_email.trim())) {
      return "Enter a valid supplier email.";
    }
    return "";
  };

  const handleAdd = async () => {
    setProductMessage("");
    setProductsError("");

    const validationError = validateAddForm();
    if (validationError) {
      setProductsError(validationError);
      return;
    }

    setAddingProduct(true);

    try {
      const payload = {
        ...form,
        store_id: activeStoreId,
        merchant_id: merchant?.merchant_id,
        cost_price: Number(form.cost_price || 0),
        selling_price: Number(form.selling_price || 0),
        competitor_price: form.competitor_price === "" ? null : Number(form.competitor_price),
        initial_stock: form.initial_stock === "" ? 0 : Number(form.initial_stock),
        threshold: Number(form.threshold || 50)
      };

      const addRes = await API.post("/add-product", payload);
      await fetchProducts(activeStoreId);
      setProductMessage(
        `Product added successfully. Barcode: ${addRes.data?.product?.barcode || "Generated"}`
      );
      setForm(initialForm);
      setFieldErrors({});
      if (addRes.data?.product?.product_id) {
        await fetchProductDetails(addRes.data.product.product_id);
      }
    } catch (err) {
      setProductsError(err.response?.data?.error || "Unable to add product.");
    } finally {
      setAddingProduct(false);
    }
  };

  const handleUpdateProduct = async () => {
    if (!selectedProduct) {
      return;
    }

    setProductMessage("");
    setProductsError("");
    setSavingProduct(true);

    try {
      await API.put(`/product/${selectedProduct.product_id}`, {
        ...editForm,
        price: Number(editForm.price || 0),
        competitor_price:
          editForm.competitor_price === "" ? null : Number(editForm.competitor_price),
        threshold: Number(editForm.threshold || 50)
      });
      await fetchProducts(activeStoreId);
      await fetchProductDetails(selectedProduct.product_id);
      setProductMessage("Product updated successfully.");
    } catch (err) {
      setProductsError(err.response?.data?.error || "Unable to update product.");
    } finally {
      setSavingProduct(false);
    }
  };

  const handleUpdateStock = async () => {
    if (!selectedProduct) {
      return;
    }

    if (stockValue === "" || Number(stockValue) < 0) {
      setProductsError("Enter a valid stock level.");
      return;
    }

    setProductMessage("");
    setProductsError("");
    setSavingStock(true);

    try {
      await API.post("/update-stock", {
        product_id: selectedProduct.product_id,
        stock_level: Number(stockValue)
      });
      await fetchProducts(activeStoreId);
      await fetchProductDetails(selectedProduct.product_id);
      setProductMessage("Stock updated successfully.");
    } catch (err) {
      setProductsError(err.response?.data?.error || "Unable to update stock.");
    } finally {
      setSavingStock(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!selectedProduct) {
      return;
    }

    const confirmed = window.confirm(`Delete ${selectedProduct.product_name}?`);
    if (!confirmed) {
      return;
    }

    setProductMessage("");
    setProductsError("");
    setDeletingProduct(true);

    try {
      await API.delete(`/delete-product/${selectedProduct.product_id}`);
      setSelectedProduct(null);
      setEditForm({});
      setStockValue("");
      await fetchProducts(activeStoreId);
      setProductMessage("Product deleted successfully.");
    } catch (err) {
      setProductsError(err.response?.data?.error || "Unable to delete product.");
    } finally {
      setDeletingProduct(false);
    }
  };

  return (
    <Layout>
      <div className="theme-page" style={pageStyle}>
        <Toast tone={toast.tone} message={toast.message} />
        {isBusy && <LoadingSpinner label="Loading products..." />}
        <div style={heroStyle}>
          <div>
            <div style={eyebrowStyle}>PRODUCT CONTROL</div>
            <h2 style={titleStyle}>Add, View, Update and Delete Products</h2>
            <p style={subtitleStyle}>
              Create products, click any product card to open details, update its information,
              adjust stock, and remove it if it has no billing history.
            </p>
          </div>
        </div>

        <div style={mainGridStyle}>
          <div style={leftColumnStyle}>
            <div className="theme-card" style={formCardStyle}>
              <h3 style={sectionTitleStyle}>Add Product</h3>
              <div style={formGridStyle}>
                <input
                  value={form.product_id}
                  placeholder="Product ID"
                  onChange={(e) => {
                    handleChange("product_id", e.target.value);
                    setFieldErrors((current) => ({ ...current, product_id: "" }));
                  }}
                  className="theme-input"
                  style={inputStyle(false)}
                />
                <input
                  value={form.product_name}
                  placeholder="Product Name"
                  onChange={(e) => {
                    handleChange("product_name", e.target.value);
                    setFieldErrors((current) => ({ ...current, product_name: "" }));
                  }}
                  className="theme-input"
                  style={inputStyle(false)}
                />
                <input
                  value={form.supplier_name}
                  placeholder="Supplier Name"
                  onChange={(e) => {
                    handleChange("supplier_name", e.target.value);
                    setFieldErrors((current) => ({ ...current, supplier_name: "" }));
                  }}
                  className="theme-input"
                  style={inputStyle(false)}
                />
                <input
                  value={form.supplier_email}
                  type="email"
                  placeholder="Supplier Email"
                  onChange={(e) => {
                    handleChange("supplier_email", e.target.value);
                    setFieldErrors((current) => ({ ...current, supplier_email: "" }));
                  }}
                  className="theme-input"
                  style={inputStyle(false)}
                />
                <input
                  value={form.category}
                  list="category-suggestions"
                  placeholder="Category"
                  onChange={(e) => {
                    handleChange("category", e.target.value);
                    setFieldErrors((current) => ({ ...current, category: "" }));
                  }}
                  className="theme-input"
                  style={inputStyle(false)}
                />
                <datalist id="category-suggestions">
                  {categorySuggestions.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
                <input
                  value={form.cost_price}
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Cost Price (Rs.)"
                  onChange={(e) => handleChange("cost_price", e.target.value)}
                  className="theme-input"
                  style={inputStyle(false)}
                />
                <input
                  value={form.selling_price}
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Selling Price (Rs.)"
                  onChange={(e) => handleChange("selling_price", e.target.value)}
                  className="theme-input"
                  style={inputStyle(false)}
                />
                <input
                  value={form.competitor_price}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Competitor Price (Rs.)"
                  onChange={(e) => handleChange("competitor_price", e.target.value)}
                  className="theme-input"
                  style={inputStyle(false)}
                />
                <input
                  value={form.initial_stock}
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Opening Stock"
                  onChange={(e) => handleChange("initial_stock", e.target.value)}
                  className="theme-input"
                  style={inputStyle(false)}
                />
                <input
                  value={form.threshold}
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Reorder Threshold"
                  onChange={(e) => handleChange("threshold", e.target.value)}
                  className="theme-input"
                  style={inputStyle(false)}
                />
              </div>

              <div style={helperRowStyle}>
                <span style={helperTextStyle}>
                  Barcode is generated automatically when the product is created.
                </span>
                <button onClick={handleAdd} disabled={addingProduct} style={addButtonStyle}>
                  {addingProduct ? "Adding Product..." : "Add Product"}
                </button>
              </div>
              {hasFieldErrors && (
                <div style={fieldErrorSummaryStyle}>
                  Please correct the highlighted required fields.
                </div>
              )}
            </div>

            <div className="theme-card" style={listCardStyle}>
              <div style={listHeaderStyle}>
                <h3 style={sectionTitleStyle}>Product List</h3>
                <span style={listMetaStyle}>
                  {loadingProducts ? "Loading..." : `${products.length} products`}
                </span>
              </div>

              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search products"
                className="theme-input"
                style={searchInputStyle}
              />

              {loadingProducts && (
                <div className="theme-empty-state">
                  <span>Loading products...</span>
                </div>
              )}
              {!loadingProducts && products.length === 0 && !productsError && (
                <div className="theme-empty-state">
                  <span>No products found</span>
                </div>
              )}

              <div style={productsGridStyle}>
                {products.map((product) => (
                  <button
                    key={product.product_id}
                    onClick={() => fetchProductDetails(product.product_id)}
                    className="theme-product-card"
                    style={{
                      ...productCardStyle,
                      borderColor:
                        selectedProduct?.product_id === product.product_id ? theme.colors.primary : theme.colors.border,
                      boxShadow:
                        selectedProduct?.product_id === product.product_id
                          ? "0 0 0 2px rgba(255, 107, 53, 0.16)"
                          : "none"
                    }}
                  >
                    <div style={productTopStyle}>
                      <div>
                        <strong style={productNameStyle}>{product.product_name}</strong>
                        <div style={productSubtextStyle}>{product.product_id}</div>
                      </div>
                      <span style={stockBadgeStyle}>Stock: {product.stock_left ?? 0}</span>
                    </div>

                    <div style={productInfoRowStyle}>Category: {product.category || "N/A"}</div>
                    <div style={productInfoRowStyle}>Price: Rs. {Number(product.price || 0).toFixed(2)}</div>
                    <div style={productInfoRowStyle}>
                      Supplier: {product.supplier_name || "Not assigned"}
                    </div>
                    <div style={productInfoRowStyle}>
                      Competitor Price: Rs. {Number(product.competitor_price || 0).toFixed(2)}
                    </div>
                    <div style={barcodeRowStyle}>Barcode: {product.barcode || "Not set"}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="theme-detail-card" style={detailCardStyle}>
            <h3 style={sectionTitleStyle}>Product Details</h3>
            {!selectedProduct ? (
              <div className="theme-empty-state">
                <span>Click any product card to view and manage its details.</span>
              </div>
            ) : (
              <div style={detailPanelStyle}>
                <div style={detailSummaryStyle}>
                  <strong style={detailTitleStyle}>{selectedProduct.product_name}</strong>
                  <div style={mutedTextStyle}>Product ID: {selectedProduct.product_id}</div>
                  <div style={mutedTextStyle}>Barcode: {selectedProduct.barcode}</div>
                  <div style={mutedTextStyle}>Current Stock: {selectedProduct.stock_left ?? 0}</div>
                </div>

                <div style={detailSectionStyle}>
                  <h4 style={subTitleStyle}>Update Product Details</h4>
                  <div style={detailGridStyle}>
                    <input
                      value={editForm.product_name || ""}
                      onChange={(e) => setEditForm({ ...editForm, product_name: e.target.value })}
                      placeholder="Product Name"
                      className="theme-input"
                      style={inputStyle(false)}
                    />
                    <input
                      value={editForm.category || ""}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      placeholder="Category"
                      className="theme-input"
                      style={inputStyle(false)}
                    />
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={editForm.cost_price ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, cost_price: e.target.value })}
                      placeholder="Cost Price (Rs.)"
                      className="theme-input"
                      style={inputStyle(false)}
                    />
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={editForm.selling_price ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, selling_price: e.target.value })}
                      placeholder="Selling Price (Rs.)"
                      className="theme-input"
                      style={inputStyle(false)}
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.competitor_price ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, competitor_price: e.target.value })}
                      placeholder="Competitor Price (Rs.)"
                      className="theme-input"
                      style={inputStyle(false)}
                    />
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={editForm.threshold ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, threshold: e.target.value })}
                      placeholder="Reorder Threshold"
                      className="theme-input"
                      style={inputStyle(false)}
                    />
                    <input
                      value={editForm.supplier_name || ""}
                      onChange={(e) => setEditForm({ ...editForm, supplier_name: e.target.value })}
                      placeholder="Supplier Name"
                      className="theme-input"
                      style={inputStyle(false)}
                    />
                    <input
                      type="email"
                      value={editForm.supplier_email || ""}
                      onChange={(e) => setEditForm({ ...editForm, supplier_email: e.target.value })}
                      placeholder="Supplier Email"
                      className="theme-input"
                      style={inputStyle(false)}
                    />
                  </div>

                  <div style={actionRowStyle}>
                    <button onClick={handleUpdateProduct} disabled={savingProduct} style={addButtonStyle}>
                      {savingProduct ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>

                <div style={detailSectionStyle}>
                  <h4 style={subTitleStyle}>Update Stock</h4>
                  <div style={stockEditorStyle}>
                    <input
                      type="number"
                      min="0"
                      value={stockValue}
                      onChange={(e) => setStockValue(e.target.value)}
                      placeholder="Quantity"
                      className="theme-input"
                      style={inputStyle(false)}
                    />
                    <button onClick={handleUpdateStock} disabled={savingStock} style={secondaryButtonStyle}>
                      {savingStock ? "Updating..." : "Update Stock"}
                    </button>
                  </div>
                </div>

                <div style={detailSectionStyle}>
                  <h4 style={subTitleStyle}>Delete Product</h4>
                  <p style={mutedTextStyle}>
                    Products tied to billing history cannot be deleted so old invoices remain valid.
                  </p>
                  <button onClick={handleDeleteProduct} disabled={deletingProduct} style={dangerButtonStyle}>
                    {deletingProduct ? "Deleting..." : "Delete Product"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

const pageStyle = { display: "grid", gap: "24px", position: "relative" };
const heroStyle = {
  padding: "24px",
  borderRadius: theme.radius.xl,
  background: `linear-gradient(135deg, ${theme.colors.secondary} 0%, ${theme.colors.primary} 100%)`,
  color: theme.colors.textLight,
  boxShadow: theme.shadow.strong
};
const eyebrowStyle = {
  fontSize: "12px",
  fontWeight: 800,
  letterSpacing: "0.16em",
  color: "rgba(255,255,255,0.78)"
};
const titleStyle = { margin: "10px 0 8px", fontSize: "30px" };
const subtitleStyle = { margin: 0, color: "rgba(255,255,255,0.88)", maxWidth: "760px", lineHeight: 1.6 };
const mainGridStyle = { display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: "20px" };
const leftColumnStyle = { display: "grid", gap: "20px" };
const formCardStyle = {
  background: theme.colors.card,
  borderRadius: theme.radius.lg,
  padding: "24px",
  boxShadow: theme.shadow.soft
};
const listCardStyle = {
  background: theme.colors.card,
  borderRadius: theme.radius.lg,
  padding: "24px",
  boxShadow: theme.shadow.soft
};
const detailCardStyle = {
  background: theme.colors.card,
  borderRadius: theme.radius.lg,
  padding: "24px",
  boxShadow: theme.shadow.soft,
  alignSelf: "start",
  position: "sticky",
  top: "20px"
};
const sectionTitleStyle = { marginTop: 0, marginBottom: "16px", color: theme.colors.secondary };
const subTitleStyle = { marginTop: 0, marginBottom: "12px", color: theme.colors.secondary };
const formGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "14px"
};
const detailGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "12px"
};
const inputStyle = (hasError) => ({
  width: "100%",
  padding: "13px 14px",
  borderRadius: theme.radius.md,
  border: hasError ? "1px solid #be123c" : `1px solid ${theme.colors.border}`,
  background: theme.colors.cardStrong,
  boxSizing: "border-box"
});
const helperRowStyle = {
  marginTop: "16px",
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center",
  flexWrap: "wrap"
};
const helperTextStyle = { color: theme.colors.textMuted };
const fieldErrorSummaryStyle = {
  color: theme.colors.danger,
  fontSize: "13px",
  marginTop: "10px"
};
const addButtonStyle = {
  padding: "12px 18px",
  borderRadius: theme.radius.md,
  border: "none",
  background: theme.colors.primary,
  color: theme.colors.textLight,
  fontWeight: 700,
  cursor: "pointer"
};
const secondaryButtonStyle = {
  padding: "12px 18px",
  borderRadius: theme.radius.md,
  border: `1px solid ${theme.colors.secondary}`,
  background: theme.colors.secondary,
  color: theme.colors.textLight,
  fontWeight: 700,
  cursor: "pointer"
};
const dangerButtonStyle = {
  padding: "12px 18px",
  borderRadius: theme.radius.md,
  border: `1px solid ${theme.colors.danger}`,
  background: "#FDEDEC",
  color: theme.colors.danger,
  fontWeight: 700,
  cursor: "pointer"
};
const listHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center",
  flexWrap: "wrap",
  marginBottom: "8px"
};
const searchInputStyle = {
  width: "100%",
  padding: "13px 14px",
  borderRadius: "12px",
  border: "1px solid #d4dde5",
  background: "#fbfdff",
  boxSizing: "border-box",
  marginBottom: "16px"
};
const listMetaStyle = { color: theme.colors.textMuted, fontWeight: 600 };
const productsGridStyle = {
  display: "grid",
  gap: "14px",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))"
};
const productCardStyle = {
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.radius.lg,
  padding: "16px",
  background: theme.colors.cardStrong,
  display: "grid",
  gap: "10px",
  textAlign: "left",
  cursor: "pointer",
  transition: theme.transition
};
const productTopStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "10px",
  alignItems: "flex-start"
};
const productNameStyle = { fontSize: "17px", color: theme.colors.secondary };
const productSubtextStyle = { color: theme.colors.textMuted, fontSize: "13px", marginTop: "4px" };
const stockBadgeStyle = {
  padding: "6px 10px",
  borderRadius: "999px",
  background: "#FFE8DF",
  color: theme.colors.primary,
  fontSize: "12px",
  fontWeight: 700
};
const productInfoRowStyle = { color: theme.colors.textMuted };
const barcodeRowStyle = {
  marginTop: "6px",
  paddingTop: "10px",
  borderTop: `1px solid ${theme.colors.border}`,
  color: theme.colors.textDark,
  fontWeight: 600,
  wordBreak: "break-word"
};
const detailPanelStyle = { display: "grid", gap: "18px" };
const detailSummaryStyle = {
  padding: "16px",
  borderRadius: "16px",
  background: theme.colors.cardStrong,
  border: `1px solid ${theme.colors.border}`
};
const detailTitleStyle = { fontSize: "20px", color: theme.colors.secondary };
const detailSectionStyle = {
  paddingTop: "4px",
  borderTop: `1px solid ${theme.colors.border}`,
  display: "grid",
  gap: "12px"
};
const mutedTextStyle = { color: theme.colors.textDark };
const stockEditorStyle = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: "12px",
  alignItems: "center"
};
const actionRowStyle = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap"
};
export default Products;
