import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';
import { NotificationsPanel } from '@/components/ui-custom/NotificationsPanel';

interface HeaderProps {
  currentView: string;
  onViewChange: (view: string) => void;
  onLoginClick: () => void;
}

const NAV_ITEMS = [
  { id: 'home', label: 'Produtos', auth: false },
  { id: 'favorites', label: 'Favoritos', auth: false },
  { id: 'cart', label: 'Pedidos', auth: true },
  { id: 'publish', label: 'Publicar', auth: true },
  { id: 'chat', label: 'Chat', auth: true },
  { id: 'profile', label: 'Perfil', auth: true },
];

export function Header({ currentView, onViewChange, onLoginClick }: HeaderProps) {
  const { isAuthenticated, user } = useAuth();

  const handleNav = (itemId: string, requiresAuth: boolean) => {
    if (requiresAuth && !isAuthenticated) {
      onLoginClick();
      return;
    }
    onViewChange(itemId);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 border-b border-[#1f1f1f] bg-[#0A0A0A]/95 backdrop-blur">
      <div className="w-full px-4 h-14 flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-[0.18em]">
          <span className="gradient-text">LOOT BOX</span>
        </h1>

        {isAuthenticated ? (
          <div className="flex items-center gap-3">
            <NotificationsPanel />
            <div className="w-9 h-9 bg-gradient-to-br from-[#C9A962] to-[#8B7355] rounded-full flex items-center justify-center">
              <span className="text-[#0A0A0A] font-bold text-sm">{user?.avatar || user?.name?.charAt(0) || 'U'}</span>
            </div>
          </div>
        ) : (
          <Button onClick={onLoginClick} className="h-9 px-4 btn-gold rounded-full text-sm font-semibold">
            <LogIn className="w-4 h-4 mr-1" />
            Entrar
          </Button>
        )}
      </div>

      <div className="px-4 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {NAV_ITEMS.map((item) => {
            const active = currentView === item.id || (item.id === 'home' && currentView === 'product-detail');
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id, item.auth)}
                className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-gradient-to-r from-[#C9A962] to-[#D4AF37] text-[#0A0A0A] font-semibold'
                    : 'text-[#8a816a] hover:text-[#E8E0C8] hover:bg-[#171717]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
