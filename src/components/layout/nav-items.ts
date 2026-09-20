import {
  CalendarDays,
  FileText,
  LayoutGrid,
  MapPin,
  Settings,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Restrito a Admin (PRD seção 2). */
  adminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/painel", label: "Painel", icon: LayoutGrid },
  { href: "/cronograma", label: "Cronograma", icon: CalendarDays },
  { href: "/locais", label: "Locais", icon: MapPin },
  { href: "/colaboradores", label: "Pessoas", icon: UserRound },
  { href: "/equipes", label: "Equipes", icon: Users },
  { href: "/relatorios", label: "Relatórios", icon: FileText },
];

export const NAV_FOOTER: NavItem[] = [
  { href: "/ajustes", label: "Ajustes", icon: Settings, adminOnly: true },
];
