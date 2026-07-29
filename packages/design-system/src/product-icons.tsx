import {
  Activity,
  AppWindow,
  AudioLines,
  BadgeCheck,
  ChartSpline,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Crosshair,
  Database,
  Gamepad2,
  Gauge,
  History,
  Languages,
  MemoryStick,
  Microchip,
  Monitor,
  Network,
  Pin,
  Radar,
  RotateCcw,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Thermometer,
  Timer,
  Trash2,
  Usb,
  Zap,
  type LucideIcon,
} from 'lucide-react';

const PRODUCT_ICONS = Object.freeze({
  activity: Activity,
  app: AppWindow,
  audio: AudioLines,
  check: BadgeCheck,
  chart: ChartSpline,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  cpu: Cpu,
  crosshair: Crosshair,
  database: Database,
  game: Gamepad2,
  gauge: Gauge,
  history: History,
  languages: Languages,
  memory: MemoryStick,
  microchip: Microchip,
  monitor: Monitor,
  network: Network,
  pin: Pin,
  radar: Radar,
  recovery: RotateCcw,
  settings: Settings2,
  shield: ShieldCheck,
  sliders: SlidersHorizontal,
  star: Star,
  temperature: Thermometer,
  timer: Timer,
  trash: Trash2,
  usb: Usb,
  zap: Zap,
}) satisfies Readonly<Record<string, LucideIcon>>;

export type ProductIconName = keyof typeof PRODUCT_ICONS;

export interface ProductIconProps {
  readonly className?: string;
  readonly name: ProductIconName;
  readonly size?: number;
}

export const ProductIcon = ({ className, name, size = 20 }: ProductIconProps) => {
  const Icon = PRODUCT_ICONS[name];

  return (
    <span aria-hidden="true" className={['lb-product-icon', className].filter(Boolean).join(' ')}>
      <Icon size={size} strokeWidth={1.75} />
    </span>
  );
};
