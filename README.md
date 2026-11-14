# Sitio de maquillaje — Vercel + Supabase (gratis)

Página estática (HTML/CSS/JS, sin build) con contenido editable desde la propia web.

- Tocando el **logo** de arriba se abre el acceso de administradora.
- Con sesión iniciada: los textos se editan tocándolos, las fotos tienen el botón **Cambiar foto**, se pueden agregar o quitar servicios y fotos del portfolio, y en **Ajustes** se cambia el número de WhatsApp, el mensaje automático y el logo.
- El botón **Reservá tu turno** queda siempre visible (barra fija abajo en el celular) y abre WhatsApp.

## Archivos
| Archivo | Qué es |
|---|---|
| `index.html` | Estructura y textos por defecto |
| `styles.css` | Estilos; colores y tipografías en `:root` |
| `app.js` | Carga de contenido, modo edición, subida de fotos |
| `config.js` | Datos de Supabase y WhatsApp por defecto |
| `supabase/schema.sql` | Tablas, permisos y bucket de fotos |

## Puesta en marcha (una sola vez)

### 1. Supabase
1. Crear un proyecto gratis en supabase.com.
2. **SQL Editor** → pegar todo `supabase/schema.sql` → **Run**. Después, lo mismo con `supabase/02-servicios-canva.sql`.
3. **Authentication → Users → Add user**: crear la usuaria admin con email y contraseña (marcar *Auto confirm*).
4. En el SQL Editor, correr la última línea del schema con ese email (la que inserta en `admins`).
5. Recomendado: **Authentication → Providers → Email** → desactivar *Allow new users to sign up*, así nadie más puede crear cuentas.
6. **Project Settings → Data API**: copiar la *Project URL*. **Project Settings → API Keys**: copiar la *Publishable key* (o, en *Legacy API Keys*, la *anon public*). Pegar las dos en `config.js`. Nunca usar la *secret* / *service_role*.

### 2. Vercel
1. Subir esta carpeta a un repo de GitHub.
2. En vercel.com → **Add New Project** → importar el repo → Framework: **Other** → Deploy. No hace falta comando de build.

### Probar en local
Los módulos ES no funcionan abriendo el archivo con doble clic; hace falta un servidor local, por ejemplo `npx serve .` o `python3 -m http.server`, y abrir la URL que muestra.

## Límites del plan gratis
- Supabase: 1 GB de storage y el proyecto se pausa tras 7 días sin visitas (se reactiva desde el panel). Las fotos se comprimen antes de subir (máx. 1800px) para no gastar espacio.
- Vercel Hobby: alcanza para un sitio personal.
