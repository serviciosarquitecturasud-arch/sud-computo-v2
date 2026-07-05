import type { Catalogo, Obra } from '../core/types';
import { KEYS, type StorageAdapter } from './adapter';

/**
 * Adapter localStorage — mismas claves que la app legacy.
 * Fallback a memoria si localStorage no está disponible (incógnito, cuota llena),
 * replicando el comportamiento del legacy.
 */
export class LocalStorageAdapter implements StorageAdapter {
  private mem: Record<string, string | null> = {};
  private warnedFull = false;

  private get(k: string): string | null {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      console.warn(`localStorage.getItem falló para "${k}", usando memoria:`, e);
      return this.mem[k] ?? null;
    }
  }

  private set(k: string, v: string): void {
    try {
      localStorage.setItem(k, v);
      this.mem[k] = null;
    } catch (e) {
      this.mem[k] = v;
      if (!this.warnedFull) {
        this.warnedFull = true;
        console.error(
          'localStorage no disponible o lleno. Los cambios se guardan SOLO en memoria de esta sesión. Exportá un respaldo.',
          e
        );
      }
    }
  }

  private parse<T>(raw: string | null): T | null {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch (e) {
      console.error('JSON inválido en localStorage:', e);
      return null;
    }
  }

  async loadCatalogo() {
    return this.parse<Catalogo>(this.get(KEYS.catalogo));
  }
  async saveCatalogo(cat: Catalogo) {
    this.set(KEYS.catalogo, JSON.stringify(cat));
  }
  async loadObras() {
    return this.parse<Obra[]>(this.get(KEYS.obras));
  }
  async saveObras(obras: Obra[]) {
    this.set(KEYS.obras, JSON.stringify(obras));
  }
  async loadRevitMap() {
    return this.parse<Record<string, string>>(this.get(KEYS.revitMap));
  }
  async saveRevitMap(map: Record<string, string>) {
    this.set(KEYS.revitMap, JSON.stringify(map));
  }
}
