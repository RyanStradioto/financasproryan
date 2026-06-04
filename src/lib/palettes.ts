/**
 * Color palettes the user can pick in Settings.
 *
 * The actual CSS variable overrides live in index.css under
 * `html[data-palette="<id>"]` (light) and `html[data-palette="<id>"].dark`.
 * Here we only keep metadata for the picker UI (name + preview swatches).
 *
 * `id: 'default'` removes the data-palette attribute (uses the base theme).
 */

export type PaletteId =
  | 'default' | 'purple' | 'crimson' | 'forest' | 'noir' | 'mono'
  | 'sunset' | 'neon' | 'indigo' | 'periwinkle' | 'caramel' | 'lagoon';

export interface PaletteMeta {
  id: PaletteId;
  name: string;
  description: string;
  /** Swatch colors for the preview chip (dark → light), purely cosmetic. */
  swatches: string[];
}

export const PALETTES: PaletteMeta[] = [
  {
    id: 'default',
    name: 'Padrão',
    description: 'Esmeralda — o tema original do app',
    swatches: ['#065f46', '#10b981', '#34d399', '#a7f3d0', '#ecfdf5'],
  },
  {
    id: 'purple',
    name: 'Roxo',
    description: 'Tons de violeta elegante',
    swatches: ['#49225B', '#6E3482', '#A56ABD', '#E7DBEF', '#F5EBFA'],
  },
  {
    id: 'crimson',
    name: 'Vinho',
    description: 'Bordô e rosa intenso',
    swatches: ['#800021', '#881144', '#C2185B', '#F48FB1', '#FCE4EC'],
  },
  {
    id: 'forest',
    name: 'Floresta',
    description: 'Verde-azulado profundo',
    swatches: ['#051F20', '#163832', '#235347', '#8EB69B', '#DAF1DE'],
  },
  {
    id: 'noir',
    name: 'Noir',
    description: 'Vermelho carmesim sobre preto',
    swatches: ['#02060E', '#3a0a14', '#C50337', '#ff5a7a', '#ffe0e6'],
  },
  {
    id: 'mono',
    name: 'Grafite',
    description: 'Preto e branco minimalista',
    swatches: ['#1a1c1e', '#4b4f54', '#8a9099', '#c7ccd1', '#f4f6f8'],
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Laranja e âmbar quentes',
    swatches: ['#7a2e08', '#EA6113', '#F88F22', '#FBB931', '#FFE3B3'],
  },
  {
    id: 'neon',
    name: 'Neon',
    description: 'Verde-limão vibrante no preto',
    swatches: ['#0F0F0F', '#202020', '#337418', '#5DD62C', '#F8F8F8'],
  },
  {
    id: 'indigo',
    name: 'Índigo',
    description: 'Azul-violeta elétrico',
    swatches: ['#060416', '#130C49', '#1F137D', '#5C21C3', '#874AD7'],
  },
  {
    id: 'periwinkle',
    name: 'Pervinca',
    description: 'Azul e lavanda das águas-vivas',
    swatches: ['#0E155E', '#206ABC', '#7997E6', '#B37AD4', '#CAA9F3'],
  },
  {
    id: 'caramel',
    name: 'Caramelo',
    description: 'Terracota e caramelo quente',
    swatches: ['#45151B', '#C74E51', '#F99256', '#EA9DAE', '#FBDE9C'],
  },
  {
    id: 'lagoon',
    name: 'Lagoa',
    description: 'Teal e rosa pastel de praia',
    swatches: ['#6BB1AD', '#A7BCBD', '#EDECDB', '#E5A9A9', '#E6748E'],
  },
];

export const PALETTE_STORAGE_KEY = 'financaspro_palette';

/** Reads the saved palette id (defaults to 'default'). */
export function getStoredPalette(): PaletteId {
  try {
    const v = localStorage.getItem(PALETTE_STORAGE_KEY);
    if (v && PALETTES.some((p) => p.id === v)) return v as PaletteId;
  } catch { /* ignore */ }
  return 'default';
}

/** Applies a palette by setting/removing the data-palette attribute on <html>. */
export function applyPalette(id: PaletteId) {
  const root = document.documentElement;
  if (id === 'default') {
    root.removeAttribute('data-palette');
  } else {
    root.setAttribute('data-palette', id);
  }
}
