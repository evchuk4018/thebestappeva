import { motion } from 'motion/react';
import type { HTMLMotionProps } from 'motion/react';

export function WorkoutActionButton({ className = '', ...props }: HTMLMotionProps<'button'>) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      className={className}
      {...props}
    />
  );
}
