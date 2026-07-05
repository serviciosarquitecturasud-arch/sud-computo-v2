# SUD Cómputo — Instructivo: activar el modo nube (Supabase)

Guía paso a paso, pensada para hacerla sin saber programar. Al terminar, la
app publicada va a pedir email y contraseña, y cada persona invitada va a
tener **sus propias obras y su propio catálogo** guardados en la nube.

> **Importante**: mientras NO completes estos pasos, la app sigue funcionando
> exactamente como hasta ahora (datos en el navegador + respaldo en Drive).
> El modo nube se "enciende" recién en el paso 6.

---

## 1. Crear el proyecto en Supabase

1. Entrá a <https://supabase.com> y creá una cuenta con
   `serviciosarquitectura.sud@gmail.com` (esa cuenta pasa a ser la admin:
   es la única que puede entrar al panel y crear usuarios).
2. Botón **New project**:
   - **Name**: `sud-computo` (o el que quieras).
   - **Database password**: generá una y guardala en un lugar seguro
     (no la vas a necesitar a diario, pero no se puede recuperar).
   - **Region**: elegí **South America (São Paulo)** — es la más cercana
     a Argentina.
3. Esperá uno o dos minutos a que el proyecto termine de crearse.

## 2. Crear las tablas (correr `schema.sql`)

1. En el menú lateral del proyecto, abrí **SQL Editor**.
2. Abrí el archivo `supabase/schema.sql` de este repositorio, copiá **todo**
   su contenido y pegalo en el editor.
3. Botón **Run** (abajo a la derecha). Tiene que decir "Success. No rows
   returned".

Esto crea las 3 tablas (`catalogos`, `obras`, `revit_maps`) y las reglas de
seguridad que hacen que **cada usuario solo pueda ver y tocar sus datos**.

## 3. Desactivar el registro público

Queremos que NADIE pueda crearse una cuenta solo: el acceso es por invitación.

1. Menú lateral → **Authentication** → **Sign In / Providers**
   (en algunos paneles figura como **Settings** dentro de Authentication).
2. Buscá la opción **Allow new users to sign up** y **desactivala**.
3. Guardá los cambios.

## 4. Crear los usuarios invitados (incluida tu propia cuenta)

1. Menú lateral → **Authentication** → **Users**.
2. Botón **Add user** → **Create new user**:
   - **Email**: el de la persona invitada
     (empezá por `serviciosarquitectura.sud@gmail.com`, tu propia cuenta).
   - **Password**: inventá una contraseña y pasásela por un canal seguro
     (después la puede cambiar).
   - Tildá **Auto Confirm User** si aparece la opción (así no necesita
     confirmar por email).
3. Repetí para cada persona del estudio que quieras invitar.

> La primera vez que VOS entres a la app con tu usuario, la app sube sola a
> la nube todo lo que hoy tenés en ese navegador (catálogo y obras). Para los
> demás usuarios nuevos, arranca con el catálogo estándar (SEED) y sin obras.

## 5. Copiar las dos claves del proyecto

1. Menú lateral → **Project Settings** (engranaje) → **API Keys** /
   **Data API**.
2. Anotá dos valores:
   - **Project URL** — algo como `https://abcdefgh.supabase.co`
   - **anon / public key** — un texto largo que empieza con `eyJ…`
     (o `sb_publishable_…` en proyectos nuevos).

> **¿Es seguro compartir la anon key?** Sí: la anon key es **pública por
> diseño** (viaja dentro de la página web, cualquiera puede verla). La
> seguridad NO depende de esa clave sino de las reglas RLS que creaste en el
> paso 2: aunque alguien tenga la clave, sin usuario y contraseña no puede
> leer ni escribir nada, y con usuario solo accede a SUS propias filas.
> La única clave que jamás hay que publicar es la `service_role` — no la
> uses en ningún lado.

## 6. Cargar las claves en GitHub (esto "enciende" el modo nube)

1. En GitHub, entrá al repositorio de la app.
2. **Settings** → **Secrets and variables** → **Actions** → pestaña
   **Variables** → botón **New repository variable**. Creá estas dos:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | la Project URL del paso 5 |
   | `VITE_SUPABASE_ANON_KEY` | la anon key del paso 5 |

3. El workflow de deploy (`.github/workflows/deploy.yml`) **ya está
   preparado** para leer esas variables: el paso de build incluye

   ```yaml
   - run: npm run build
     env:
       VITE_SUPABASE_URL: ${{ vars.VITE_SUPABASE_URL }}
       VITE_SUPABASE_ANON_KEY: ${{ vars.VITE_SUPABASE_ANON_KEY }}
   ```

   No hace falta tocar nada más.
4. Hacé cualquier push a `main` (o corré el workflow a mano desde la pestaña
   **Actions** → "Build y deploy a GitHub Pages" → **Run workflow**).
5. Cuando termine el deploy, la app publicada muestra la pantalla de ingreso.

## 7. Verificar

1. Abrí la app publicada: tiene que aparecer la pantalla "Ingresar".
2. Entrá con `serviciosarquitectura.sud@gmail.com` y tu contraseña.
3. Tienen que aparecer tus obras y tu catálogo de siempre (migrados
   automáticamente la primera vez, desde ese navegador).
4. En Supabase → **Table Editor** → tabla `obras` deberías ver tus obras.

## Para volver atrás (apagar el modo nube)

Borrá las dos variables del paso 6 en GitHub y volvé a deployar. La app
vuelve al modo local de siempre, sin login. Los datos en Supabase quedan
guardados por si volvés a activarlo.

## Notas

- **Drive sigue funcionando** igual que siempre: el respaldo a Google Drive y
  los archivos por obra conviven con el modo nube.
- Cada usuario tiene su espacio propio: no se comparten obras ni catálogos
  entre usuarios (eso llegará en una etapa futura si hace falta).
- Si un usuario olvida la contraseña: Authentication → Users → los tres
  puntitos de la fila → **Reset password** (o creale una nueva desde ahí).
