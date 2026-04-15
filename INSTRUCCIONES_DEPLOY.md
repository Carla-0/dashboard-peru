# Dashboard Estadistica Peru - Instrucciones de Deploy

## SEGURIDAD

El dashboard ahora usa **tokens JWT firmados**. Esto significa:

- Sin token → pantalla "Acceso Restringido" (no ve nada)
- Token expirado → pantalla "Sesion Expirada"
- Token de Operador → solo ve datos de su operador (el backend fuerza el filtro)
- Token de Administrador → ve todos los datos

Nadie puede "inventar" un token porque esta firmado con una clave secreta (`JWT_SECRET`) que solo tu servidor conoce.

---

## Variables de entorno en Render

| Variable | Valor | Descripcion |
|----------|-------|-------------|
| `DB_HOST` | `34.125.225.64` | Host MySQL |
| `DB_USER` | `ddi` | Usuario MySQL |
| `DB_PASS` | `DDI4ever%` | Password MySQL |
| `DB_NAME` | `EMI` | Base de datos |
| `DB_TABLE` | `DashboardPe` | Tabla |
| `JWT_SECRET` | *(pon una clave larga y unica)* | Clave para firmar tokens |
| `API_KEY` | *(pon una clave para generar tokens)* | Protege el endpoint de generacion |

**IMPORTANTE**: Cambia `JWT_SECRET` y `API_KEY` por valores seguros propios.

---

## Deploy en Render

1. Sube el proyecto a GitHub
2. En Render: New+ → Web Service → Conecta el repo
3. Build Command: `npm install && npm run build`
4. Start Command: `npm start`
5. Agrega las variables de entorno de la tabla de arriba
6. Create Web Service

---

## Integracion con GeneXus + GAM

### Paso 1: Generar token desde GeneXus

Desde un procedimiento GeneXus, haz un HTTP POST a tu dashboard para obtener el token:

```
// URL: https://TU-APP.onrender.com/api/generar-token
// Method: POST
// Headers:
//   Content-Type: application/json
//   x-api-key: TU_API_KEY
//
// Body para Administrador:
// { "rol": "Administrador", "usuario": "admin@zuru.com", "exp_hours": 8 }
//
// Body para Operador:
// { "rol": "Operador", "operadorId": "123", "operador": "Nombre del Operador", "usuario": "usuario@operador.com", "exp_hours": 8 }
// NOTA: operadorId hace match con DashboardPeOpID en la base de datos
//
// Respuesta:
// { "token": "eyJhbGciOiJI...", "expires_in": "8 horas" }
```

En GeneXus (pseudocodigo):
```
&HttpClient.Host = "TU-APP.onrender.com"
&HttpClient.Port = 443
&HttpClient.Secure = 1
&HttpClient.AddHeader("Content-Type", "application/json")
&HttpClient.AddHeader("x-api-key", "TU_API_KEY")

// Determinar rol desde GAM
&GAMUser = GAMSession.Get(&GAMSession.Token)
&UserRole = &GAMUser.Roles.Item(1).Name

If &UserRole = "Administrador"
    &Body = '{"rol":"Administrador","usuario":"' + &GAMUser.Email + '","exp_hours":8}'
Else
    &Body = '{"rol":"Operador","operadorId":"' + &GAMUser.Properties("OperadorID").ToString().Trim() + '","operador":"' + &GAMUser.Properties("Operador") + '","usuario":"' + &GAMUser.Email + '","exp_hours":8}'
EndIf

&HttpClient.Execute("POST", "/api/generar-token")
&Response = &HttpClient.ToString()
// Extraer &Token del JSON de respuesta
```

### Paso 2: Insertar iframe con token

```html
<iframe
  src="https://TU-APP.onrender.com/?token=AQUI_VA_EL_TOKEN"
  width="100%"
  height="900"
  frameborder="0"
  style="border: none;"
></iframe>
```

En GeneXus WebPanel:
```
&IframeURL = "https://TU-APP.onrender.com/?token=" + &Token.Trim()
// Asignar &IframeURL al atributo src del WebComponent/iframe
```

---

## Probar tokens manualmente

Para generar tokens de prueba sin GeneXus:

```
GET https://TU-APP.onrender.com/api/test-token?api_key=TU_API_KEY
```

Esto devuelve URLs de prueba con tokens validos por 2 horas:
- URL para Administrador (ve todo)
- URL para Operador ejemplo (ve solo su data)

---

## Flujo de seguridad completo

```
Usuario abre tu plataforma GeneXus
         ↓
GAM valida credenciales (usuario + password)
         ↓
GeneXus identifica rol y operador del usuario
         ↓
GeneXus llama POST /api/generar-token con API_KEY
         ↓
Dashboard devuelve token JWT firmado (expira en 8h)
         ↓
GeneXus carga iframe con ?token=xxx
         ↓
Dashboard valida el token en cada peticion
         ↓
Si es Operador: backend FUERZA filtro por su operador
Si es Admin: ve todos los datos
```

Alguien que encuentre la URL sin token → ve "Acceso Restringido"
Alguien que copie un token viejo → ve "Sesion Expirada"
Alguien que intente fabricar un token → la firma no coincide → rechazado

---

## Columnas esperadas en DashboardPe

- `DashboardPeOpID` - ID del operador (usado para filtro de seguridad)
- `DashboardPeOperador` - Nombre del operador (para mostrar en dropdown)
- `DashboardPeTipoNegocio`
- `DashboardPeProducto`
- `DashboardPeSumaAsegurada` (numerico)
- `DashboardPeCosto` (numerico)
- `DashboardPeVenta` (numerico)
- `DashboardPeGanancia` (numerico)
- `DashboardPeBeneficiario`
- `DashboardPeFechaEmision` (DATE/DATETIME)

Endpoint de diagnostico: `GET /api/columns` (requiere token)
