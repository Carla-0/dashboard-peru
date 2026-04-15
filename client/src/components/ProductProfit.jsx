import React from 'react';

const formatNumber = (num) => {
  if (num === null || num === undefined) return '0';
  return Number(num).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const ProductProfit = ({ data }) => {
  if (!data || data.length === 0) return null;

  return (
    <div className="product-grid">
      {data.map((item, i) => (
        <div className="product-card" key={i}>
          <div className="product-name">{item.producto}</div>
          <div className="product-value">{formatNumber(item.ganancia)}</div>
        </div>
      ))}
    </div>
  );
};

export default ProductProfit;
