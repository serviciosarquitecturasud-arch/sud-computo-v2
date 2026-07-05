/**
 * Paridad contra el RESPALDO REAL (fixtures/respaldo-real.local.json).
 * El fixture contiene datos reales de obra y está en .gitignore (repo público):
 * este test corre localmente y se OMITE en CI si el archivo no existe.
 */
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildMotor, buildPlan, buildSuministro, calcCoef, coefDefault, materialesTotalObra } from '../src/core';
import type { Catalogo, Obra } from '../src/core';

const require = createRequire(import.meta.url);
const legacy = require('./legacy/core-legacy.cjs');

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'respaldo-real.local.json');
const disponible = existsSync(fixturePath);

describe.skipIf(!disponible)('PARIDAD CONTRA RESPALDO REAL (producción)', () => {
  if (!disponible) return;
  const backup = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
    catalogo: Catalogo;
    obras: Obra[];
  };
  const cat = backup.catalogo;
  const obras = backup.obras;
  const mNuevo = buildMotor(cat);
  const mViejo = legacy.buildMotor(cat);

  it('el respaldo tiene catálogo y obras', () => {
    expect(cat.materiales.length).toBeGreaterThan(300);
    expect(obras.length).toBeGreaterThan(0);
  });

  it('costoAPU idéntico para TODOS los APUs del catálogo real', () => {
    for (const a of Object.keys(mNuevo.bibMap)) {
      expect(mNuevo.costoAPU(a), `APU ${a}`).toBe(mViejo.costoAPU(a));
    }
  });

  for (const obra of JSON.parse(readFileSync(fixturePath, 'utf8')).obras as Obra[]) {
    describe(`obra: ${obra.nombre || obra.id}`, () => {
      it('costoAPUEnObra idéntico para todos los APUs (172 overrides reales incluidos)', () => {
        for (const a of Object.keys(mNuevo.bibMap)) {
          expect(mNuevo.costoAPUEnObra(a, obra), `APU ${a}`).toBe(mViejo.costoAPUEnObra(a, obra));
        }
      });

      it('costoInsumoEnObra idéntico para todos los materiales', () => {
        for (const cod of Object.keys(mNuevo.matMap)) {
          expect(mNuevo.costoInsumoEnObra('M', cod, obra), `mat ${cod}`).toBe(
            mViejo.costoInsumoEnObra('M', cod, obra)
          );
        }
      });

      it('coeficiente de pase idéntico', () => {
        const c = obra.coef || coefDefault();
        expect(calcCoef(c as never)).toBe(legacy.calcCoef(c));
      });

      it('presupuesto total (costo directo × coef por ítem) idéntico', () => {
        const coefN = calcCoef((obra.coef as never) || coefDefault());
        const coefV = legacy.calcCoef(obra.coef || legacy.coefDefault());
        let totN = 0,
          totV = 0;
        for (const it of obra.items || []) {
          const cuN = mNuevo.apuTiene(it.cod) ? mNuevo.costoAPUEnObra(it.cod, obra) : it.precioManual || 0;
          const cuV = mViejo.apuTiene(it.cod) ? mViejo.costoAPUEnObra(it.cod, obra) : it.precioManual || 0;
          totN += cuN * (it.cant || 0) * coefN;
          totV += cuV * (it.cant || 0) * coefV;
        }
        expect(totN).toBe(totV);
        expect(totN).toBeGreaterThanOrEqual(0);
      });

      it('buildPlan idéntico (plan completo, CPM y curva)', () => {
        expect(buildPlan(obra, mNuevo)).toEqual(legacy.buildPlan(obra, mViejo));
      });

      it('buildSuministro idéntico', () => {
        const pN = buildPlan(obra, mNuevo);
        const pV = legacy.buildPlan(obra, mViejo);
        expect(buildSuministro(obra, pN, mNuevo)).toEqual(legacy.buildSuministro(obra, pV, mViejo));
      });

      it('materialesTotalObra idéntico', () => {
        expect(materialesTotalObra(obra, mNuevo)).toEqual(legacy.materialesTotalObra(obra, mViejo));
      });
    });
  }
});
