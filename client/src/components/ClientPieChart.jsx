import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = [
  '#2563eb', '#0891b2', '#a855f7', '#84cc16', '#06b6d4',
  '#f59e0b', '#ec4899', '#6366f1', '#14b8a6', '#f97316'
];

const formatNumber = (num) => {
  return Number(num).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const ClientPieChart = ({ data }) => {
  if (!data || data.length === 0) return null;

  const total = data.reduce((sum, item) => sum + Number(item.suma_asegurada), 0);

  // Top entries + "Otros"
  const top = data.slice(0, 9);
  const othersSum = data.slice(9).reduce((sum, item) => sum + Number(item.suma_asegurada), 0);

  const chartData = [
    ...top.map(item => ({
      name: item.beneficiario && item.beneficiario.length > 25
        ? item.beneficiario.substring(0, 25) + '...'
        : item.beneficiario,
      value: Number(item.suma_asegurada)
    })),
    ...(othersSum > 0 ? [{ name: 'Otros', value: othersSum }] : [])
  ];

  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.03) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
        {`${(percent * 100).toFixed(1)}%`}
      </text>
    );
  };

  return (
    <div className="pie-container">
      <ResponsiveContainer width="100%" height={400}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderLabel}
            outerRadius={140}
            dataKey="value"
          >
            {chartData.map((entry, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => formatNumber(value)} />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            wrapperStyle={{ fontSize: 11, lineHeight: '20px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ClientPieChart;
