/**
 * CAJA de obra (H8a) — movimientos de plata: ingresos (fondos del cliente)
 * y egresos (jornales, corralón, volquetes…). Balance y gasto total derivados.
 * La factura se puede adjuntar desde la carpeta de Drive de la obra
 * (misma carpeta que ARCHIVOS) o registrarse sin archivo (tipo 'sin').
 * El resumen por comercio responde «todas las facturas de Feros».
 */
import { useEffect, useMemo, useState } from 'react';
import {
  balanceCaja,
  gastoTotalObra,
  money,
  pendientesDePago,
  resumenPorComercio,
  uid
} from '../../core';
import type { CompraMaterial, FacturaTipo, MovimientoCaja, Obra } from '../../core';
import { Badge, Btn, Card, SectionTitle, td, th } from '../../ui/base';
import { useGoogleAuth } from '../../storage/googleAuth';
import {
  asegurarCarpetaObra,
  linkPreview,
  listarArchivos,
  type ArchivoDrive
} from '../../storage/driveArchivos';

const hoyISO = () => new Date().toISOString().slice(0, 10);

const inputCls =
  'w-full rounded border border-[var(--borde)] bg-[var(--panel)] px-2 py-1.5 text-sm ' +
  'focus:outline-2 focus:outline-[var(--color-sud-azul)]';

const TIPOS_FACTURA: FacturaTipo[] = ['A', 'B', 'C', 'sin'];

function fmtFechaCorta(iso: string): string {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return a && m && d ? `${d}/${m}/${a.slice(2)}` : iso;
}

function mesDe(iso: string): string {
  return (iso || '').slice(0, 7);
}

function nombreMes(ym: string): string {
  const [a, m] = ym.split('-').map(Number);
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${meses[(m || 1) - 1]} ${a}`;
}

function linkFactura(m: MovimientoCaja): string {
  if (m.facturaLink) return m.facturaLink;
  if (m.facturaFileId) return linkPreview(m.facturaFileId).replace('/preview', '/view');
  return '';
}

function Kpi({ valor, label, tono = '' }: { valor: string; label: string; tono?: string }) {
  return (
    <div className="rounded-md border border-[var(--borde)] px-4 py-2">
      <div className={'font-marca text-xl tabular-nums ' + tono}>{valor}</div>
      <div className="text-[11px] uppercase tracking-[0.1em] text-[var(--texto-2)]">{label}</div>
    </div>
  );
}

export function ObraCaja({ obra, setObra }: { obra: Obra; setObra: (o: Obra) => void }) {
  const caja: MovimientoCaja[] = Array.isArray(obra.caja) ? obra.caja : [];
  const compras: CompraMaterial[] = Array.isArray(obra.compras) ? obra.compras : [];
  const setCaja = (movs: MovimientoCaja[]) => setObra({ ...obra, caja: movs });

  /* Archivos de Drive de la obra para adjuntar facturas (si hay sesión de Google) */
  const auth = useGoogleAuth();
  const [archivos, setArchivos] = useState<ArchivoDrive[]>([]);
  useEffect(() => {
    let vivo = true;
    if (auth.autenticado) {
      (async () => {
        try {
          const id = await asegurarCarpetaObra(obra);
          const lista = await listarArchivos(id);
          if (vivo) setArchivos(lista);
        } catch {
          /* sin Drive no se bloquea la caja: se registra sin archivo */
        }
      })();
    } else {
      setArchivos([]);
    }
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.autenticado, obra.id]);

  /* ===== Alta rápida ===== */
  const [fecha, setFecha] = useState(hoyISO());
  const [tipo, setTipo] = useState<'ingreso' | 'egreso'>('egreso');
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [comercio, setComercio] = useState('');
  const [facturaTipo, setFacturaTipo] = useState<FacturaTipo>('sin');
  const [facturaFileId, setFacturaFileId] = useState('');
  const [pagadoPor, setPagadoPor] = useState('obra');
  const [pagado, setPagado] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const agregar = () => {
    const n = Number(monto) || 0;
    if (n <= 0) {
      setError('Indicá el monto (mayor a 0).');
      return;
    }
    if (!descripcion.trim()) {
      setError('Contá qué fue este movimiento (ej. «pago jornales semana 3»).');
      return;
    }
    const mov: MovimientoCaja = {
      id: uid(),
      fecha: fecha || hoyISO(),
      tipo,
      monto: n,
      descripcion: descripcion.trim(),
      facturaTipo,
      pagado
    };
    if (comercio.trim()) mov.comercio = comercio.trim();
    if (pagadoPor.trim()) mov.pagadoPor = pagadoPor.trim();
    const archivo = archivos.find((a) => a.id === facturaFileId);
    if (archivo) {
      mov.facturaFileId = archivo.id;
      if (archivo.webViewLink) mov.facturaLink = archivo.webViewLink;
    }
    setCaja([mov, ...caja]);
    setMonto('');
    setDescripcion('');
    setComercio('');
    setFacturaTipo('sin');
    setFacturaFileId('');
    setError(null);
  };

  /* ===== Filtro por mes ===== */
  const [filtroMes, setFiltroMes] = useState('todos');
  const meses = useMemo(
    () => [...new Set(caja.map((m) => mesDe(m.fecha)).filter(Boolean))].sort().reverse(),
    [caja]
  );
  const visibles = useMemo(
    () =>
      [...caja]
        .filter((m) => filtroMes === 'todos' || mesDe(m.fecha) === filtroMes)
        .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')),
    [caja, filtroMes]
  );

  const bal = balanceCaja(caja);
  const pend = pendientesDePago(caja);
  const resumen = resumenPorComercio(caja, compras);

  const togglePagado = (id: string) =>
    setCaja(caja.map((m) => (m.id === id ? { ...m, pagado: !m.pagado } : m)));

  const borrar = (m: MovimientoCaja) => {
    if (!confirm(`¿Borrar el movimiento «${m.descripcion}» (${money(m.monto)})?`)) return;
    setCaja(caja.filter((x) => x.id !== m.id));
  };

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="flex flex-wrap gap-3">
        <Kpi
          valor={money(bal.balance)}
          label="Balance de caja"
          tono={bal.balance >= 0 ? 'text-[var(--color-ok)]' : 'text-[var(--color-alerta)]'}
        />
        <Kpi valor={money(gastoTotalObra(caja))} label="Gasto total obra" />
        <Kpi valor={money(bal.ingresos)} label="Ingresos" />
        <Kpi
          valor={pend.cantidad > 0 ? `${pend.cantidad} · ${money(pend.monto)}` : '0'}
          label="Pendientes de pago"
          tono={pend.cantidad > 0 ? 'text-[var(--color-alerta)]' : ''}
        />
      </div>

      {/* Alta rápida */}
      <Card className="p-4">
        <SectionTitle>Nuevo movimiento</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-[var(--texto-2)]">Fecha</span>
            <input className={inputCls} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-[var(--texto-2)]">Tipo</span>
            <select className={inputCls} value={tipo} onChange={(e) => setTipo(e.target.value as 'ingreso' | 'egreso')}>
              <option value="egreso">Egreso (gasto)</option>
              <option value="ingreso">Ingreso (fondos)</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-[var(--texto-2)]">Monto ARS *</span>
            <input
              className={inputCls + ' tabular-nums'}
              type="number"
              inputMode="numeric"
              min={0}
              step="any"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-[var(--texto-2)]">Comercio / proveedor</span>
            <input
              className={inputCls}
              value={comercio}
              placeholder="Ej.: FEROS, volquetes"
              onChange={(e) => setComercio(e.target.value)}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-xs text-[var(--texto-2)]">Descripción *</span>
            <input
              className={inputCls}
              value={descripcion}
              placeholder="Ej.: semana 1 — pago jornales"
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-[var(--texto-2)]">Factura</span>
            <select
              className={inputCls}
              value={facturaTipo}
              onChange={(e) => setFacturaTipo(e.target.value as FacturaTipo)}
            >
              {TIPOS_FACTURA.map((t) => (
                <option key={t} value={t}>
                  {t === 'sin' ? 'Sin factura' : `Factura ${t}`}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-[var(--texto-2)]">Pagó</span>
            <input
              className={inputCls}
              value={pagadoPor}
              placeholder="obra / cliente / contratista"
              list="caja-pagadopor"
              onChange={(e) => setPagadoPor(e.target.value)}
            />
            <datalist id="caja-pagadopor">
              <option value="obra" />
              <option value="cliente" />
            </datalist>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-xs text-[var(--texto-2)]">
              Archivo de factura (Drive de la obra)
            </span>
            <select
              className={inputCls}
              value={facturaFileId}
              onChange={(e) => setFacturaFileId(e.target.value)}
              disabled={archivos.length === 0}
            >
              <option value="">
                {archivos.length === 0
                  ? auth.autenticado
                    ? 'Sin archivos en la carpeta de la obra'
                    : 'Conectá Google Drive en ARCHIVOS para adjuntar'
                  : 'Sin archivo adjunto'}
              </option>
              {archivos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={pagado} onChange={(e) => setPagado(e.target.checked)} />
            Ya está pagado
          </label>
          <Btn variante="primario" onClick={agregar}>+ Registrar movimiento</Btn>
          {error && <span className="text-sm text-[var(--color-alerta)]">{error}</span>}
        </div>
      </Card>

      {/* Movimientos */}
      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <SectionTitle>Movimientos</SectionTitle>
          <select
            className="mb-3 rounded border border-[var(--borde)] bg-[var(--panel)] px-2 py-1 text-sm"
            value={filtroMes}
            onChange={(e) => setFiltroMes(e.target.value)}
          >
            <option value="todos">Todos los meses</option>
            {meses.map((m) => (
              <option key={m} value={m}>
                {nombreMes(m)}
              </option>
            ))}
          </select>
        </div>
        {visibles.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--texto-2)]">
            Sin movimientos {filtroMes !== 'todos' ? 'en ' + nombreMes(filtroMes) : 'todavía'}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={th}>Fecha</th>
                  <th className={th}>Detalle</th>
                  <th className={th}>Factura</th>
                  <th className={th}>Pagó</th>
                  <th className={th + ' text-right'}>Monto</th>
                  <th className={th}>Pagado</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((m) => {
                  const link = linkFactura(m);
                  return (
                    <tr key={m.id}>
                      <td className={td + ' whitespace-nowrap tabular-nums'}>{fmtFechaCorta(m.fecha)}</td>
                      <td className={td}>
                        <div>{m.descripcion}</div>
                        {m.comercio && (
                          <div className="text-xs text-[var(--texto-2)]">{m.comercio}</div>
                        )}
                      </td>
                      <td className={td + ' whitespace-nowrap'}>
                        {link ? (
                          <a
                            className="text-[var(--color-sud-azul)] underline-offset-2 hover:underline"
                            href={link}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {m.facturaTipo && m.facturaTipo !== 'sin' ? `Fact. ${m.facturaTipo}` : 'Factura'} ↗
                          </a>
                        ) : m.facturaTipo && m.facturaTipo !== 'sin' ? (
                          `Fact. ${m.facturaTipo}`
                        ) : (
                          <span className="text-[var(--texto-2)]">—</span>
                        )}
                      </td>
                      <td className={td}>{m.pagadoPor || '—'}</td>
                      <td
                        className={
                          td +
                          ' whitespace-nowrap text-right tabular-nums ' +
                          (m.tipo === 'ingreso' ? 'text-[var(--color-ok)]' : '')
                        }
                      >
                        {m.tipo === 'ingreso' ? '+' : '−'} {money(m.monto)}
                      </td>
                      <td className={td}>
                        <button onClick={() => togglePagado(m.id)} title="Cambiar estado de pago">
                          {m.pagado ? <Badge tono="ok">pagado</Badge> : <Badge tono="alerta">debe</Badge>}
                        </button>
                      </td>
                      <td className={td + ' text-right'}>
                        <button
                          className="text-[var(--texto-2)] hover:text-[var(--color-alerta)]"
                          title="Borrar movimiento"
                          onClick={() => borrar(m)}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Resumen por comercio / proveedor */}
      <Card className="p-4">
        <SectionTitle>Por comercio / proveedor</SectionTitle>
        {resumen.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--texto-2)]">
            Cargá el comercio en los egresos (o el proveedor en Compras) para ver acá cuánto se
            le lleva pagado a cada uno.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={th}>Comercio</th>
                <th className={th + ' text-right'}>Mov. caja</th>
                <th className={th + ' text-right'}>Pedidos</th>
                <th className={th + ' text-right'}>Total</th>
              </tr>
            </thead>
            <tbody>
              {resumen.map((r) => (
                <tr key={r.nombre.toLowerCase()}>
                  <td className={td}>{r.nombre}</td>
                  <td className={td + ' text-right tabular-nums'}>
                    {r.movs > 0 ? `${r.movs} · ${money(r.totalCaja)}` : '—'}
                  </td>
                  <td className={td + ' text-right tabular-nums'}>
                    {r.pedidos > 0 ? `${r.pedidos} · ${money(r.totalCompras)}` : '—'}
                  </td>
                  <td className={td + ' text-right font-medium tabular-nums'}>{money(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
