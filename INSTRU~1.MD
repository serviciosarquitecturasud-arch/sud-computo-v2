# Instructivo: publicar SUD Cómputo v2 en GitHub Pages

Una sola vez (pasos 1–4). Después, cada actualización es solo el paso 5.

## 1. Crear el repositorio

1. Entrá a https://github.com/new con la cuenta `serviciosarquitecturasud-arch`.
2. Nombre del repositorio: `sud-computo-v2`. Visibilidad: **Public**
   (GitHub Pages gratuito requiere repo público).
3. NO marques "Add a README". Botón **Create repository**.

## 2. Subir los archivos

1. En la página del repo recién creado: link **"uploading an existing file"**.
2. Arrastrá TODO el contenido de la carpeta `sud-computo-v2` que te entregué,
   **EXCEPTO** las carpetas `node_modules` y `dist` (si existen).
   Importante: incluí la carpeta `.github` (si no la ves, activá
   "archivos ocultos" en tu explorador de Windows: Vista → Elementos ocultos).
3. Mensaje de commit: `H0 — fundación`. Botón **Commit changes**.

> Si el arrastre no toma la carpeta `.github`, subila aparte:
> Add file → Upload files → arrastrá la carpeta `.github` completa.

## 3. Activar GitHub Pages con Actions

1. En el repo: **Settings → Pages**.
2. En "Build and deployment" → Source: elegí **GitHub Actions**.

## 4. Verificar el primer deploy

1. Pestaña **Actions** del repo: debería estar corriendo
   "Build y deploy a GitHub Pages". Tarda 1–2 minutos.
   El workflow corre los tests de paridad antes de publicar:
   si un test falla, NO se publica (protección automática).
2. Cuando esté verde, la app queda en:
   `https://serviciosarquitecturasud-arch.github.io/sud-computo-v2/`
3. Abrila. Como este navegador ya tiene tus datos en localStorage (si es el
   mismo dominio github.io, comparte origen con la app vieja), la página H0
   debería mostrar **Melicue 4458 y Casa Demo con los mismos totales que la
   app de producción**. Verificá los números contra la app vieja.

## 5. Actualizaciones futuras (cada hito)

1. Te entrego los archivos modificados.
2. En el repo: navegás al archivo → botón lápiz (o Upload files para varios)
   → pegás/subís → Commit.
3. Actions buildea y publica solo. Ctrl+F5 en la app tras 1–2 minutos.

## Reglas de seguridad

- La app vieja sigue intacta en `.../sud-computo/`. Es tu rollback.
- **Nunca uses la app vieja y la nueva el mismo día** una vez que la nueva
  empiece a escribir en Drive (recién en H3; por ahora la nueva NO escribe).
- H0 solo LEE localStorage, no escribe nada: es seguro abrirla para comparar.
