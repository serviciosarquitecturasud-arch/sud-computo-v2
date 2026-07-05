/**
 * Atajos de teclado globales (H5):
 * Ctrl/Cmd+K → paleta de comandos · Ctrl/Cmd+Z → deshacer global
 * (salvo foco en campo de texto: ahí manda el undo nativo) · g luego o → Obras.
 */
import { useEffect, useRef } from 'react';

export interface Atajos {
  onPaleta: () => void;
  onDeshacer: () => void;
  onIrObras?: () => void;
}

/** ¿El evento nació en un campo editable? (input/textarea/select/contentEditable) */
function esCampoTexto(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}

export function useAtajos(atajos: Atajos): void {
  const ref = useRef(atajos);
  ref.current = atajos;
  const ultimaG = useRef(0);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'k') {
        e.preventDefault();
        ref.current.onPaleta();
        return;
      }
      if (mod && !e.shiftKey && !e.altKey && k === 'z') {
        if (esCampoTexto(e.target)) return; // el usuario edita texto: undo nativo
        e.preventDefault();
        ref.current.onDeshacer();
        return;
      }
      // Secuencia "g o" (ir a Obras), solo fuera de campos de texto
      if (!mod && !e.altKey && !esCampoTexto(e.target)) {
        if (k === 'g') {
          ultimaG.current = Date.now();
          return;
        }
        if (k === 'o' && Date.now() - ultimaG.current < 800) {
          ultimaG.current = 0;
          ref.current.onIrObras?.();
        }
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
}
