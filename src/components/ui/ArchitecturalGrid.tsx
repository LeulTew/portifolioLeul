import React from 'react';
import { cn } from '@/lib/utils';

interface ArchitecturalGridProps {
  className?: string;
  theme?: string;
  showCoordinates?: boolean;
}

export function ArchitecturalGrid({
  className,
  theme = 'dark',
  showCoordinates = true,
}: ArchitecturalGridProps) {
  const isLight = theme === 'light';

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 z-0 overflow-hidden select-none',
        className
      )}
      aria-hidden="true"
    >
      {/* Background Architectural Grid Pattern */}
      <svg
        className="absolute inset-0 h-full w-full opacity-20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="arch-grid"
            width="80"
            height="80"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 80 0 L 0 0 0 80"
              fill="none"
              stroke={isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.1)'}
              strokeWidth="0.75"
            />
            {/* Subtle Crosshair intersections */}
            <circle
              cx="0"
              cy="0"
              r="1.5"
              fill={isLight ? 'rgba(0, 0, 0, 0.25)' : 'rgba(0, 255, 157, 0.35)'}
            />
          </pattern>
          {/* Hatched Accent Pattern */}
          <pattern
            id="hatched-accent"
            width="8"
            height="8"
            patternTransform="rotate(45 0 0)"
            patternUnits="userSpaceOnUse"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="8"
              stroke={isLight ? 'rgba(0,0,0,0.08)' : 'rgba(0,255,157,0.12)'}
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#arch-grid)" />
      </svg>

      {/* Technical Telemetry Coordinate Tags */}
      {showCoordinates && (
        <>
          <div
            className={cn(
              'absolute top-8 left-10 font-mono text-[10px] tracking-wider uppercase opacity-40',
              isLight ? 'text-neutral-700' : 'text-neutral-400'
            )}
          >
            clip-path: inset(0px 0px 0px)
          </div>
          <div
            className={cn(
              'absolute top-8 right-12 font-mono text-[10px] tracking-wider uppercase opacity-40',
              isLight ? 'text-neutral-700' : 'text-emerald-400'
            )}
          >
            sys.coord: [40.7128° N, 74.0060° W]
          </div>
          <div
            className={cn(
              'absolute bottom-10 left-10 font-mono text-[10px] tracking-wider uppercase opacity-40',
              isLight ? 'text-neutral-700' : 'text-neutral-400'
            )}
          >
            transform: translate3d(0px, 0px, 0)
          </div>
        </>
      )}
    </div>
  );
}
