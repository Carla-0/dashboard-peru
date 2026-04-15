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

const TopClients = ({ data }) => {
  if (!data || data.length === 0) return null;

  return (
    <div className="clients-table-container">
      <table className="clients-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Beneficiario</th>
            <th>Ganancia</th>
            <th>Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              <td className="rank-number">{i + 1}.</td>
              <td title={row.beneficiario}>
                {row.beneficiario && row.beneficiario.length > 35
                  ? row.beneficiario.substring(0, 35) + '...'
                  : row.beneficiario}
              </td>
              <td>{formatNumber(row.ganancia)}</td>
              <td>{formatInt(row.cantidad)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TopClients;
