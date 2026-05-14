import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

function Charts({ inventory, prediction, weekDemand = [], monthDemand = [] }) {
  const colors = ["#FF6B35", "#1E3A5F", "#4CAF50", "#FFC107"];
  const chartMargin = { top: 40, right: 20, left: 20, bottom: 60 };
  const comparisonData = [
    {
      name: "Current Stock",
      value: Number(inventory) || 0,
      fill: colors[0]
    },
    {
      name: "Predicted Daily Demand",
      value: Number(prediction) || 0,
      fill: colors[1]
    }
  ];

  const weekChartData = weekDemand.map((item, index) => ({
    ...item,
    fill: colors[index % colors.length]
  }));

  const monthChartData = monthDemand.map((item, index) => ({
    ...item,
    fill: colors[index % colors.length]
  }));

  return (
    <div style={{ display: "grid", gap: "20px", marginTop: "24px" }}>
      <div style={chartCardStyle}>
        <h3 style={chartTitleStyle}>Inventory vs Predicted Daily Demand</h3>
        <p style={chartDescriptionStyle}>
          This compares current stock on hand with the model's predicted daily demand
          for the selected product, so retailers can quickly see if stock is comfortably
          above expected near-term movement.
        </p>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={comparisonData} margin={chartMargin} barGap={10}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              angle={-20}
              textAnchor="end"
              height={70}
              tick={{ fontSize: 11 }}
              tickFormatter={shortenLabel}
            />
            <YAxis />
            <Tooltip content={<ProductTooltip />} />
            <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={30}>
              {comparisonData.map((item) => (
                <Cell key={item.name} fill={item.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={chartGridStyle}>
        <div style={chartCardStyle}>
          <h3 style={chartTitleStyle}>Top 5 High-Demand Products Next Week</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={weekChartData} margin={chartMargin} barGap={10}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="product_name"
                angle={-20}
                textAnchor="end"
                height={70}
                tick={{ fontSize: 11 }}
                tickFormatter={shortenLabel}
              />
              <YAxis />
              <Tooltip content={<ProductTooltip />} />
              <Legend />
              <Bar dataKey="next_week" name="Next Week Demand" radius={[8, 8, 0, 0]} barSize={30}>
                {weekChartData.map((item) => (
                  <Cell key={item.product_name} fill={item.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={chartCardStyle}>
          <h3 style={chartTitleStyle}>Top 5 High-Demand Products Next Month</h3>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={monthChartData} margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="product_name"
                angle={-20}
                textAnchor="end"
                height={70}
                tick={{ fontSize: 11 }}
                tickFormatter={shortenLabel}
              />
              <YAxis />
              <Tooltip content={<ProductTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="next_month"
                name="Next Month Demand"
                stroke="#2563eb"
                strokeWidth={3}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

const chartGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "20px"
};

const chartCardStyle = {
  background: "#ffffff",
  borderRadius: "18px",
  padding: "18px",
  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.08)"
};

const chartTitleStyle = {
  marginTop: 0,
  marginBottom: "16px",
  color: "#163047"
};

const chartDescriptionStyle = {
  marginTop: "-6px",
  marginBottom: "16px",
  color: "#64748b",
  lineHeight: 1.6
};

export default Charts;

function shortenLabel(value) {
  const label = String(value || "");
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

const tooltipStyle = {
  background: "#ffffff",
  border: "1px solid #d7dee8",
  borderRadius: "12px",
  padding: "10px 12px",
  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.08)"
};

const tooltipTitleStyle = {
  color: "#163047",
  fontWeight: 700,
  marginBottom: "6px"
};

const tooltipRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  color: "#334155"
};
