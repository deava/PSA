'use client';

import { Suspense, useState } from 'react';
import { ClockWidget } from './clock-widget';
import { useClockWidgetState } from '@/lib/hooks/use-clock-widget-state';

export function ClockWidgetManager() {
  const { isPopped, dock, isHydrated } = useClockWidgetState();
  const [hovered, setHovered] = useState(false);

  if (!isHydrated || !isPopped) return null;

  return (
    <>
      {/* Invisible hover trigger strip on the left edge */}
      <div
        className="fixed z-40"
        style={{ bottom: 0, left: 0, width: '12px', height: '80px' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />

      {/* Clock widget with slide-in from left effect */}
      <div
        className="fixed z-50 transition-all duration-300 ease-out"
        style={{
          bottom: '1rem',
          left: '1rem',
          opacity: hovered ? 1 : 0,
          transform: hovered ? 'translateX(0)' : 'translateX(-120%)',
          pointerEvents: hovered ? 'auto' : 'none',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <Suspense fallback={null}>
          <ClockWidget isVisible={true} onDock={dock} hidden={false} managed={true} />
        </Suspense>
      </div>
    </>
  );
}
