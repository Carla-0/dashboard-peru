import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const monthLabels = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

const formatK = (value) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(0)} M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)} mil`;
  return value;
};

const formatTooltip = (value) => {
  return Number(value).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const MonthlyChart = ({ data }) => {
  if (!data || !data.data || data.data.length === 0) {
    return <div className="loading">Sin datos para mostrar</div>;
  }

  const { currentYear, prevYear, data: rawData } = data;

  // Build chart data: 12 months
  const chartData = monthLabels.map((label, i) => {
    const monthNum = i + 1;
    const current = rawData.find(d => d.anio === currentYear && d.mes_num === monthNum) || {};
    const prev = rawData.find(d => d.anio === prevYear && d.mes_num === monthNum) || {};

    return {
      mes: label,
      Venta: Number(current.venta || 0),
      Costo: Number(current.costo || 0),
      Ganancia: Number(current.ganancia || 0),
      [`Venta (${prevYear})`]: Number(prev.venta || 0),
      [`Costo (${prevYear})`]: Number(prev.costo || 0),
      [`Ganancia (${prevYear})`]: Number(prev.ganancia || 0)
    };
  });

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={chartData} barCategoryGap="15%">
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={formatK} tick={{ fontSize: 11 }} />
        <Tooltip formatter={formatTooltip} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Venta" fill="#2563eb" radius={[2, 2, 0, 0]} />
        <Bar dataKey="Costo" fill="#10b981" radius={[2, 2, 0, 0]} />
        <Bar dataKey="Ganancia" fill="#a855f7" radius={[2, 2, 0, 0]} />
        <Bar dataKey={`Venta (${prevYear})`} fill="#93c5fd" radius={[2, 2, 0, 0]} />
        <Bar dataKey={`Costo (${prevYear})`} fill="#6ee7b7" radius={[2, 2, 0, 0]} />
        <Bar dataKey={`Ganancia (${prevYear})`} fill="#d8b4fe" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default MonthlyChart;
