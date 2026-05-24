# IceBuinPOS 🧊

Sistema de Punto de Venta (POS) moderno con escáner de código de barras, diseñado para pequeños y medianos comercios.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React + shadcn/ui + Tailwind CSS |
| Backend | FastAPI (Python) + MongoDB |
| Base de Datos | MongoDB |
| Deploy | Docker Compose |

## Funcionalidades

- ✅ Dashboard con estadísticas en tiempo real
- ✅ Gestión de productos (CRUD + códigos de barras)
- ✅ Ventas con carrito y escáner de código de barras
- ✅ Precios por volumen (precio unitario variable según cantidad)
- ✅ Reportes de ventas (exportables a Excel)
- ✅ Autenticación JWT (login/registro)
- ✅ Roles: vendedor / administrador

## Requisitos

- Docker + Docker Compose

## Instalación

```bash
# 1. Clonar
git clone https://github.com/webexpresschile/icebuin-pos.git
cd icebuin-pos

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores

# 3. Iniciar
docker compose up -d

# 4. Abrir en el navegador
# http://localhost
```

## Variables de Entorno

Ver `.env.example` para todas las variables disponibles.

## Desarrollo

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --reload --port 8000

# Frontend
cd frontend
npm install
REACT_APP_BACKEND_URL=http://localhost:8000 npm start
```

## Licencia

MIT
