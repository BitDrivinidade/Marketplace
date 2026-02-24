import { Home, Heart, PlusCircle, MessageCircle, User, ShoppingCart } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMarketplace } from '@/hooks/useMarketplace';

interface BottomNavigationProps {
  currentView: string;
  onViewChange: (view: string) => void;
  onLoginClick: () => void;
}

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'favorites', label: 'Favoritos', icon: Heart },
  { id: 'cart', label: 'Carrinho', icon: ShoppingCart },
  { id: 'publish', label: 'Publicar', icon: PlusCircle },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
  { id: 'profile', label: 'Perfil', icon: User },
];

export function BottomNavigation({ currentView, onViewChange, onLoginClick }: BottomNavigationProps) {
  const { isAuthenticated } = useAuth();
  const { cartCount } = useMarketplace();

  const handleClick = (viewId: string) => {
    if ((viewId === 'publish' || viewId === 'profile' || viewId === 'chat' || viewId === 'cart') && !isAuthenticated) {
      onLoginClick();
      return;
    }
    onViewChange(viewId);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#1f1f1f] bg-[#0A0A0A]/97 backdrop-blur">
      <div className="w-full px-2">
        <div className="flex items-center justify-around py-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => handleClick(item.id)}
                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-md transition-colors ${
                  isActive 
                    ? 'text-[#C9A962]' 
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-6 h-6 ${isActive ? 'fill-current' : ''}`} />
                  {item.id === 'cart' && cartCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 bg-[#C9A962] text-[#0A0A0A] rounded-full text-[10px] font-bold flex items-center justify-center">
                      {cartCount > 9 ? '9+' : cartCount}
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      {/* Safe area for mobile */}
      <div className="h-safe-area-inset-bottom" />
    </nav>
  );
}
