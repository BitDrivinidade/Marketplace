import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useToast } from '@/hooks/use-toast';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegisterClick: () => void;
  onSuccess?: () => void;
}

export function LoginModal({ isOpen, onClose, onRegisterClick, onSuccess }: LoginModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const { login, requestPasswordReset } = useAuth();
  const { addNotification } = useNotifications();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const result = await login(email, password);
    if (result.success) {
      addNotification({ title: 'Login efetuado', message: 'Bem-vindo de volta.', type: 'success' });
      toast({ title: 'Bem-vindo', description: 'Login efetuado com sucesso.' });
      onClose();
      onSuccess?.();
    } else if (result.reason === 'email_not_verified') {
      toast({
        title: 'Email nao verificado',
        description: 'Verifica o teu email antes de entrar.',
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Erro', description: 'Email ou password incorretos.', variant: 'destructive' });
    }
    setIsLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast({ title: 'Recuperacao', description: 'Indica primeiro o teu email.' });
      return;
    }
    const res = await requestPasswordReset(email);
    if (!res.success) {
      toast({ title: 'Erro', description: 'Nao foi possivel enviar email de recuperacao.', variant: 'destructive' });
      return;
    }
    addNotification({
      title: 'Recuperacao enviada',
      message: `Link de recuperacao enviado para ${email}.`,
      type: 'info',
    });
    toast({ title: 'Email enviado', description: 'Abre o link no teu email para redefinir a password.' });
    setIsRecoveryMode(false);
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
              {isRecoveryMode ? 'Recuperar palavra-passe' : 'Bem-vindo de volta'}
            </DialogTitle>
            <p className="text-sm text-[#666] mt-1">
              {isRecoveryMode ? 'Recuperacao por link real (Firebase).' : 'Entra na tua conta para continuar.'}
            </p>
          </DialogHeader>

          {!isRecoveryMode ? (
            <form onSubmit={handleSubmit} className="space-y-4 mt-6">
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
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => setIsRecoveryMode(true)}
                    className="text-xs text-[#A09060] hover:text-[#C9A962] transition-colors"
                  >
                    Esqueceu a palavra-passe?
                  </button>
                </div>
              </div>

              <Button type="submit" disabled={isLoading} className="w-full h-11 btn-gold rounded-lg font-semibold">
                {isLoading ? 'A processar...' : 'Entrar'}
              </Button>
            </form>
          ) : (
            <div className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#A09060]">Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 rounded-lg bg-[#0A0A0A] border-[#222] text-[#E8E0C8]"
                  required
                />
              </div>
              <Button onClick={() => void handleForgotPassword()} className="w-full h-11 btn-gold rounded-lg font-semibold">
                Enviar link de recuperacao
              </Button>
              <button
                type="button"
                onClick={() => setIsRecoveryMode(false)}
                className="w-full h-10 rounded-lg border border-[#2b2b2b] text-[#A09060] hover:text-[#E8E0C8]"
              >
                Voltar ao login
              </button>
            </div>
          )}

          <p className="text-center text-sm text-[#666] mt-4">
            Nao tens conta?{' '}
            <button onClick={onRegisterClick} className="text-[#C9A962] hover:text-[#D4AF37] font-medium">
              Regista-te
            </button>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
