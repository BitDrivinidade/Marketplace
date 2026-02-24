import { useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/hooks/useAuth';
import { ProductsProvider } from '@/hooks/useProducts';
import { NotificationsProvider } from '@/hooks/useNotifications';
import { MarketplaceProvider } from '@/hooks/useMarketplace';
import { Header } from '@/components/pages/Header';
import { HomePage } from '@/components/pages/HomePage';
import { ProfilePage } from '@/components/pages/ProfilePage';
import { PublishPage } from '@/components/pages/PublishPage';
import { ProductDetailPage } from '@/components/pages/ProductDetailPage';
import { FavoritesPage } from '@/components/pages/FavoritesPage';
import { ChatPage } from '@/components/pages/ChatPage';
import { CartPage } from '@/components/pages/CartPage';
import { LoginModal } from '@/components/auth/LoginModal';
import { RegisterModal } from '@/components/auth/RegisterModal';
import './App.css';

function AppContent() {
  const [currentView, setCurrentView] = useState('home');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  const handleProductClick = (productId: string) => {
    setSelectedProductId(productId);
    setCurrentView('product-detail');
  };

  const handleBackFromProduct = () => {
    setSelectedProductId(null);
    setCurrentView('home');
  };

  const handlePublishSuccess = () => {
    setCurrentView('home');
  };

  const handleLogout = () => {
    setCurrentView('home');
  };

  const renderContent = () => {
    switch (currentView) {
      case 'home':
        return (
          <HomePage
            onProductClick={handleProductClick}
            onViewChange={setCurrentView}
            onLoginClick={() => setIsLoginOpen(true)}
          />
        );
      case 'profile':
        return <ProfilePage onLogout={handleLogout} />;
      case 'publish':
        return <PublishPage onPublishSuccess={handlePublishSuccess} />;
      case 'favorites':
        return <FavoritesPage />;
      case 'chat':
        return <ChatPage />;
      case 'cart':
        return <CartPage />;
      case 'product-detail':
        return selectedProductId ? (
          <ProductDetailPage 
            productId={selectedProductId} 
            onBack={handleBackFromProduct}
            onGoToCart={() => setCurrentView('cart')}
            onGoToChat={() => setCurrentView('chat')}
          />
        ) : (
          <HomePage
            onProductClick={handleProductClick}
            onViewChange={setCurrentView}
            onLoginClick={() => setIsLoginOpen(true)}
          />
        );
      default:
        return (
          <HomePage
            onProductClick={handleProductClick}
            onViewChange={setCurrentView}
            onLoginClick={() => setIsLoginOpen(true)}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] ambient-bg">
      <Header
        currentView={currentView}
        onViewChange={setCurrentView}
        onLoginClick={() => setIsLoginOpen(true)}
      />
      
      {/* Main Content */}
      <main className="pt-24 md:pt-24 relative z-[1]">
        {renderContent()}
      </main>

      {/* Modals */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSuccess={() => setCurrentView('profile')}
        onRegisterClick={() => {
          setIsLoginOpen(false);
          setIsRegisterOpen(true);
        }}
      />

      <RegisterModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onLoginClick={() => {
          setIsRegisterOpen(false);
          setIsLoginOpen(true);
        }}
      />

      {/* Toast notifications */}
      <Toaster position="bottom-right" />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ProductsProvider>
        <MarketplaceProvider>
          <NotificationsProvider>
            <AppContent />
          </NotificationsProvider>
        </MarketplaceProvider>
      </ProductsProvider>
    </AuthProvider>
  );
}

export default App;
