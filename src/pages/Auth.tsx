import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { DollarSign, KeyRound, LogIn, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

type AuthView = 'login' | 'signup' | 'forgot' | 'reset';

const getFriendlyAuthError = (message: string) => {
  const normalized = message.toLowerCase();

  if (normalized.includes('invalid login credentials')) {
    return 'Email ou senha inválidos.';
  }
  if (normalized.includes('email not confirmed')) {
    return 'Seu email ainda não foi confirmado. Confira sua caixa de entrada.';
  }
  if (normalized.includes('password should be at least')) {
    return 'Sua senha precisa ter pelo menos 6 caracteres.';
  }
  if (normalized.includes('user already registered')) {
    return 'Esse email já está cadastrado.';
  }
  if (normalized.includes('for security purposes')) {
    return 'Muitas tentativas seguidas. Aguarde um pouco e tente de novo.';
  }
  if (normalized.includes('failed to fetch')) {
    return 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.';
  }

  return message;
};

export default function Auth() {
  const { isRecoveryMode, exitRecoveryMode } = useAuth();
  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isRecoveryMode) {
      setView('reset');
    } else {
      setView((current) => (current === 'reset' ? 'login' : current));
    }
  }, [isRecoveryMode]);

  const title = useMemo(() => {
    if (view === 'signup') return 'Crie sua conta';
    if (view === 'forgot') return 'Recuperar acesso';
    if (view === 'reset') return 'Definir nova senha';
    return 'Entrar na sua conta';
  }, [view]);

  const subtitle = useMemo(() => {
    if (view === 'signup') return 'Comece a organizar suas finanças com segurança.';
    if (view === 'forgot') return 'Envie um link de recuperação para o seu email.';
    if (view === 'reset') return 'Escolha uma nova senha para voltar a acessar o app.';
    return 'Acesse seu painel financeiro.';
  }, [view]);

  const normalizedEmail = email.trim().toLowerCase();

  const resetFields = () => {
    setPassword('');
    setConfirmPassword('');
  };

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (error) throw error;
    toast.success('Login realizado com sucesso!');
  };

  const handleSignUp = async () => {
    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
    });
    if (error) throw error;
    toast.success('Conta criada! Confira seu email para confirmar o acesso.');
    setView('login');
  };

  const handleForgotPassword = async () => {
    const redirectTo = import.meta.env.VITE_APP_URL
      ? `${import.meta.env.VITE_APP_URL}/`
      : `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo });
    if (error) throw error;
    toast.success('Link de recuperação enviado. Confira seu email.');
    setView('login');
  };

  const handleResetPassword = async () => {
    if (password.length < 6) {
      throw new Error('Sua senha precisa ter pelo menos 6 caracteres.');
    }
    if (password !== confirmPassword) {
      throw new Error('As senhas não conferem.');
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;

    exitRecoveryMode();
    resetFields();
    toast.success('Senha atualizada com sucesso!');
    setView('login');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (view === 'login') {
        await handleLogin();
      } else if (view === 'signup') {
        await handleSignUp();
      } else if (view === 'forgot') {
        await handleForgotPassword();
      } else {
        await handleResetPassword();
      }
    } catch (err) {
      const error = err as Error;
      toast.error(getFriendlyAuthError(error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-border/60 bg-card shadow-2xl shadow-primary/5 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="relative hidden overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.22),_transparent_42%),linear-gradient(160deg,rgba(10,14,22,1)_0%,rgba(15,23,42,1)_100%)] p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div className="max-w-md space-y-6">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/12 backdrop-blur">
                <DollarSign className="h-7 w-7" />
              </div>
              <div className="space-y-3">
                <h1 className="text-4xl font-bold tracking-tight">FinançasPro</h1>
                <p className="text-base text-white/72">
                  Um painel financeiro pensado para acompanhar receitas, despesas, cartões, investimentos e metas em um só lugar.
                </p>
              </div>
              <div className="grid gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/6 p-4 backdrop-blur">
                  <p className="text-sm font-semibold">Segurança de acesso</p>
                  <p className="mt-1 text-sm text-white/70">
                    Login protegido pelo Supabase com recuperação de senha e sessão persistente.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/6 p-4 backdrop-blur">
                  <p className="text-sm font-semibold">Recuperação simples</p>
                  <p className="mt-1 text-sm text-white/70">
                    Se alguém esquecer a senha, o próprio app já envia o link e recebe a nova senha sem depender de suporte.
                  </p>
                </div>
              </div>
            </div>
            <div className="text-sm text-white/55">
              Controle total das suas finanças, com uma experiência mais estável para todos os usuários.
            </div>
          </section>

          <section className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-8 space-y-3 text-center lg:text-left">
                <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary lg:mx-0">
                  {view === 'forgot' ? <Mail className="h-6 w-6" /> : view === 'reset' ? <KeyRound className="h-6 w-6" /> : view === 'signup' ? <ShieldCheck className="h-6 w-6" /> : <LogIn className="h-6 w-6" />}
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {view !== 'reset' && (
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                    />
                  </div>
                )}

                {(view === 'login' || view === 'signup' || view === 'reset') && (
                  <div className="space-y-2">
                    <Label htmlFor="password">{view === 'reset' ? 'Nova senha' : 'Senha'}</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete={view === 'reset' ? 'new-password' : view === 'login' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                  </div>
                )}

                {view === 'reset' && (
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading
                    ? 'Processando...'
                    : view === 'login'
                      ? 'Entrar'
                      : view === 'signup'
                        ? 'Criar conta'
                        : view === 'forgot'
                          ? 'Enviar link de recuperação'
                          : 'Salvar nova senha'}
                </Button>
              </form>

              <div className="mt-5 space-y-2 text-center text-sm">
                {view === 'login' && (
                  <>
                    <button
                      onClick={() => setView('forgot')}
                      className="text-primary hover:text-primary/80 transition-colors"
                    >
                      Esqueci minha senha
                    </button>
                    <div className="text-muted-foreground">
                      Não tem conta?{' '}
                      <button
                        onClick={() => setView('signup')}
                        className="font-medium text-foreground hover:text-primary transition-colors"
                      >
                        Criar uma
                      </button>
                    </div>
                  </>
                )}

                {view === 'signup' && (
                  <div className="text-muted-foreground">
                    Já tem conta?{' '}
                    <button
                      onClick={() => setView('login')}
                      className="font-medium text-foreground hover:text-primary transition-colors"
                    >
                      Fazer login
                    </button>
                  </div>
                )}

                {view === 'forgot' && (
                  <div className="text-muted-foreground">
                    Lembrou a senha?{' '}
                    <button
                      onClick={() => setView('login')}
                      className="font-medium text-foreground hover:text-primary transition-colors"
                    >
                      Voltar para o login
                    </button>
                  </div>
                )}

                {view === 'reset' && (
                  <button
                    onClick={() => {
                      exitRecoveryMode();
                      setView('login');
                      resetFields();
                    }}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancelar redefinição
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
