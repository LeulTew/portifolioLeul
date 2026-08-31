import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { cn } from '@/lib/utils';

interface RotatingGearProps {
  className?: string;
  theme?: string;
  speed?: number;
  rotationOffset?: number;
}

export function RotatingGear({
  className,
  theme = 'dark',
  speed = 1,
  rotationOffset = 0,
}: RotatingGearProps) {
  const gear1Ref = useRef<SVGGElement>(null);
  const gear2Ref = useRef<SVGGElement>(null);
  const gear3Ref = useRef<SVGGElement>(null);

  const isLight = theme === 'light';
  const strokeColor = isLight ? 'rgba(0,0,0,0.45)' : 'rgba(0, 255, 157, 0.45)';
  const secondaryStroke = isLight ? 'rgba(0,0,0,0.25)' : 'rgba(255, 255, 255, 0.2)';
  const dotColor = isLight ? '#059669' : '#00ff9d';

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Smooth continuous rotational tick
      if (gear1Ref.current) {
        gsap.to(gear1Ref.current, {
          rotation: '+=360',
          duration: 30 / speed,
          repeat: -1,
          ease: 'none',
          transformOrigin: '50% 50%',
        });
      }

      if (gear2Ref.current) {
        gsap.to(gear2Ref.current, {
          rotation: '-=360',
          duration: 20 / speed,
          repeat: -1,
          ease: 'none',
          transformOrigin: '50% 50%',
        });
      }

      if (gear3Ref.current) {
        gsap.to(gear3Ref.current, {
          rotation: '+=360',
          duration: 15 / speed,
          repeat: -1,
          ease: 'none',
          transformOrigin: '50% 50%',
        });
      }
    });

    return () => ctx.revert();
  }, [speed]);

  return (
    <div className={cn('relative flex items-center justify-center select-none pointer-events-none', className)}>
      <svg
        viewBox="0 0 400 400"
        className="w-full h-full max-w-[320px] max-h-[320px] overflow-visible"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Large Outer Dial Ring */}
        <circle
          cx="200"
          cy="200"
          r="160"
          fill="none"
          stroke={secondaryStroke}
          strokeWidth="1"
          strokeDasharray="4 8"
        />

        {/* Main Central Planet Gear */}
        <g ref={gear1Ref}>
          <circle
            cx="200"
            cy="200"
            r="120"
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeDasharray="6 6"
          />
          {/* Planetary teeth/dots */}
          {[...Array(12)].map((_, i) => {
            const angle = (i * 30 * Math.PI) / 180;
            const x = 200 + 120 * Math.cos(angle);
            const y = 200 + 120 * Math.sin(angle);
            return <circle key={i} cx={x} cy={y} r="2.5" fill={dotColor} />;
          })}
        </g>

        {/* Secondary Medium Gear */}
        <g ref={gear2Ref}>
          <circle
            cx="200"
            cy="200"
            r="75"
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.2"
            strokeDasharray="3 4"
          />
          {[...Array(8)].map((_, i) => {
            const angle = (i * 45 * Math.PI) / 180;
            const x = 200 + 75 * Math.cos(angle);
            const y = 200 + 75 * Math.sin(angle);
            return <circle key={i} cx={x} cy={y} r="2" fill={dotColor} />;
          })}
        </g>

        {/* Small Inner Sun Core */}
        <g ref={gear3Ref}>
          <circle
            cx="200"
            cy="200"
            r="35"
            fill="none"
            stroke={secondaryStroke}
            strokeWidth="1"
          />
          <circle cx="200" cy="200" r="4" fill={dotColor} />
        </g>
      </svg>
      
      {/* Coordinate Telemetry underneath gear */}
      <span className={cn(
        'absolute bottom-0 right-0 font-mono text-[9px] tracking-widest uppercase opacity-40',
        isLight ? 'text-neutral-600' : 'text-neutral-400'
      )}>
        mech.rot({Math.round(rotationOffset)}deg)
      </span>
    </div>
  );
}
