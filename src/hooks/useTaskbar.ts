import { useState, useEffect, useRef } from 'react';

export const useTaskbar = (isMobile: boolean) => {
  const [isTaskbarExpanded, setIsTaskbarExpanded] = useState(false);
  const [taskbarPosition, setTaskbarPosition] = useState(() => ({
    x: 24,
    y: typeof window !== 'undefined' ? window.innerHeight - 80 : 600,
  }));
  const taskbarRef = useRef<HTMLDivElement>(null);

  // Reset position on window resize to keep it at bottom-left
  useEffect(() => {
    const handleResize = () => {
      setTaskbarPosition({
        x: 24,
        y: window.innerHeight - 80
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    taskbarRef,
    taskbarPosition,
    isTaskbarExpanded,
    setIsTaskbarExpanded,
    handleTaskbarMouseDown: () => {}, // No-op
    handleTaskbarTouchStart: () => {}, // No-op
    isDraggingTaskbar: false
  };
};
