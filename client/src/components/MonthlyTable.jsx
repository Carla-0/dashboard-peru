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

const monthNames = {
  '01': 'ene', '02': 'feb', '03': 'mar', '04': 'abr',
  '05': 'may', '06': 'jun', '07': 'jul', '08': 'ago',
  '09': 'sept', '10': 'oct', '11': 'nov', '12': 'dic'
};

const MonthlyTable = ({ data }) => {
  if (!data || data.length === 0) return null;

  const totals = data.reduce((acc, row) => ({
    costo: acc.costo + Number(row.costo),
    venta: acc.venta + Number(row.venta),
    ganancia: acc.ganancia + Number(row.ganancia),
    cantidad: acc.cantidad + Number(row.cantidad)
  }), { costo: 0, venta: 0, ganancia: 0, cantidad: 0 });

  const formatMonth = (mes) => {
    const [year, month] = mes.split('-');
    return `${monthNames[month] || month} ${year}`;
  };

  return (
    <div className="monthly-table-container">
      <table className="monthly-table">
        <thead>
          <tr>
            <th>Fecha de emisi&oacute;n</th>
            <th>Costo</th>
            <th>Venta</th>
            <th>Ganancia</th>
            <th>Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              <td>{formatMonth(row.mes)}</td>
              <td>{formatNumber(row.costo)}</td>
              <td>{formatNumber(row.venta)}</td>
              <td>{formatNumber(row.ganancia)}</td>
              <td>{formatInt(row.cantidad)}</td>
            </tr>
          ))}
          <tr>
            <td><strong>Total</strong></td>
            <td><strong>{formatNumber(totals.costo)}</strong></td>
            <td><strong>{formatNumber(totals.venta)}</strong></td>
            <td><strong>{formatNumber(totals.ganancia)}</strong></td>
            <td><strong>{formatInt(totals.cantidad)}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default MonthlyTable;
