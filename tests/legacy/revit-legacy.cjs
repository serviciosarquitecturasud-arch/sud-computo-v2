// EXTRACCIÓN VERBATIM del index.html legacy (producción) — funciones Revit.
// NO EDITAR: es la referencia de los tests de paridad del import Revit.
"use strict";

const REVIT_SCHEMA_VERSION = '1.1';
const REVIT_SCHEMA_ACEPTADAS = ['1.0', '1.1'];
const REVIT_CATS_MVP = ['Walls', 'Doors', 'Windows', 'Floors'];

function validateRevitPayload(parsed) {
  const errs = [];
  const warns = [];
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { errs: ['El JSON raíz debe ser un objeto con metadata y elementos.'], warns: [] };
  }
  const m = parsed.metadata;
  let version = null;
  if (!m || typeof m !== 'object') {
    errs.push('Falta el bloque "metadata".');
  } else {
    if (REVIT_SCHEMA_ACEPTADAS.indexOf(m.schemaVersion) < 0) {
      errs.push(`metadata.schemaVersion debe ser una de: ${REVIT_SCHEMA_ACEPTADAS.join(', ')} (recibido: "${m.schemaVersion}").`);
    } else {
      version = m.schemaVersion;
      if (version === '1.0') {
        warns.push('Schema v1.0 obsoleto. Se acepta por compatibilidad pero no permite vinculación robusta obra ↔ archivo (todos los archivos Revit con el mismo nombre quedan indistinguibles). Migrar a v1.1 con documentoHostRuta.');
      }
    }
    ['fecha', 'proyecto', 'documentoHost'].forEach(k => {
      if (typeof m[k] !== 'string' || !m[k]) errs.push(`Falta metadata.${k} (string).`);
    });
    if (version === '1.1') {
      if (typeof m.documentoHostRuta !== 'string' || !m.documentoHostRuta) {
        errs.push('Falta metadata.documentoHostRuta (string, ruta completa del archivo Revit). Es requerido en schema v1.1.');
      }
    }
    if (!Array.isArray(m.documentosLinkeados)) {
      errs.push('metadata.documentosLinkeados debe ser un array (puede estar vacío).');
    }
  }
  if (!Array.isArray(parsed.elementos)) {
    errs.push('Falta el array "elementos".');
    return { errs, warns };
  }
  if (parsed.elementos.length === 0) {
    errs.push('El array "elementos" está vacío.');
    return { errs, warns };
  }
  const reqFields = ['uid', 'id', 'documento', 'categoria', 'tipo', 'magnitudes'];
  const uidSet = new Set();
  parsed.elementos.forEach((el, i) => {
    if (!el || typeof el !== 'object' || Array.isArray(el)) {
      errs.push(`elementos[${i}] no es un objeto.`);
      return;
    }
    reqFields.forEach(f => {
      const v = el[f];
      if (v === undefined || v === null || v === '') {
        errs.push(`elementos[${i}] no tiene "${f}".`);
      }
    });
    if (typeof el.uid === 'string' && el.uid) {
      if (uidSet.has(el.uid)) errs.push(`elementos[${i}] uid duplicado: "${el.uid}".`);
      uidSet.add(el.uid);
    }
    if (el.magnitudes !== undefined && (typeof el.magnitudes !== 'object' || Array.isArray(el.magnitudes))) {
      errs.push(`elementos[${i}].magnitudes debe ser un objeto.`);
    } else if (el.magnitudes && Object.keys(el.magnitudes).length === 0) {
      errs.push(`elementos[${i}].magnitudes no tiene ninguna magnitud.`);
    } else if (el.magnitudes) {
      Object.keys(el.magnitudes).forEach(k => {
        const v = el.magnitudes[k];
        if (typeof v !== 'number' || !Number.isFinite(v)) {
          errs.push(`elementos[${i}].magnitudes.${k} debe ser un número finito (recibido: ${JSON.stringify(v)}).`);
        } else if (v < 0) {
          errs.push(`elementos[${i}].magnitudes.${k} no puede ser negativo (recibido: ${v}).`);
        }
      });
    }
  });
  // Cross-checks de consistencia entre metadata y contenido real (sólo warnings)
  if (m && typeof m === 'object') {
    if (m.totalElementos !== undefined) {
      if (typeof m.totalElementos !== 'number' || !Number.isFinite(m.totalElementos)) {
        warns.push(`metadata.totalElementos debería ser un número (recibido: ${JSON.stringify(m.totalElementos)}). Se ignora para el cross-check.`);
      } else if (m.totalElementos !== parsed.elementos.length) {
        warns.push(`metadata.totalElementos declara ${m.totalElementos} pero el array "elementos" tiene ${parsed.elementos.length}. Posible export parcial o corrupción del JSON.`);
      }
    }
    if (m.categoriasIncluidas !== undefined) {
      if (!Array.isArray(m.categoriasIncluidas)) {
        warns.push(`metadata.categoriasIncluidas debería ser un array (recibido: ${typeof m.categoriasIncluidas}). Se ignora para el cross-check.`);
      } else {
        const catsDeclaradas = new Set(m.categoriasIncluidas);
        const catsReales = new Set();
        parsed.elementos.forEach(el => { if (el && typeof el.categoria === 'string') catsReales.add(el.categoria); });
        const noDeclaradas = [];
        catsReales.forEach(c => { if (!catsDeclaradas.has(c)) noDeclaradas.push(c); });
        if (noDeclaradas.length > 0) {
          warns.push(`Hay categorías en elementos[] que no figuran en metadata.categoriasIncluidas: ${noDeclaradas.join(', ')}. Metadata inconsistente.`);
        }
      }
    }
  }
  return { errs, warns };
}

function magnitudParaUnidad(unidad) {
  const u = (unidad || '').toString().toLowerCase().trim();
  if (u === 'm²' || u === 'm2') return 'area_m2';
  if (u === 'm³' || u === 'm3') return 'volumen_m3';
  if (u === 'ml' || u === 'm') return 'longitud_m';
  if (u === 'un' || u === 'u') return '__count__';
  if (u === 'kg') return 'peso_kg';
  if (u === 'gl') return '__count__';
  return null;
}

module.exports = { REVIT_SCHEMA_VERSION, REVIT_SCHEMA_ACEPTADAS, REVIT_CATS_MVP, validateRevitPayload, magnitudParaUnidad };
