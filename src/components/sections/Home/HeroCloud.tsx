import { useEffect, useRef, useState, type CSSProperties } from 'react';
import styles from './HeroCloud.module.css';

export interface HeroCloudProps {
  className?: string;
  /** Pauses ambient drift; Home owns entrance and inherited --shut (0-1). */
  active?: boolean;
  /** Inherits the ancestor's data-theme when omitted. */
  theme?: string;
  /** What the night mist drifts over: the island scene, or the fallback's plain page. */
  ground?: 'scene' | 'plain';
}

type CloudLayer = 'body' | 'vapor' | 'shear' | 'mask';

/** The authored SVG noise is baked once, not evaluated during every fog frame. */
export function HeroCloud({ className, active = true, theme, ground = 'scene' }: HeroCloudProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [moving, setMoving] = useState(false);
  const [vectorFallback, setVectorFallback] = useState(false);
  const fallbackRequested = useRef(false);
  const cloudTheme = theme === 'light' || theme === 'dark' ? theme : undefined;
  const texture = (layer: CloudLayer) => `/textures/hero-cloud/${layer}.${vectorFallback ? 'svg' : 'webp'}`;
  const maskStyle: CSSProperties & { '--cloud-mask': string } = { '--cloud-mask': `url("${texture('mask')}")` };
  const textureError = () => {
    if (vectorFallback) {
      console.error('Hero cloud source texture could not be loaded.');
    } else if (!fallbackRequested.current) {
      fallbackRequested.current = true;
      console.warn('Hero cloud raster texture unavailable; using its vector source.');
      setVectorFallback(true);
    }
  };

  useEffect(() => {
    const root = rootRef.current;
    setMoving(false);
    if (!root || !active) return;

    let disposed = false;
    let inView = false;
    const motionQuery = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
    const syncMotion = () => {
      if (!disposed) {
        setMoving(inView && document.visibilityState !== 'hidden' && !motionQuery?.matches);
      }
    };
    const observer = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((entries) => {
        const entry = entries.find(candidate => candidate.target === root);
        if (!entry) return;
        inView = entry.isIntersecting && entry.intersectionRatio > 0;
        syncMotion();
      }, { threshold: 0 })
      : null;

    observer?.observe(root);
    document.addEventListener('visibilitychange', syncMotion);
    if (motionQuery?.addEventListener) motionQuery.addEventListener('change', syncMotion);
    else motionQuery?.addListener(syncMotion);

    return () => {
      disposed = true;
      observer?.disconnect();
      document.removeEventListener('visibilitychange', syncMotion);
      if (motionQuery?.removeEventListener) motionQuery.removeEventListener('change', syncMotion);
      else motionQuery?.removeListener(syncMotion);
    };
  }, [active]);

  return (
    <div
      ref={rootRef}
      className={[styles.cloud, className].filter(Boolean).join(' ')}
      aria-hidden="true"
      data-hero-cloud=""
      data-cloud-theme={cloudTheme}
      data-cloud-ground={ground}
      data-cloud-texture={vectorFallback ? 'vector' : 'raster'}
      data-motion={active && moving ? 'running' : 'paused'}
    >
      <div className={styles.dissolving} style={maskStyle} data-cloud-mask="">
        <img className={styles.body} src={texture('body')} alt="" draggable={false} onError={textureError} />
        <div className={styles.vapor}>
          <img className={styles.layerImage} src={texture('vapor')} alt="" draggable={false} onError={textureError} />
        </div>
        <div className={styles.shear}>
          <img className={styles.layerImage} src={texture('shear')} alt="" draggable={false} onError={textureError} />
        </div>
      </div>
      <img className={styles.maskSource} src={texture('mask')} alt="" hidden onError={textureError} />
    </div>
  );
}
