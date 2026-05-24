# IceBuinPOS 🧊

Sistema de Punto de Venta (POS) moderno con escáner de código de barras.

## Stack

| Capa | Tecnología | Producción |
|------|-----------|------------|
| Frontend | React + shadcn/ui + Tailwind | **Vercel** ($0) |
| Backend | FastAPI (Python) + MongoDB | **Railway** ($0) |
| Base de Datos | MongoDB | **MongoDB Atlas** ($0) |

## Features

- ✅ Dashboard con estadísticas en tiempo real
- ✅ Gestión de productos (CRUD + códigos de barras)
- ✅ Ventas con carrito y escáner de código de barras
- ✅ Precios por volumen (precio variable según cantidad)
- ✅ Reportes de ventas (exportables a Excel)
- ✅ Autenticación JWT (login/registro)
- ✅ Roles: vendedor / administrador

## Deploy en Producción

### 1. MongoDB Atlas (Base de Datos)

1. Crear cuenta gratis en [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)
2. Crear cluster **M0 Free** (512 MB)
3. En "Database Access" → crear usuario: `icebuin` con contraseña segura
4. En "Network Access" → `0.0.0.0/0` (Allow All) o IP de Railway
5. Conectar → copiar Connection String

### 2. Railway (Backend)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new)

1. Click botón o nuevo proyecto → "Deploy from GitHub repo"
2. Seleccionar `webexpresschile/icebuin-pos`
3. **Root Directory**: `backend/`
4. **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
5. **Variables de entorno**:
   - `MONGO_URL` = tu string de MongoDB Atlas
   - `DB_NAME` = `icebuinpos`
   - `JWT_SECRET_KEY` = clave aleatoria segura (ej: `openssl rand -base64 32`)
   - `CORS_ORIGINS` = `https://icebuinpos.vercel.app`
6. Railway te dará una URL tipo `https://icebuinpos.up.railway.app`

### 3. Vercel (Frontend)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

1. Nuevo proyecto → importar `webexpresschile/icebuin-pos`
2. **Root Directory**: `frontend/`
3. **Framework**: Create React App (auto-detect)
4. **Build Command**: `craco build`
5. **Variables de entorno**:
   - `REACT_APP_BACKEND_URL` = URL del backend en Railway (ej: `https://icebuinpos.up.railway.app`)
6. Deploy → Vercel dará URL tipo `https://icebuinpos.vercel.app`

## Desarrollo Local

```bash
# 1. Clonar
git clone https://github.com/webexpresschile/icebuin-pos.git
cd icebuin-pos

# 2. Base de datos (Docker Compose)
cp .env.example .env
# Editar .env con contraseñas
docker compose up -d mongodb

# 3. Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --reload --port 8000

# 4. Frontend (otra terminal)
cd frontend
npm install --legacy-peer-deps
REACT_APP_BACKEND_URL=http://localhost:8000 npm start
```

## Arquitectura

```
Vercel (frontend) ──https──▶ Railway (backend) ──▶ MongoDB Atlas
                                  │
                                  └── JWT Auth (bcrypt)
```

## Notas

- Los precios por volumen (`priceVolumes`) permiten precios variables según cantidad
- El escáner de código de barras funciona con cámara del dispositivo
- Exportación de reportes a Excel con OpenPyXL

## Licencia

MIT
