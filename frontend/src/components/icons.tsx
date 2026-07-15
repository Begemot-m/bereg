import {
  BellRinging,
  BookOpen,
  CalendarDots,
  ChartLineUp,
  CheckCircle,
  Clock,
  Compass,
  Heart,
  House,
  NotePencil,
  Plus,
  Sparkle,
  SquaresFour,
  User,
  UsersThree,
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
  | "note";

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
  note: NotePencil,
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
