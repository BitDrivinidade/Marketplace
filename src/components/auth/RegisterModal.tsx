import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useToast } from '@/hooks/use-toast';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginClick: () => void;
}

export function RegisterModal({ isOpen, onClose, onLoginClick }: RegisterModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isVerificationStep, setIsVerificationStep] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { register, verifyEmail, resendVerificationCode } = useAuth();
  const { addNotification } = useNotifications();
  const { toast } = useToast();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const result = await register(name, email, password);
    if (!result.success) {
      toast({
        title: 'Erro',
        description:
          result.reason === 'email_exists' ? 'Este email ja esta registado.' : 'Falha no registo.',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    setIsVerificationStep(true);
    addNotification({
      title: 'Verificacao necessaria',
      message: `Link enviado para ${email}.`,
      type: 'info',
    });
    toast({
      title: 'Verifica o teu email',
      description: 'Abrimos o fluxo real do Firebase. Clica no link enviado para o teu email.',
    });
    setIsLoading(false);
  };

  const handleVerify = async () => {
    setIsLoading(true);
    const result = await verifyEmail();
    if (!result.success) {
      toast({
        title: 'Ainda nao verificado',
        description: 'Depois de clicar no link do email, carrega em "Ja verifiquei".',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    addNotification({
      title: 'Email verificado',
      message: 'A tua conta foi verificada com sucesso.',
      type: 'success',
    });
    toast({
      title: 'Conta verificada',
      description: 'Agora podes entrar com o teu email e password.',
    });
    setIsLoading(false);
    onClose();
    onLoginClick();
  };

  const handleResend = async () => {
    const res = await resendVerificationCode(email);
    if (!res.success) {
      toast({ title: 'Erro', description: 'Nao foi possivel reenviar email de verificacao.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Email reenviado', description: 'Verifica novamente a tua caixa de entrada.' });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-0 bg-[#111]">
        <div className="relative rounded-lg p-6">
          <button onClick={onClose} className="absolute left-4 top-4 text-[#666] hover:text-[#E8E0C8] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>

          <DialogHeader className="text-center pt-4">
            <div className="mx-auto w-12 h-12 bg-gradient-to-br from-[#C9A962] to-[#8B7355] rounded-full flex items-center justify-center mb-4">
              <span className="text-[#0A0A0A] font-bold text-xl">L</span>
            </div>
            <DialogTitle className="text-xl font-semibold text-[#E8E0C8]">
              {isVerificationStep ? 'Verificar email' : 'Criar conta'}
            </DialogTitle>
            <p className="text-sm text-[#666] mt-1">
              {isVerificationStep ? 'Verificacao por link (Firebase).' : 'Regista-te para comprar e vender.'}
            </p>
          </DialogHeader>

          {!isVerificationStep ? (
            <form onSubmit={handleRegister} className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-[#A09060]">
                  Nome
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="O teu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-11 rounded-lg bg-[#0A0A0A] border-[#222] text-[#E8E0C8]"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-[#A09060]">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 rounded-lg bg-[#0A0A0A] border-[#222] text-[#E8E0C8]"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-[#A09060]">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="********"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-11 rounded-lg bg-[#0A0A0A] border-[#222] text-[#E8E0C8] pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] hover:text-[#E8E0C8]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" disabled={isLoading} className="w-full h-11 btn-gold rounded-lg font-semibold">
                {isLoading ? 'A processar...' : 'Criar conta'}
              </Button>
            </form>
          ) : (
            <div className="space-y-3 mt-6">
              <Button onClick={() => void handleVerify()} disabled={isLoading} className="w-full h-11 btn-gold rounded-lg font-semibold">
                {isLoading ? 'A verificar...' : 'Ja verifiquei'}
              </Button>
              <button
                type="button"
                onClick={handleResend}
                className="w-full h-10 rounded-lg border border-[#2b2b2b] text-[#A09060] hover:text-[#E8E0C8]"
              >
                Reenviar email
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
