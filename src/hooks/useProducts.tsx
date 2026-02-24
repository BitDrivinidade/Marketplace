import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Product, User } from '@/types';

interface ProductsContextType {
  products: Product[];
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'seller' | 'status' | 'buyerId'>) => Promise<void>;
  buyProducts: (productIds: string[], buyerId: string) => { success: string[]; failed: string[] };
  removeProduct: (productId: string) => Promise<boolean>;
  getProductById: (id: string) => Product | undefined;
  getProductsBySellerId: (sellerId: string) => Product[];
  refreshProducts: () => Promise<void>;
}

const ProductsContext = createContext<ProductsContextType | null>(null);
const STORAGE_KEY = 'lootbox_products';
const WIPE_FLAG_KEY = 'lootbox_products_wiped_v1';

const sellerSeed: User = {
  id: 'u1',
  name: 'Bit Drivinidade',
  email: 'bitdrivinidade@gmail.com',
  avatar: 'B',
  paymentMethods: [],
};

function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`;
}

function loadProducts(): Product[] {
  if (!localStorage.getItem(WIPE_FLAG_KEY)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    localStorage.setItem(WIPE_FLAG_KEY, '1');
    return [];
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    return [];
  }
  return JSON.parse(raw, (key, value) => {
    if (key === 'createdAt') return new Date(value);
    return value;
  }) as Product[];
}

function getCurrentUser(): User | null {
  const raw = localStorage.getItem('lootbox_user');
  if (!raw) return null;
  return JSON.parse(raw) as User;
}

export function ProductsProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);

  const refreshProducts = async () => {
    setProducts(loadProducts());
  };

  useEffect(() => {
    void refreshProducts();
    const onAuthChange = () => {
      void refreshProducts();
    };
    window.addEventListener('lootbox-auth-changed', onAuthChange);
    return () => window.removeEventListener('lootbox-auth-changed', onAuthChange);
  }, []);

  const persistProducts = (next: Product[]) => {
    setProducts(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const addProduct = async (productData: Omit<Product, 'id' | 'createdAt' | 'seller' | 'status' | 'buyerId'>) => {
    const currentUser = getCurrentUser() ?? sellerSeed;
    const newProduct: Product = {
      ...productData,
      id: randomId('p'),
      createdAt: new Date(),
      status: 'available',
      seller: currentUser,
      sellerId: currentUser.id,
      buyerId: undefined,
    };
    persistProducts([newProduct, ...products]);
  };

  const buyProducts = (productIds: string[], buyerId: string) => {
    const ids = new Set(productIds);
    const success: string[] = [];
    const failed: string[] = [];
    const next = products.map((product) => {
      if (!ids.has(product.id)) return product;
      if (product.status !== 'available' || product.sellerId === buyerId) {
        failed.push(product.id);
        return product;
      }
      success.push(product.id);
      return { ...product, status: 'sold' as const, buyerId };
    });
    if (success.length > 0) persistProducts(next);
    return { success, failed };
  };

  const removeProduct = async (productId: string) => {
    const found = products.find((p) => p.id === productId);
    if (!found) return false;
    const next = products.filter((p) => p.id !== productId);
    persistProducts(next);
    return true;
  };

  const getProductById = (id: string) => products.find((p) => p.id === id);
  const getProductsBySellerId = (sellerId: string) => products.filter((p) => p.sellerId === sellerId);

  return (
    <ProductsContext.Provider
      value={{
        products,
        addProduct,
        buyProducts,
        removeProduct,
        getProductById,
        getProductsBySellerId,
        refreshProducts,
      }}
    >
      {children}
    </ProductsContext.Provider>
  );
}

export function useProducts() {
  const context = useContext(ProductsContext);
  if (!context) throw new Error('useProducts must be used within a ProductsProvider');
  return context;
}
