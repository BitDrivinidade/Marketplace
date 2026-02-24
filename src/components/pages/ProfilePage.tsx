import { useMemo, useState } from 'react';
import { LogOut, Package, ShoppingBag, CreditCard, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useProducts } from '@/hooks/useProducts';
import { useMarketplace } from '@/hooks/useMarketplace';
import { useNotifications } from '@/hooks/useNotifications';
import { useToast } from '@/hooks/use-toast';
import type { PaymentMethodType, Product } from '@/types';

interface ProfilePageProps {
  onLogout: () => void;
}

export function ProfilePage({ onLogout }: ProfilePageProps) {
  const { user, logout, addPaymentMethod, setDefaultPaymentMethod, removePaymentMethod } = useAuth();
  const { getProductsBySellerId, products, removeProduct } = useProducts();
  const { orders } = useMarketplace();
  const { addNotification } = useNotifications();
  const { toast } = useToast();

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [methodType, setMethodType] = useState<PaymentMethodType>('card');
  const [cardNumber, setCardNumber] = useState('');
  const [holderName, setHolderName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [paypalEmail, setPaypalEmail] = useState('');
  const [mbwayPhone, setMbwayPhone] = useState('');

  if (!user) return null;

  const userProducts = getProductsBySellerId(user.id);
  const soldUserProducts = userProducts.filter((p) => p.status !== 'available');
  const userOrders = orders.filter((o) => o.buyerId === user.id);

  const purchases = useMemo(() => {
    return userOrders.flatMap((order) =>
      order.itemIds
        .map((id) => products.find((p) => p.id === id))
        .filter((product): product is Product => Boolean(product)),
    );
  }, [products, userOrders]);

  const closeAndReset = () => {
    setIsPaymentModalOpen(false);
    setCardNumber('');
    setHolderName('');
    setExpiryDate('');
    setPaypalEmail('');
    setMbwayPhone('');
    setMethodType('card');
  };

  const handleLogout = () => {
    logout();
    onLogout();
  };

  const handleDeleteSold = async (productId: string) => {
    const ok = await removeProduct(productId);
    if (!ok) {
      toast({ title: 'Erro', description: 'Nao foi possivel apagar o produto.', variant: 'destructive' });
      return;
    }
    addNotification({ title: 'Produto removido', message: 'Produto vendido removido.', type: 'info' });
    toast({ title: 'Removido', description: 'Produto vendido apagado.' });
  };

  const handleDeleteAllSold = async () => {
    if (soldUserProducts.length === 0) return;
    for (const product of soldUserProducts) {
      await removeProduct(product.id);
    }
    addNotification({
      title: 'Vendidos removidos',
      message: `${soldUserProducts.length} produto(s) vendido(s) removidos.`,
      type: 'info',
    });
    toast({ title: 'Concluido', description: 'Todos os vendidos foram apagados.' });
  };

  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault();

    if (methodType === 'card') {
      if (cardNumber.replace(/\D/g, '').length < 16 || !holderName.trim() || !expiryDate.trim()) {
        toast({ title: 'Erro', description: 'Dados do cartao invalidos.', variant: 'destructive' });
        return;
      }
      const digits = cardNumber.replace(/\D/g, '');
      void addPaymentMethod({
        type: 'card',
        label: `Cartao final ${digits.slice(-4)}`,
        brand: digits.startsWith('4') ? 'Visa' : 'Mastercard',
        last4: digits.slice(-4),
        holderName: holderName.trim(),
        expiresAt: expiryDate.trim(),
      });
    }

    if (methodType === 'paypal') {
      if (!paypalEmail.includes('@')) {
        toast({ title: 'Erro', description: 'Email PayPal invalido.', variant: 'destructive' });
        return;
      }
      void addPaymentMethod({ type: 'paypal', label: `PayPal (${paypalEmail})`, email: paypalEmail.trim() });
    }

    if (methodType === 'mbway') {
      if (mbwayPhone.replace(/\D/g, '').length < 9) {
        toast({ title: 'Erro', description: 'Numero MB WAY invalido.', variant: 'destructive' });
        return;
      }
      void addPaymentMethod({ type: 'mbway', label: `MB WAY (${mbwayPhone})`, phone: mbwayPhone.trim() });
    }

    addNotification({ title: 'Metodo adicionado', message: 'Pagamento guardado com sucesso.', type: 'success' });
    toast({ title: 'Metodo adicionado', description: 'Pagamento guardado com sucesso.' });
    closeAndReset();
  };

  return (
    <div className="pb-8 pt-4 px-3 md:px-6 w-full">
      <section className="rounded-2xl border border-[#232323] bg-[#0f0f0f] p-4 md:p-5 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[#E8E0C8]">Perfil</h2>
          <Button variant="outline" size="sm" onClick={handleLogout} className="text-[#A09060] border-[#222] bg-[#121212]">
            <LogOut className="w-4 h-4 mr-1" />
            Sair
          </Button>
        </div>

        <div className="bg-[#111] rounded-xl p-4 border border-[#222]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-[#C9A962] to-[#8B7355] rounded-full flex items-center justify-center">
              <span className="text-[#0A0A0A] font-bold text-lg">{user.avatar || user.name.charAt(0)}</span>
            </div>
            <div>
              <h3 className="font-semibold text-[#E8E0C8]">{user.name}</h3>
              <p className="text-sm text-[#666]">{user.email}</p>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#C9A962]" />
              <h3 className="font-semibold text-[#E8E0C8]">Pagamentos ({user.paymentMethods.length})</h3>
            </div>
            <button onClick={() => setIsPaymentModalOpen(true)} className="text-[#C9A962] text-sm flex items-center gap-1">
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
          </div>
          <div className="space-y-2">
            {user.paymentMethods.map((method) => (
              <div key={method.id} className="bg-[#111] rounded-xl p-3 border border-[#222] flex items-center justify-between">
                <div>
                  <p className="text-[#E8E0C8] text-sm">
                    {method.label} {method.isDefault ? <span className="text-[#C9A962]">(Principal)</span> : null}
                  </p>
                  <p className="text-[#666] text-xs uppercase">{method.type}</p>
                </div>
                <div className="flex items-center gap-2">
                  {!method.isDefault && (
                    <button
                      onClick={() => void setDefaultPaymentMethod(method.id)}
                      className="text-xs px-2 py-1 rounded border border-[#333] text-[#A09060]"
                    >
                      Definir principal
                    </button>
                  )}
                  <button onClick={() => void removePaymentMethod(method.id)} className="p-2 text-[#666] hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {user.paymentMethods.length === 0 && (
              <button
                onClick={() => setIsPaymentModalOpen(true)}
                className="w-full bg-[#111] rounded-xl p-4 border border-[#222] border-dashed text-[#666]"
              >
                Adicionar metodo de pagamento
              </button>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-[#C9A962]" />
              <h3 className="font-semibold text-[#E8E0C8]">Meus Produtos ({userProducts.length})</h3>
            </div>
            {soldUserProducts.length > 0 && (
              <button
                onClick={() => void handleDeleteAllSold()}
                className="text-xs px-3 py-1.5 rounded-lg border border-[#3a2a2a] text-red-300 hover:bg-[#221515]"
              >
                Apagar vendidos ({soldUserProducts.length})
              </button>
            )}
          </div>

          {userProducts.length > 0 ? (
            <div className="space-y-3">
              {userProducts.map((product) => (
                <div key={product.id} className="bg-[#111] rounded-xl p-3 border border-[#222] flex items-center gap-3">
                  <img src={product.image} alt={product.name} className="w-14 h-14 rounded-lg object-cover bg-[#1a1a1a]" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-[#E8E0C8] text-sm truncate">{product.name}</h4>
                    <p className="text-[#C9A962] font-semibold text-sm">{product.price.toFixed(2)}€</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      product.status === 'available' ? 'bg-[#C9A962]/20 text-[#C9A962]' : 'bg-[#333] text-[#999]'
                    }`}
                  >
                    {product.status === 'available' ? 'Disponivel' : 'Vendido'}
                  </span>
                  {product.status !== 'available' && (
                    <button onClick={() => void handleDeleteSold(product.id)} className="p-2 text-red-300 hover:text-red-200">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#111] rounded-xl p-6 text-center border border-[#222]">
              <p className="text-[#666] text-sm">Ainda nao publicaste nenhum produto.</p>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <ShoppingBag className="w-5 h-5 text-[#C9A962]" />
            <h3 className="font-semibold text-[#E8E0C8]">Compras ({purchases.length})</h3>
          </div>
          <div className="space-y-3">
            {purchases.map((product) => (
              <div key={product.id} className="bg-[#111] rounded-xl p-3 border border-[#222] flex items-center gap-3">
                <img src={product.image} alt={product.name} className="w-14 h-14 rounded-lg object-cover bg-[#1a1a1a]" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-[#E8E0C8] text-sm truncate">{product.name}</h4>
                  <p className="text-[#C9A962] font-semibold text-sm">{product.price.toFixed(2)}€</p>
                </div>
              </div>
            ))}
            {purchases.length === 0 && (
              <div className="bg-[#111] rounded-xl p-6 text-center border border-[#222]">
                <p className="text-[#666] text-sm">Ainda nao fizeste nenhuma compra.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-md bg-[#111] border-[#222] text-[#E8E0C8]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Adicionar pagamento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddPayment} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-[#A09060]">Tipo</Label>
              <select
                value={methodType}
                onChange={(e) => setMethodType(e.target.value as PaymentMethodType)}
                className="w-full h-11 rounded-lg border border-[#222] px-3 bg-[#0A0A0A] text-[#E8E0C8]"
              >
                <option value="card">Cartao</option>
                <option value="paypal">PayPal</option>
                <option value="mbway">MB WAY</option>
              </select>
            </div>
            {methodType === 'card' && (
              <div className="space-y-3">
                <Input placeholder="Nome no cartao" value={holderName} onChange={(e) => setHolderName(e.target.value)} className="bg-[#0A0A0A] border-[#222] text-[#E8E0C8]" />
                <Input placeholder="0000 0000 0000 0000" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} className="bg-[#0A0A0A] border-[#222] text-[#E8E0C8]" />
                <Input placeholder="MM/AA" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="bg-[#0A0A0A] border-[#222] text-[#E8E0C8]" />
              </div>
            )}
            {methodType === 'paypal' && (
              <Input placeholder="email@paypal.com" value={paypalEmail} onChange={(e) => setPaypalEmail(e.target.value)} className="bg-[#0A0A0A] border-[#222] text-[#E8E0C8]" />
            )}
            {methodType === 'mbway' && (
              <Input placeholder="912345678" value={mbwayPhone} onChange={(e) => setMbwayPhone(e.target.value)} className="bg-[#0A0A0A] border-[#222] text-[#E8E0C8]" />
            )}
            <Button type="submit" className="w-full btn-gold rounded-lg font-semibold">
              Guardar metodo
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
