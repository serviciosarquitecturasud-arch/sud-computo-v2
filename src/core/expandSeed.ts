import { cmpCodigo } from './codigo';
import type { Catalogo, SeedComprimido } from './types';

/** Expande el SEED comprimido (arrays posicionales) al catálogo completo. Port 1:1. */
export function expandSeed(s: SeedComprimido): Catalogo {
  const n = (v: unknown): number => (v as number) || 0;
  const str = (v: unknown): string => (v as string) || '';
  return {
    materiales: (s.M || [])
      .map((a) => ({
        cod: a[0] as string,
        desc: a[1] as string,
        unidad: a[2] as string,
        precio: n(a[3]),
        div: str(a[4]),
        desp: n(a[5]),
        pres1: str(a[6]),
        fac1: n(a[7]),
        pres2: str(a[8]),
        fac2: n(a[9])
      }))
      .sort((x, y) => cmpCodigo(x.cod, y.cod)),
    manoObra: (s.O || [])
      .map((a) => ({
        cod: a[0] as string,
        desc: a[1] as string,
        unidad: a[2] as string,
        valor: n(a[3])
      }))
      .sort((x, y) => cmpCodigo(x.cod, y.cod)),
    herramientas: (s.H || [])
      .map((a) => ({
        cod: a[0] as string,
        desc: a[1] as string,
        grupo: a[2] as string,
        tenencia: a[3] as string,
        valor: n(a[4]),
        vidautil: n(a[5]),
        jornada: (a[6] as number) || 8,
        combust: n(a[7]),
        reparac: n(a[8])
      }))
      .sort((x, y) => cmpCodigo(x.cod, y.cod)),
    rubros: (s.R || [])
      .map((a) => ({
        cod: a[0] as string,
        rubro: a[1] as string,
        subrubro: a[2] as string,
        desc: a[3] as string,
        unidad: a[4] as string
      }))
      .sort((x, y) => cmpCodigo(x.cod, y.cod)),
    biblioteca: (s.B || [])
      .map((a) => ({
        apu: a[0] as string,
        tipo: a[1] as string,
        insumo: a[2] as string,
        cant: n(a[3]),
        nota: a[4] as string
      }))
      .sort(
        (x, y) =>
          cmpCodigo(x.apu, y.apu) ||
          (x.tipo || '').localeCompare(y.tipo || '') ||
          cmpCodigo(x.insumo, y.insumo)
      ),
    deletedApus: [],
    apusEditados: []
  };
}
