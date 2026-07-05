/**
 * Pantalla de login (H7 — modo nube).
 * Solo se muestra cuando cloudHabilitado() y no hay sesión.
 * Sin registro público: el acceso es por invitación (los usuarios se crean
 * desde el dashboard de Supabase).
 */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { signIn } from '../cloud/auth';
import { Btn, Card } from '../ui/base';
import { Logo } from '../ui/Logo';

const claseInput =
  'w-full rounded-md border border-[var(--borde)] bg-[var(--panel)] px-3 py-2 text-sm ' +
  'text-[var(--texto)] placeholder:text-[var(--texto-2)] ' +
  'focus:outline-2 focus:outline-offset-1 focus:outline-[var(--color-sud-azul)]';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (cargando) return;
    setError(null);
    setCargando(true);
    const err = await signIn(email.trim(), password);
    setCargando(false);
    if (err) setError(err);
    // Si salió bien, onAuthStateChange (en App) hace el resto.
  };

  return (
    <div className="fondo-paleta flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo className="text-2xl" />
        </div>
        <Card className="p-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="login-email" className="text-xs font-medium text-[var(--texto-2)]">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={claseInput}
                placeholder="tu@email.com"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="login-pass" className="text-xs font-medium text-[var(--texto-2)]">
                Contraseña
              </label>
              <input
                id="login-pass"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={claseInput}
                placeholder="••••••••"
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-[var(--color-alerta)]">
                {error}
              </p>
            )}
            <Btn type="submit" variante="primario" className="w-full justify-center" disabled={cargando}>
              {cargando ? 'Ingresando…' : 'Ingresar'}
            </Btn>
          </form>
        </Card>
        <p className="mt-4 text-center text-xs text-[var(--texto-2)]">
          Acceso por invitación — pedila a estudio SUD.
        </p>
      </div>
    </div>
  );
}
