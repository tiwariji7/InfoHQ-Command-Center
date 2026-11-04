import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { getPageTransitionVariants, reducedMotionVariants } from '../../lib/motion.js';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Motion 2: Blur-Fade Page Transition
 * Animates in new page with subtle blur-fade (opacity 0→1, blur 8px→0, 0.4s)
 * Exits with opacity 1→0, blur 0→8px (0.28s)
 * On mobile viewports blur is limited to 4px to prevent GPU frame drops.
 */
export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  className = 'w-full',
}) => {
  const shouldReduceMotion = useReducedMotion();
  const variants = React.useMemo(() => {
    if (shouldReduceMotion) return reducedMotionVariants;
    return getPageTransitionVariants();
  }, [shouldReduceMotion]);

  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={className}
      style={{ willChange: 'opacity, transform, filter' }}
    >
      {children}
    </motion.div>
  );
};

