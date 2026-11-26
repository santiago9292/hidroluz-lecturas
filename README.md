# ⚡💧 HidroLuz Control — Lecturas de Medidores en Tiempo Real (PWA)

Aplicación web moderna progresiva (**PWA**) desarrollada con **Vite + React + JavaScript + Tailwind CSS + Supabase + Web Push**, lista para desplegar en **GitHub, Supabase y Vercel**.

## ✨ Características principales

- **Ingreso rápido con DNI**: Inicio de sesión directo sin contraseñas complejas.
- **Control estricto por Sede**: Cada operario solo puede registrar y visualizar lecturas de su sede asignada (validado tanto en la interfaz como mediante *trigger* en PostgreSQL).
- **Rol Sysadmin Global**: Creación, edición y eliminación de usuarios (con DNI y sede), creación de sedes y configuración de medidores y límites máximos diarios.
- **Evidencia en Supabase Storage**: Captura directa desde cámara móvil o subida de **fotos y videos** (bucket `evidencias` hasta 50 MB).
- **Cálculo Diario y Detección de Anomalías**:
  - Cálculo instantáneo de consumo diario (`kWh/día` y `m³/día`) antes y después de guardar.
  - Alerta por superar el **umbral diario máximo** configurado en el medidor.
  - Alerta estadística automática al superar en **+30%** el promedio diario reciente.
  - Alerta crítica si la lectura ingresada es **menor a la lectura anterior**.
- **Actualizaciones en Tiempo Real**: Sincronización viva mediante **Supabase Realtime** (`postgres_changes`).
- **PWA Instalable + Alertas Nativas Multiplataforma**:
  - Instalable en **Android**, **iOS (iPhone/iPad)** y **Escritorio (Windows/macOS/Linux)**.
  - Notificaciones nativas del sistema operativo vía **Web Push (VAPID)** + Service Worker (`public/sw.js` y Serverless Function `api/push.js`).

---

## 🚀 1. Ejecución en Local

```bash
npm install
npm run dev
```

> **Nota:** Si aún no configuras las variables de Supabase en `.env`, la app inicia automáticamente en **Modo Demo Interactivo** (Sysadmin: `00000000`, Operarios: `12345678` y `87654321`) para que puedas probar todas las pantallas de inmediato.

---

## 🗄️ 2. Configurar Supabase (Base de datos, Storage y Realtime)

1. Crea un proyecto nuevo en [Supabase](https://supabase.com).
2. Abre **SQL Editor** → **New Query**, pega todo el contenido de [`supabase/migrations/001_initial_schema.sql`](./supabase/migrations/001_initial_schema.sql) y pulsa **Run**.
   - Esto crea todas las tablas, el bucket público `evidencias` para fotos/videos, las publicaciones Realtime y el usuario Sysadmin inicial con **DNI `00000000`**.
3. Ve a **Project Settings → API** y copia tu **Project URL** y tu **anon public key** en tu archivo `.env`:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-publica

VITE_VAPID_PUBLIC_KEY=tu-clave-publica-vapid
VAPID_PRIVATE_KEY=tu-clave-privada-vapid
VAPID_SUBJECT=mailto:alertas@tudominio.com
```

*(Opcional: ejecuta `npm run vapid` si deseas generar un nuevo par de llaves VAPID propias).*

---

## ☁️ 3. Subir a GitHub y Desplegar en Vercel

1. Sube este repositorio a GitHub:
   ```bash
   git add .
   git commit -m "feat: webapp PWA de lecturas de luz y agua en Vite + JS + Supabase"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
   git push -u origin main
   ```
2. En [Vercel](https://vercel.com), haz clic en **Add New → Project** e importa tu repositorio de GitHub.
3. Vercel detectará automáticamente **Vite** (`npm run build`, carpeta `dist`) y la función Serverless `api/push.js`.
4. En **Environment Variables** de Vercel, agrega las 5 variables de `.env.example`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT`
5. Haz clic en **Deploy**.

---

## 📱 4. Instalación y Alertas Nativas por Dispositivo

- **Android (Chrome / Edge)**: Pulsa el botón **Instalar App** dentro del menú lateral/superior y luego toca **Activar Alertas Nativas**.
- **iPhone / iPad (iOS 16.4+)**: Abre la URL en Safari → toca **Compartir → Agregar a pantalla de inicio**, abre el ícono instalado y pulsa **Activar Alertas Nativas**.
- **PC Escritorio (Windows / macOS / Linux)**: Haz clic en **Instalar App** (o el icono de instalación en la barra de direcciones de Chrome/Edge) y activa las alertas nativas.
