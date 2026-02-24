import { useMemo, useState } from 'react';
import { Heart, Search, Plus, CircleDot } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { useMarketplace } from '@/hooks/useMarketplace';
import { useAuth } from '@/hooks/useAuth';

interface HomePageProps {
  onProductClick: (productId: string) => void;
  onViewChange: (view: string) => void;
  onLoginClick: () => void;
}

export function HomePage({ onProductClick, onViewChange, onLoginClick }: HomePageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { products } = useProducts();
  const { isFavorite, toggleFavorite } = useMarketplace();
  const { isAuthenticated } = useAuth();

  const filteredProducts = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return products.filter((product) => {
      if (product.status !== 'available') return false;
      if (!query) return true;
      return (
        product.name.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query)
      );
    });
  }, [products, searchQuery]);

  return (
    <div className="pb-8 pt-4 px-3 md:px-6 w-full">
      <section className="rounded-2xl border border-[#232323] bg-[#0f0f0f] p-3 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border border-[#1f1f1f] bg-[#111] rounded-xl p-2.5 md:p-3 mb-4">
          <div>
            <h2 className="text-xl font-semibold text-[#E8E0C8]">Lista de produtos</h2>
            <p className="text-xs text-[#7f7661]">Todos os teus anuncios e produtos disponiveis.</p>
          </div>
          <div className="relative w-full md:w-[320px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7d7562]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar..."
              className="w-full h-10 rounded-xl border border-[#262626] bg-[#141414] pl-9 pr-3 text-sm text-[#E8E0C8] placeholder:text-[#6b6453] outline-none focus:border-[#C9A962]"
            />
          </div>
        </div>
        <div className="mb-4">
          <button
            onClick={() => {
              if (!isAuthenticated) {
                onLoginClick();
                return;
              }
              onViewChange('publish');
            }}
            className="h-9 px-3 rounded-lg border border-[#2b2b2b] bg-[#151515] text-[#E8E0C8] text-sm flex items-center gap-1.5 hover:border-[#3a3a3a]"
          >
            <Plus className="w-4 h-4" />
            Adicionar produto
          </button>
        </div>

        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {filteredProducts.map((product) => {
              const sold = product.status !== 'available';
              return (
                <article
                  key={product.id}
                  onClick={() => onProductClick(product.id)}
                  className="rounded-xl border border-[#242424] bg-[#121212] p-2.5 md:p-3 cursor-pointer card-hover"
                >
                  <div className="relative rounded-lg border border-[#222] bg-[#181818] aspect-[4/3] overflow-hidden mb-2.5">
                    <img src={product.image} alt={product.name} className="w-full h-full object-contain p-2" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void toggleFavorite(product.id);
                      }}
                      className="absolute right-2 top-2 h-7 w-7 rounded-full bg-black/55 flex items-center justify-center"
                    >
                      <Heart className={`w-4 h-4 ${isFavorite(product.id) ? 'text-red-400 fill-red-400' : 'text-[#9c9278]'}`} />
                    </button>
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-[#E8E0C8] truncate">{product.name}</h3>
                      <p className="text-xs text-[#7a725f] truncate">{product.category}</p>
                    </div>
                    <p className="text-[#E8E0C8] font-semibold text-sm">{product.price.toFixed(0)}€</p>
                  </div>

                  <div
                    className={`mt-2.5 h-7 rounded-md border flex items-center justify-center gap-1.5 text-xs ${
                      sold
                        ? 'border-[#4a2424] bg-[#2a1717] text-[#f08f8f]'
                        : 'border-[#3e3727] bg-[#1f1a12] text-[#d8c28a]'
                    }`}
                  >
                    <CircleDot className="w-3 h-3" />
                    {sold ? 'Vendido' : 'Disponivel'}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="h-44 rounded-xl border border-[#222] bg-[#111] flex flex-col items-center justify-center text-center">
            <Search className="w-6 h-6 text-[#756c59] mb-2" />
            <p className="text-[#E8E0C8] text-sm">Nenhum produto encontrado</p>
            <p className="text-[#7f7661] text-xs">Tenta outra pesquisa.</p>
          </div>
        )}
      </section>
    </div>
  );
}
