import { ArrowLeft, CircleDot, Heart, MessageCircle, ShoppingCart } from 'lucide-react';
import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMarketplace } from '@/hooks/useMarketplace';
import { useNotifications } from '@/hooks/useNotifications';
import { useProducts } from '@/hooks/useProducts';
import { useToast } from '@/hooks/use-toast';

interface ProductDetailPageProps {
  productId: string;
  onBack: () => void;
  onGoToCart: () => void;
  onGoToChat: () => void;
}

export function ProductDetailPage({ productId, onBack, onGoToCart, onGoToChat }: ProductDetailPageProps) {
  const { user, isAuthenticated } = useAuth();
  const { getProductById } = useProducts();
  const { isFavorite, toggleFavorite, addToCart, createOrGetConversation } = useMarketplace();
  const { addNotification } = useNotifications();
  const { toast } = useToast();

  const product = useMemo(() => getProductById(productId), [getProductById, productId]);

  if (!product) {
    return (
      <div className="pb-8 pt-4 px-3 md:px-6 w-full">
        <section className="rounded-2xl border border-[#232323] bg-[#0f0f0f] p-4 md:p-6">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm text-[#9a917a] hover:text-[#E8E0C8]"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
          <div className="mt-6 rounded-xl border border-[#222] bg-[#111] p-8 text-center">
            <p className="text-[#E8E0C8] text-lg font-semibold">Produto nao encontrado</p>
            <p className="text-[#7f7661] text-sm mt-1">Este anuncio pode ter sido removido.</p>
          </div>
        </section>
      </div>
    );
  }

  const isSeller = user?.id === product.sellerId;
  const sold = product.status !== 'available';

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      toast({ title: 'Login necessario', description: 'Entra na tua conta para comprar.', variant: 'destructive' });
      return;
    }
    if (sold) {
      toast({ title: 'Produto indisponivel', description: 'Este item ja foi vendido.', variant: 'destructive' });
      return;
    }
    if (isSeller) {
      toast({ title: 'Operacao invalida', description: 'Nao podes comprar o teu proprio item.', variant: 'destructive' });
      return;
    }

    await addToCart(product.id);
    addNotification({
      title: 'Adicionado ao carrinho',
      message: `${product.name} foi adicionado ao teu carrinho.`,
      type: 'success',
    });
    toast({ title: 'Item adicionado', description: 'Abre o carrinho para concluir a compra.' });
    onGoToCart();
  };

  const handleOpenChat = async () => {
    if (!isAuthenticated || !user) {
      toast({ title: 'Login necessario', description: 'Entra para falar com o vendedor.', variant: 'destructive' });
      return;
    }
    if (isSeller) {
      toast({ title: 'Info', description: 'Este anuncio e teu.' });
      return;
    }

    await createOrGetConversation(user.id, product.sellerId, product.id);
    onGoToChat();
  };

  return (
    <div className="pb-8 pt-4 px-3 md:px-6 w-full">
      <section className="rounded-2xl border border-[#232323] bg-[#0f0f0f] p-3 md:p-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-[#9a917a] hover:text-[#E8E0C8] mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar aos produtos
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-4 md:gap-6 items-start">
          <div className="rounded-2xl border border-[#232323] bg-[#121212] p-2 md:p-3">
            <div className="rounded-xl overflow-hidden border border-[#1f1f1f] bg-[#0d0d0d] h-[260px] md:h-[340px] lg:h-[420px]">
              <img src={product.image} alt={product.name} className="w-full h-full object-contain p-3" />
            </div>
          </div>

          <div className="rounded-2xl border border-[#232323] bg-[#111] p-4 md:p-6 flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.16em] text-[#8a816a]">{product.category}</p>
                <h1 className="text-2xl md:text-3xl font-bold text-[#E8E0C8] mt-1">{product.name}</h1>
              </div>
              <button
                onClick={() => void toggleFavorite(product.id)}
                className="h-10 w-10 shrink-0 rounded-full border border-[#2b2b2b] bg-[#161616] flex items-center justify-center"
                aria-label="Favoritar"
              >
                <Heart className={`w-5 h-5 ${isFavorite(product.id) ? 'text-red-400 fill-red-400' : 'text-[#9c9278]'}`} />
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-3xl font-extrabold gradient-text">{product.price.toFixed(2)}EUR</p>
              <div
                className={`h-8 px-3 rounded-full border flex items-center gap-1.5 text-xs ${
                  sold
                    ? 'border-[#4a2424] bg-[#2a1717] text-[#f08f8f]'
                    : 'border-[#3e3727] bg-[#1f1a12] text-[#d8c28a]'
                }`}
              >
                <CircleDot className="w-3 h-3" />
                {sold ? 'Vendido' : 'Disponivel'}
              </div>
            </div>

            <p className="mt-4 text-sm md:text-base text-[#b4aa90] leading-relaxed">{product.description}</p>

            <div className="mt-5 rounded-xl border border-[#232323] bg-[#0f0f0f] p-3 md:p-4">
              <p className="text-xs text-[#8a816a]">Vendedor</p>
              <div className="mt-2 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C9A962] to-[#8B7355] text-[#0A0A0A] font-bold flex items-center justify-center">
                  {product.seller.avatar || product.seller.name.charAt(0)}
                </div>
                <div>
                  <p className="text-[#E8E0C8] font-semibold text-sm">{product.seller.name}</p>
                  <p className="text-[#7f7661] text-xs">{product.seller.email}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2.5">
              <button
                onClick={() => void handleAddToCart()}
                disabled={sold || isSeller}
                className="h-11 rounded-xl btn-gold inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShoppingCart className="w-4 h-4" />
                {sold ? 'Item vendido' : isSeller ? 'Anuncio teu' : 'Adicionar e pagar'}
              </button>
              <button
                onClick={() => void handleOpenChat()}
                disabled={isSeller}
                className="h-11 px-4 rounded-xl border border-[#2b2b2b] bg-[#161616] text-[#E8E0C8] inline-flex items-center justify-center gap-2 hover:border-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MessageCircle className="w-4 h-4" />
                Chat
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
