import React, { useState, useEffect, useCallback } from 'react';
import KPICards from './components/KPICards';
import ProductProfit from './components/ProductProfit';
import MonthlyChart from './components/MonthlyChart';
import MonthlyTable from './components/MonthlyTable';
import TopClients from './components/TopClients';
import ClientPieChart from './components/ClientPieChart';
import Logo from './components/Logo';

const API_BASE = window.location.origin;

// ============================================
// Extract token from URL and decode user info
// ============================================
function getAuthInfo() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || '';

  if (!token) {
    return { token: '', rol: '', operador: '', authenticated: false };
  }

  // Decode JWT payload (without verifying - server does that)
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return {
      token,
      rol: payload.rol || 'Operador',
      operador: payload.operador || '',
      usuario: payload.usuario || '',
      authenticated: true
    };
  } catch (e) {
    return { token, rol: '', operador: '', authenticated: false };
  }
}

// Helper to add token to fetch requests
function authFetch(url, token) {
  return fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
}

function App() {
  const auth = getAuthInfo();
  const isAdmin = auth.rol === 'Administrador';

  const currentYear = new Date().getFullYear();

  const [filters, setFilters] = useState({
    operador: isAdmin ? '' : auth.operador,
    tipo_negocio: '',
    producto: '',
    fecha_inicio: `${currentYear}-01-01`,
    fecha_fin: `${currentYear}-12-31`
  });

  const [filterOptions, setFilterOptions] = useState({
    operadores: [],
    tipos_negocio: [],
    productos: []
  });

  const [kpis, setKpis] = useState(null);
  const [productProfit, setProductProfit] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [comparativeData, setComparativeData] = useState(null);
  const [topClients, setTopClients] = useState([]);
  const [clientPercentages, setClientPercentages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [authError, setAuthError] = useState(false);

  // ============================================
  // If no token, show access denied screen
  // ============================================
  if (!auth.token) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', flexDirection: 'column', fontFamily: 'Inter, sans-serif',
        background: '#f5f7fa'
      }}>
        <div style={{
          background: 'white', padding: '48px', borderRadius: '16px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: 420
        }}>
          <Logo />
          <div style={{ marginTop: 24 }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
          </div>
          <h2 style={{ color: '#1a1a2e', marginTop: 16, fontSize: 20 }}>Acceso Restringido</h2>
          <p style={{ color: '#6b7280', marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>
            Este dashboard requiere autenticaci&oacute;n.<br/>
            Accede desde la plataforma Zuru para ver el reporte.
          </p>
        </div>
      </div>
    );
  }

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.operador) params.append('operador', filters.operador);
    if (filters.tipo_negocio) params.append('tipo_negocio', filters.tipo_negocio);
    if (filters.producto) params.append('producto', filters.producto);
    if (filters.fecha_inicio) params.append('fecha_inicio', filters.fecha_inicio);
    if (filters.fecha_fin) params.append('fecha_fin', filters.fecha_fin);
    return params.toString();
  }, [filters]);

  // Fetch filter options
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const res = await authFetch(`${API_BASE}/api/filtros`, auth.token);
        if (res.status === 401) { setAuthError(true); return; }
        const data = await res.json();
        setFilterOptions(data);
      } catch (err) {
        console.error('Error fetching filters:', err);
      }
    };
    fetchFilters();
  }, [auth.token]);

  // Fetch all data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = buildQuery();
        const [kpiRes, prodRes, monthRes, compRes, clientRes, pctRes] = await Promise.all([
          authFetch(`${API_BASE}/api/produccion-general?${qs}`, auth.token),
          authFetch(`${API_BASE}/api/ganancia-producto?${qs}`, auth.token),
          authFetch(`${API_BASE}/api/detalle-mensual?${qs}`, auth.token),
          authFetch(`${API_BASE}/api/comparativo-anual?${qs}`, auth.token),
          authFetch(`${API_BASE}/api/top-clientes?${qs}`, auth.token),
          authFetch(`${API_BASE}/api/porcentaje-clientes?${qs}`, auth.token)
        ]);

        // Check if any returned 401
        if (kpiRes.status === 401) { setAuthError(true); return; }

        const [kpiData, prodData, monthData, compData, clientData, pctData] = await Promise.all([
          kpiRes.json(), prodRes.json(), monthRes.json(),
          compRes.json(), clientRes.json(), pctRes.json()
        ]);

        if (kpiRes.ok) setKpis(kpiData); else throw new Error(kpiData.error);
        setProductProfit(prodData);
        setMonthlyData(monthData);
        setComparativeData(compData);
        setTopClients(clientData);
        setClientPercentages(pctData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [buildQuery, auth.token]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Token expired or invalid
  if (authError) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', flexDirection: 'column', fontFamily: 'Inter, sans-serif',
        background: '#f5f7fa'
      }}>
        <div style={{
          background: 'white', padding: '48px', borderRadius: '16px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: 420
        }}>
          <Logo />
          <div style={{ marginTop: 24 }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h2 style={{ color: '#1a1a2e', marginTop: 16, fontSize: 20 }}>Sesi&oacute;n Expirada</h2>
          <p style={{ color: '#6b7280', marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>
            Tu token de acceso ha expirado o es inv&aacute;lido.<br/>
            Regresa a la plataforma Zuru para obtener un nuevo acceso.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="header">
        <div className="header-left">
          <div className="header-logo">
            <Logo />
          </div>
          <div>
            <div className="header-title">Reporte de Estad&iacute;stica Per&uacute;</div>
            <div className="header-subtitle">Logistics Insurtech</div>
          </div>
        </div>

        <div className="filters-bar">
          {/* Tipo de Negocio */}
          <select
            className="filter-select"
            value={filters.tipo_negocio}
            onChange={e => handleFilterChange('tipo_negocio', e.target.value)}
          >
            <option value="">Tipo de Negocio</option>
            {filterOptions.tipos_negocio?.map(t => (
              <option key={t.value} value={t.value}>{t.value}</option>
            ))}
          </select>

          {/* Operador - only for Admin */}
          {isAdmin && (
            <select
              className="filter-select"
              value={filters.operador}
              onChange={e => handleFilterChange('operador', e.target.value)}
            >
              <option value="">Operador</option>
              {filterOptions.operadores?.map(o => (
                <option key={o.value} value={o.value}>{o.value}</option>
              ))}
            </select>
          )}

          {/* Producto */}
          <select
            className="filter-select"
            value={filters.producto}
            onChange={e => handleFilterChange('producto', e.target.value)}
          >
            <option value="">Producto</option>
            {filterOptions.productos?.map(p => (
              <option key={p.value} value={p.value}>{p.value}</option>
            ))}
          </select>

          {/* Date range */}
          <input
            type="date"
            className="filter-date"
            value={filters.fecha_inicio}
            onChange={e => handleFilterChange('fecha_inicio', e.target.value)}
          />
          <span className="filter-label">-</span>
          <input
            type="date"
            className="filter-date"
            value={filters.fecha_fin}
            onChange={e => handleFilterChange('fecha_fin', e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="error-banner">
          Error al cargar datos: {error}
        </div>
      )}

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          Cargando datos...
        </div>
      ) : (
        <>
          {/* PRODUCCIÓN GENERAL */}
          <div className="section-title">Producci&oacute;n General</div>
          <KPICards data={kpis} />

          {/* GANANCIA POR PRODUCTO */}
          <div className="section-title">Ganancia por Producto</div>
          <ProductProfit data={productProfit} />

          {/* DETALLE POR MES - Chart */}
          <div className="section-title">Detalle por Mes</div>
          <div className="chart-container">
            <MonthlyChart data={comparativeData} />
          </div>

          {/* PRODUCCIÓN MENSUAL - Table */}
          <div className="section-title">Producci&oacute;n Mensual</div>
          <MonthlyTable data={monthlyData} />

          {/* TOP 10 CLIENTES + PIE CHART */}
          <div className="two-cols">
            <div>
              <div className="section-title">Top 10 Clientes</div>
              <TopClients data={topClients} />
            </div>
            <div>
              <div className="section-title">Porcentaje de Suma Asegurada por Cliente</div>
              <ClientPieChart data={clientPercentages} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
