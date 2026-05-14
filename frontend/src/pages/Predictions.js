import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import Layout from "../components/Layout";
import API from "../services/api";
import { theme } from "../theme";
import { getStoredStoreId } from "../utils/auth";

const DEFAULT_OVERVIEW = {
  next_week_top_products: [],
  next_month_top_products: [],
  profit_prediction: [],
  loss_prediction: [],
  understock_risk: [],
  overstock_risk: []
};

const CHART_COLORS = ["#FF6B35", "#1E3A5F", "#4CAF50", "#FFC107", "#0EA5E9", "#A855F7"];
const BAR_CHART_MARGIN = { top: 40, right: 20, left: 20, bottom: 60 };

function Predictions() {
  const merchant = JSON.parse(localStorage.getItem("merchant") || "{}");
  const storeId = merchant?.store_id || getStoredStoreId() || "";

  const [products, setProducts] = useState([]);
  const [overview, setOverview] = useState(DEFAULT_OVERVIEW);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [predicting, setPredicting] = useState(false);
  const [retraining, setRetraining] = useState(false);
  const [retrainStatus, setRetrainStatus] = useState("");
  const [retrainTone, setRetrainTone] = useState("info");
  const [predictionError, setPredictionError] = useState("");
  const [predictionResult, setPredictionResult] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [form, setForm] = useState({
    product_id: "",
    date: "",
    inventory_level: "",
    discount: ""
  });

  useEffect(() => {
    const loadPage = async () => {
      setLoading(true);
      setError("");

      try {
        const [productsRes, overviewRes] = await Promise.all([
          API.get(`/products/${storeId}`),
          API.get(`/predictions/${storeId}`)
        ]);

        setProducts(Array.isArray(productsRes.data) ? productsRes.data : []);
        setOverview({ ...DEFAULT_OVERVIEW, ...overviewRes.data });
      } catch (err) {
        setError(err.response?.data?.error || "Unable to load prediction insights right now.");
      } finally {
        setLoading(false);
      }
    };

    loadPage();
  }, [storeId]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.product_id === form.product_id) || null,
    [form.product_id, products]
  );

  const nextWeekChart = useMemo(
    () =>
      overview.next_week_top_products.map((item) => ({
        name: item.product_name,
        demand: Number(item.predicted_demand || 0),
        fill: CHART_COLORS[Math.abs(hashCode(item.product_name || "")) % CHART_COLORS.length]
      })),
    [overview.next_week_top_products]
  );

  const nextMonthChart = useMemo(
    () =>
      overview.next_month_top_products.map((item) => ({
        name: item.product_name,
        demand: Number(item.next_month_demand || 0),
        fill: CHART_COLORS[Math.abs(hashCode(item.product_name || "")) % CHART_COLORS.length]
      })),
    [overview.next_month_top_products]
  );

  const riskDistribution = useMemo(
    () => [
      {
        name: "Understock",
        value: overview.understock_risk.length,
        color: "#f97316"
      },
      {
        name: "Overstock",
        value: overview.overstock_risk.length,
        color: "#2563eb"
      }
    ],
    [overview.overstock_risk.length, overview.understock_risk.length]
  );

  const handlePredict = async () => {
    setPredictionError("");
    setPredictionResult(null);
    const nextErrors = {};

    if (!form.product_id) {
      nextErrors.product_id = "This field is required";
    }

    if (form.inventory_level === "") {
      nextErrors.inventory_level = "This field is required";
    }

    if (!form.date) {
      nextErrors.date = "This field is required";
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setPredicting(true);

    try {
      const res = await API.post("/predict-product", {
        product_id: form.product_id,
        date: form.date,
        inventory_level: Number(form.inventory_level),
        discount: Number(form.discount || 0)
      });
      setPredictionResult(res.data);
    } catch (err) {
      setPredictionError(err.response?.data?.error || "Unable to predict this product right now.");
    } finally {
      setPredicting(false);
    }
  };

  const handleRetrainModel = async () => {
    setRetrainStatus("");
    setRetrainTone("info");
    setRetraining(true);

    try {
      const res = await API.post("/retrain-model");
      const rowsUsed = Number(res.data?.rows_used || 0);
      setRetrainTone("success");
      setRetrainStatus(
        `Model retrained successfully using ${rowsUsed} historical rows.`
      );
    } catch (err) {
      setRetrainTone("error");
      setRetrainStatus(
        err.response?.data?.error || "Unable to retrain the model right now."
      );
    } finally {
      setRetraining(false);
    }
  };

  return (
    <Layout>
      <div className="theme-page" style={pageStyle}>
        <div style={heroStyle}>
          <div>
            <div style={eyebrowStyle}>PREDICTION DESK</div>
            <h2 style={titleStyle}>Forecast demand before stock decisions</h2>
            <p style={subtitleStyle}>
              See top upcoming sales, profit and loss forecasts, and stock risk patterns
              for store {storeId}. You can also select a single product and run a fresh
              prediction instantly.
            </p>
          </div>
        </div>

        {error && <div style={errorStyle}>{error}</div>}
        <div style={formCardStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h3 style={sectionTitleStyle}>Select Product and Get Prediction</h3>
              <p style={sectionCopyStyle}>
                Pick a product, review current inventory, and generate an updated demand forecast.
              </p>
            </div>
            <button
              onClick={handleRetrainModel}
              disabled={retraining}
              style={secondaryActionStyle}
            >
              {retraining ? "Retraining..." : "Retrain Model"}
            </button>
          </div>

          {retrainStatus && (
            <div
              style={{
                ...(retrainTone === "success"
                  ? successNoticeStyle
                  : retrainTone === "error"
                    ? inlineErrorStyle
                    : neutralNoticeStyle)
              }}
            >
              {retrainStatus}
            </div>
          )}

          <div style={formGridStyle}>
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
                  {product.product_name} ({product.product_id})
                </option>
              ))}
            </select>
            {fieldErrors.product_id && <div style={fieldErrorStyle}>{fieldErrors.product_id}</div>}

            <input
              type="date"
              value={form.date}
              onChange={(e) => {
                setForm({ ...form, date: e.target.value });
                setFieldErrors((current) => ({ ...current, date: "" }));
              }}
              className="theme-input"
              style={inputStyle(fieldErrors.date)}
            />
            {fieldErrors.date && <div style={fieldErrorStyle}>{fieldErrors.date}</div>}

            <input
              type="number"
              min="0"
              step="1"
              value={form.inventory_level}
              onChange={(e) => {
                setForm({ ...form, inventory_level: e.target.value });
                setFieldErrors((current) => ({ ...current, inventory_level: "" }));
              }}
              placeholder="Quantity"
              className="theme-input"
              style={inputStyle(fieldErrors.inventory_level)}
            />
            {fieldErrors.inventory_level && <div style={fieldErrorStyle}>{fieldErrors.inventory_level}</div>}

            <input
              type="number"
              min="0"
              step="0.01"
              value={form.discount}
              onChange={(e) => setForm({ ...form, discount: e.target.value })}
              placeholder="Discount (%)"
              className="theme-input"
              style={inputStyle(false)}
            />
          </div>

          {selectedProduct && (
            <div style={productMetaStyle}>
              <span><strong>Category:</strong> {selectedProduct.category || "Not set"}</span>
              <span><strong>Selling Price:</strong> Rs. {Number(selectedProduct.selling_price ?? selectedProduct.price ?? 0).toFixed(2)}</span>
              <span><strong>Cost Price:</strong> Rs. {Number(selectedProduct.cost_price ?? 0).toFixed(2)}</span>
            </div>
          )}

          <button onClick={handlePredict} disabled={predicting} style={primaryButtonStyle}>
            {predicting ? "Predicting..." : "Get Prediction"}
          </button>

          {predictionError && <div style={inlineErrorStyle}>{predictionError}</div>}

          {predictionResult && (
            <div style={predictionCardStyle}>
              <div style={predictionHeaderStyle}>
                <div>
                  <div style={predictionEyebrowStyle}>LIVE PRODUCT FORECAST</div>
                  <h3 style={predictionTitleStyle}>{predictionResult.product_name}</h3>
                </div>
                <div style={riskBadge(predictionResult.stock_risk)}>
                  {String(predictionResult.stock_risk || "normal").toUpperCase()} RISK
                </div>
              </div>

              <div style={resultGridStyle}>
                <div style={resultItemStyle}>
                  <span>Predicted Demand</span>
                  <strong>{Number(predictionResult.predicted_demand || 0).toFixed(2)}</strong>
                </div>
                <div style={resultItemStyle}>
                  <span>Expected Profit</span>
                  <strong>Rs. {Number(predictionResult.expected_profit || 0).toFixed(2)}</strong>
                </div>
                <div style={resultItemStyle}>
                  <span>Current Inventory</span>
                  <strong>{Number(form.inventory_level || 0).toFixed(0)}</strong>
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={chartGridStyle}>
          <ChartCard
            title="Next Week Top Sales"
            loading={loading}
            hasData={nextWeekChart.length > 0}
            emptyMessage="No weekly prediction data available."
          >
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={nextWeekChart} margin={BAR_CHART_MARGIN} barGap={10}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  tickFormatter={shortenLabel}
                  angle={-20}
                  textAnchor="end"
                  height={70}
                  tick={{ fontSize: 11 }}
                />
                <YAxis />
                <Tooltip content={<ProductTooltip />} />
                <Bar dataKey="demand" radius={[10, 10, 0, 0]} barSize={30}>
                  {nextWeekChart.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Next Month Top Sales"
            loading={loading}
            hasData={nextMonthChart.length > 0}
            emptyMessage="No monthly prediction data available."
          >
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={nextMonthChart} margin={BAR_CHART_MARGIN} barGap={10}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  tickFormatter={shortenLabel}
                  angle={-20}
                  textAnchor="end"
                  height={70}
                  tick={{ fontSize: 11 }}
                />
                <YAxis />
                <Tooltip content={<ProductTooltip />} />
                <Bar dataKey="demand" radius={[10, 10, 0, 0]} barSize={30}>
                  {nextMonthChart.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Stock Risk Mix"
            loading={loading}
            hasData={riskDistribution.some((item) => item.value > 0)}
            emptyMessage="No stock risk data available."
          >
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={riskDistribution}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label
                >
                  {riskDistribution.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div style={gridStyle}>
          <PredictionPanel
            title="Understock Risk"
            loading={loading}
            rows={overview.understock_risk}
            renderValue={(row) => `${Number(row.predicted_demand || 0).toFixed(2)} demand vs ${Number(row.stock || 0).toFixed(0)} stock`}
          />

          <PredictionPanel
            title="Overstock Risk"
            loading={loading}
            rows={overview.overstock_risk}
            renderValue={(row) => `${Number(row.stock || 0).toFixed(0)} stock vs ${Number(row.predicted_demand || 0).toFixed(2)} demand`}
          />
        </div>

        <div style={tableGridStyle}>
          <PredictionTable
            title="Profit Prediction Table"
            loading={loading}
            rows={overview.profit_prediction}
            tone="#067647"
            emptyMessage="No profit prediction data available."
          />

          <PredictionTable
            title="Loss Prediction Table"
            loading={loading}
            rows={overview.loss_prediction}
            tone="#b42318"
            emptyMessage="No loss prediction data available."
          />
        </div>
      </div>
    </Layout>
  );
}

function ChartCard({ title, loading, hasData, emptyMessage, children }) {
  return (
    <div className="theme-chart-card theme-chart-shell" style={chartCardStyle}>
      <h3 style={panelTitleStyle}>{title}</h3>
      {loading ? (
        <div className="theme-empty-state">
          <span>Loading chart...</span>
        </div>
      ) : hasData ? (
        <div className="theme-chart-frame">{children}</div>
      ) : (
        <div className="theme-empty-state">
          <span>{emptyMessage}</span>
        </div>
      )}
    </div>
  );
}

function PredictionPanel({ title, loading, rows, renderValue }) {
  return (
    <div className="theme-panel" style={panelStyle}>
      <h3 style={panelTitleStyle}>{title}</h3>
      {loading ? (
        <div className="theme-empty-state">
          <span>Loading...</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="theme-empty-state">
          <span>No data available yet.</span>
        </div>
      ) : (
        rows.map((row) => (
          <div key={row.product_id} style={itemStyle}>
            <strong>{row.product_name}</strong>
            <span>{renderValue(row)}</span>
          </div>
        ))
      )}
    </div>
  );
}

function PredictionTable({ title, loading, rows, tone, emptyMessage }) {
  return (
    <div className="theme-table-card" style={tableCardStyle}>
      <h3 style={panelTitleStyle}>{title}</h3>
      {loading ? (
        <div className="theme-empty-state">
          <span>Loading table...</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="theme-empty-state">
          <span>{emptyMessage}</span>
        </div>
      ) : (
        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Product</th>
                <th style={thStyle}>Predicted Demand</th>
                <th style={thStyle}>Expected Profit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.product_id}>
                  <td style={tdStyle}>{row.product_name}</td>
                  <td style={tdStyle}>{Number(row.predicted_demand || 0).toFixed(2)}</td>
                  <td style={{ ...tdStyle, color: tone, fontWeight: 700 }}>
                    Rs. {Number(row.predicted_profit || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function shortenLabel(label) {
  if (!label) {
    return "";
  }

  return label.length > 10 ? `${label.slice(0, 10)}...` : label;
}

function ProductTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div style={tooltipStyle}>
      <div style={tooltipTitleStyle}>{label}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} style={tooltipRowStyle}>
          <span>{entry.name || entry.dataKey}</span>
          <strong>{entry.value}</strong>
        </div>
      ))}
    </div>
  );
}

function hashCode(value) {
  return value.split("").reduce((accumulator, character) => (
    (accumulator << 5) - accumulator + character.charCodeAt(0)
  ), 0);
}

function riskBadge(risk) {
  const normalizedRisk = String(risk || "normal").toLowerCase();

  if (normalizedRisk === "under") {
    return {
      ...riskBadgeBaseStyle,
      background: "#fff7ed",
      color: "#c2410c"
    };
  }

  if (normalizedRisk === "over") {
    return {
      ...riskBadgeBaseStyle,
      background: "#eff6ff",
      color: "#1d4ed8"
    };
  }

  return {
    ...riskBadgeBaseStyle,
    background: "#ecfdf3",
    color: "#067647"
  };
}

const pageStyle = {
  display: "grid",
  gap: "24px"
};

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

const titleStyle = {
  margin: "10px 0 8px",
  fontSize: "30px"
};

const subtitleStyle = {
  margin: 0,
  color: "rgba(255,255,255,0.88)",
  maxWidth: "760px",
  lineHeight: 1.6
};

const errorStyle = {
  background: "#FFF1EC",
  border: `1px solid ${theme.colors.primary}`,
  color: theme.colors.danger,
  padding: "12px 14px",
  borderRadius: "12px"
};

const formCardStyle = {
  background: theme.colors.card,
  borderRadius: theme.radius.lg,
  padding: "24px",
  boxShadow: theme.shadow.soft
};

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  marginBottom: "16px"
};

const sectionTitleStyle = {
  margin: 0,
  color: theme.colors.secondary
};

const sectionCopyStyle = {
  margin: "6px 0 0",
  color: theme.colors.textMuted,
  lineHeight: 1.5
};

const formGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "14px"
};

const inputStyle = (hasError) => ({
  width: "100%",
  padding: "13px 14px",
  borderRadius: theme.radius.md,
  border: hasError ? "1px solid #be123c" : `1px solid ${theme.colors.border}`,
  background: theme.colors.cardStrong,
  boxSizing: "border-box"
});

const fieldErrorStyle = {
  color: "#be123c",
  fontSize: "13px",
  marginTop: "-4px"
};

const productMetaStyle = {
  marginTop: "14px",
  display: "flex",
  flexWrap: "wrap",
  gap: "14px",
  color: theme.colors.textMuted,
  fontSize: "14px"
};

const primaryButtonStyle = {
  marginTop: "18px",
  padding: "13px 18px",
  borderRadius: "12px",
  border: "none",
  background: theme.colors.primary,
  color: theme.colors.textLight,
  fontWeight: 700,
  cursor: "pointer"
};

const secondaryActionStyle = {
  padding: "13px 18px",
  borderRadius: "12px",
  border: `1px solid ${theme.colors.secondary}`,
  background: theme.colors.secondary,
  color: theme.colors.textLight,
  fontWeight: 700,
  cursor: "pointer"
};

const inlineErrorStyle = {
  marginTop: "14px",
  background: "#FFF1EC",
  border: `1px solid ${theme.colors.primary}`,
  color: theme.colors.danger,
  padding: "12px 14px",
  borderRadius: "12px"
};

const successNoticeStyle = {
  marginBottom: "14px",
  background: "#ECFDF3",
  border: `1px solid ${theme.colors.success}`,
  color: theme.colors.success,
  padding: "12px 14px",
  borderRadius: "12px"
};

const neutralNoticeStyle = {
  marginBottom: "14px",
  background: "#EEF2F7",
  border: `1px solid ${theme.colors.border}`,
  color: theme.colors.secondary,
  padding: "12px 14px",
  borderRadius: "12px"
};

const predictionCardStyle = {
  marginTop: "20px",
  borderRadius: "18px",
  padding: "20px",
  background: theme.colors.cardStrong,
  border: `1px solid ${theme.colors.border}`
};

const predictionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
  marginBottom: "16px"
};

const predictionEyebrowStyle = {
  fontSize: "12px",
  fontWeight: 800,
  letterSpacing: "0.14em",
  color: theme.colors.textMuted
};

const predictionTitleStyle = {
  margin: "8px 0 0",
  color: theme.colors.secondary
};

const riskBadgeBaseStyle = {
  padding: "8px 12px",
  borderRadius: "999px",
  fontWeight: 800,
  fontSize: "12px",
  letterSpacing: "0.06em"
};

const resultGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "14px"
};

const resultItemStyle = {
  background: theme.colors.cardStrong,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.radius.md,
  padding: "16px",
  color: "#334155",
  display: "grid",
  gap: "8px"
};

const chartGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: "20px"
};

const chartCardStyle = {
  background: theme.colors.card,
  borderRadius: theme.radius.lg,
  padding: "24px",
  boxShadow: theme.shadow.soft
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "20px"
};

const tableGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
  gap: "20px"
};

const panelStyle = {
  background: theme.colors.card,
  borderRadius: theme.radius.lg,
  padding: "24px",
  boxShadow: theme.shadow.soft
};

const tableCardStyle = {
  background: theme.colors.card,
  borderRadius: theme.radius.lg,
  padding: "24px",
  boxShadow: theme.shadow.soft
};

const panelTitleStyle = {
  marginTop: 0,
  marginBottom: "14px",
  color: theme.colors.secondary
};

const itemStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  padding: "10px 12px",
  borderRadius: "12px",
  background: theme.colors.cardStrong,
  marginBottom: "10px",
  color: theme.colors.textDark
};

const tableWrapStyle = {
  overflowX: "auto"
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse"
};

const thStyle = {
  textAlign: "left",
  padding: "12px 10px",
  borderBottom: "1px solid #e4e9ee",
  color: theme.colors.secondary
};

const tdStyle = {
  padding: "12px 10px",
  borderBottom: "1px solid #f0f4f7",
  color: theme.colors.textDark
};
const tooltipStyle = {
  background: "#ffffff",
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.radius.md,
  padding: "10px 12px",
  boxShadow: theme.shadow.soft
};
const tooltipTitleStyle = {
  color: theme.colors.secondary,
  fontWeight: 700,
  marginBottom: "6px"
};
const tooltipRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  color: theme.colors.textDark
};

export default Predictions;
