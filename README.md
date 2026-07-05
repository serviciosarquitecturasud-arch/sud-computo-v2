# SUD Cómputo v2

Cómputo métrico, presupuestación y gestión de obra — Estudio SUD (CABA/AMBA).

Reconstrucción profesional de la app de producción
(`serviciosarquitecturasud-arch.github.io/sud-computo`) sobre Vite + React +
TypeScript + Tailwind, manteniendo **paridad total de datos** con la app legacy.

## Estado: H0–H6 implementados · checks de producción diferidos (pendientes de validación conjunta)

- ✅ Motor de cálculo portado 1:1 (`src/core/`): expandSeed, buildMotor
  (IVA en material, Camino γ / β = precio_pres1 ÷ fac1, overrides por obra),
  coeficiente de pase R11, buildPlan (precedencias + CPM + curva de inversión),
  buildSuministro (Modelo A), materialesTotalObra.
- ✅ SEED embebido idéntico al de producción (341 materiales, 289 CUs).
- ✅ Tests de paridad (`tests/`): comparan el núcleo nuevo contra la extracción
  **verbatim** del legacy (`tests/legacy/core-legacy.cjs`). 30/30 verdes,
  incluidas las corridas contra el respaldo real de producción.
- ✅ Capa de persistencia abstraída (`src/storage/`): hoy localStorage con las
  mismas claves legacy (`cmp_catalogo`, `cmp_obras`, `cmp_revitMap`);
  preparada para Drive (H3) y Supabase multiusuario (H7).
- ✅ Deploy automático a GitHub Pages vía Actions (`.github/workflows/deploy.yml`).

## Reglas del proyecto

1. **Paridad de datos**: no cambiar nombres de campos ni claves de storage.
   Los adapters son passthrough: preservan campos que el núcleo no conoce.
2. **Nunca** subir fixtures con datos reales de obra (están en `.gitignore`
   como `fixtures/*.local.json`) — el repo es público.
3. Todo cambio al núcleo (`src/core/`) debe pasar `npm test` antes de mergear.
   El CI corre los tests en cada push.
4. Los criterios técnicos (dosificaciones, unidades físicas, coeficiente sin
   IVA ni cargas sociales, Modelo A de suministro) derivan de los cinco ejes
   documentales del proyecto — ver Project "COMPUTO Y PRESUPUESTO".

## Comandos

```bash
npm install      # instalar dependencias
npm run dev      # desarrollo en http://localhost:8000
npm test         # tests de paridad
npm run build    # build de producción → dist/
```

## Hoja de ruta

H0 Fundación → H1 Design system → H2/H3 Paridad funcional → H4 Visualización
→ H5 Dinámica → H6 Salidas cliente → H7 Auth + nube (multiusuario) → Switchover.

### H1 — Identidad SUD_estudio

- Tokens de marca en `src/index.css` (@theme Tailwind v4): naranja #DC8A52, oliva #63704A, azul #78A6C0, crema #FDFAE7, tan #D9B798, tinta #1B1B18 + neutros cálidos.
- Tipografía: Acid Grotesk (Folch Studio, solo Regular — nunca sintetizar negrita) para marca/títulos; Inter para UI y números tabulares.
- Motivo "aura de obra" (`src/ui/Aura.tsx`): esfera difusa con código de obra, de la papelería del estudio.
- Shell con navegación lateral, modo claro/oscuro, componentes base (`src/ui/`).
- Vista "Sistema visual" para aprobación del checkpoint (se retira al cerrar H1).

**Nota de licencia:** AcidGrotesk-Regular.woff2 es una fuente comercial de Folch Studio con licencia del estudio. Verificar que la licencia cubra uso web/embebido antes de publicar en repo público; si no, quitar `src/assets/fonts/` y la app cae a Inter automáticamente.


### H2–H6 — implementado (validación en producción pendiente)

- H2: panel de obra PROYECTO (Resumen, Carátula, Cómputo, Coeficiente, Presupuesto,
  Explosión, MO, Plan, Curva, Camino crítico, Suministro, Comparativa) | OBRA
  (placeholder H8) | ARCHIVOS. Catálogos editables (Materiales, MO, Equipos, Rubros, CUs).
- H3: Import Revit completo (mapeo SOLO por campo Comentarios, schema 1.1, diff,
  vinculación obra↔archivo). Google Drive: respaldos en carpeta "SUD Cómputo v2"
  (NUNCA la carpeta legacy — regla de convivencia), auto-sync default OFF por sesión.
  Archivos por obra en "SUD Cómputo v2/Archivos/<obra>" (subir/listar/preview/borrar).
- H4: Resumen con KPIs + composición + incidencia por rubro + curva; Gantt SVG en
  Camino crítico; curva de inversión SVG.
- H5: paleta de comandos (Ctrl/Cmd+K), undo global, indicador de autoguardado.
- H6: impresión A4 (@page) con panel de control por rubro.

### Pendiente

- Checks diferidos en producción (ver task list de la sesión).
- H7 auth+nube multiusuario (Supabase). H8 módulo Obra: bloqueado hasta recibir
  las planillas del usuario con la lógica de gestión de obra.
