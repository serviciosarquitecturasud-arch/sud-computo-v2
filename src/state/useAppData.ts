/**
 * Estado global de datos: catálogo + obras, con persistencia legacy-compatible
 * (claves cmp_catalogo / cmp_obras) y respaldo JSON v2.
 * H5: historial de undo (anillo de 25 snapshots) e indicador de autoguardado.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SetStateAction } from 'react';
import { SEED, buildMotor, expandSeed, uid } from '../core';
import type { Catalogo, Obra } from '../core';
import type { StorageAdapter } from '../storage/adapter';
import { LocalStorageAdapter } from '../storage/localStorageAdapter';
import { mergeCatalogoConSeed, migrarObras } from './bootstrap';

/** Adapter por defecto: modo local (claves legacy cmp_*). */
const storageLocal = new LocalStorageAdapter();

/** Cantidad máxima de snapshots de undo en memoria. */
const MAX_HISTORIAL = 25;

/** Delay visual del indicador: los saves son sincrónicos, sin esto no se percibe. */
const DELAY_GUARDADO_MS = 400;

export type SaveStatus = 'guardado' | 'guardando';

interface Snapshot {
  cat: Catalogo | null;
  obras: Obra[];
}

export interface RespaldoV2 {
  app: string;
  version: number;
  fecha: string;
  catalogo: Catalogo;
  obras: Obra[];
  mapaRevit: Record<string, string>;
}

/**
 * @param adapter persistencia a usar. Default: localStorage (modo local).
 *                H7: en modo nube se pasa un SupabaseAdapter. Se fija en el
 *                primer render (si cambia el usuario, remontar con `key`).
 */
export function useAppData(adapter: StorageAdapter = storageLocal) {
  const storage = useRef(adapter).current;
  const [cat, setCatRaw] = useState<Catalogo | null>(null);
  const [obras, setObrasRaw] = useState<Obra[]>([]);
  const [revitMap, setRevitMap] = useState<Record<string, string>>({});
  const ready = useRef(false);

  // --- Historial de undo (anillo, máx MAX_HISTORIAL) -----------------------
  const historial = useRef<Snapshot[]>([]);
  const [nivelesUndo, setNivelesUndo] = useState(0);

  /** Pushea el estado ACTUAL antes de un cambio. No corre en la carga inicial. */
  const pushHistorial = () => {
    if (!ready.current) return;
    historial.current = [...historial.current, { cat, obras }].slice(-MAX_HISTORIAL);
    setNivelesUndo(historial.current.length);
  };

  /** Setter de catálogo con snapshot previo (misma firma que el de useState). */
  const setCat = (v: SetStateAction<Catalogo | null>) => {
    pushHistorial();
    setCatRaw(v);
  };

  /** Setter de obras con snapshot previo (misma firma que el de useState). */
  const setObras = (v: SetStateAction<Obra[]>) => {
    pushHistorial();
    setObrasRaw(v);
  };

  /** Restaura el último snapshot. Sin redo. */
  const deshacer = () => {
    const snap = historial.current[historial.current.length - 1];
    if (!snap) return;
    historial.current = historial.current.slice(0, -1);
    setNivelesUndo(historial.current.length);
    setCatRaw(snap.cat);
    setObrasRaw(snap.obras);
  };

  // --- Indicador de autoguardado -------------------------------------------
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('guardado');
  const [ultimoGuardado, setUltimoGuardado] = useState<number>(() => Date.now());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const marcarGuardando = () => {
    setSaveStatus('guardando');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSaveStatus('guardado');
      setUltimoGuardado(Date.now());
      saveTimer.current = null;
    }, DELAY_GUARDADO_MS);
  };

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    []
  );

  // --- Carga inicial y persistencia ----------------------------------------
  useEffect(() => {
    (async () => {
      // Cargas vía adapter (local o nube). El merge con SEED espera los raw
      // strings del formato legacy, así que re-serializamos: mismo resultado.
      const catGuardado = await storage.loadCatalogo();
      const obrasGuardadas = await storage.loadObras();
      const mapGuardado = await storage.loadRevitMap();
      const seedFresh = expandSeed(SEED);
      const catFinal = mergeCatalogoConSeed(
        catGuardado ? JSON.stringify(catGuardado) : null,
        seedFresh
      );
      const obrasFinal = migrarObras(
        obrasGuardadas ? JSON.stringify(obrasGuardadas) : null,
        catFinal
      );
      setCatRaw(catFinal);
      setObrasRaw(obrasFinal);
      setRevitMap(mapGuardado ?? {});
      ready.current = true;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ready.current && cat) {
      marcarGuardando();
      void storage.saveCatalogo(cat).catch((e) => console.error(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat]);
  useEffect(() => {
    if (ready.current) {
      marcarGuardando();
      void storage.saveObras(obras).catch((e) => console.error(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obras]);
  useEffect(() => {
    if (ready.current) void storage.saveRevitMap(revitMap).catch((e) => console.error(e));
  }, [revitMap]);

  const motor = useMemo(() => (cat ? buildMotor(cat) : null), [cat]);

  const crearObra = (nombre: string): Obra => {
    const o: Obra = {
      id: uid(),
      nombre,
      comitente: '',
      direccion: '',
      items: [],
      coef: { ggd: 0, ggi: 0, imp: 0, ben: 0, iva: 0, iib: 0 },
      creada: new Date().toISOString(),
      caratula: {},
      superficies: { cub: 0, semi: 0, desc: 0 },
      precios: {},
      proveedores: {},
      plan: { hsSem: 45, rubros: {} },
      materialesConfig: {},
      cotizacionesPorRubro: {}
    };
    setObras((prev) => [...prev, o]);
    return o;
  };

  const setObra = (o: Obra) => setObras((prev) => prev.map((x) => (x.id === o.id ? o : x)));
  const eliminarObra = (id: string) => setObras((prev) => prev.filter((x) => x.id !== id));

  const exportRespaldo = (): RespaldoV2 => ({
    app: 'sud-computo',
    version: 2,
    fecha: new Date().toISOString(),
    catalogo: cat as Catalogo,
    obras,
    mapaRevit: revitMap
  });

  const importRespaldo = (data: RespaldoV2): string | null => {
    if (!data || typeof data !== 'object' || !data.catalogo || !Array.isArray(data.obras)) {
      return 'El archivo no es un respaldo válido de SUD Cómputo.';
    }
    const seedFresh = expandSeed(SEED);
    const catFinal = mergeCatalogoConSeed(JSON.stringify(data.catalogo), seedFresh);
    pushHistorial(); // un solo snapshot para todo el import
    setCatRaw(catFinal);
    setObrasRaw(migrarObras(JSON.stringify(data.obras), catFinal));
    setRevitMap(data.mapaRevit || {});
    return null;
  };

  return {
    cat,
    setCat,
    obras,
    setObras,
    setObra,
    crearObra,
    eliminarObra,
    revitMap,
    setRevitMap,
    motor,
    exportRespaldo,
    importRespaldo,
    saveStatus,
    ultimoGuardado,
    deshacer,
    puedeDeshacer: nivelesUndo > 0
  };
}
