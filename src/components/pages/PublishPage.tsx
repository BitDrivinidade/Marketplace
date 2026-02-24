import { useMemo, useRef, useState } from 'react';
import { ImagePlus, Send, Sparkles, UploadCloud } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useProducts } from '@/hooks/useProducts';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useToast } from '@/hooks/use-toast';

interface PublishPageProps {
  onPublishSuccess: () => void;
}

const CATEGORIES = ['Eletronica', 'Roupa', 'Casa', 'Desporto', 'Veiculos'];

export function PublishPage({ onPublishSuccess }: PublishPageProps) {
  const [image, setImage] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { addProduct } = useProducts();
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const { toast } = useToast();

  const previewPrice = useMemo(() => {
    const value = Number(price);
    if (!Number.isFinite(value) || value <= 0) return '0.00 EUR';
    return `${value.toFixed(2)} EUR`;
  }, [price]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearForm = () => {
    setImage(null);
    setName('');
    setDescription('');
    setPrice('');
    setCategory('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!image || !name.trim() || !price || !category) {
      toast({
        title: 'Erro',
        description: 'Preenche os campos obrigatorios e adiciona imagem.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    await addProduct({
      name: name.trim(),
      description: description.trim(),
      price: Number(price),
      category,
      image,
      sellerId: user?.id ?? 'u1',
    });

    addNotification({
      title: 'Produto publicado',
      message: `"${name.trim()}" foi publicado com sucesso.`,
      type: 'success',
    });

    toast({ title: 'Publicado', description: 'O anuncio ja esta na tua loja.' });
    setIsLoading(false);
    clearForm();
    onPublishSuccess();
  };

  return (
    <div className="pb-8 pt-4 px-3 md:px-6 w-full">
      <section className="rounded-2xl border border-[#232323] bg-[#0f0f0f] p-4 md:p-6">
        <div className="mb-5">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-[#E8E0C8]">Publicar Produto</h2>
            <p className="text-sm text-[#7f7661] mt-1">Cria um anuncio elegante e pronto para vender.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1.4fr] gap-5">
          <aside className="rounded-2xl border border-[#242424] bg-[#111] p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[#8b8168] mb-3">Preview</p>
            <div className="rounded-xl border border-[#262626] bg-[#0d0d0d] overflow-hidden">
              <div className="aspect-[4/3] bg-[#101010]">
                {image ? (
                  <img src={image} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-[#5f5746] gap-2">
                    <ImagePlus className="w-8 h-8" />
                    <span className="text-sm">Sem imagem</span>
                  </div>
                )}
              </div>
              <div className="p-3 border-t border-[#1d1d1d]">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[#E8E0C8] font-semibold truncate">{name.trim() || 'Nome do produto'}</p>
                  <p className="text-[#d8c28a] font-semibold text-sm whitespace-nowrap">{previewPrice}</p>
                </div>
                <p className="text-xs text-[#7f7661] mt-1 truncate">{category || 'Categoria'}</p>
                <p className="text-sm text-[#9a917a] mt-2 line-clamp-2">{description.trim() || 'Descricao do produto.'}</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-[#262626] bg-[#101010] p-3 flex items-center gap-2 text-[#b8ad90] text-sm">
              <Sparkles className="w-4 h-4 text-[#C9A962]" />
              Dica: fotos claras vendem mais rapido.
            </div>
          </aside>

          <form onSubmit={handleSubmit} className="rounded-2xl border border-[#242424] bg-[#111] p-4 md:p-5 space-y-4">
            <div className="space-y-2">
              <Label className="text-[#A09060]">Imagem do produto</Label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-36 rounded-xl border-2 border-dashed border-[#2c2c2c] bg-[#0e0e0e] hover:border-[#C9A962]/60 transition-colors flex flex-col items-center justify-center gap-2"
              >
                <UploadCloud className="w-6 h-6 text-[#8a816a]" />
                <span className="text-sm text-[#8a816a]">Clique para carregar imagem</span>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="text-[#A09060]">Nome do produto</Label>
              <Input
                id="name"
                type="text"
                placeholder="Ex: iPhone 14 Pro"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11 rounded-lg bg-[#0A0A0A] border-[#252525] text-[#E8E0C8]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-[#A09060]">Descricao</Label>
              <Textarea
                id="description"
                placeholder="Descreve o teu produto..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[110px] rounded-lg bg-[#0A0A0A] border-[#252525] text-[#E8E0C8] resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="price" className="text-[#A09060]">Preco (EUR)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="h-11 rounded-lg bg-[#0A0A0A] border-[#252525] text-[#E8E0C8]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category" className="text-[#A09060]">Categoria</Label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-11 rounded-lg border border-[#252525] px-3 bg-[#0A0A0A] text-[#E8E0C8]"
                >
                  <option value="">Selecionar</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <Button type="button" onClick={clearForm} className="h-11 rounded-xl border border-[#2b2b2b] bg-[#151515] text-[#E8E0C8] hover:bg-[#1b1b1b]">
                Limpar
              </Button>
              <Button type="submit" disabled={isLoading} className="h-11 rounded-xl btn-gold font-semibold">
                <Send className="w-4 h-4 mr-2" />
                {isLoading ? 'A publicar...' : 'Publicar produto'}
              </Button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
