import type { ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { LoginPage } from './LoginPage';

export function RequireOwner({ children }: { children: ReactNode }) {
  const auth = useAuth();

  if (auth.status === 'loading') {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-zinc-950 px-6 text-sm text-zinc-300">
        Resolving your session...
      </div>
    );
  }

  if (!auth.ownerConfirmed || auth.status !== 'authenticated') {
    return <LoginPage error={auth.error} onSubmit={auth.login} />;
  }

  return <>{children}</>;
}
