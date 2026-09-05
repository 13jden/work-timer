/**
 * IconByKey — key → Phosphor 线稿图标的统一渲染层
 *
 * v2.1 TASK-036:记账模块图标系统升级(emoji → Phosphor thin/light)。
 *
 * 设计:
 * - `icon` 字段继续存字符串;新数据存 icon key(如 'food'),老数据存 emoji
 * - 命中 ICON_MAP → 渲染 Phosphor 线稿图标(thin 字重,颜色走 color prop / currentColor)
 * - 未命中 → 回退渲染原 emoji 文本,老 localStorage 数据无缝兼容
 *
 * 图标名均已在已安装版本 @phosphor-icons/react 的 d.ts 中校验存在。
 */
import {
  ForkKnife, Coffee, Pizza, Hamburger, BowlFood, CookingPot, Cake, Wine, BeerBottle,
  Bus, CarSimple, Bicycle, TrainRegional, AirplaneTilt, GasPump,
  ShoppingBag, ShoppingCartSimple, Tag, Gift, Dress, TShirt, Sneaker, Handbag,
  GameController, MusicNote, FilmSlate, Ticket, DiceFive, SoccerBall,
  HouseSimple, Lightbulb, Drop, Plugs, Armchair, Bed, Plant,
  FirstAid, Pill, Stethoscope, Heartbeat, BookOpen, GraduationCap, Baby,
  Wallet, Coins, Bank, TrendUp, Briefcase, HandCoins, PiggyBank, CurrencyCny, EnvelopeSimple,
  Package, Cube, Sparkle, Star, PawPrint, Phone, Laptop, Television, Watch, Backpack, Umbrella, Sun,
} from '@phosphor-icons/react';

type IconComponent = typeof Coffee;

/** icon key → Phosphor 组件 */
export const ICON_MAP: Record<string, IconComponent> = {
  // 餐饮
  food: ForkKnife,
  drink: Coffee,
  pizza: Pizza,
  burger: Hamburger,
  bowl: BowlFood,
  pot: CookingPot,
  cake: Cake,
  wine: Wine,
  beer: BeerBottle,
  // 出行
  bus: Bus,
  car: CarSimple,
  bike: Bicycle,
  train: TrainRegional,
  plane: AirplaneTilt,
  fuel: GasPump,
  // 购物
  bag: ShoppingBag,
  cart: ShoppingCartSimple,
  tag: Tag,
  gift: Gift,
  dress: Dress,
  tshirt: TShirt,
  sneaker: Sneaker,
  handbag: Handbag,
  // 娱乐
  game: GameController,
  music: MusicNote,
  film: FilmSlate,
  ticket: Ticket,
  dice: DiceFive,
  ball: SoccerBall,
  // 居家
  home: HouseSimple,
  bulb: Lightbulb,
  drop: Drop,
  plug: Plugs,
  sofa: Armchair,
  bed: Bed,
  plant: Plant,
  // 健康成长
  aid: FirstAid,
  pill: Pill,
  steth: Stethoscope,
  heart: Heartbeat,
  book: BookOpen,
  grad: GraduationCap,
  baby: Baby,
  // 钱财工作
  wallet: Wallet,
  coins: Coins,
  bank: Bank,
  trend: TrendUp,
  brief: Briefcase,
  handcoins: HandCoins,
  piggy: PiggyBank,
  cny: CurrencyCny,
  envelope: EnvelopeSimple,
  // 其他
  box: Package,
  cube: Cube,
  sparkle: Sparkle,
  star: Star,
  paw: PawPrint,
  phone: Phone,
  laptop: Laptop,
  tv: Television,
  watch: Watch,
  backpack: Backpack,
  umbrella: Umbrella,
  sun: Sun,
};

/** 添加分类弹窗的分组图标清单 */
export const ACCOUNTING_ICON_GROUPS: ReadonlyArray<{ label: string; icons: readonly string[] }> = [
  { label: '餐饮', icons: ['food', 'drink', 'pizza', 'burger', 'bowl', 'pot', 'cake', 'wine', 'beer'] },
  { label: '出行', icons: ['bus', 'car', 'bike', 'train', 'plane', 'fuel'] },
  { label: '购物', icons: ['bag', 'cart', 'tag', 'gift', 'dress', 'tshirt', 'sneaker', 'handbag'] },
  { label: '娱乐', icons: ['game', 'music', 'film', 'ticket', 'dice', 'ball'] },
  { label: '居家', icons: ['home', 'bulb', 'drop', 'plug', 'sofa', 'bed', 'plant'] },
  { label: '健康成长', icons: ['aid', 'pill', 'steth', 'heart', 'book', 'grad', 'baby'] },
  { label: '钱财工作', icons: ['wallet', 'coins', 'bank', 'trend', 'brief', 'handcoins', 'piggy', 'cny', 'envelope'] },
  { label: '其他', icons: ['box', 'cube', 'sparkle', 'star', 'paw', 'phone', 'laptop', 'tv', 'watch', 'backpack', 'umbrella', 'sun'] },
];

interface IconByKeyProps {
  /** icon key(新)或旧 emoji 字符串 */
  icon: string;
  /** 图标尺寸(px),默认 18 */
  size?: number;
  /** 字重,默认 regular（v2.5-patch6 N-490：账单分类图标整体加重） */
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
  /** 颜色,默认继承 currentColor */
  color?: string;
  className?: string;
}

/**
 * 按 key 渲染线稿图标;未命中回退 emoji 文本(兼容老数据)。
 */
export function IconByKey({ icon, size = 18, weight = 'regular', color, className }: IconByKeyProps) {
  const Cmp = ICON_MAP[icon];
  if (!Cmp) {
    return (
      <span className={className} style={color ? { color } : undefined}>
        {icon}
      </span>
    );
  }
  return <Cmp size={size} weight={weight} color={color} className={className} />;
}
