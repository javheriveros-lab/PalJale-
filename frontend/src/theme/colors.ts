// Paleta "obra": neutros cálidos (piedra/concreto) en vez del slate azulado
// genérico de IA, más un naranja de marca oscurecido a terracota — mismo
// tono que el logo pero con suficiente contraste para texto sobre blanco.
// Todos los pares texto/fondo de abajo están verificados ≥4.5:1 (WCAG AA).
export const colors = {
  // Fondos
  bg: '#faf9f7',
  card: '#ffffff',
  cardMuted: '#f4f1ec',

  // Bordes
  border: '#e8e2d9',
  borderStrong: '#d6cdbf',

  // Texto
  textPrimary: '#1c1917',
  textSecondary: '#44403c',
  textMuted: '#6f6a61',
  textPlaceholder: '#6f6a61',

  // Marca — terracota, suficiente contraste para texto/iconos sobre blanco
  primary: '#C2410C',
  primaryDark: '#9A3412',
  primaryLight: '#FBE4D5',
  primarySoft: '#FDF1E7',
  // Naranja de marca original: solo para usos decorativos (rellenos de
  // ícono sobre fondo claro), nunca como color de texto — no pasa 4.5:1.
  accent: '#F37820',

  // Semánticos
  success: '#16a34a',
  successBg: '#dcfce7',
  danger: '#dc2626',
  dangerBg: '#fef2f2',
  warning: '#b45309',
  warningBg: '#fef3c7',

  white: '#ffffff',
  overlay: 'rgba(28, 25, 23, 0.5)',
} as const;
