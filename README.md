# 🎭 Mundo Disfraz

Sistema web de gestión para alquiler de disfraces. Permite administrar clientes, alquileres con fotos, pagos y reportes desde cualquier dispositivo con internet.

## 🚀 Funcionalidades

- **Dashboard** — resumen de clientes, alquileres, pendientes, caja y señas
- **Clientes** — buscar, crear, editar y eliminar; historial de alquileres por cliente
- **Nuevo Alquiler** — formulario en 3 pasos: seleccionar cliente, elegir disfraces con fotos, confirmar
- **Alquileres** — listado con filtros y búsqueda, cambio rápido de estado, edición completa con fotos
- **Reportes** — gráficos y tablas por rango de fechas (ingresos, devoluciones, disfraces, colegios, garantías)
- **WhatsApp** — comprobante y recordatorio de fuera de término directamente desde la app
- **Backup** — exportar todos los datos (clientes, alquileres y fotos) en JSON desde la página de Ayuda
- **Fotos** — se guardan como base64 en Firestore (no requiere Firebase Storage)
- **Mobile** — diseño responsive, cámara directa, menú táctil

## 🛠️ Tecnologías

- **Frontend:** React + Vite (JavaScript)
- **Base de datos:** Firebase Firestore
- **Autenticación:** Firebase Auth (email/contraseña)
- **Hosting:** Firebase Hosting
- **Fotos:** Base64 embebido en los documentos de Firestore

## 📦 Instalación local

```bash
git clone https://github.com/maguicordobaqc-dotcom/MundoDisfraz.git
cd MundoDisfraz
npm install
npm run dev
```

Abrir en http://localhost:3000

## 🚢 Deploy

```bash
npm run build
firebase deploy --only hosting --project mundo-disfraz
```

## 📄 Licencia

Uso privado — Mundo Disfraz
