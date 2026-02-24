import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CartItem, Conversation, Order, Product } from '@/types';
import { useProducts } from '@/hooks/useProducts';

interface CheckoutPayload {
  buyerId: string;
  paymentMethodId: string;
  shippingAddress: string;
  note?: string;
}

interface CheckoutResult {
  success: boolean;
  message: string;
  order?: Order;
}

interface MarketplaceContextType {
  favorites: string[];
  cart: CartItem[];
  orders: Order[];
  conversations: Conversation[];
  isFavorite: (productId: string) => boolean;
  toggleFavorite: (productId: string) => Promise<void>;
  addToCart: (productId: string) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  clearCart: () => void;
  cartCount: number;
  checkout: (payload: CheckoutPayload) => Promise<CheckoutResult>;
  createOrGetConversation: (a: string, b: string, productId?: string) => Promise<string>;
  sendMessage: (conversationId: string, senderId: string, text: string) => Promise<void>;
  getUserConversations: (userId: string) => Conversation[];
  refreshAll: () => Promise<void>;
}

const MarketplaceContext = createContext<MarketplaceContextType | null>(null);
const FAVORITES_KEY = 'lootbox_favorites';
const CART_KEY = 'lootbox_cart';
const ORDERS_KEY = 'lootbox_orders';
const CONVERSATIONS_KEY = 'lootbox_conversations';

function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`;
}

export function MarketplaceProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const { getProductById, buyProducts } = useProducts();

  const refreshAll = async () => {
    const rawFavorites = localStorage.getItem(FAVORITES_KEY);
    const rawCart = localStorage.getItem(CART_KEY);
    const rawOrders = localStorage.getItem(ORDERS_KEY);
    const rawConversations = localStorage.getItem(CONVERSATIONS_KEY);

    setFavorites(rawFavorites ? (JSON.parse(rawFavorites) as string[]) : []);
    setCart(rawCart ? (JSON.parse(rawCart) as CartItem[]) : []);
    setOrders(
      rawOrders
        ? (JSON.parse(rawOrders, (k, v) => (k === 'createdAt' ? new Date(v) : v)) as Order[])
        : [],
    );
    setConversations(
      rawConversations
        ? (JSON.parse(rawConversations, (k, v) => {
            if (k === 'updatedAt' || k === 'createdAt') return new Date(v);
            return v;
          }) as Conversation[])
        : [],
    );
  };

  useEffect(() => {
    void refreshAll();
    const onAuthChange = () => {
      void refreshAll();
    };
    window.addEventListener('lootbox-auth-changed', onAuthChange);
    return () => window.removeEventListener('lootbox-auth-changed', onAuthChange);
  }, []);

  useEffect(() => localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites)), [favorites]);
  useEffect(() => localStorage.setItem(CART_KEY, JSON.stringify(cart)), [cart]);
  useEffect(() => localStorage.setItem(ORDERS_KEY, JSON.stringify(orders)), [orders]);
  useEffect(() => localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations)), [conversations]);

  const isFavorite = (productId: string) => favorites.includes(productId);

  const toggleFavorite = async (productId: string) => {
    setFavorites((prev) => (prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]));
  };

  const addToCart = async (productId: string) => {
    const product = getProductById(productId);
    if (!product || product.status !== 'available') return;
    setCart((prev) => (prev.some((item) => item.productId === productId) ? prev : [...prev, { productId, quantity: 1 }]));
  };

  const removeFromCart = async (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const clearCart = () => setCart([]);
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  const checkout = async ({ buyerId, paymentMethodId, shippingAddress, note }: CheckoutPayload): Promise<CheckoutResult> => {
    const cartProducts = cart
      .map((item) => getProductById(item.productId))
      .filter(
        (product): product is Product =>
          product !== undefined && product.status === 'available',
      );
    if (cartProducts.length === 0) {
      return { success: false, message: 'Carrinho vazio.' };
    }

    const result = buyProducts(
      cartProducts.map((p) => p.id),
      buyerId,
    );
    if (result.success.length === 0) {
      return { success: false, message: 'Não foi possível concluir a compra.' };
    }

    const purchased = cartProducts.filter((p) => result.success.includes(p.id));
    const subtotal = purchased.reduce((sum, p) => sum + p.price, 0);
    const serviceFee = subtotal * 0.04;
    const order: Order = {
      id: randomId('ord'),
      itemIds: purchased.map((p) => p.id),
      buyerId,
      subtotal,
      serviceFee,
      total: subtotal + serviceFee,
      paymentMethodId,
      shippingAddress,
      note,
      status: 'paid',
      createdAt: new Date(),
    };

    setOrders((prev) => [order, ...prev]);
    setCart((prev) => prev.filter((item) => !result.success.includes(item.productId)));
    return { success: true, message: 'Pagamento simulado concluído com sucesso.', order };
  };

  const createOrGetConversation = async (a: string, b: string, productId?: string): Promise<string> => {
    const sorted = [a, b].sort();
    const existing = conversations.find(
      (conv) =>
        conv.participantIds.length === 2 &&
        conv.participantIds.includes(sorted[0]) &&
        conv.participantIds.includes(sorted[1]) &&
        conv.productId === productId,
    );
    if (existing) return existing.id;
    const newConversation: Conversation = {
      id: randomId('conv'),
      participantIds: sorted,
      productId,
      messages: [],
      updatedAt: new Date(),
    };
    setConversations((prev) => [newConversation, ...prev]);
    return newConversation.id;
  };

  const sendMessage = async (conversationId: string, senderId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setConversations((prev) =>
      prev
        .map((conv) =>
          conv.id === conversationId
            ? {
                ...conv,
                updatedAt: new Date(),
                messages: [
                  ...conv.messages,
                  { id: randomId('msg'), senderId, text: trimmed, createdAt: new Date() },
                ],
              }
            : conv,
        )
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    );
  };

  const getUserConversations = (userId: string) =>
    conversations.filter((conv) => conv.participantIds.includes(userId));

  return (
    <MarketplaceContext.Provider
      value={{
        favorites,
        cart,
        orders,
        conversations,
        isFavorite,
        toggleFavorite,
        addToCart,
        removeFromCart,
        clearCart,
        cartCount,
        checkout,
        createOrGetConversation,
        sendMessage,
        getUserConversations,
        refreshAll,
      }}
    >
      {children}
    </MarketplaceContext.Provider>
  );
}

export function useMarketplace() {
  const context = useContext(MarketplaceContext);
  if (!context) throw new Error('useMarketplace must be used within a MarketplaceProvider');
  return context;
}
