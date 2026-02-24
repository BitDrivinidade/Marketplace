export type PaymentMethodType = 'card' | 'paypal' | 'mbway';

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  label: string;
  isDefault: boolean;
  brand?: string;
  last4?: string;
  holderName?: string;
  expiresAt?: string;
  phone?: string;
  email?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  paymentMethods: PaymentMethod[];
}

export interface StoredUser extends User {
  password: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  seller: User;
  sellerId: string;
  buyerId?: string;
  status: 'available' | 'reserved' | 'sold';
  createdAt: Date;
}

export interface CartItem {
  productId: string;
  quantity: number;
}

export interface Order {
  id: string;
  itemIds: string[];
  items?: Array<{
    product_id: string;
    price: number;
    name: string;
    image: string;
    category: string;
  }>;
  buyerId: string;
  subtotal: number;
  serviceFee: number;
  total: number;
  paymentMethodId: string;
  shippingAddress: string;
  note?: string;
  status: 'processing' | 'paid' | 'shipped' | 'completed';
  createdAt: Date;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: Date;
}

export interface Conversation {
  id: string;
  participantIds: string[];
  productId?: string;
  messages: ChatMessage[];
  updatedAt: Date;
}

export type View =
  | 'home'
  | 'favorites'
  | 'publish'
  | 'chat'
  | 'profile'
  | 'product-detail'
  | 'cart';
