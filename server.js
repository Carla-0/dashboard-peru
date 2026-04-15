require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve React build
app.use(express.static(path.join(__dirname, 'client', 'build')));

// ============================================
// JWT SECURITY - Token signing & verification
// ============================================
const JWT_SECRET = process.env.JWT_SECRET || 'CAMBIA_ESTA_CLAVE_SECRETA_2026';

function base64url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString();
}

function signToken(payload) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const data = {
    ...payload,
    iat: now,
    exp: now + (payload.exp_hours || 8) * 3600  // default 8 hours
  };
  delete data.exp_hours;
  const body = base64url(JSON.stringify(data));
  const signature = crypto.createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`).digest('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`).digest('base64')
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    if (signature !== expectedSig) return null;

    const payload = JSON.parse(base64urlDecode(body));

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch (e) {
    return null;
  }
}

// ============================================
// Auth middleware - protects all /api/* routes
// ============================================
function authMiddleware(req, res, next) {
  // Token can come from: header, query param, or cookie
  let token = null;

  // 1. Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  // 2. Query parameter
  if (!token && req.query.token) {
    token = req.query.token;
  }

  // 3. Cookie
  if (!token && req.headers.cookie) {
    const cookies = req.headers.cookie.split(';').reduce((acc, c) => {
      const [key, val] = c.trim().split('=');
      acc[key] = val;
      return acc;
    }, {});
    token = cookies['dashboard_token'];
  }

  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado. Acceso denegado.' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Token inválido o expirado. Acceso denegado.' });
  }

  // Attach user info to request
  req.user = {
    rol: payload.rol || 'Operador',
    operador: payload.operador || '',
    operadorId: payload.operadorId || '',
    usuario: payload.usuario || ''
  };

  next();
}

// ============================================
// Endpoint to generate tokens (for testing & GeneXus)
// Protect this in production with an API key
// ============================================
app.post('/api/generar-token', (req, res) => {
  const apiKey = req.headers['x-api-key'] || req.body.api_key;
  const API_KEY = process.env.API_KEY || 'ZURU_API_KEY_2026';

  if (apiKey !== API_KEY) {
    return res.status(403).json({ error: 'API Key inválida' });
  }

  const { rol, operador, operadorId, usuario, exp_hours } = req.body;

  if (!rol) {
    return res.status(400).json({ error: 'El campo "rol" es requerido' });
  }

  const token = signToken({
    rol,
    operador: operador || '',
    operadorId: operadorId || '',
    usuario: usuario || '',
    exp_hours: exp_hours || 8
  });

  res.json({ token, expires_in: `${exp_hours || 8} horas` });
});

// ============================================
// Quick test endpoint - generates a test URL
// Protected by API_KEY
// ============================================
app.get('/api/test-token', (req, res) => {
  const apiKey = req.query.api_key;
  const API_KEY = process.env.API_KEY || 'ZURU_API_KEY_2026';

  if (apiKey !== API_KEY) {
    return res.status(403).json({ error: 'Agrega ?api_key=TU_API_KEY para generar un token de prueba' });
  }

  const rol = req.query.rol || 'Administrador';
  const operadorId = req.query.operadorId || '';
  const operador = req.query.operador || '';

  const token = signToken({ rol, operador, operadorId, usuario: 'test', exp_hours: 2 });

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.json({
    token,
    url_admin: `${baseUrl}/?token=${signToken({ rol: 'Administrador', usuario: 'admin', exp_hours: 2 })}`,
    url_operador_ejemplo: `${baseUrl}/?token=${signToken({ rol: 'Operador', operador: operador || 'OPERADOR_EJEMPLO', operadorId: operadorId || '123', usuario: 'operador1', exp_hours: 2 })}`,
    nota: 'Estos tokens expiran en 2 horas. En producción, GeneXus los genera dinámicamente.'
  });
});

// MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000
});

// ============================================
// Apply auth to all /api/ routes EXCEPT token generation
// ============================================
app.use('/api/produccion-general', authMiddleware);
app.use('/api/ganancia-producto', authMiddleware);
app.use('/api/detalle-mensual', authMiddleware);
app.use('/api/top-clientes', authMiddleware);
app.use('/api/porcentaje-clientes', authMiddleware);
app.use('/api/filtros', authMiddleware);
app.use('/api/comparativo-anual', authMiddleware);
app.use('/api/columns', authMiddleware);

// Helper: enforce operator filter for non-admin users
// Uses operadorId (matches DashboardPeOpID) for security
// and operador name (DashboardPeOperador) for admin dropdown filtering
function enforceOperadorId(req) {
  if (req.user.rol !== 'Administrador' && req.user.operadorId) {
    return req.user.operadorId;
  }
  return req.query.operadorId || '';
}

function enforceOperadorNombre(req) {
  if (req.user.rol !== 'Administrador' && req.user.operador) {
    return req.user.operador;
  }
  return req.query.operador || '';
}

// ============================================
// API: Get table columns (diagnostic)
// ============================================
app.get('/api/columns', async (req, res) => {
  try {
    const [rows] = await pool.query(`DESCRIBE ${process.env.DB_TABLE}`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// API: General production KPIs
// ============================================
app.get('/api/produccion-general', async (req, res) => {
  try {
    const operadorId = enforceOperadorId(req);
    const { tipo_negocio, producto, fecha_inicio, fecha_fin } = req.query;
    let where = [];
    let params = [];

    if (operadorId) { where.push('DashboardPeOpID = ?'); params.push(operadorId); }
    if (tipo_negocio) { where.push('DashboardPeTipoNegocio = ?'); params.push(tipo_negocio); }
    if (producto) { where.push('DashboardPeProducto = ?'); params.push(producto); }
    if (fecha_inicio && fecha_fin) {
      where.push('DashboardPeFechaEmision BETWEEN ? AND ?');
      params.push(fecha_inicio, fecha_fin);
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const query = `
      SELECT
        COALESCE(SUM(DashboardPeSumaAsegurada), 0) as suma_asegurada,
        COALESCE(SUM(DashboardPeCosto), 0) as costo,
        COALESCE(SUM(DashboardPeVenta), 0) as venta,
        COALESCE(SUM(DashboardPeGanancia), 0) as ganancia,
        COUNT(*) as cantidad
      FROM ${process.env.DB_TABLE}
      ${whereClause}
    `;

    const [rows] = await pool.query(query, params);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// API: Profit by product
// ============================================
app.get('/api/ganancia-producto', async (req, res) => {
  try {
    const operadorId = enforceOperadorId(req);
    const { tipo_negocio, producto, fecha_inicio, fecha_fin } = req.query;
    let where = [];
    let params = [];

    if (operadorId) { where.push('DashboardPeOpID = ?'); params.push(operadorId); }
    if (tipo_negocio) { where.push('DashboardPeTipoNegocio = ?'); params.push(tipo_negocio); }
    if (producto) { where.push('DashboardPeProducto = ?'); params.push(producto); }
    if (fecha_inicio && fecha_fin) {
      where.push('DashboardPeFechaEmision BETWEEN ? AND ?');
      params.push(fecha_inicio, fecha_fin);
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const query = `
      SELECT
        DashboardPeProducto as producto,
        COALESCE(SUM(DashboardPeGanancia), 0) as ganancia
      FROM ${process.env.DB_TABLE}
      ${whereClause}
      GROUP BY DashboardPeProducto
      ORDER BY ganancia DESC
    `;

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// API: Monthly breakdown
// ============================================
app.get('/api/detalle-mensual', async (req, res) => {
  try {
    const operadorId = enforceOperadorId(req);
    const { tipo_negocio, producto, fecha_inicio, fecha_fin } = req.query;
    let where = [];
    let params = [];

    if (operadorId) { where.push('DashboardPeOpID = ?'); params.push(operadorId); }
    if (tipo_negocio) { where.push('DashboardPeTipoNegocio = ?'); params.push(tipo_negocio); }
    if (producto) { where.push('DashboardPeProducto = ?'); params.push(producto); }
    if (fecha_inicio && fecha_fin) {
      where.push('DashboardPeFechaEmision BETWEEN ? AND ?');
      params.push(fecha_inicio, fecha_fin);
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const query = `
      SELECT
        DATE_FORMAT(DashboardPeFechaEmision, '%Y-%m') as mes,
        DATE_FORMAT(DashboardPeFechaEmision, '%b %Y') as mes_label,
        COALESCE(SUM(DashboardPeCosto), 0) as costo,
        COALESCE(SUM(DashboardPeVenta), 0) as venta,
        COALESCE(SUM(DashboardPeGanancia), 0) as ganancia,
        COUNT(*) as cantidad
      FROM ${process.env.DB_TABLE}
      ${whereClause}
      GROUP BY DATE_FORMAT(DashboardPeFechaEmision, '%Y-%m'), DATE_FORMAT(DashboardPeFechaEmision, '%b %Y')
      ORDER BY mes ASC
    `;

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// API: Top 10 clients
// ============================================
app.get('/api/top-clientes', async (req, res) => {
  try {
    const operadorId = enforceOperadorId(req);
    const { tipo_negocio, producto, fecha_inicio, fecha_fin } = req.query;
    let where = [];
    let params = [];

    if (operadorId) { where.push('DashboardPeOpID = ?'); params.push(operadorId); }
    if (tipo_negocio) { where.push('DashboardPeTipoNegocio = ?'); params.push(tipo_negocio); }
    if (producto) { where.push('DashboardPeProducto = ?'); params.push(producto); }
    if (fecha_inicio && fecha_fin) {
      where.push('DashboardPeFechaEmision BETWEEN ? AND ?');
      params.push(fecha_inicio, fecha_fin);
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const query = `
      SELECT
        DashboardPeBeneficiario as beneficiario,
        COALESCE(SUM(DashboardPeGanancia), 0) as ganancia,
        COUNT(*) as cantidad
      FROM ${process.env.DB_TABLE}
      ${whereClause}
      GROUP BY DashboardPeBeneficiario
      ORDER BY ganancia DESC
      LIMIT 10
    `;

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// API: Client percentage (sum asegurada)
// ============================================
app.get('/api/porcentaje-clientes', async (req, res) => {
  try {
    const operadorId = enforceOperadorId(req);
    const { tipo_negocio, producto, fecha_inicio, fecha_fin } = req.query;
    let where = [];
    let params = [];

    if (operadorId) { where.push('DashboardPeOpID = ?'); params.push(operadorId); }
    if (tipo_negocio) { where.push('DashboardPeTipoNegocio = ?'); params.push(tipo_negocio); }
    if (producto) { where.push('DashboardPeProducto = ?'); params.push(producto); }
    if (fecha_inicio && fecha_fin) {
      where.push('DashboardPeFechaEmision BETWEEN ? AND ?');
      params.push(fecha_inicio, fecha_fin);
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const query = `
      SELECT
        DashboardPeBeneficiario as beneficiario,
        COALESCE(SUM(DashboardPeSumaAsegurada), 0) as suma_asegurada
      FROM ${process.env.DB_TABLE}
      ${whereClause}
      GROUP BY DashboardPeBeneficiario
      ORDER BY suma_asegurada DESC
      LIMIT 10
    `;

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// API: Filter options (for dropdowns)
// ============================================
app.get('/api/filtros', async (req, res) => {
  try {
    const operadorId = enforceOperadorId(req);
    let operadorWhere = operadorId ? `WHERE DashboardPeOpID = '${operadorId}'` : '';

    const [operadores] = await pool.query(
      `SELECT DISTINCT DashboardPeOperador as value FROM ${process.env.DB_TABLE} WHERE DashboardPeOperador IS NOT NULL AND DashboardPeOperador != '' ORDER BY DashboardPeOperador`
    );
    const [tipos] = await pool.query(
      `SELECT DISTINCT DashboardPeTipoNegocio as value FROM ${process.env.DB_TABLE} ${operadorWhere} ORDER BY DashboardPeTipoNegocio`
    );
    const [productos] = await pool.query(
      `SELECT DISTINCT DashboardPeProducto as value FROM ${process.env.DB_TABLE} ${operadorWhere} ORDER BY DashboardPeProducto`
    );

    res.json({ operadores, tipos_negocio: tipos, productos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// API: Monthly comparison (current vs previous year)
// ============================================
app.get('/api/comparativo-anual', async (req, res) => {
  try {
    const operadorId = enforceOperadorId(req);
    const { tipo_negocio, producto, fecha_inicio, fecha_fin } = req.query;
    let where = [];
    let params = [];

    if (operadorId) { where.push('DashboardPeOpID = ?'); params.push(operadorId); }
    if (tipo_negocio) { where.push('DashboardPeTipoNegocio = ?'); params.push(tipo_negocio); }
    if (producto) { where.push('DashboardPeProducto = ?'); params.push(producto); }

    const whereClause = where.length > 0 ? 'AND ' + where.join(' AND ') : '';

    const currentYear = fecha_inicio ? new Date(fecha_inicio).getFullYear() : new Date().getFullYear();
    const prevYear = currentYear - 1;

    const query = `
      SELECT
        MONTH(DashboardPeFechaEmision) as mes_num,
        YEAR(DashboardPeFechaEmision) as anio,
        COALESCE(SUM(DashboardPeCosto), 0) as costo,
        COALESCE(SUM(DashboardPeVenta), 0) as venta,
        COALESCE(SUM(DashboardPeGanancia), 0) as ganancia
      FROM ${process.env.DB_TABLE}
      WHERE YEAR(DashboardPeFechaEmision) IN (?, ?)
      ${whereClause}
      GROUP BY YEAR(DashboardPeFechaEmision), MONTH(DashboardPeFechaEmision)
      ORDER BY anio, mes_num
    `;

    const [rows] = await pool.query(query, [currentYear, prevYear, ...params]);
    res.json({ currentYear, prevYear, data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Catch-all: serve React
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'build', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Dashboard server running on port ${PORT}`);
  console.log(`Security: JWT enabled. Generate tokens via POST /api/generar-token`);
});
