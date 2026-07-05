/**
 * COMPRAS de obra (H8a) — saldo REGRESIVO por material: computado con
 * desperdicio (materialesTotalObra) − pedidos acumulados. El proveedor
 * sale de la adjudicación de la Comparativa (obra.proveedores /
 * cotizacionesPorRubro); si no hay, se escribe libre por pedido.
 * Al cargar un pedido con precio se puede registrar el egreso en Caja
 * (movimiento vinculado por id determinístico: no se duplica).
 */
import { useMemo, useState } from 'react';
import {
  UMBRAL_DESVIO_PRECIO,
  desvioPrecioPct,
  fmtN,
  idMovimientoCompra,
  money,
  movimientoDeCompra,
  saldosCompras,
  uid
} from '../../core';
import type { CompraMaterial, Motor, MovimientoCaja, Obra, SaldoMaterial } from '../../core';
import { Badge, Btn, Card, SectionTitle, td, th } from '../../ui/base';

const hoyISO = () => new Date().toISOString().slice(0, 10);

const inputCls =
  'w-full rounded border border-[var(--borde)] bg-[var(--panel)] px-2 py-1.5 text-sm ' +
  'focus:outline-2 focus:outline-[var(--color-sud-azul)]';

function fmtFechaCorta(iso: string): string {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return a && m && d ? `${d}/${m}/${a.slice(2)}` : iso;
}

function BadgeEstado({ s }: { s: SaldoMaterial }) {
  if (s.estado === 'excedido') return <Badge tono="alerta">Excedido</Badge>;
  if (s.estado === 'por agotarse') return <Badge tono="info">Por agotarse</Badge>;
  return <Badge tono="ok">OK</Badge>;
}

/** Alta de un pedido para un material (fila expandida). */
function AltaPedido({
  saldo,
  onAgregar
}: {
  saldo: SaldoMaterial;
  onAgregar: (compra: CompraMaterial, registrarEnCaja: boolean) => void;
}) {
  const [fecha, setFecha] = useState(hoyISO());
  const [cantidad, setCantidad] = useState('');
  const [precio, setPrecio] = useState('');
  const [proveedor, setProveedor] = useState(saldo.proveedor);
  const [remito, setRemito] = useState('');
  const [facturaLink, setFacturaLink] = useState('');
  const [nota, setNota] = useState('');
  const [enCaja, setEnCaja] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const nPrecio = Number(precio) || 0;
  const desvio = desvioPrecioPct(nPrecio, saldo.precioPresupuestado);

  const agregar = () => {
    const n = Number(cantidad) || 0;
    if (n <= 0) {
      setError('Indicá la cantidad pedida (mayor a 0).');
      return;
    }
    const c: CompraMaterial = { id: uid(), fecha: fecha || hoyISO(), matCod: saldo.matCod, cantidad: n };
    if (nPrecio > 0) c.precioUnit = nPrecio;
    if (proveedor.trim()) c.proveedor = proveedor.trim();
    if (remito.trim()) c.remito = remito.trim();
    if (facturaLink.trim()) c.facturaLink = facturaLink.trim();
    if (nota.trim()) c.nota = nota.trim();
    onAgregar(c, enCaja && nPrecio > 0);
    setCantidad('');
    setPrecio('');
    setRemito('');
    setFacturaLink('');
    setNota('');
    setError(null);
  };

  return (
    <div className="rounded-md border border-dashed border-[var(--borde)] p-3">
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-[var(--texto-2)]">Fecha</span>
          <input className={inputCls} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-[var(--texto-2)]">Cantidad ({saldo.unidad || 'un'}) *</span>
          <input
            className={inputCls + ' tabular-nums'}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-[var(--texto-2)]">Precio unit. real</span>
          <input
            className={
              inputCls +
              ' tabular-nums' +
              (nPrecio > 0 && Math.abs(desvio) > UMBRAL_DESVIO_PRECIO
                ? ' border-[var(--color-alerta)] text-[var(--color-alerta)]'
                : '')
            }
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={precio}
            placeholder={saldo.precioPresupuestado > 0 ? `presup. ${money(saldo.precioPresupuestado)}` : ''}
            onChange={(e) => setPrecio(e.target.value)}
          />
          {nPrecio > 0 && Math.abs(desvio) > UMBRAL_DESVIO_PRECIO && (
            <span className="mt-0.5 block text-[11px] text-[var(--color-alerta)]">
              {desvio > 0 ? '+' : ''}
              {desvio.toFixed(0)}% vs presupuestado
            </span>
          )}
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-[var(--texto-2)]">Proveedor</span>
          <input className={inputCls} value={proveedor} onChange={(e) => setProveedor(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-[var(--texto-2)]">Remito</span>
          <input className={inputCls} value={remito} onChange={(e) => setRemito(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-[var(--texto-2)]">Link factura</span>
          <input
            className={inputCls}
            value={facturaLink}
            placeholder="Drive u otro"
            onChange={(e) => setFacturaLink(e.target.value)}
          />
        </label>
        <label className="block text-sm sm:col-span-3 lg:col-span-6">
          <span className="mb-1 block text-xs text-[var(--texto-2)]">Nota</span>
          <input className={inputCls} value={nota} onChange={(e) => setNota(e.target.value)} />
        </label>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        <label
          className={'flex items-center gap-2 text-sm ' + (nPrecio > 0 ? '' : 'opacity-50')}
          title={nPrecio > 0 ? '' : 'Cargá el precio para poder registrar el egreso'}
        >
          <input
            type="checkbox"
            checked={enCaja && nPrecio > 0}
            disabled={nPrecio <= 0}
            onChange={(e) => setEnCaja(e.target.checked)}
          />
          Registrar egreso en Caja {nPrecio > 0 && `(${money((Number(cantidad) || 0) * nPrecio)})`}
        </label>
        <Btn variante="primario" onClick={agregar}>+ Cargar pedido</Btn>
        {error && <span className="text-sm text-[var(--color-alerta)]">{error}</span>}
      </div>
    </div>
  );
}

export function ObraCompras({
  obra,
  setObra,
  motor
}: {
  obra: Obra;
  setObra: (o: Obra) => void;
  motor: Motor;
}) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const saldos = useMemo(() => saldosCompras(obra, motor), [obra, motor]);

  const agregarPedido = (compra: CompraMaterial, registrarEnCaja: boolean, matDesc: string, unidad: string) => {
    const compras: CompraMaterial[] = [...(Array.isArray(obra.compras) ? obra.compras : []), compra];
    const patch: Partial<Obra> = { compras };
    if (registrarEnCaja) {
      const caja: MovimientoCaja[] = Array.isArray(obra.caja) ? obra.caja : [];
      patch.caja = [movimientoDeCompra(compra, matDesc, unidad), ...caja];
    }
    setObra({ ...obra, ...patch });
  };

  const borrarPedido = (c: CompraMaterial) => {
    if (!confirm(`¿Borrar el pedido del ${fmtFechaCorta(c.fecha)} (${fmtN(c.cantidad)})? Si generó un egreso en Caja, también se borra.`)) return;
    const compras = (Array.isArray(obra.compras) ? obra.compras : []).filter((x) => x.id !== c.id);
    const caja = (Array.isArray(obra.caja) ? (obra.caja as MovimientoCaja[]) : []).filter(
      (m) => m.id !== idMovimientoCompra(c.id)
    );
    setObra({ ...obra, compras, caja });
  };

  if (saldos.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-[var(--texto-2)]">
        Sin materiales computados: cargá ítems con APU en el cómputo (fase PROYECTO) para
        seguir acá el saldo de compras.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <SectionTitle>Saldo de materiales (regresivo)</SectionTitle>
        <p className="mb-3 text-xs text-[var(--texto-2)]">
          Computado = cantidad con desperdicio del cómputo. A medida que cargás pedidos, el
          saldo baja: así se ve cuánto falta pedir de cada material y si algo se excedió.
          Tocá un material para ver el historial y cargar un pedido.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={th}>Material</th>
                <th className={th}>Proveedor</th>
                <th className={th + ' text-right'}>Computado</th>
                <th className={th + ' text-right'}>Pedido</th>
                <th className={th + ' text-right'}>Saldo</th>
                <th className={th + ' text-right'}>%</th>
                <th className={th}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {saldos.map((s) => {
                const conDesvio = s.precioRealMedio > 0 && Math.abs(s.desvioPct) > UMBRAL_DESVIO_PRECIO;
                return [
                  <tr
                    key={s.matCod}
                    className="cursor-pointer hover:bg-[var(--color-neutro-100)] dark:hover:bg-[var(--color-neutro-800)]"
                    onClick={() => setAbierto(abierto === s.matCod ? null : s.matCod)}
                  >
                    <td className={td}>
                      <span className="mr-1 text-xs text-[var(--texto-2)]">{abierto === s.matCod ? '▾' : '▸'}</span>
                      <span className="font-medium">{s.matDesc}</span>
                      <span className="ml-1 text-xs text-[var(--texto-2)]">{s.matCod}</span>
                      {conDesvio && (
                        <span className="ml-2 text-xs font-medium text-[var(--color-alerta)]">
                          precio {s.desvioPct > 0 ? '+' : ''}
                          {s.desvioPct.toFixed(0)}%
                        </span>
                      )}
                    </td>
                    <td className={td + ' text-xs'}>{s.proveedor || '—'}</td>
                    <td className={td + ' text-right tabular-nums'}>
                      {fmtN(s.computado)} <span className="text-xs text-[var(--texto-2)]">{s.unidad}</span>
                    </td>
                    <td className={td + ' text-right tabular-nums'}>{fmtN(s.pedido)}</td>
                    <td
                      className={
                        td +
                        ' text-right font-semibold tabular-nums' +
                        (s.saldo < 0 ? ' text-[var(--color-alerta)]' : '')
                      }
                    >
                      {fmtN(s.saldo)}
                    </td>
                    <td className={td + ' text-right tabular-nums'}>
                      {s.computado > 0 ? s.pctConsumido.toFixed(0) + '%' : '—'}
                    </td>
                    <td className={td}>
                      <BadgeEstado s={s} />
                    </td>
                  </tr>,
                  abierto === s.matCod ? (
                    <tr key={s.matCod + '-det'}>
                      <td className={td} colSpan={7}>
                        <div className="space-y-3 py-1">
                          {s.compras.length > 0 && (
                            <table className="w-full text-xs">
                              <thead>
                                <tr>
                                  <th className={th}>Fecha</th>
                                  <th className={th + ' text-right'}>Cantidad</th>
                                  <th className={th + ' text-right'}>Precio unit.</th>
                                  <th className={th}>Proveedor</th>
                                  <th className={th}>Remito</th>
                                  <th className={th}>Factura</th>
                                  <th className={th}>Nota</th>
                                  <th className={th}></th>
                                </tr>
                              </thead>
                              <tbody>
                                {s.compras.map((c) => {
                                  const dv = desvioPrecioPct(Number(c.precioUnit) || 0, s.precioPresupuestado);
                                  const rojo = (Number(c.precioUnit) || 0) > 0 && Math.abs(dv) > UMBRAL_DESVIO_PRECIO;
                                  return (
                                    <tr key={c.id}>
                                      <td className={td + ' tabular-nums'}>{fmtFechaCorta(c.fecha)}</td>
                                      <td className={td + ' text-right tabular-nums'}>{fmtN(c.cantidad)}</td>
                                      <td
                                        className={
                                          td +
                                          ' text-right tabular-nums' +
                                          (rojo ? ' font-medium text-[var(--color-alerta)]' : '')
                                        }
                                        title={rojo ? `${dv > 0 ? '+' : ''}${dv.toFixed(0)}% vs presupuestado` : ''}
                                      >
                                        {c.precioUnit ? money(c.precioUnit) : '—'}
                                      </td>
                                      <td className={td}>{c.proveedor || '—'}</td>
                                      <td className={td}>{c.remito || '—'}</td>
                                      <td className={td}>
                                        {c.facturaLink ? (
                                          <a
                                            className="text-[var(--color-sud-azul)] underline-offset-2 hover:underline"
                                            href={c.facturaLink}
                                            target="_blank"
                                            rel="noreferrer"
                                          >
                                            ver ↗
                                          </a>
                                        ) : (
                                          '—'
                                        )}
                                      </td>
                                      <td className={td}>{c.nota || ''}</td>
                                      <td className={td + ' text-right'}>
                                        <button
                                          className="text-[var(--texto-2)] hover:text-[var(--color-alerta)]"
                                          title="Borrar pedido"
                                          onClick={() => borrarPedido(c)}
                                        >
                                          ✕
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-[var(--texto-2)]">
                            <span>
                              Presupuestado: <b className="tabular-nums">{money(s.precioPresupuestado)}</b>/{s.unidad || 'un'}
                            </span>
                            {s.precioRealMedio > 0 && (
                              <span>
                                Real medio:{' '}
                                <b className={'tabular-nums' + (conDesvio ? ' text-[var(--color-alerta)]' : '')}>
                                  {money(s.precioRealMedio)}
                                </b>
                                /{s.unidad || 'un'}
                              </span>
                            )}
                            <span>
                              Costo real acumulado: <b className="tabular-nums">{money(s.costoReal)}</b> (presup.{' '}
                              {money(s.costoPresupuestado)})
                            </span>
                          </div>
                          <AltaPedido
                            saldo={s}
                            onAgregar={(c, reg) => agregarPedido(c, reg, s.matDesc, s.unidad)}
                          />
                        </div>
                      </td>
                    </tr>
                  ) : null
                ];
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
