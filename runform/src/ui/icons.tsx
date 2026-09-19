import type { SVGProps } from 'react';

/** Iconos de trazo (estilo Lucide), 24x24, sin dependencias. */
const PATHS: Record<string, string> = {
  // navegación
  video: 'M15 10l4.55-2.28A1 1 0 0 1 21 8.62v6.76a1 1 0 0 1-1.45.9L15 14M3 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  chart: 'M3 3v18h18M7 14l4-4 4 4 5-6',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5V4.5A2.5 2.5 0 0 1 6.5 2H20v15H6.5A2.5 2.5 0 0 0 4 19.5z',
  // grupos de métricas
  gauge: 'M12 14l3.5-3.5M20.2 17A8 8 0 1 0 3.8 17',
  footprints: 'M4 16v-2.4a4 4 0 0 1 8 0V16a2 2 0 0 1-4 0M4 16h8M13 6.5a3.5 3.5 0 1 1 7 0V9a2 2 0 0 1-4 0M13 9h7M7 5.5a1.5 1.5 0 1 0 0 .01M17 15.5a1.5 1.5 0 1 0 0 .01',
  person: 'M12 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM9 8h6l2 6h-2l-1 8h-4l-1-8H7z',
  arm: 'M6 20V9a3 3 0 0 1 3-3h4l4 3-1.5 2L13 9.5V20M9 20h4',
  frontal: 'M12 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 9h12M8 9l-1 6M16 9l1 6M12 9v6l-3 7M12 15l3 7',
  // métricas individuales
  timer: 'M10 2h4M12 14l3-3M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  ground: 'M3 20h18M7 20V8l5-4 5 4v12',
  wind: 'M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2M9.6 4.6A2 2 0 1 1 11 8H2M12.6 19.4A2 2 0 1 0 14 16H2',
  wave: 'M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0',
  lean: 'M12 4a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM10 6l4 1 3 5-2 1-2-3-1 5 2 6h-2l-2-5-2 5H6l3-8-1-4z',
  knee: 'M8 3v7l4 3-3 8M12 13l6 2',
  shin: 'M12 3v9l-4 9M12 12l4 9',
  stride: 'M4 21h16M8 21l3-8 3 3 2-4M10 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  foot: 'M5 15c0-2 1-3 3-3h4c2 0 3-1 3-3V7a3 3 0 0 0-6 0v1M5 15c0 3 2 5 5 5h5a3 3 0 0 0 0-6H5z',
  hip: 'M6 4v6l6 3 6-3V4M12 13v8M8 21h8',
  elbow: 'M6 20V10a4 4 0 0 1 4-4h3M13 6l3 3-2 2-3-3M12 10l-1 10',
  pelvis: 'M4 8h16M6 8l2 8h8l2-8M10 16v5M14 16v5',
  crossover: 'M8 3l8 18M16 3L8 21',
  // acciones y estado
  upload: 'M12 16V4M6 10l6-6 6 6M4 20h16',
  play: 'M6 4l14 8-14 8z',
  save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8',
  trash: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6',
  download: 'M12 4v12M6 10l6 6 6-6M4 20h16',
  check: 'M20 6L9 17l-5-5',
  alert: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  x: 'M18 6L6 18M6 6l12 12',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  legend: 'M4 6h4M4 12h4M4 18h4M12 6h8M12 12h8M12 18h8',
  camera: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  ruler: 'M3 17l14-14 4 4L7 21zM8 12l2 2M11 9l2 2M14 6l2 2',
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
  trend: 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6',
  compare: 'M12 3v18M3 8h6M3 12h6M3 16h6M15 8h6M15 12h6M15 16h6',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
};

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 18,
  ...rest
}: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      <path d={PATHS[name] ?? PATHS.info} />
    </svg>
  );
}
