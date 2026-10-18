'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Lightbulb,
  MessageSquare,
  GraduationCap,
  BarChart3,
  FileInput,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAuth } from '@/lib/auth';
import { useI18n, type Locale } from '@/lib/i18n';
import { Badge } from '@/components/ui/badge';
import { Languages } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/students', label: 'Students', icon: Users },
  { href: '/curricula', label: 'Curricula', icon: BookOpen },
  { href: '/suggestions', label: 'Suggestions', icon: Lightbulb },
  { href: '/feedback', label: 'Feedback', icon: MessageSquare },
  { href: '/progress', label: 'Progress', icon: BarChart3 },
  { href: '/resources', label: 'Resources', icon: FileInput },
];

// Admin-only route, shown only to the admin role.
const ADMIN_NAV = { href: '/admin', label: 'Users', icon: ShieldCheck };

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { t, locale, setLocale } = useI18n();

  const name =
    user?.firstName || user?.lastName
      ? [user?.firstName, user?.lastName].filter(Boolean).join(' ')
      : user?.email || 'Teacher';
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <aside className="fixed left-0 top-0 z-10 flex h-screen w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <GraduationCap className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-sm font-bold leading-tight">{t('nav.appTitle')}</h1>
          <p className="text-xs text-muted-foreground">
            {t('nav.appSubtitle')}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {[...navItems, ...(user?.role === 'admin' ? [ADMIN_NAV] : [])].map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.href === '/admin' ? item.label : t(`nav.${item.label.toLowerCase()}`)}
            </Link>
          );
        })}
      </nav>

      {/* Language switcher */}
      <div className="border-t px-4 py-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Languages className="h-3 w-3" />
            {locale === 'en' ? 'English' : 'Español'}
          </span>
          <button
            onClick={() => setLocale(locale === 'en' ? 'es' : 'en')}
            className="rounded-md border border-input px-2 py-1 text-xs font-medium transition-colors hover:bg-accent"
            aria-label="Switch language"
          >
            {locale === 'en' ? 'ES' : 'EN'}
          </button>
        </div>
      </div>

      {/* Theme toggle */}
      <div className="border-t px-4 py-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {t('nav.appearance')}
          </span>
          <ThemeToggle />
        </div>
      </div>

      {/* User + sign out */}
      <div className="border-t p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            {initials}
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-medium">{name}</p>
              {user?.role === 'admin' && (
                <Badge variant="info" className="text-[9px] px-1.5 py-0">
                  admin
                </Badge>
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {user?.email}
            </p>
          </div>
          <button
            onClick={() => logout()}
            title="Sign out"
            aria-label="Sign out"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
