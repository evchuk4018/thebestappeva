import { CalendarDays, Dumbbell, FileText, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

const cards = [
  {
    id: 'btn-ai-start',
    icon: Sparkles,
    title: 'AI',
    subtitle: 'Chats, tools, automations, and artifacts',
    href: '/ai',
    delay: 0,
  },
  {
    id: 'btn-docs-start',
    icon: FileText,
    title: 'Docs',
    subtitle: 'Files, templates, exports, and local history',
    href: '/docs',
    delay: 0.08,
  },
  {
    id: 'btn-calendar-start',
    icon: CalendarDays,
    title: 'Calendar',
    subtitle: 'Events, tasks, recurrence, and private schedules',
    href: '/calendar',
    delay: 0.16,
  },
  {
    id: 'btn-workout-start',
    icon: Dumbbell,
    title: 'Workout',
    subtitle: 'Routines, live sessions, sets, and local history',
    href: '/workout',
    delay: 0.24,
  },
] as const;

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="flex h-full w-full items-center justify-center overflow-y-auto bg-zinc-950 px-6 py-10">
      <div className="w-full max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24 }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-red-400">thebestappeva</p>
          <h1 className="mt-4 text-4xl font-semibold text-white md:text-5xl">AI and Docs, without the extra tabs.</h1>
          <p className="mt-4 text-base leading-7 text-zinc-300">
            Choose the workspace you want to open. AI handles conversations, tools, and artifacts. Docs keeps your files, templates, rewrites, and exports in one local workspace.
          </p>
        </motion.div>
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-4">
          {cards.map(({ id, icon: Icon, title, subtitle, href, delay }) => (
            <motion.button
              key={id}
              id={id}
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 280, damping: 18, delay }}
              onClick={() => navigate(href)}
              className="cursor-pointer rounded-[32px] border border-red-500/25 bg-red-600 px-8 py-10 text-left text-white shadow-2xl shadow-red-950/50 transition-shadow duration-300 hover:bg-red-500 hover:shadow-red-500/20"
            >
              <Icon size={40} strokeWidth={2.6} className="text-white" />
              <div className="mt-8">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-red-100/90">Open workspace</p>
                <h2 className="mt-3 text-3xl font-black uppercase tracking-[0.18em]">{title}</h2>
                <p className="mt-4 max-w-sm text-sm leading-6 text-red-50/90">{subtitle}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
