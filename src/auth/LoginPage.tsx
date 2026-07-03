import { useState, type FormEvent } from 'react';

interface LoginPageProps {
  error: string | null;
  onSubmit: (email: string, password: string) => Promise<void>;
}

export function LoginPage({ error, onSubmit }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password) {
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(email.trim(), password);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-zinc-950 px-6 py-10 text-zinc-50">
      <div className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-900/90 p-8 shadow-2xl shadow-black/40">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-red-400">thebestappeva</p>
        <h1 className="mt-4 text-3xl font-semibold text-white">Owner Login</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-300">Sign in with the owner email and password configured in Supabase.</p>
        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm text-zinc-200">
            <span className="mb-2 block">Email</span>
            <input
              autoComplete="email"
              className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-red-400"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </label>
          <label className="block text-sm text-zinc-200">
            <span className="mb-2 block">Password</span>
            <input
              autoComplete="current-password"
              className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-red-400"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>
          {error ? <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</p> : null}
          <button
            className="w-full rounded-2xl bg-red-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-zinc-700"
            disabled={submitting || !email.trim() || !password}
            type="submit"
          >
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
