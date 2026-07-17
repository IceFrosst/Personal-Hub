import {
  IconApps,
  IconBarbell,
  IconBolt,
  IconCookie,
  IconDroplet,
  IconNote,
  IconCalendar,
  IconList,
  IconHeartbeat,
  IconBook,
  IconBrain,
  IconChartBar,
  IconCoin,
  IconHome,
  IconMusic,
  IconRadar2,
  IconShoppingCart,
  IconTarget,
  IconWallet,
} from "@tabler/icons-react";
import type { ComponentType } from "react";

type IconProps = { size?: number | string; stroke?: number };

const map: Record<string, ComponentType<IconProps>> = {
  apps: IconApps,
  barbell: IconBarbell,
  bolt: IconBolt,
  cookie: IconCookie,
  droplet: IconDroplet,
  note: IconNote,
  calendar: IconCalendar,
  list: IconList,
  heartbeat: IconHeartbeat,
  book: IconBook,
  brain: IconBrain,
  chart: IconChartBar,
  coin: IconCoin,
  home: IconHome,
  music: IconMusic,
  radar: IconRadar2,
  cart: IconShoppingCart,
  target: IconTarget,
  wallet: IconWallet,
};

export function getIcon(name: string): ComponentType<IconProps> {
  return map[name] ?? IconApps;
}
