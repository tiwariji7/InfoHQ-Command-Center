import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  cardRevealItemVariants,
  reducedMotionVariants,
} from '../../lib/motion.js';

interface RevealGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
  delayChildren?: number;
  amount?: number;
  asGrid?: boolean;
}

/**
 * Motion 1: Staggered Container
 * Reveals child cards sequentially from bottom-to-top with subtle scale-up.
 */
export const RevealGroup: React.FC<RevealGroupProps> = ({
  children,
  className = '',
  stagger = 0.08,
  delayChildren = 0.04,
  amount = 0.15,
  ...rest
}) => {
  const shouldReduceMotion = useReducedMotion();

  const containerVariants = React.useMemo(() => {
    if (shouldReduceMotion) return reducedMotionVariants;
    return {
      hidden: { opacity: 0 },
      show: {
        opacity: 1,
        transition: {
          staggerChildren: stagger,
          delayChildren: delayChildren,
        },
      },
    };
  }, [shouldReduceMotion, stagger, delayChildren]);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
      className={className}
      {...(rest as any)}
    >
      {children}
    </motion.div>
  );
};

interface RevealItemProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Motion 1: Individual Staggered Card
 * Animate: opacity 0→1, y 20→0, scale 0.96→1, duration 0.5s easeOut.
 */
export const RevealItem: React.FC<RevealItemProps> = ({
  children,
  className = '',
  style,
  ...rest
}) => {
  const shouldReduceMotion = useReducedMotion();
  const variants = shouldReduceMotion ? reducedMotionVariants : cardRevealItemVariants;

  return (
    <motion.div
      variants={variants}
      className={className}
      style={style}
      {...(rest as any)}
    >
      {children}
    </motion.div>
  );
};
