import React, { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import API from "../services/api";
import { theme } from "../theme";
import { getStoredStoreId } from "../utils/auth";

const DEFAULT_INSIGHTS = {
  overall_profit: 0,
  top_combos: [],
  pricing_suggestions: [],
  demand_suggestions: [],
  discount_suggestions: [],
};

function Discussion() {
  const merchant = JSON.parse(localStorage.getItem("merchant") || "{}");
  const storeId = merchant?.store_id || getStoredStoreId() || "";

  const [insights, setInsights] = useState(DEFAULT_INSIGHTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadInsights = async () => {
      setLoading(true);
      setError("");

      try {
        const res = await API.get(`/insights/${storeId}`);
        setInsights({ ...DEFAULT_INSIGHTS, ...res.data });
      } catch (err) {
        setError(err.response?.data?.error || "Unable to load discussion insights right now.");
      } finally {
        setLoading(false);
      }
    };

    loadInsights();
  }, [storeId]);

  const summaryCards = useMemo(
    () => [
      {
        label: "Overall Profit",
        value: `Rs. ${Number(insights.overall_profit || 0).toFixed(2)}`,
        tone: Number(insights.overall_profit || 0) >= 0 ? theme.colors.primary : theme.colors.danger,
      },
      {
        label: "Combo Offers",
        value: insights.top_combos.length,
        tone: theme.colors.secondary,
      },
      {
        label: "Actionable Suggestions",
        value:
          insights.pricing_suggestions.length +
          insights.demand_suggestions.length +
          insights.discount_suggestions.length,
        tone: theme.colors.warning,
      },
    ],
    [insights]
  );

  return (
    <Layout>
      <div className="theme-page" style={pageStyle}>
        <div style={heroStyle}>
          <div>
            <div style={eyebrowStyle}>SUGGESTIONS</div>
            <h2 style={titleStyle}>AI-backed retail insights for store {storeId}</h2>
            <p style={subtitleStyle}>
              Review profitability, bundle opportunities, pricing pressure, demand-led
              stock actions, and discount ideas in one place.
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

        <div style={insightGridStyle}>
          <InsightCard
            title="Overall Profit Summary"
            loading={loading}
            emptyMessage="No profit data is available yet."
          >
            <div style={headlineValueStyle}>
              Rs. {Number(insights.overall_profit || 0).toFixed(2)}
            </div>
            <p style={cardCopyStyle}>
              This is the cumulative realized profit for the selected store based on recorded sales.
            </p>
          </InsightCard>

          <InsightCard
            title="Combo Offers"
            loading={loading}
            emptyMessage="No strong product combinations found yet."
          >
            {insights.top_combos.length === 0 ? null : insights.top_combos.map((combo, index) => (
              <div key={`${combo.product_ids.join("-")}-${index}`} style={itemCardStyle}>
                <strong>{combo.products.join(" + ")}</strong>
                <span>
                  Lift {Number(combo.lift || 0).toFixed(2)} | Confidence {Number(combo.confidence || 0).toFixed(2)}
                </span>
              </div>
            ))}
          </InsightCard>

          <InsightCard
            title="Price Suggestions"
            loading={loading}
            emptyMessage="No pricing changes suggested right now."
          >
            {insights.pricing_suggestions.length === 0 ? null : insights.pricing_suggestions.map((item) => (
              <div key={item.product_id} style={itemCardStyle}>
                <strong>{item.product_name}</strong>
                <span>
                  Rs. {Number(item.current_price || 0).toFixed(2)} now, competitor at Rs. {Number(item.competitor_price || 0).toFixed(2)}
                </span>
                <span>{item.suggestion}</span>
              </div>
            ))}
          </InsightCard>

          {loading ? (
            <InsightCard
              title="Demand Suggestions"
              loading={loading}
              emptyMessage="No demand suggestions available"
            >
              {null}
            </InsightCard>
          ) : insights.demand_suggestions.length > 0 ? (
            <InsightCard
              title="Demand Suggestions"
              loading={false}
              emptyMessage="No demand suggestions available"
            >
              {insights.demand_suggestions.map((item) => (
                <div key={item.product_id} style={itemCardStyle}>
                  <strong>{item.product_name}</strong>
                  <span>
                    Demand {Number(item.predicted_demand || 0).toFixed(2)} vs stock {Number(item.current_stock || 0).toFixed(0)}
                  </span>
                  <span>Suggested restock: {Number(item.suggested_restock || 0).toFixed(0)}</span>
                </div>
              ))}
            </InsightCard>
          ) : (
            <div className="theme-panel" style={compactMessageCardStyle}>
              <h3 style={panelTitleStyle}>Demand Suggestions</h3>
              <p style={cardCopyStyle}>No demand suggestions available</p>
            </div>
          )}

          <InsightCard
            title="Discount Suggestions"
            loading={loading}
            emptyMessage="No slow-moving products need discount action right now."
          >
            {insights.discount_suggestions.length === 0 ? null : insights.discount_suggestions.map((item) => (
              <div key={item.product_id} style={itemCardStyle}>
                <strong>{item.product_name}</strong>
                <span>
                  Avg sold {Number(item.average_units_sold || 0).toFixed(2)} with stock {Number(item.current_stock || 0).toFixed(0)}
                </span>
                <span>
                  Suggest {Number(item.suggested_discount || 0).toFixed(2)}% discount
                </span>
              </div>
            ))}
          </InsightCard>
        </div>
      </div>
    </Layout>
  );
}

function InsightCard({ title, loading, emptyMessage, children }) {
  const hasContent = React.Children.count(children) > 0;

  return (
    <div className="theme-panel" style={panelStyle}>
      <h3 style={panelTitleStyle}>{title}</h3>
      {loading ? (
        <div className="theme-empty-state">
          <span>Loading insights...</span>
        </div>
      ) : hasContent ? (
        children
      ) : (
        <p style={cardCopyStyle}>{emptyMessage}</p>
      )}
    </div>
  );
}

const pageStyle = {
  display: "grid",
  gap: "24px",
};

const heroStyle = {
  padding: "24px",
  borderRadius: theme.radius.xl,
  background: `linear-gradient(135deg, ${theme.colors.secondary} 0%, ${theme.colors.primary} 100%)`,
  color: theme.colors.textLight,
  boxShadow: theme.shadow.strong,
};

const eyebrowStyle = {
  fontSize: "12px",
  fontWeight: 800,
  letterSpacing: "0.16em",
  color: "rgba(255,255,255,0.78)",
};

const titleStyle = {
  margin: "10px 0 8px",
  fontSize: "30px",
};

const subtitleStyle = {
  margin: 0,
  color: "rgba(255,255,255,0.88)",
  maxWidth: "760px",
  lineHeight: 1.6,
};

const errorStyle = {
  background: "#FFF1EC",
  border: `1px solid ${theme.colors.primary}`,
  color: theme.colors.danger,
  padding: "12px 14px",
  borderRadius: theme.radius.md,
};

const statsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: "20px",
};

const statCardStyle = {
  background: theme.colors.cardStrong,
  borderRadius: theme.radius.lg,
  padding: "24px",
  boxShadow: theme.shadow.soft,
  display: "grid",
  placeItems: "center",
  textAlign: "center",
};

const statLabelStyle = {
  color: theme.colors.textMuted,
  fontSize: "13px",
  marginBottom: "8px",
};

const statValueStyle = {
  fontSize: "28px",
  fontWeight: 800,
};

const insightGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: "20px",
};

const panelStyle = {
  background: theme.colors.card,
  borderRadius: theme.radius.lg,
  padding: "24px",
  boxShadow: theme.shadow.soft,
  display: "grid",
  gap: "14px",
  alignContent: "start",
};

const panelTitleStyle = {
  margin: 0,
  color: theme.colors.secondary,
};

const headlineValueStyle = {
  fontSize: "34px",
  fontWeight: 800,
  color: theme.colors.primary,
};

const cardCopyStyle = {
  margin: 0,
  color: theme.colors.textMuted,
  lineHeight: 1.6,
};

const itemCardStyle = {
  display: "grid",
  gap: "6px",
  padding: "14px 16px",
  borderRadius: theme.radius.md,
  background: theme.colors.cardStrong,
  color: theme.colors.textDark,
};

const compactMessageCardStyle = {
  background: theme.colors.card,
  borderRadius: theme.radius.lg,
  padding: "24px",
  boxShadow: theme.shadow.soft,
  display: "grid",
  gap: "10px",
  alignContent: "center",
  textAlign: "center",
};

export default Discussion;
