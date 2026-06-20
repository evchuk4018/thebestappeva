import { FileText, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { Link, useLocation } from 'react-router-dom';

const retiredRoutes = new Set(['/workout', '/nutrition', '/tasks', '/notes']);

export default function RetiredRoutePage() {
  const location = useLocation();
  const isRetiredRoute = retiredRoutes.has(location.pathname);

  return (
    <div className="flex h-full w-full items-center justify-center overflow-y-auto bg-zinc-950 px-6 py-10">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24 }}
        className="w-full max-w-2xl rounded-[32px] border border-zinc-800 bg-[#111317] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-red-400">
          {isRetiredRoute ? 'Module Retired' : 'Page Not Found'}
        </p>
        <h1 className="mt-4 text-4xl font-semibold text-white">
          {isRetiredRoute ? 'That workspace is no longer part of the app.' : 'There is nothing at this route anymore.'}
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-zinc-300">
          {isRetiredRoute
            ? `The ${location.pathname.replace('/', '')} module was removed as part of the AI + Docs simplification.`
            : `The route "${location.pathname}" does not exist in the current AI + Docs-only app.`}
          {' '}Use AI for conversations, tools, and artifact generation, or jump into Docs to manage files and exports.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Link to="/ai" className="group rounded-[24px] border border-red-500/25 bg-red-600/90 p-5 transition hover:bg-red-500">
            <div className="flex items-center gap-3 text-white">
              <Sparkles size={22} strokeWidth={2.5} />
              <span className="text-lg font-semibold">Open AI</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-red-50/90">
              Resume chats, tools, automations, and artifact workflows.
            </p>
          </Link>
          <Link to="/docs" className="group rounded-[24px] border border-zinc-700 bg-zinc-900/80 p-5 transition hover:border-zinc-500 hover:bg-zinc-900">
            <div className="flex items-center gap-3 text-white">
              <FileText size={22} strokeWidth={2.5} />
              <span className="text-lg font-semibold">Open Docs</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              Browse documents, edit files, and keep AI exports flowing into the docs workspace.
            </p>
          </Link>
        </div>
      </motion.section>
    </div>
  );
}
