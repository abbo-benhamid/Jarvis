import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * Icônes au trait, style lucide (§ 7), reprises du sprite de site/maquette-conso.html.
 * Une icône est décorative : le bouton qui la porte a l'étiquette d'accessibilité.
 */
const shapes = {
  home: (
    <>
      <Path d="M15 21v-7a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v7" />
      <Path d="M3 10a2 2 0 0 1 .7-1.5l7-6a2 2 0 0 1 2.6 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </>
  ),
  book: (
    <>
      <Path d="M12 7v14" />
      <Path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </>
  ),
  calendar: (
    <>
      <Rect width={18} height={18} x={3} y={4} rx={3} />
      <Path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  user: (
    <>
      <Circle cx={12} cy={8} r={4.5} />
      <Path d="M20 21a8 8 0 0 0-16 0" />
    </>
  ),
  check: <Path d="M20 6 9 17l-5-5" />,
  right: <Path d="m9 18 6-6-6-6" />,
  left: <Path d="m15 18-6-6 6-6" />,
  pin: (
    <>
      <Path d="M20 10c0 5-5.5 10.2-7.4 11.8a1 1 0 0 1-1.2 0C9.5 20.2 4 15 4 10a8 8 0 0 1 16 0" />
      <Circle cx={12} cy={10} r={3} />
    </>
  ),
  scan: <Path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10" />,
  phone: (
    <Path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
  ),
  shield: (
    <>
      <Path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z" />
      <Path d="m9 12 2 2 4-4" />
    </>
  ),
  sun: (
    <>
      <Circle cx={12} cy={12} r={4} />
      <Path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4" />
    </>
  ),
  moon: <Path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
  heart: <Path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z" />,
  lock: (
    <>
      <Rect width={18} height={11} x={3} y={11} rx={2.5} />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  clock: (
    <>
      <Circle cx={12} cy={12} r={9.5} />
      <Path d="M12 7v5l3 2" />
    </>
  ),
  flag: (
    <>
      <Path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <Path d="M4 22v-7" />
    </>
  ),
  arrow: <Path d="M5 12h14M13 6l6 6-6 6" />,
  nav: <Path d="M3 11l19-9-9 19-2-8z" />,
  info: (
    <>
      <Circle cx={12} cy={12} r={9.5} />
      <Path d="M12 16v-4M12 8h.01" />
    </>
  ),
  bell: (
    <>
      <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <Path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
    </>
  ),
  minus: <Path d="M6 12h12" />,
  pen: (
    <>
      <Path d="M12 20h9" />
      <Path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
  logout: (
    <>
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <Path d="m16 17 5-5-5-5M21 12H9" />
    </>
  ),
  wallet: (
    <>
      <Path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2" />
      <Path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
    </>
  ),
  key: (
    <>
      <Circle cx={7.5} cy={15.5} r={5.5} />
      <Path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3" />
    </>
  ),
  // L1 : e-mail, carte, arrêt du trajet.
  mail: (
    <>
      <Rect x={2} y={4} width={20} height={16} rx={2} />
      <Path d="m22 7-10 6L2 7" />
    </>
  ),
  map: <Path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2ZM9 4v14M15 6v14" />,
  stop: <Rect x={6} y={6} width={12} height={12} rx={2} />,
} as const;

export type IconName = keyof typeof shapes;

type Props = {
  name: IconName;
  size?: 16 | 18 | 20 | 24;
  color: string;
  strokeWidth?: number;
};

export function Icon({ name, size = 24, color, strokeWidth }: Props) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth ?? (size <= 16 ? 1.8 : 1.6)}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessible={false}
      aria-hidden
    >
      {shapes[name]}
    </Svg>
  );
}
