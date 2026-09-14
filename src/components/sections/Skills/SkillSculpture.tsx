import { useId, useState, type ReactNode } from 'react';
import { SKILL_CHAPTERS, type SkillScene } from './skillsData';
import {
  DELIVERY_NODES, LEARNING_NODES, getMaterialGeometry, materialMatrix, projectMaterialPoint, type MaterialQuality,
} from './skillGeometry';
import styles from './Skills.module.css';

function Piece({ children, depth = 'middle' }: { children: ReactNode; depth?: 'back' | 'middle' | 'front' }) {
  return <g data-material-piece="" data-depth={depth}>{children}</g>;
}

function Trace({ d }: { d: string }) {
  return <path d={d} pathLength={1} strokeDasharray="1" data-material-trace=""
    className={styles.artAccentLine} fill="none" />;
}

function CodeDetails({ face }: { face: string }) {
  return <>
    <Piece>
      <g transform={materialMatrix('languages')} data-asset-feature="chip-pins">
        <path d="M-164-80h-18m18 32h-18m18 32h-18m18 32h-18m18 32h-18m18 32h-18M164-80h18m-18 32h18m-18 32h18m-18 32h18m-18 32h18m-18 32h18M-112-128v-16m45 16v-16m45 16v-16m45 16v-16m45 16v-16m45 16v-16M-112 128v16m45-16v16m45-16v16m45-16v16m45-16v16m45-16v16"
          className={styles.artLine} strokeWidth="4" />
        <rect x="-96" y="-73" width="192" height="146" rx="8"
          className={styles.artAccentLine} fill="none" opacity=".45" />
      </g>
    </Piece>
    <Piece depth="back">
      <g transform="translate(100 148) skewY(-25)">
        <rect width="145" height="102" rx="8" fill={face} className={styles.artEdge} />
        <text x="18" y="29" className={styles.artTiny}>.ts</text>
        <path d="M18 49h91m-77 17h83m-83 17h54" className={styles.artLine} strokeWidth="4" />
        <path d="M18 49h34m-20 17h24" className={styles.artAccentLine} strokeWidth="4" />
      </g>
    </Piece>
    <Piece depth="front">
      <g transform="translate(527 162) skewY(24)">
        <rect width="91" height="108" rx="9" className={styles.artDarkSide} />
        <text x="15" y="35" className={styles.artLightCode}>0101</text>
        <text x="15" y="60" className={styles.artLightCode}>1010</text>
        <text x="15" y="85" className={styles.artLightCode}>0011</text>
      </g>
    </Piece>
    <Trace d="M196 288C216 326 242 352 279 366" />
    <Trace d="M471 257C494 245 512 248 535 260" />
  </>;
}

function InterfaceDetails({ face }: { face: string }) {
  return <>
    <Piece>
      <g transform={materialMatrix('interfaces')} data-asset-feature="interface-system">
        {[-104, -89, -74].map(x => <circle key={x} cx={x} cy="-90" r="4" className={styles.artMint} />)}
        <rect x="-111" y="-40" width="29" height="6" rx="2" className={styles.artFaint} />
        <rect x="-111" y="-18" width="22" height="6" rx="2" className={styles.artFaint} />
        <rect x="-43" y="28" width="62" height="55" rx="5" className={styles.artMint} fillOpacity=".22" />
        <rect x="43" y="28" width="64" height="55" rx="5" className={styles.artMint} fillOpacity=".1" />
      </g>
    </Piece>
    <Piece depth="front">
      <g transform="matrix(.94 .3 -.22 .96 134 299)">
        <rect width="97" height="166" rx="15" fill={face} className={styles.artEdge} />
        <rect x="8" y="9" width="81" height="148" rx="10" className={styles.artInset} />
        <path d="M32 20h32M22 113h52M22 129h34" className={styles.artLine} strokeWidth="4" />
        <rect x="21" y="45" width="55" height="44" rx="4" className={styles.artMint} />
      </g>
    </Piece>
    <Piece depth="back">
      <g transform="translate(558 162)">
        {[25, 85, 145].map(angle => <ellipse key={angle} rx="52" ry="21"
          transform={`rotate(${angle})`} className={styles.artLine} fill="none" />)}
        <circle r="8" className={styles.artMint} />
      </g>
    </Piece>
    <Trace d="M222 412C273 445 319 454 351 451" />
  </>;
}

function LearningDetails({ face }: { face: string }) {
  return <>
    <Piece depth="back">
      <g data-asset-feature="neural-volume" transform={materialMatrix('intelligence')}>
        <path d="M-139-100v203M-15-135v270M143-100v203"
          className={styles.artGrid} strokeDasharray="3 7" />
        <Trace d="M-112-74C-60-55-52 90 0 108M0-108C55-83 60 55 112 74M-112 74C-64 49-50-89 0-108M0 108C54 81 63-53 112-74" />
      </g>
    </Piece>
    <Piece>
      {LEARNING_NODES.map((point, index) => {
        const [x, y] = projectMaterialPoint('intelligence', point);
        return <g key={index} data-material-node="" data-material-origin={`${x} ${y}`}>
          <circle cx={x} cy={y} r={[10, 14, 10, 12, 12, 10, 14, 10][index]} fill={face} className={styles.artEdge} />
          <circle cx={x} cy={y} r="4" className={styles.artMint} />
        </g>;
      })}
      <circle cx="360" cy="274" r="20" className={styles.artMint} />
      <circle cx="360" cy="274" r="6" className={styles.artDarkSide} />
    </Piece>
    <Piece depth="back">
      <g transform="translate(98 281) skewY(-24)">
        <rect width="90" height="100" rx="8" fill={face} className={styles.artEdge} />
        {[0, 1, 2].map(row => [0, 1, 2].map(col => (
          <rect key={`${row}-${col}`} x={15 + col * 22} y={17 + row * 24} width="13" height="14" rx="2"
            className={row === col ? styles.artMint : styles.artFaint} />
        )))}
      </g>
    </Piece>
    <Piece depth="front">
      <g transform="translate(544 272) skewY(23)">
        <rect width="74" height="87" rx="8" fill={face} className={styles.artEdge} />
        <path d="m19 44 13 13 24-29" className={styles.artAccentLine} strokeWidth="4" fill="none" />
      </g>
    </Piece>
    <Trace d="M179 311C210 302 231 289 257 280" />
    <Trace d="M462 300C497 307 515 312 546 313" />
  </>;
}

function DataDetails({ face }: { face: string }) {
  return <>
    <Piece depth="front">
      <g transform="translate(96 275) skewY(-25)">
        <rect width="125" height="142" rx="8" fill={face} className={styles.artEdge} />
        <text x="14" y="28" className={styles.artTiny}>SELECT</text>
        <path d="M14 46h97M14 73h97M14 100h97M44 46v80M82 46v80"
          className={styles.artLine} fill="none" />
        <path d="M17 60h15M54 87h16M90 115h16" className={styles.artAccentLine} strokeWidth="4" />
      </g>
    </Piece>
    <Piece>
      <g data-asset-feature="storage-tiers">
      {[0, 1, 2].map(index => (
        <g key={index} data-material-node="" data-material-origin={`360 ${256 + index * 52}`}>
          <circle cx={484} cy={248 + index * 52} r="4" className={styles.artMint} />
          <path d={`M269 ${255 + index * 52}q35 19 65 20`} className={styles.artLine} fill="none" strokeWidth="3" />
        </g>
      ))}
      </g>
    </Piece>
    <Piece depth="back">
      <g transform="translate(548 264)">
        <path d="m0 0 31-15 31 15-31 16Z" className={styles.artMint} />
        <path d="m0 14 31 16 31-16m-62 15 31 16 31-16" className={styles.artAccentLine} fill="none" />
      </g>
    </Piece>
    <Trace d="M219 358C239 410 269 437 318 453" />
    <Trace d="M525 195C556 204 576 222 580 247" />
  </>;
}

function DesignDetails({ face }: { face: string }) {
  const [tipX, tipY] = projectMaterialPoint('design', [0, 160]);
  return <>
    <Piece>
      <g data-asset-feature="bezier-work">
        <Trace d={`M${tipX} ${tipY}C458 454 510 161 614 270`} />
        <path d={`M${tipX} ${tipY} 458 454M510 161 614 270`}
          className={styles.artLine} fill="none" />
        <circle cx="458" cy="454" r="5" className={styles.artMint} />
        <circle cx="510" cy="161" r="5" className={styles.artMint} />
        <rect x="609" y="265" width="10" height="10" fill={face} className={styles.artEdge} />
      </g>
    </Piece>
    <Piece depth="front">
      <g transform={materialMatrix('design')} data-asset-feature="vector-nib">
        <circle cx="0" cy="-70" r="11" className={styles.artDarkSide} />
        <path d="M-58-108h116" className={styles.artLine} strokeWidth="3" />
      </g>
    </Piece>
    <Piece depth="back">
      <g transform="translate(521 342) skewY(23)">
        <rect width="104" height="76" rx="8" fill={face} className={styles.artEdge} />
        <circle cx="25" cy="28" r="10" className={styles.artDarkSide} />
        <circle cx="52" cy="28" r="10" className={styles.artMint} />
        <circle cx="79" cy="28" r="10" className={styles.artFaint} />
        <path d="M16 55h72" className={styles.artLine} strokeWidth="4" />
      </g>
    </Piece>
    <Trace d="M170 435C251 451 266 447 287 440" />
  </>;
}

function DeliveryDetails({ face }: { face: string }) {
  return <>
    <Piece>
      <g data-asset-feature="collaborating-modules">
      {DELIVERY_NODES.map((point, index) => {
        const [x, y] = projectMaterialPoint('delivery', point);
        const height = [58, 93, 70][index];
        return <g key={index} data-material-node="" data-material-origin={`${x} ${y}`}>
          <path d={`M${x - 54} ${y}V${y + height}L${x} ${y + height + 28}V${y + 28}Z`}
            className={styles.artSide} />
          <path d={`M${x} ${y + 28}V${y + height + 28}L${x + 54} ${y + height}V${y}Z`}
            className={styles.artDarkSide} />
          <path d={`M${x - 54} ${y} ${x} ${y - 28} ${x + 54} ${y} ${x} ${y + 28}Z`}
            fill={index === 2 ? 'var(--skill-mint)' : face} className={styles.artEdge} />
          <path d={`M${x - 38} ${y + 32}l24 12m-24 1 24 12`} className={styles.artLine} strokeWidth="3" />
        </g>;
      })}
      </g>
    </Piece>
    <Piece depth="back">
      <g transform="translate(106 207) skewY(-18)">
        <path d="M0 0h108v64H47L25 84V64H0Z" fill={face} className={styles.artEdge} />
        <path d="M20 22h66M20 42h42" className={styles.artLine} strokeWidth="4" />
      </g>
    </Piece>
    <Piece depth="front">
      <g transform="translate(540 311) skewY(23)">
        <rect width="74" height="84" rx="8" fill={face} className={styles.artEdge} />
        <path d="m19 39 13 13 23-28" className={styles.artAccentLine} fill="none" strokeWidth="4" />
      </g>
    </Piece>
    <Trace d="M199 280C223 288 238 290 256 290" />
    <Trace d="M465 354C494 361 521 356 545 350" />
  </>;
}

const DETAILS = {
  languages: CodeDetails, interfaces: InterfaceDetails, intelligence: LearningDetails,
  data: DataDetails, design: DesignDetails, delivery: DeliveryDetails,
};
const SCENES = SKILL_CHAPTERS.map(chapter => chapter.scene);

export function SkillSculpture({ scene = 'languages', shared = false }: { scene?: SkillScene; shared?: boolean }) {
  const id = useId().replace(/:/g, '');
  const [quality] = useState<MaterialQuality>(() =>
    shared && typeof document !== 'undefined' && document.documentElement.dataset.quality === 'low'
      ? 'economy' : 'full');
  const geometry = getMaterialGeometry(scene, quality);
  const initial = getMaterialGeometry('languages', quality);
  const raster = shared && quality === 'economy';

  const drawing = (
    <svg className={styles.artifact} viewBox="0 0 720 580" fill="none"
      data-skill-sculpture={raster ? undefined : ''} data-material-quality={quality}
      data-shared={shared || undefined} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-face`} x1="220" y1="100" x2="496" y2="437" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--skill-face)" />
          <stop offset=".55" stopColor="var(--skill-face-low)" />
          <stop offset="1" stopColor="var(--skill-shade)" />
        </linearGradient>
        <radialGradient id={`${id}-shadow`}>
          <stop stopColor="var(--skill-shadow)" stopOpacity=".24" />
          <stop offset="1" stopColor="var(--skill-shadow)" stopOpacity="0" />
        </radialGradient>
        <path id={`${id}-shell`} d={geometry.shell} data-material-shell="" data-art-morph=""
          data-morph-from={initial.shell} />
        <path id={`${id}-panel`} d={geometry.panel} data-material-panel="" data-art-morph=""
          data-morph-from={initial.panel} />
      </defs>
      <g data-material-floor="">
        <ellipse cx="363" cy="484" rx="255" ry="64" fill={`url(#${id}-shadow)`} />
        <path d="m64 423 297 145 302-145M115 399l300 145M165 375l302 145M611 399 312 544M561 375 261 520"
          className={styles.artGrid} />
      </g>
      <g data-material-foreground="" opacity={geometry.surfaceOpacity}>
        <use href={`#${id}-shell`} transform="translate(0 -25)" className={styles.materialDraft} />
      </g>
      <g data-material-body={raster ? undefined : ''}>
        <g data-material-vector="">
          <g data-material-surfaces="" opacity={geometry.surfaceOpacity}>
            <g data-material-deep="" transform={`translate(8 ${geometry.depth})`}>
              <use href={`#${id}-shell`} className={styles.artDarkSide} fillRule="evenodd" />
            </g>
            <g data-material-middle="" transform={`translate(4 ${geometry.depth / 2})`}>
              <use href={`#${id}-shell`} className={styles.artSide} fillRule="evenodd" />
            </g>
            <use href={`#${id}-shell`} fill={`url(#${id}-face)`} className={styles.artEdge}
              fillRule="evenodd" data-material-front="" />
            <use href={`#${id}-panel`} className={styles.artInset} data-material-well="" opacity={geometry.panelOpacity} />
            <use href={`#${id}-shell`} className={styles.materialHighlight} fillRule="evenodd" />
          </g>
          {geometry.signals.map((signal, index) => (
            <path key={index} d={signal.d} opacity={signal.opacity} data-material-signal={index}
              className={styles.materialSignal} />
          ))}
        </g>
      </g>
      {(shared ? SCENES : [scene]).map(key => {
        const Detail = DETAILS[key];
        return <g key={key} data-material-detail={key}>
          <Detail face={`url(#${id}-face)`} />
        </g>;
      })}
    </svg>
  );
  if (!raster) return drawing;
  return <div className={`${styles.artifact} ${styles.rasterSculpture}`}
    data-skill-sculpture="" data-material-quality={quality} aria-hidden="true">
    <div className={styles.rasterBody} data-material-body="">
      <canvas width={720} height={580} className={styles.materialCanvas} data-material-canvas="" />
      {drawing}
    </div>
  </div>;
}
