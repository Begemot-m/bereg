import {
  ArrowsLeftRight,
  BellRinging,
  BookOpen,
  CalendarDots,
  ChartLineUp,
  CheckCircle,
  SealCheck,
  Clock,
  Compass,
  GearSix,
  Heart,
  House,
  MoonStars,
  NotePencil,
  Plus,
  Sparkle,
  SquaresFour,
  Sun,
  User,
  UsersThree,
  VideoCamera,
  MapPin,
  ChartPolar,
  Smiley,
  Pulse,
  FlowerLotus,
  Funnel,
  SlidersHorizontal,
  Star,
  Question,
  PaperPlaneTilt,
  ShareNetwork,
  SignOut,
  LockSimple,
  MapPinLine,
  X,
  Chalkboard,
  Feather,
  TelegramLogo,
  CloudLightning,
  BatteryLow,
  Fire,
  Heartbeat,
  HeartBreak,
  Bandaids,
  Backpack,
  UserFocus,
  Clover,
  WarningCircle,
  Waves,
  Footprints,
  type Icon as PhIcon,
  type IconWeight,
} from "@phosphor-icons/react";

export type IconName =
  | "home"
  | "calendar"
  | "users"
  | "tools"
  | "compass"
  | "user"
  | "plus"
  | "heart"
  | "chart"
  | "spark"
  | "book"
  | "bell"
  | "clock"
  | "check"
  | "seal"
  | "note"
  | "edit"
  | "sun"
  | "moon"
  | "video"
  | "pin"
  | "swap"
  | "gear"
  | "balance"
  | "mood"
  | "pulse"
  | "therapy"
  | "filter"
  | "sort"
  | "star"
  | "question"
  | "telegram"
  | "share"
  | "exit"
  | "lock"
  | "route"
  | "close"
  | "chalkboard"
  | "angel"
  | "telegram-logo"
  | "storm"
  | "battery"
  | "fire"
  | "heartbeat"
  | "heartbreak"
  | "bandaid"
  | "backpack"
  | "self"
  | "clover"
  | "warn"
  | "waves"
  | "steps";

const MAP: Record<IconName, PhIcon> = {
  home: House,
  calendar: CalendarDots,
  users: UsersThree,
  tools: SquaresFour,
  compass: Compass,
  user: User,
  plus: Plus,
  heart: Heart,
  chart: ChartLineUp,
  spark: Sparkle,
  book: BookOpen,
  bell: BellRinging,
  clock: Clock,
  check: CheckCircle,
  seal: SealCheck,
  note: NotePencil,
  edit: NotePencil,
  sun: Sun,
  moon: MoonStars,
  video: VideoCamera,
  pin: MapPin,
  swap: ArrowsLeftRight,
  gear: GearSix,
  balance: ChartPolar,
  mood: Smiley,
  pulse: Pulse,
  therapy: FlowerLotus,
  filter: Funnel,
  sort: SlidersHorizontal,
  star: Star,
  question: Question,
  // Базовый самолётик вместо фирменного логотипа: иконка про «отправить»,
  // а не про конкретный мессенджер.
  telegram: PaperPlaneTilt,
  share: ShareNetwork,
  exit: SignOut,
  lock: LockSimple,
  route: MapPinLine,
  close: X,
  chalkboard: Chalkboard,
  // Ангела в Phosphor нет: за Амура отвечает крыло-перо.
  angel: Feather,
  // Фирменный самолётик Telegram — для ссылок «открыть приложение».
  "telegram-logo": TelegramLogo,
  storm: CloudLightning,
  battery: BatteryLow,
  fire: Fire,
  heartbeat: Heartbeat,
  heartbreak: HeartBreak,
  bandaid: Bandaids,
  backpack: Backpack,
  self: UserFocus,
  clover: Clover,
  warn: WarningCircle,
  waves: Waves,
  steps: Footprints,
};

export function Icon({
  name,
  width = 20,
  height,
  weight = "regular",
  className,
  color,
}: {
  name: IconName;
  width?: number;
  height?: number;
  weight?: IconWeight;
  className?: string;
  color?: string;
}) {
  const Cmp = MAP[name];
  return <Cmp size={width ?? height} weight={weight} className={className} color={color} />;
}
