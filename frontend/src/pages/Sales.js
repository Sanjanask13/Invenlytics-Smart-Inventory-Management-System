import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import API from "../services/api";
import { theme } from "../theme";
import { getStoredMerchant, getStoredStoreId } from "../utils/auth";

function Sales() {
  const merchant = getStoredMerchant() || {};
  const storeId = merchant?.store_id || getStoredStoreId() || "";
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    product_id: "",
    quantity: ""
  });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    fetchProducts();
  }, [storeId]);

  const fetchProducts = async () => {
    const res = await API.get(`/products/${storeId}`);
    setProducts(res.data);
  };

  const handleSale = async () => {
    const nextErrors = {};

    if (!form.product_id) {
      nextErrors.product_id = "This field is required";
    }

    if (!form.quantity) {
      nextErrors.quantity = "This field is required";
    }

    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setError("Please complete the required fields.");
      return;
    }

    try {
      setError("");
      await API.post("/add-sale", { ...form, store_id: storeId });
      setForm({
        product_id: "",
        quantity: ""
      });
    } catch (err) {
      setError("Error adding sale");
    }
  };

  return (
    <Layout>
      <h2>Add Sale</h2>

      {error && <div style={errorStyle}>{error}</div>}

      <select
        value={form.product_id}
        onChange={(e) => {
          setForm({ ...form, product_id: e.target.value });
          setFieldErrors((current) => ({ ...current, product_id: "" }));
        }}
        className="theme-input"
        style={inputStyle(fieldErrors.product_id)}
      >
        <option value="">Select product</option>
        {products.map((product) => (
          <option key={product.product_id} value={product.product_id}>
            {product.product_name}
          </option>
        ))}
      </select>
      {fieldErrors.product_id && <div style={fieldErrorStyle}>{fieldErrors.product_id}</div>}

      <input
        placeholder="Quantity"
        value={form.quantity}
        onChange={(e) => {
          setForm({ ...form, quantity: e.target.value });
          setFieldErrors((current) => ({ ...current, quantity: "" }));
        }}
        className="theme-input"
        style={inputStyle(fieldErrors.quantity)}
      />
      {fieldErrors.quantity && <div style={fieldErrorStyle}>{fieldErrors.quantity}</div>}

      <button onClick={handleSale}>Add Sale</button>
    </Layout>
  );
}

const inputStyle = (hasError) => ({
  width: "100%",
  maxWidth: 320,
  padding: "12px 14px",
  borderRadius: 12,
  border: hasError ? "1px solid #be123c" : `1px solid ${theme.colors.border}`,
  background: "#ffffff",
  boxSizing: "border-box",
  marginBottom: 12
});

const fieldErrorStyle = {
  color: "#be123c",
  fontSize: "13px",
  marginTop: "-4px",
  marginBottom: "12px"
};

const errorStyle = {
  background: "#FFF1EC",
  border: `1px solid ${theme.colors.primary}`,
  color: theme.colors.danger,
  padding: "12px 14px",
  borderRadius: 12,
  marginBottom: 12,
  maxWidth: 420
};

export default Sales;
