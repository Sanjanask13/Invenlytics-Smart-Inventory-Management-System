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

const DEFAULT_DASHBOARD = {
  weekly_top_products: [],
  monthly_top_products: [],
  total_profit: 0,
  profit_products: [],
  loss_products: []
};

const DEFAULT_PREDICTIONS = {
  understock_risk: [],
  overstock_risk: []
};

const CHART_COLORS = ["#FF6B35", "#1E3A5F", "#4CAF50", "#FFC107", "#0EA5E9", "#A855F7"];
const BAR_CHART_MARGIN = { top: 40, right: 20, left: 20, bottom: 60 };

function Dashboard() {
  const merchant = JSON.parse(localStorage.getItem("merchant") || "{}");
  const storeId = merchant?.store_id || getStoredStoreId() || "";

  const [dashboard, setDashboard] = useState(DEFAULT_DASHBOARD);
  const [predictions, setPredictions] = useState(DEFAULT_PREDICTIONS);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      setError("");

      try {
        const [dashboardRes, predictionRes, productsRes] = await Promise.all([
          API.get(`/dashboard/${storeId}`),
          API.get(`/predictions/${storeId}`),
          API.get(`/products/${storeId}`)
        ]);
        setDashboard({ ...DEFAULT_DASHBOARD, ...dashboardRes.data });
        setPredictions({ ...DEFAULT_PREDICTIONS, ...predictionRes.data });
        setProducts(Array.isArray(productsRes.data) ? productsRes.data : []);
      } catch (err) {
        setError(err.response?.data?.error || "Unable to load dashboard right now.");
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [storeId]);

  const totalInvestment = useMemo(
    () =>
      products.reduce(
        (sum, product) =>
          sum + (Number(product.cost_price || 0) * Number(product.stock_left || product.stock || 0)),
        0
      ),
    [products]
  );

  const summaryCards = useMemo(
    () => [
      {
        label: "Total Products",
        value: products.length,
        tone: theme.colors.secondary
      },
      {
        label: "Total Investment",
        value: `Rs. ${totalInvestment.toFixed(2)}`,
        tone: theme.colors.primary
      },
      {
        label: "Total Profit",
        value: `Rs. ${Number(dashboard.total_profit || 0).toFixed(2)}`,
        tone: Number(dashboard.total_profit || 0) >= 0 ? theme.colors.secondary : theme.colors.danger
      }
    ],
    [dashboard.total_profit, products.length, totalInvestment]
  );

  const profitMix = useMemo(
    () => [
      { name: "Profit Products", value: dashboard.profit_products.length, color: "#0f766e" },
      { name: "Loss Products", value: dashboard.loss_products.length, color: "#b42318" }
    ],
    [dashboard.loss_products.length, dashboard.profit_products.length]
  );

  const weeklyChartData = useMemo(
    () =>
      dashboard.weekly_top_products.map((item) => ({
        product_name: item.product_name,
        quantity: Number(item.total_quantity || 0),
        fill: CHART_COLORS[Math.abs(hashCode(item.product_name || "")) % CHART_COLORS.length]
      })),
    [dashboard.weekly_top_products]
  );

  const monthlyChartData = useMemo(
    () =>
      dashboard.monthly_top_products.map((item) => ({
        product_name: item.product_name,
        quantity: Number(item.total_quantity || 0),
        fill: CHART_COLORS[Math.abs(hashCode(item.product_name || "")) % CHART_COLORS.length]
      })),
    [dashboard.monthly_top_products]
  );

  return (
    <Layout>
      <div className="theme-page" style={pageStyle}>
        <div style={heroStyle}>
          <div>
            <div style={eyebrowStyle}>MERCHANT DASHBOARD</div>
            <h2 style={titleStyle}>Real sales performance overview</h2>
            <p style={subtitleStyle}>
              This dashboard now focuses on the numbers that matter most:
              realized profit, strongest-selling products, and real stock risks
              based on live prediction data.
            </p>
          </div>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        <div style={statsGridStyle}>
          {summaryCards.map((card) => (
            <div key={card.label} className="theme-stat" style={statCardStyle}>
              <div style={statLabelStyle}>{card.label}</div>
              <div style={{ ...statValueStyle, color: card.tone }}>
                {loading ? "..." : card.value}
              </div>
            </div>
          ))}
        </div>

        <div style={chartGridStyle}>
          <ChartCard
            title="Weekly Top Products"
            loading={loading}
            hasData={weeklyChartData.length > 0}
            emptyMessage="No sales found in the last 7 days."
          >
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={weeklyChartData} margin={BAR_CHART_MARGIN} barGap={10}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="product_name"
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={70}
                  tick={{ fontSize: 11 }}
                  tickFormatter={shortenLabel}
                />
                <YAxis />
                <Tooltip content={<ProductTooltip />} />
                <Bar dataKey="quantity" radius={[10, 10, 0, 0]} barSize={30}>
                  {weeklyChartData.map((entry) => (
                    <Cell key={entry.product_name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Monthly Top Products"
            loading={loading}
            hasData={monthlyChartData.length > 0}
            emptyMessage="No sales found in the last 30 days."
          >
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={monthlyChartData} margin={BAR_CHART_MARGIN} barGap={10}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="product_name"
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={70}
                  tick={{ fontSize: 11 }}
                  tickFormatter={shortenLabel}
                />
                <YAxis />
                <Tooltip content={<ProductTooltip />} />
                <Bar dataKey="quantity" radius={[10, 10, 0, 0]} barSize={30}>
                  {monthlyChartData.map((entry) => (
                    <Cell key={entry.product_name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Profit vs Loss Products"
            loading={loading}
            hasData={profitMix.some((item) => item.value > 0)}
            emptyMessage="No product-level profit data available yet."
          >
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={profitMix}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label
                >
                  {profitMix.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div style={profitLossSectionStyle}>
          <h3 style={sectionTitleStyle}>Profit & Loss</h3>
          <div style={tableGridStyle}>
          <ProductTable
            title="Profit Products"
            loading={loading}
            rows={dashboard.profit_products}
            tone="#067647"
            emptyMessage="No profitable products yet."
          />

          <ProductTable
            title="Loss Products"
            loading={loading}
            rows={dashboard.loss_products}
            tone="#b42318"
            emptyMessage="No loss-making products right now."
          />
          </div>
        </div>

        <div style={profitLossSectionStyle}>
          <h3 style={sectionTitleStyle}>Stock Risk Products</h3>
          <div style={tableGridStyle}>
            <RiskTable
              title="Understock Products"
              loading={loading}
              rows={predictions.understock_risk}
              tone="#b45309"
              emptyMessage="No understock products right now."
            />

            <RiskTable
              title="Overstock Products"
              loading={loading}
              rows={predictions.overstock_risk}
              tone="#0f766e"
              emptyMessage="No overstock products right now."
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}

function ChartCard({ title, loading, hasData, emptyMessage, children }) {
  return (
    <div className="theme-chart-card theme-chart-shell" style={chartCardStyle}>
      <div style={{ display: "grid", gap: "14px" }}>
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
    </div>
  );
}

function ProductTable({ title, loading, rows, tone, emptyMessage }) {
  return (
    <div className="theme-table-card" style={tableCardStyle}>
      <div style={{ display: "grid", gap: "14px" }}>
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
          <table className="theme-table" style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Product</th>
                <th style={thStyle}>Quantity Sold</th>
                <th style={thStyle}>Profit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.product_id}>
                  <td style={tdStyle}>{row.product_name}</td>
                  <td style={tdStyle}>{Number(row.total_quantity || 0).toFixed(0)}</td>
                  <td style={{ ...tdStyle, color: tone, fontWeight: 700 }}>
                    Rs. {Number(row.total_profit || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </div>
  );
}

function RiskTable({ title, loading, rows, tone, emptyMessage }) {
  return (
    <div className="theme-table-card" style={tableCardStyle}>
      <div style={{ display: "grid", gap: "14px" }}>
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
          <table className="theme-table" style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Product</th>
                <th style={thStyle}>Current Stock</th>
                <th style={thStyle}>Predicted Demand</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.product_id}>
                  <td style={tdStyle}>{row.product_name}</td>
                  <td style={tdStyle}>{Number(row.stock || 0).toFixed(0)}</td>
                  <td style={{ ...tdStyle, color: tone, fontWeight: 700 }}>
                    {Number(row.predicted_demand || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>
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
  borderRadius: theme.radius.md
};

const statsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "20px"
};

const statCardStyle = {
  background: theme.colors.cardStrong,
  borderRadius: theme.radius.lg,
  padding: "24px",
  boxShadow: theme.shadow.soft
};

const statLabelStyle = {
  color: theme.colors.textMuted,
  fontSize: "13px",
  marginBottom: "8px"
};

const statValueStyle = {
  fontSize: "28px",
  fontWeight: 800,
  color: theme.colors.textDark
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

const tableGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
  gap: "20px"
};

const profitLossSectionStyle = {
  display: "grid",
  gap: "16px"
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

const sectionTitleStyle = {
  margin: 0,
  color: theme.colors.secondary
};

const tableWrapStyle = { overflowX: "auto" };
const tableStyle = { width: "100%", borderCollapse: "separate", borderSpacing: 0, overflow: "hidden", borderRadius: theme.radius.md };
const thStyle = {
  textAlign: "left",
  padding: "12px 10px",
  borderBottom: `1px solid ${theme.colors.border}`,
  color: theme.colors.secondary
};
const tdStyle = {
  padding: "12px 10px",
  borderBottom: `1px solid ${theme.colors.border}`,
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

export default Dashboard;
