import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface WireframeSphereProps {
  className?: string;
  theme?: string;
  particleCount?: number;
  size?: number;
  interactive?: boolean;
}

export function WireframeSphere({
  className,
  theme = 'dark',
  particleCount = 650,
  size = 280,
  interactive = true,
}: WireframeSphereProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  const isLight = theme === 'light';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const dpr = window.devicePixelRatio || 1;
    const width = size;
    const height = size;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Generate 3D Fibonacci Sphere points
    interface Point3D {
      x: number;
      y: number;
      z: number;
      baseX: number;
      baseY: number;
      baseZ: number;
    }

    const radius = size * 0.38;
    const points: Point3D[] = [];
    const phi = Math.PI * (3 - Math.sqrt(5)); // Golden ratio angle

    for (let i = 0; i < particleCount; i++) {
      const y = 1 - (i / (particleCount - 1)) * 2; // y goes from 1 to -1
      const radiusAtY = Math.sqrt(1 - y * y); // radius at y
      const theta = phi * i; // golden angle increment

      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;

      points.push({
        x: x * radius,
        y: y * radius,
        z: z * radius,
        baseX: x * radius,
        baseY: y * radius,
        baseZ: z * radius,
      });
    }

    let angleX = 0;
    let angleY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left - width / 2;
      const y = e.clientY - rect.top - height / 2;
      mouseRef.current.targetX = (x / (width / 2)) * 0.5;
      mouseRef.current.targetY = (y / (height / 2)) * 0.5;
    };

    if (interactive) {
      window.addEventListener('mousemove', handleMouseMove);
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Smooth mouse lerp
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      angleY += 0.008 + mouseRef.current.x * 0.02;
      angleX += 0.004 + mouseRef.current.y * 0.02;

      const cosX = Math.cos(angleX);
      const sinX = Math.sin(angleX);
      const cosY = Math.cos(angleY);
      const sinY = Math.sin(angleY);

      const centerX = width / 2;
      const centerY = height / 2;
      const fov = 400;

      // Sort points by depth for proper transparency layering
      const projectedPoints = points.map((p) => {
        // Rotate around Y axis
        const x1 = p.baseX * cosY - p.baseZ * sinY;
        const z1 = p.baseZ * cosY + p.baseX * sinY;

        // Rotate around X axis
        const y2 = p.baseY * cosX - z1 * sinX;
        const z2 = z1 * cosX + p.baseY * sinX;

        // Perspective projection
        const scale = fov / (fov + z2);
        const projX = centerX + x1 * scale;
        const projY = centerY + y2 * scale;
        const alpha = Math.max(0.08, (z2 + radius) / (2 * radius));

        return { projX, projY, scale, alpha, z: z2 };
      });

      projectedPoints.sort((a, b) => a.z - b.z);

      // Render glowing points
      projectedPoints.forEach((p) => {
        const dotSize = Math.max(0.6, p.scale * 1.4);
        ctx.beginPath();
        ctx.arc(p.projX, p.projY, dotSize, 0, Math.PI * 2);

        if (isLight) {
          ctx.fillStyle = `rgba(16, 185, 129, ${p.alpha * 0.8})`;
        } else {
          ctx.fillStyle = `rgba(0, 255, 157, ${p.alpha * 0.85})`;
        }
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (interactive) {
        window.removeEventListener('mousemove', handleMouseMove);
      }
    };
  }, [particleCount, size, isLight, interactive]);

  return (
    <div className={cn('relative flex items-center justify-center select-none', className)}>
      <canvas
        ref={canvasRef}
        style={{ width: `${size}px`, height: `${size}px` }}
        className="pointer-events-none"
      />
      <div
        className={cn(
          'absolute bottom-2 left-2 font-mono text-[9px] tracking-wider uppercase opacity-40',
          isLight ? 'text-neutral-600' : 'text-neutral-400'
        )}
      >
        orb.mesh(fibonacci-650)
      </div>
    </div>
  );
}
