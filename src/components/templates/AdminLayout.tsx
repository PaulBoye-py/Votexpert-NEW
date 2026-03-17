import * as React from 'react';
import { cn } from '@/lib/utils';
import { Logo, Button, Avatar, AvatarFallback } from '@/components/atoms';
import { getInitials } from '@/lib/utils';
import {
  LayoutDashboard,
  Vote,
  Users,
  UserCheck,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string | number;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Elections', href: '/admin/elections', icon: Vote },
  { label: 'Candidates', href: '/admin/candidates', icon: UserCheck },
  { label: 'Voters', href: '/admin/voters', icon: Users },
  { label: 'Results', href: '/admin/results', icon: BarChart3 },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
];

interface AdminLayoutProps {
  children: React.ReactNode;
  adminName?: string;
  adminEmail?: string;
  currentPath?: string;
  onNavigate?: (path: string) => void;
  onLogout?: () => void;
  className?: string;
}

export function AdminLayout({
  children,
  adminName = 'Admin',
  adminEmail,
  currentPath = '/admin',
  onNavigate,
  onLogout,
  className,
}: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [showUserMenu, setShowUserMenu] = React.useState(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);

  // Close user menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close sidebar on route change (mobile)
  React.useEffect(() => {
    setSidebarOpen(false);
  }, [currentPath]);

  const handleNavClick = (href: string) => {
    onNavigate?.(href);
    setSidebarOpen(false);
  };

  const isActive = (href: string) => {
    if (href === '/admin/dashboard') {
      return currentPath === '/admin/dashboard' || currentPath === '/admin';
    }
    return currentPath.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-64 bg-background border-r border-border transition-transform duration-200',
          'lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Sidebar header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          <Logo size="sm" />
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <button
                key={item.href}
                onClick={() => handleNavClick(item.href)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && (
                  <span
                    className={cn(
                      'px-2 py-0.5 text-xs rounded-full',
                      active
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-primary/10 text-primary'
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="text-xs">
                {getInitials(adminName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {adminName}
              </p>
              {adminEmail && (
                <p className="text-xs text-muted-foreground truncate">
                  {adminEmail}
                </p>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="lg:pl-64">
        {/* Top header */}
        <header className="sticky top-0 z-30 h-16 bg-background border-b border-border">
          <div className="h-full px-4 flex items-center justify-between">
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Page title - can be customized via context or props */}
            <div className="hidden lg:block">
              <h1 className="text-lg font-semibold text-foreground">
                {navItems.find((item) => isActive(item.href))?.label || 'Dashboard'}
              </h1>
            </div>

            {/* Right side - User menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {getInitials(adminName)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-foreground hidden sm:inline">
                  {adminName}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>

              {/* Dropdown menu */}
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-background border border-border rounded-lg shadow-lg py-1">
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-sm font-medium text-foreground">{adminName}</p>
                    {adminEmail && (
                      <p className="text-xs text-muted-foreground truncate">{adminEmail}</p>
                    )}
                  </div>
                  <div className="py-1">
                    <button
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      onClick={() => {
                        handleNavClick('/admin/settings');
                        setShowUserMenu(false);
                      }}
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </button>
                    {onLogout && (
                      <button
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                        onClick={() => {
                          setShowUserMenu(false);
                          onLogout();
                        }}
                      >
                        <LogOut className="h-4 w-4" />
                        Logout
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className={cn('p-6', className)}>
          {children}
        </main>
      </div>
    </div>
  );
}
