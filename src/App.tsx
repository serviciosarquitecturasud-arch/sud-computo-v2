/**
 * SUD Cómputo v2 — aplicación (H2 + H5).
 * Navegación: Obras (con panel Proyecto|Obra|Archivos por obra), catálogos
 * editables, respaldo. Persistencia legacy-compatible vía useAppData.
 * H5: paleta de comandos (Ctrl/Cmd+K), undo global (Ctrl/Cmd+Z),
 * indicador de autoguardado en el pie del sidebar.
 */
import { useEffect, useMemo, useState } from 'react';
import { useAppData } from './state/useAppData';
import { useAtajos } from './state/useAtajos';
import { Shell, type NavItem } from './ui/Shell';
import { CommandPalette, type AccionPaleta } from './ui/CommandPalette';
import { tiempoRelativo } from './ui/util';
import { Obras } from './views/Obras';
import { ObraPanel } from './views/obra/ObraPanel';
import { Materiales } from './views/catalogo/Materiales';
import { ManoObra } from './views/catalogo/ManoObra';
import { Equipos } from './views/catalogo/Equipos';
import { Rubros } from './views/catalogo/Rubros';
import { CUs } from './views/catalogo/CUs';
import { Respaldo } from './views/Respaldo';
import { Revit } from './views/Revit';
import { SistemaVisual } from './views/SistemaVisual';
import type { RespaldoV2 } from './state/useAppData';
import { autoSync, subirRespaldo } from './storage/driveSync';
import { estaAutenticado } from './storage/googleAuth';
import type { Session } from '@supabase/supabase-js';
import type { StorageAdapter } from './storage/adapter';
import { cloudHabilitado, getSupabase } from './cloud/config';
import { getSession, migrarLocalANube, onAuthStateChange, signOut } from './cloud/auth';
import { SupabaseAdapter } from './cloud/supabaseAdapter';
import { Login } from './views/Login';

const NAV: NavItem[] = [
  { id: 'obras', label: 'Obras' },
  { id: 'materiales', label: 'Materiales', grupo: 'Catálogo' },
  { id: 'mo', label: 'Mano de obra', grupo: 'Catálogo' },
  { id: 'equipos', label: 'Equipos', grupo: 'Catálogo' },
  { id: 'rubros', label: 'Rubros', grupo: 'Catálogo' },
  { id: 'cus', label: 'Cómputos Unitarios', grupo: 'Catálogo' },
  { id: 'revit', label: 'Import Revit', grupo: 'Herramientas' },
  { id: 'respaldo', label: 'Respaldo', grupo: 'Herramientas' },
  { id: 'sistema', label: 'Sistema visual', grupo: 'Herramientas' }
];

/** Descarga el respaldo como JSON (misma lógica que la vista Respaldo). */
function descargarRespaldo(data: RespaldoV2) {
  const stamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `computo_respaldo_${stamp}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Pie del sidebar: estado de autoguardado + botón Deshacer cuando hay historial. */
function IndicadorGuardado({
  status,
  ultimoGuardado,
  puedeDeshacer,
  onDeshacer
}: {
  status: 'guardado' | 'guardando';
  ultimoGuardado: number;
  puedeDeshacer: boolean;
  onDeshacer: () => void;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="mb-1 flex items-center justify-between px-2 py-1 text-[11px] text-[var(--texto-2)]">
      <span className={status === 'guardando' ? 'opacity-60' : ''}>
        {status === 'guardando' ? '◌ Guardando…' : `● Guardado ${tiempoRelativo(ultimoGuardado)}`}
      </span>
      {puedeDeshacer && (
        <button
          onClick={onDeshacer}
          title="Deshacer último cambio (Ctrl+Z)"
          className="rounded px-1.5 py-0.5 transition-colors hover:bg-[var(--color-neutro-100)] hover:text-[var(--texto)] dark:hover:bg-[var(--color-neutro-800)]"
        >
          Deshacer
        </button>
      )}
    </div>
  );
}

/**
 * Cuerpo de la aplicación. En modo local se monta sin props (adapter default
 * = localStorage). En modo nube recibe el adapter Supabase y los datos de
 * sesión para el pie del sidebar.
 */
function AppInterna({
  adapter,
  sesionEmail,
  onCerrarSesion
}: {
  adapter?: StorageAdapter;
  sesionEmail?: string;
  onCerrarSesion?: () => void;
}) {
  const [vista, setVista] = useState('obras');
  const [obraId, setObraId] = useState<string | null>(null);
  const [dark, setDark] = useState(false);
  const [paleta, setPaleta] = useState(false);
  const app = useAppData(adapter);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  // H3: auto-sync a Drive con debounce de 30s tras cada guardado local.
  // Solo actúa si el usuario activó el toggle en Respaldo (default apagado)
  // y hay sesión de Google; autoSync.notificarCambio hace el gating.
  useEffect(() => {
    if (!estaAutenticado()) return;
    autoSync.notificarCambio(() => {
      void subirRespaldo(app.exportRespaldo()).catch(() => undefined);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.ultimoGuardado]);

  const irA = (id: string) => {
    setVista(id);
    setObraId(null);
  };

  useAtajos({
    onPaleta: () => setPaleta((p) => !p),
    onDeshacer: () => {
      if (app.puedeDeshacer) app.deshacer();
    },
    onIrObras: () => {
      if (!paleta) irA('obras');
    }
  });

  if (!app.cat || !app.motor) {
    return <div className="p-10 text-sm text-[var(--texto-2)]">Cargando…</div>;
  }
  const { cat, setCat, obras, motor } = app;
  const origen: 'localStorage' | 'seed' = localStorage.getItem('cmp_obras') ? 'localStorage' : 'seed';
  const obraAbierta = obraId ? obras.find((o) => o.id === obraId) : undefined;

  const acciones: AccionPaleta[] = [
    {
      id: 'nueva-obra',
      label: 'Nueva obra',
      run: () => {
        const o = app.crearObra('Obra nueva');
        setVista('obras');
        setObraId(o.id);
      }
    },
    { id: 'exportar', label: 'Exportar respaldo', run: () => descargarRespaldo(app.exportRespaldo()) },
    { id: 'dark', label: dark ? 'Modo claro' : 'Modo oscuro', run: () => setDark(!dark) },
    ...NAV.filter((n) => !n.deshabilitado).map((n) => ({
      id: `nav-${n.id}`,
      label: `Ir a ${n.label}`,
      run: () => irA(n.id)
    }))
  ];

  return (
    <Shell
      nav={NAV}
      activo={vista}
      onNav={irA}
      dark={dark}
      onToggleDark={() => setDark(!dark)}
      onBuscar={() => setPaleta(true)}
      footer={
        <>
          {sesionEmail !== undefined && (
            <div className="mb-1 flex items-center justify-between gap-2 px-2 py-1 text-[11px] text-[var(--texto-2)]">
              <span className="min-w-0 truncate" title={sesionEmail}>
                {sesionEmail}
              </span>
              <button
                onClick={onCerrarSesion}
                title="Cerrar sesión"
                className="shrink-0 rounded px-1.5 py-0.5 transition-colors hover:bg-[var(--color-neutro-100)] hover:text-[var(--texto)] dark:hover:bg-[var(--color-neutro-800)]"
              >
                Cerrar sesión
              </button>
            </div>
          )}
          <IndicadorGuardado
            status={app.saveStatus}
            ultimoGuardado={app.ultimoGuardado}
            puedeDeshacer={app.puedeDeshacer}
            onDeshacer={app.deshacer}
          />
        </>
      }
    >
      {paleta && (
        <CommandPalette
          cat={cat}
          obras={obras}
          acciones={acciones}
          onAbrirObra={(id) => {
            setVista('obras');
            setObraId(id);
          }}
          onNav={irA}
          onCerrar={() => setPaleta(false)}
        />
      )}
      {vista === 'obras' && obraAbierta ? (
        <ObraPanel
          obra={obraAbierta}
          setObra={app.setObra}
          cat={cat}
          motor={motor}
          onVolver={() => setObraId(null)}
        />
      ) : vista === 'obras' ? (
        <Obras
          obras={obras}
          cat={cat}
          motor={motor}
          origen={origen}
          onAbrir={setObraId}
          onCrear={(n) => app.crearObra(n)}
          onEliminar={app.eliminarObra}
        />
      ) : vista === 'materiales' ? (
        <Materiales cat={cat} setCat={setCat} motor={motor} />
      ) : vista === 'mo' ? (
        <ManoObra cat={cat} setCat={setCat} motor={motor} />
      ) : vista === 'equipos' ? (
        <Equipos cat={cat} setCat={setCat} motor={motor} />
      ) : vista === 'rubros' ? (
        <Rubros cat={cat} setCat={setCat} motor={motor} />
      ) : vista === 'cus' ? (
        <CUs cat={cat} setCat={setCat} motor={motor} />
      ) : vista === 'revit' ? (
        <Revit cat={cat} motor={motor} obras={obras} setObras={app.setObras} revitMap={app.revitMap} setRevitMap={app.setRevitMap} onAbrirObra={(id) => { setVista('obras'); setObraId(id); }} />
      ) : vista === 'respaldo' ? (
        <Respaldo exportRespaldo={app.exportRespaldo} importRespaldo={app.importRespaldo} />
      ) : (
        <SistemaVisual />
      )}
    </Shell>
  );
}

/** Pantalla de espera mínima (carga de sesión / migración inicial). */
function Cargando() {
  return <div className="p-10 text-sm text-[var(--texto-2)]">Cargando…</div>;
}

/**
 * Modo nube (H7): gestiona sesión Supabase. Sin sesión → Login; con sesión →
 * migración inicial local→nube (solo si el usuario no tiene datos en la nube)
 * y AppInterna con el adapter cloud, remontada por usuario (key).
 */
function AppNube() {
  // undefined = todavía no sabemos si hay sesión.
  const [sesion, setSesion] = useState<Session | null | undefined>(undefined);
  const [migracionLista, setMigracionLista] = useState(false);
  const userId = sesion?.user.id;

  useEffect(() => {
    let activo = true;
    void getSession().then((s) => {
      if (activo) setSesion(s);
    });
    const off = onAuthStateChange((s) => setSesion(s));
    return () => {
      activo = false;
      off();
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setMigracionLista(false);
      return;
    }
    let activo = true;
    void migrarLocalANube(getSupabase(), userId)
      .catch((e) => console.error('Migración local → nube falló (se continúa igual):', e))
      .finally(() => {
        if (activo) setMigracionLista(true);
      });
    return () => {
      activo = false;
    };
  }, [userId]);

  const adapter = useMemo(
    () => (userId ? new SupabaseAdapter(getSupabase(), userId) : null),
    [userId]
  );

  if (sesion === undefined) return <Cargando />;
  if (sesion === null || !adapter) return <Login />;
  if (!migracionLista) return <Cargando />;
  return (
    <AppInterna
      key={sesion.user.id}
      adapter={adapter}
      sesionEmail={sesion.user.email ?? ''}
      onCerrarSesion={() => void signOut()}
    />
  );
}

/**
 * Punto de entrada: si el build tiene credenciales de Supabase, modo nube
 * (login + datos en Postgres); si no, modo local EXACTO al comportamiento
 * histórico (localStorage + Drive, sin login).
 */
export default function App() {
  return cloudHabilitado() ? <AppNube /> : <AppInterna />;
}
