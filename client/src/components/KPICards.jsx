import React from 'react';

const formatNumber = (num) => {
  if (num === null || num === undefined) return '0';
  return Number(num).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const formatInt = (num) => {
  if (num === null || num === undefined) return '0';
  return Number(num).toLocaleString('es-PE');
};

const KPICards = ({ data }) => {
  if (!data) return null;

  const cards = [
    { label: 'Suma Asegurada', value: formatNumber(data.suma_asegurada) },
    { label: 'Costo', value: formatNumber(data.costo) },
    { label: 'Venta', value: formatNumber(data.venta) },
    { label: 'Ganancia', value: formatNumber(data.ganancia), className: 'positive' },
    { label: 'Cantidad', value: formatInt(data.cantidad) }
  ];

  return (
    <div className="kpi-grid">
      {cards.map((card, i) => (
        <div className="kpi-card" key={i}>
          <div className="kpi-label">{card.label}</div>
          <div className={`kpi-value ${card.className || ''}`}>{card.value}</div>
        </div>
      ))}
    </div>
  );
};

export default KPICards;
