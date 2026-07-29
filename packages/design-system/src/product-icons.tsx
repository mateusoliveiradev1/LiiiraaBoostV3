import {
  Activity,
  ArrowRight,
  AppWindow,
  AudioLines,
  BadgeCheck,
  Bell,
  ChartSpline,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  CircleMinus,
  Crown,
  Cpu,
  Crosshair,
  Database,
  Gamepad2,
  Gauge,
  History,
  KeyRound,
  Languages,
  Laptop,
  LockKeyhole,
  LogOut,
  MemoryStick,
  Microchip,
  Monitor,
  Network,
  Pin,
  UserRound,
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
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';

const PRODUCT_ICONS = Object.freeze({
  activity: Activity,
  arrowRight: ArrowRight,
  app: AppWindow,
  audio: AudioLines,
  bell: Bell,
  check: BadgeCheck,
  chart: ChartSpline,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  crown: Crown,
  cpu: Cpu,
  crosshair: Crosshair,
  database: Database,
  device: Laptop,
  game: Gamepad2,
  gauge: Gauge,
  history: History,
  info: CircleHelp,
  key: KeyRound,
  languages: Languages,
  lock: LockKeyhole,
  logout: LogOut,
  memory: MemoryStick,
  microchip: Microchip,
  minus: CircleMinus,
  monitor: Monitor,
  network: Network,
  pin: Pin,
  profile: UserRound,
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
  close: X,
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
