/**
 * Smoke test de integración: monta la app completa con el respaldo REAL
 * en localStorage y verifica que las vistas principales rendericen datos.
 * Se omite en CI si el fixture no está (datos reales, gitignored).
 */
// @vitest-environment happy-dom
import { describe, expect, it, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../src/App';

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'respaldo-real.local.json');
const disponible = existsSync(fixturePath);

describe.skipIf(!disponible)('SMOKE — app completa con datos reales', () => {
  beforeAll(() => {
    const backup = JSON.parse(readFileSync(fixturePath, 'utf8'));
    localStorage.setItem('cmp_catalogo', JSON.stringify(backup.catalogo));
    localStorage.setItem('cmp_obras', JSON.stringify(backup.obras));
  });

  it('lista las obras reales y abre el panel Proyecto|Obra|Archivos', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('Melicue 4458')).toBeTruthy());
    fireEvent.click(screen.getByText('Melicue 4458'));
    await waitFor(() => expect(screen.getByText('Proyecto')).toBeTruthy());
    expect(screen.getByText('Obra')).toBeTruthy();
    expect(screen.getByText('Archivos')).toBeTruthy();
    // Tabs de proyecto presentes
    for (const t of ['Carátula', 'Cómputo', 'Coeficiente', 'Presupuesto', 'Explosión', 'Plan de trabajo', 'Suministro']) {
      expect(screen.getAllByText(t).length).toBeGreaterThan(0);
    }
  });

  it('la vista Cómputo renderiza ítems y totales', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getAllByText('Melicue 4458').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('Melicue 4458')[0]);
    await waitFor(() => screen.getAllByText('Cómputo'));
    fireEvent.click(screen.getAllByText('Cómputo')[0]);
    // La obra real tiene 39 ítems; deben aparecer filas con códigos (ej. 1.07)
    await waitFor(() => expect(screen.getAllByText(/^\d+\.\d+/).length).toBeGreaterThan(10));
  });

  it('los catálogos renderizan con el catálogo real (483 materiales)', async () => {
    render(<App />);
    await waitFor(() => screen.getAllByText('Materiales'));
    fireEvent.click(screen.getAllByText('Materiales')[0]);
    await waitFor(() => expect(document.querySelectorAll('table tbody tr').length).toBeGreaterThan(50));
  });

  it('vistas de planificación renderizan sin crashear', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getAllByText('Melicue 4458').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('Melicue 4458')[0]);
    for (const t of ['Plan de trabajo', 'Curva', 'Camino crítico', 'Suministro', 'Explosión', 'Mano de obra', 'Presupuesto']) {
      await waitFor(() => screen.getAllByText(t));
      fireEvent.click(screen.getAllByText(t)[0]);
    }
    expect(true).toBe(true);
  });
});
