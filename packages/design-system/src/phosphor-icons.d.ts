declare module '@phosphor-icons/react' {
  import type { ComponentType, SVGProps } from 'react';

  export type IconWeight = 'bold' | 'duotone' | 'fill' | 'light' | 'regular' | 'thin';

  export interface IconProps extends SVGProps<SVGSVGElement> {
    readonly mirrored?: boolean;
    readonly size?: number | string;
    readonly weight?: IconWeight;
  }

  type IconComponent = ComponentType<IconProps>;

  export const AppWindow: IconComponent;
  export const ArrowCounterClockwise: IconComponent;
  export const ArrowRight: IconComponent;
  export const BatteryCharging: IconComponent;
  export const Bell: IconComponent;
  export const Browsers: IconComponent;
  export const CaretLeft: IconComponent;
  export const CaretRight: IconComponent;
  export const ChartLineUp: IconComponent;
  export const CheckCircle: IconComponent;
  export const CircleNotch: IconComponent;
  export const Circuitry: IconComponent;
  export const ClockCounterClockwise: IconComponent;
  export const Code: IconComponent;
  export const Cpu: IconComponent;
  export const Crosshair: IconComponent;
  export const CrownSimple: IconComponent;
  export const Database: IconComponent;
  export const DesktopTower: IconComponent;
  export const DownloadSimple: IconComponent;
  export const GameController: IconComponent;
  export const Gauge: IconComponent;
  export const GearFine: IconComponent;
  export const Globe: IconComponent;
  export const GraphicsCard: IconComponent;
  export const HardDrives: IconComponent;
  export const Info: IconComponent;
  export const Key: IconComponent;
  export const Lightning: IconComponent;
  export const Link: IconComponent;
  export const ListChecks: IconComponent;
  export const LockKey: IconComponent;
  export const MagnifyingGlass: IconComponent;
  export const Memory: IconComponent;
  export const MinusCircle: IconComponent;
  export const Monitor: IconComponent;
  export const Network: IconComponent;
  export const Package: IconComponent;
  export const Palette: IconComponent;
  export const PlugsConnected: IconComponent;
  export const Power: IconComponent;
  export const Pulse: IconComponent;
  export const PushPin: IconComponent;
  export const RocketLaunch: IconComponent;
  export const Scan: IconComponent;
  export const ShieldCheck: IconComponent;
  export const SignOut: IconComponent;
  export const SlidersHorizontal: IconComponent;
  export const Sparkle: IconComponent;
  export const Star: IconComponent;
  export const Storefront: IconComponent;
  export const Thermometer: IconComponent;
  export const Timer: IconComponent;
  export const Toolbox: IconComponent;
  export const Trash: IconComponent;
  export const Usb: IconComponent;
  export const UserCircle: IconComponent;
  export const Warning: IconComponent;
  export const Waveform: IconComponent;
  export const WifiHigh: IconComponent;
  export const WindowsLogo: IconComponent;
  export const X: IconComponent;
}
