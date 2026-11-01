import { useState, useRef, useEffect, useCallback } from 'react';

export interface UseDraggableReturn {
  position: { x: number; y: number };
  isDragging: boolean;
  handlePointerDown: (e: React.PointerEvent) => void;
  resetPosition: () => void;
}

export function useDraggable(storageKey?: string): UseDraggableReturn {
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (storageKey && typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem(`card_pos_${storageKey}`);
        if (saved) return JSON.parse(saved);
      } catch {
        // Fallback to default
      }
    }
    return { x: 0, y: 0 };
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0,
  });

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Only primary mouse button or touch
    if (e.button !== 0) return;

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

    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y,
    };

    // Capture pointer to track movements even if cursor leaves the handle
    if (e.currentTarget && typeof (e.currentTarget as HTMLElement).setPointerCapture === 'function') {
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // Fallback to window listeners
      }
    }
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;

      // Bound within screen viewport so card cannot be lost
      const maxDistX = Math.max(300, window.innerWidth - 120);
      const maxDistY = Math.max(300, window.innerHeight - 120);

      const newX = Math.min(maxDistX, Math.max(-maxDistX, dragRef.current.posX + dx));
      const newY = Math.min(maxDistY, Math.max(-maxDistY, dragRef.current.posY + dy));

      setPosition({ x: newX, y: newY });
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      if (storageKey && typeof window !== 'undefined') {
        try {
          sessionStorage.setItem(`card_pos_${storageKey}`, JSON.stringify(position));
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [isDragging, position, storageKey]);

  const resetPosition = useCallback(() => {
    setPosition({ x: 0, y: 0 });
    if (storageKey && typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(`card_pos_${storageKey}`);
      } catch {
        // ignore
      }
    }
  }, [storageKey]);

  return {
    position,
    isDragging,
    handlePointerDown,
    resetPosition,
  };
}
