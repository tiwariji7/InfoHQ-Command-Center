import { useState, useRef, useEffect, useCallback } from 'react';

export interface UseDraggableReturn {
  cardRef: React.RefObject<HTMLDivElement>;
  position: { x: number; y: number };
  isDragging: boolean;
  handlePointerDown: (e: React.PointerEvent) => void;
  resetPosition: () => void;
}

export function useDraggable(storageKey?: string): UseDraggableReturn {
  const cardRef = useRef<HTMLDivElement>(null);

  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (storageKey && typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem(`card_pos_${storageKey}`);
        if (saved) return JSON.parse(saved);
      } catch {
        // Fallback
      }
    }
    return { x: 0, y: 0 };
  });

  const positionRef = useRef<{ x: number; y: number }>(position);
  positionRef.current = position;

  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);

  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    posX: number;
    posY: number;
    targetX: number;
    targetY: number;
  }>({
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0,
    targetX: position.x,
    targetY: position.y,
  });

  const rafId = useRef<number | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Only primary mouse button or touch
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    // Do NOT initiate drag if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('a') ||
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('select') ||
      target.closest('[data-no-drag]')
    ) {
      return;
    }

    isDraggingRef.current = true;
    setIsDragging(true);

    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: positionRef.current.x,
      posY: positionRef.current.y,
      targetX: positionRef.current.x,
      targetY: positionRef.current.y,
    };

    if (cardRef.current) {
      cardRef.current.style.willChange = 'transform';
      cardRef.current.style.transition = 'none';
    }

    document.body.style.userSelect = 'none';
    (document.body.style as unknown as { webkitUserSelect?: string }).webkitUserSelect = 'none';

    // Capture pointer if available
    try {
      if (e.currentTarget && typeof (e.currentTarget as HTMLElement).setPointerCapture === 'function') {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }

    e.preventDefault();
  }, []);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;

      const dx = e.clientX - dragStartRef.current.startX;
      const dy = e.clientY - dragStartRef.current.startY;

      // Bound within screen viewport so card cannot be lost
      const maxDistX = Math.max(250, window.innerWidth - 80);
      const maxDistY = Math.max(250, window.innerHeight - 80);

      const newX = Math.min(maxDistX, Math.max(-maxDistX, dragStartRef.current.posX + dx));
      const newY = Math.min(maxDistY, Math.max(-maxDistY, dragStartRef.current.posY + dy));

      dragStartRef.current.targetX = newX;
      dragStartRef.current.targetY = newY;

      // Ultra-smooth 60-120 FPS hardware accelerated update via requestAnimationFrame
      // Zero React component re-renders during active drag!
      if (rafId.current === null) {
        rafId.current = requestAnimationFrame(() => {
          if (cardRef.current) {
            cardRef.current.style.transform = `translate3d(${dragStartRef.current.targetX}px, ${dragStartRef.current.targetY}px, 0)`;
          }
          rafId.current = null;
        });
      }
    };

    const handlePointerUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);

      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }

      const finalPos = {
        x: dragStartRef.current.targetX,
        y: dragStartRef.current.targetY,
      };

      positionRef.current = finalPos;
      setPosition(finalPos);

      if (cardRef.current) {
        cardRef.current.style.willChange = 'auto';
        cardRef.current.style.transition = 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)';
        cardRef.current.style.transform = `translate3d(${finalPos.x}px, ${finalPos.y}px, 0)`;
      }

      document.body.style.userSelect = '';
      (document.body.style as unknown as { webkitUserSelect?: string }).webkitUserSelect = '';

      if (storageKey && typeof window !== 'undefined') {
        try {
          sessionStorage.setItem(`card_pos_${storageKey}`, JSON.stringify(finalPos));
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    };
  }, [storageKey]);

  const resetPosition = useCallback(() => {
    const zeroPos = { x: 0, y: 0 };
    positionRef.current = zeroPos;
    setPosition(zeroPos);
    dragStartRef.current.targetX = 0;
    dragStartRef.current.targetY = 0;

    if (cardRef.current) {
      cardRef.current.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
      cardRef.current.style.transform = 'translate3d(0px, 0px, 0)';
    }

    if (storageKey && typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(`card_pos_${storageKey}`);
      } catch {
        // ignore
      }
    }
  }, [storageKey]);

  return {
    cardRef,
    position,
    isDragging,
    handlePointerDown,
    resetPosition,
  };
}
