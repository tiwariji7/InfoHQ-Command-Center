import React, { useEffect, useRef, useState } from 'react';
import { useInView, animate, useReducedMotion } from 'framer-motion';

export interface CountUpProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  formatIndianCommas?: boolean;
  className?: string;
}

/**
 * Motion 4: Number Count-Up
 * Smooth hardware count-up from 0 to value over 1.5s easeOut.
 * Triggers once when entering viewport. Preserves Indian currency commas & formatting.
 */
export const CountUp: React.FC<CountUpProps> = ({
  value,
  duration = 1.5,
  prefix = '',
  suffix = '',
  decimals = 0,
  formatIndianCommas = true,
  className = '',
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-20px' });
  const shouldReduceMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState<number>(() => (shouldReduceMotion ? value : 0));

  useEffect(() => {
    if (shouldReduceMotion) {
      setDisplayValue(value);
      return;
    }

    if (!isInView) return;

    const controls = animate(0, value, {
      duration,
      ease: 'easeOut',
      onUpdate: (latest) => {
        setDisplayValue(latest);
      },
    });

    return () => controls.stop();
  }, [isInView, value, duration, shouldReduceMotion]);

  const formattedNumber = React.useMemo(() => {
    const fixed = displayValue.toFixed(decimals);
    const num = parseFloat(fixed);

    if (isNaN(num)) return '0';

    if (formatIndianCommas) {
      // Format with Indian locale number grouping
      const parts = fixed.split('.');
      const intPart = parseInt(parts[0], 10);
      const formattedInt = isNaN(intPart) ? '0' : intPart.toLocaleString('en-IN');
      return parts.length > 1 && decimals > 0 ? `${formattedInt}.${parts[1]}` : formattedInt;
    }

    return num.toLocaleString();
  }, [displayValue, decimals, formatIndianCommas]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {formattedNumber}
      {suffix}
    </span>
  );
};
