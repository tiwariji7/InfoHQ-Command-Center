import type { Variants } from 'framer-motion';

/**
 * Shared Motion System Configuration for InfoHQ Command Center
 * Pure hardware-accelerated transforms, opacity, and subtle blur.
 * Zero layout shifts (CLS), fully accessible with prefers-reduced-motion support.
 */

export const easeOutCubic = [0.16, 1, 0.3, 1] as const;
export const easeInOutCubic = [0.65, 0, 0.35, 1] as const;

// Helper to check if running on a mobile viewport (where heavy blurs are GPU-expensive)
export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
}

// ============================================================================
// MOTION 1: Staggered Card Reveal
// ============================================================================
export const cardRevealContainerVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.04,
    },
  },
};

export const cardRevealItemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.96,
  },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: 'easeOut',
    },
  },
};

// ============================================================================
// MOTION 2: Blur-Fade Page Transition
// Mobile caps blur at 4px, desktop uses 8px.
// ============================================================================
export const getPageTransitionVariants = (): Variants => {
  const isMobile = isMobileViewport();
  const blurAmount = isMobile ? '4px' : '8px';

  return {
    initial: {
      opacity: 0,
      filter: `blur(${blurAmount})`,
      y: 8,
    },
    animate: {
      opacity: 1,
      filter: 'blur(0px)',
      y: 0,
      transition: {
        duration: 0.4,
        ease: 'easeOut',
      },
    },
    exit: {
      opacity: 0,
      filter: `blur(${blurAmount})`,
      y: -6,
      transition: {
        duration: 0.28,
        ease: 'easeIn',
      },
    },
  };
};

// Fallback variants for users with prefers-reduced-motion enabled
export const reducedMotionVariants: Variants = {
  hidden: { opacity: 1, y: 0, scale: 1, filter: 'none' },
  show: { opacity: 1, y: 0, scale: 1, filter: 'none', transition: { duration: 0 } },
  initial: { opacity: 1, y: 0, scale: 1, filter: 'none' },
  animate: { opacity: 1, y: 0, scale: 1, filter: 'none', transition: { duration: 0 } },
  exit: { opacity: 1, y: 0, scale: 1, filter: 'none', transition: { duration: 0 } },
};

// ============================================================================
// MOTION 5: SVG Chart Line Draw
// ============================================================================
export const chartLineDrawVariants: Variants = {
  hidden: {
    pathLength: 0,
    opacity: 0,
  },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: {
        duration: 1.2,
        ease: 'easeInOut',
      },
      opacity: {
        duration: 0.3,
      },
    },
  },
};

export const chartBarGrowVariants: Variants = {
  hidden: {
    scaleY: 0,
    opacity: 0,
  },
  visible: {
    scaleY: 1,
    opacity: 1,
    transition: {
      duration: 0.7,
      ease: 'easeOut',
    },
  },
};
