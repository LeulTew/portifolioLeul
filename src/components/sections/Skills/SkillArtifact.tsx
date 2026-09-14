import { useId, type ReactNode } from 'react';
import type { SkillScene } from './skillsData';
import styles from './Skills.module.css';

function Part({ children }: { children: ReactNode }) {
  return <g data-art-part="">{children}</g>;
}

function Trace({ d, accent = false }: { d: string; accent?: boolean }) {
  return (
    <path
      d={d}
      pathLength={1}
      strokeDasharray="1"
      data-art-trace=""
      className={accent ? styles.artAccentLine : styles.artLine}
      fill="none"
    />
  );
}

function CodeEngine({ face, shade }: { face: string; shade: string }) {
  return (
    <>
      <Part>
        <path d="M190 344 405 244 574 330 359 438Z" fill={shade} className={styles.artEdge} />
        <path d="M190 344v29l169 89v-24Z" className={styles.artSide} />
        <path d="M359 438v24l215-108v-24Z" className={styles.artDarkSide} />
        <path d="m214 353 145 75 189-96" className={styles.artLine} fill="none" />
      </Part>
      <Part>
        <path d="m206 280 197-93 155 80-197 98Z" fill={face} className={styles.artEdge} />
        <path d="M206 280v27l155 80v-22Z" className={styles.artSide} />
        <path d="M361 365v22l197-96v-24Z" className={styles.artDarkSide} />
        <path d="m238 280 166-78 122 64-165 80Z" className={styles.artInset} />
        <path d="m273 284 127-60 89 45-127 63Z" className={styles.artMint} />
        <g className={styles.artCode} transform="matrix(1 .5 -1 .5 384 268)">
          <path d="M-40-30h-12q-12 0-12 12v12q0 9-12 9 12 0 12 9v12q0 12 12 12h12M40-30h12q12 0 12 12v12q0 9 12 9-12 0-12 9v12q0 12-12 12H40" fill="none" strokeWidth="5" />
          <path d="m12-30-24 60" fill="none" strokeWidth="4" />
        </g>
      </Part>
      <Part>
        <g transform="translate(113 124) skewY(-25)">
          <rect width="177" height="107" rx="9" fill={face} className={styles.artEdge} />
          <path d="M18 24h48M18 46h100M33 64h106M33 82h68" className={styles.artLine} fill="none" strokeWidth="5" />
          <path d="M18 24h26M33 64h42" className={styles.artAccentLine} fill="none" strokeWidth="5" />
          <text x="128" y="29" className={styles.artTiny}>.ts</text>
        </g>
      </Part>
      <Part>
        <g transform="translate(473 106) skewY(27)">
          <rect width="111" height="112" rx="10" className={styles.artDarkSide} />
          <text x="18" y="40" className={styles.artLightCode}>0101</text>
          <text x="18" y="64" className={styles.artLightCode}>1010</text>
          <text x="18" y="88" className={styles.artLightCode}>0011</text>
        </g>
      </Part>
      <Trace d="m203 247 0 63 90 47" accent />
      <Trace d="m500 224 0 100-80 40" accent />
      <g data-art-signal="" className={styles.artMint}>
        <circle cx="204" cy="282" r="5" />
        <circle cx="500" cy="288" r="5" />
        <circle cx="417" cy="400" r="5" />
      </g>
      <path d="m323 408 23 12m-5-21 23 12m-5-22 23 12" className={styles.artLine} fill="none" strokeWidth="3" />
    </>
  );
}

function InterfaceEngine({ face, shade }: { face: string; shade: string }) {
  return (
    <>
      <Part>
        <path d="m134 356 272-112 211 100-274 121Z" fill={shade} className={styles.artEdge} />
        <path d="M134 356v22l209 100v-13Z" className={styles.artSide} />
        <path d="M343 465v13l274-121v-13Z" className={styles.artDarkSide} />
      </Part>
      <Part>
        <g transform="matrix(.94 .37 -.48 .82 270 140)">
          <rect width="306" height="238" rx="13" fill={face} className={styles.artEdge} />
          <path d="M0 37h306M68 37v201" className={styles.artLine} fill="none" />
          <circle cx="18" cy="19" r="4" className={styles.artMint} />
          <circle cx="33" cy="19" r="4" className={styles.artFaint} />
          <circle cx="48" cy="19" r="4" className={styles.artFaint} />
          <rect x="15" y="57" width="38" height="7" rx="3" className={styles.artFaint} />
          <path d="M15 85h30m-30 19h30m-30 19h22" className={styles.artLine} strokeWidth="5" />
          <rect x="86" y="58" width="200" height="67" rx="6" className={styles.artInset} />
          <path d="M104 78h76m-76 17h135m-135 14h104" className={styles.artLine} strokeWidth="5" />
          <rect x="86" y="142" width="93" height="73" rx="5" className={styles.artMint} />
          <rect x="192" y="142" width="94" height="73" rx="5" className={styles.artInset} />
          <path d="m110 180 12-13 11 8 17-17" className={styles.artCode} fill="none" strokeWidth="4" />
          <path d="M207 160h55m-55 16h36m-36 17h49" className={styles.artLine} strokeWidth="5" />
        </g>
      </Part>
      <Part>
        <g transform="matrix(.94 .37 -.48 .82 172 228)">
          <rect width="115" height="179" rx="16" fill={face} className={styles.artEdge} />
          <rect x="8" y="9" width="99" height="161" rx="11" className={styles.artInset} />
          <rect x="39" y="17" width="37" height="5" rx="2.5" className={styles.artDarkSide} />
          <rect x="21" y="45" width="72" height="55" rx="5" className={styles.artMint} />
          <path d="M23 119h60m-60 16h43m-43 15h52" className={styles.artLine} strokeWidth="5" />
        </g>
      </Part>
      <Part>
        <g transform="translate(478 114)">
          <ellipse rx="69" ry="28" transform="rotate(28)" className={styles.artLine} fill="none" />
          <ellipse rx="69" ry="28" transform="rotate(88)" className={styles.artLine} fill="none" />
          <ellipse rx="69" ry="28" transform="rotate(148)" className={styles.artLine} fill="none" />
          <circle r="10" className={styles.artMint} />
        </g>
      </Part>
      <Trace d="m258 431 77 36 186-82" accent />
      <g data-art-signal="" className={styles.artMint}>
        <circle cx="297" cy="449" r="5" />
        <circle cx="440" cy="421" r="5" />
      </g>
    </>
  );
}

const NEURONS = [
  [257, 189], [247, 263], [236, 337],
  [354, 142], [353, 219], [351, 296], [350, 373],
  [454, 184], [462, 266], [470, 345],
];

function IntelligenceEngine({ face, shade }: { face: string; shade: string }) {
  return (
    <>
      <Part>
        <path d="m169 409 197-101 208 101-202 104Z" fill={shade} className={styles.artEdge} />
        <path d="M169 409v19l203 104v-19Z" className={styles.artSide} />
        <path d="M372 513v19l202-105v-18Z" className={styles.artDarkSide} />
        <ellipse cx="369" cy="416" rx="121" ry="51" className={styles.artInset} />
        <ellipse cx="369" cy="416" rx="77" ry="30" fill={face} className={styles.artEdge} />
      </Part>
      <Part>
        <path d="M235 146 350 90 478 150 499 364 374 433 222 368Z" fill={face} fillOpacity=".44" className={styles.artEdge} />
        <path d="m235 146 139 62 104-58m-104 58v225" className={styles.artLine} fill="none" />
        {NEURONS.slice(0, 3).map(([x, y], index) => (
          <Trace key={`input-${index}`} d={`M${x} ${y} 353 219 462 266`} />
        ))}
        <Trace d="m257 189 97-47 100 42M247 263l106 33 117 49M236 337l114 36 112-107M354 142l-1 154" accent />
      </Part>
      <Part>
        {NEURONS.map(([x, y], index) => (
          <g key={index} data-art-neuron="">
            <circle cx={x} cy={y} r={index === 4 ? 23 : 12} fill={index === 4 ? 'var(--skill-mint)' : face} className={styles.artEdge} />
            <circle cx={x} cy={y} r={index === 4 ? 8 : 3} className={styles.artDarkSide} />
          </g>
        ))}
      </Part>
      <Part>
        <g transform="translate(106 252) skewY(-24)">
          <rect width="93" height="104" rx="8" fill={face} className={styles.artEdge} />
          {[0, 1, 2].map(row => [0, 1, 2].map(col => (
            <rect key={`${row}-${col}`} x={17 + col * 22} y={20 + row * 24} width="13" height="14" rx="2"
              className={row === col ? styles.artMint : styles.artFaint} />
          )))}
        </g>
        <g transform="translate(538 231) skewY(24)">
          <rect width="75" height="90" rx="8" fill={face} className={styles.artEdge} />
          <path d="m20 46 13 13 24-30" className={styles.artAccentLine} fill="none" strokeWidth="5" />
        </g>
      </Part>
      <Trace d="m189 283 47-20M478 266l63 23" accent />
      <circle cx="353" cy="219" r="34" data-art-signal="" className={styles.artAccentLine} fill="none" />
    </>
  );
}

function DatabaseEngine({ face, shade }: { face: string; shade: string }) {
  return (
    <>
      <Part>
        <path d="m170 386 201-96 202 93-202 108Z" fill={shade} className={styles.artEdge} />
        <path d="M170 386v23l201 105v-23Z" className={styles.artSide} />
        <path d="M371 491v23l202-108v-23Z" className={styles.artDarkSide} />
      </Part>
      {[302, 220, 138].map((y, index) => (
        <Part key={y}>
          <path d={`M263 ${y}v57c0 26 49 47 110 47s110-21 110-47v-57Z`}
            fill={index === 1 ? shade : face} className={styles.artEdge} />
          <ellipse cx="373" cy={y} rx="110" ry="47" fill={face} className={styles.artEdge} />
          <ellipse cx="373" cy={y} rx="86" ry="34" className={index === 1 ? styles.artMint : styles.artInset} />
          <path d={`M285 ${y + 47}q30 20 63 22`} className={styles.artLine} fill="none" strokeWidth="4" />
          <circle cx="436" cy={y + 55} r="4" className={styles.artMint} />
          <circle cx="453" cy={y + 49} r="4" className={styles.artFaint} />
        </Part>
      ))}
      <Part>
        <g transform="translate(103 216) skewY(-25)">
          <rect width="128" height="139" rx="8" fill={face} className={styles.artEdge} />
          <rect x="1" y="1" width="126" height="32" rx="7" className={styles.artInset} />
          <text x="14" y="23" className={styles.artTiny}>SELECT</text>
          <path d="M13 53h102M13 79h102M13 105h102M44 42v79M84 42v79" className={styles.artLine} fill="none" />
          <path d="M14 66h17M56 92h17M96 118h17" className={styles.artAccentLine} strokeWidth="5" />
        </g>
      </Part>
      <Trace d="m211 370 0 39 137 69" accent />
      <Trace d="m491 203 65 34v123l-64 33" />
      <g data-art-signal="">
        <path d="m527 262 28-14 28 14-28 15Z" className={styles.artMint} />
        <path d="m527 277 28 15 28-15" className={styles.artAccentLine} fill="none" />
      </g>
    </>
  );
}

function DesignEngine({ face, shade }: { face: string; shade: string }) {
  return (
    <>
      <Part>
        <path d="m152 374 236-126 212 106-239 137Z" fill={shade} className={styles.artEdge} />
        <path d="M152 374v22l209 118v-23Z" className={styles.artSide} />
        <path d="M361 491v23l239-137v-23Z" className={styles.artDarkSide} />
      </Part>
      <Part>
        <g transform="matrix(.96 .39 -.48 .86 244 108)">
          <rect width="282" height="248" rx="9" fill={face} className={styles.artEdge} />
          <path d="M0 31h282M30 31v217" className={styles.artLine} fill="none" />
          <circle cx="15" cy="16" r="4" className={styles.artMint} />
          <path d="M45 56h211M45 100h211M45 144h211M45 188h211M65 42v192M109 42v192M153 42v192M197 42v192M241 42v192"
            className={styles.artGrid} fill="none" />
          <path d="M66 194C80 194 94 70 144 70S211 194 238 112"
            data-art-morph=""
            data-morph-from="M66 194C110 194 95 194 144 194S204 194 238 194"
            className={styles.artAccentLine} strokeWidth="5" fill="none" />
          <path d="m80 194 14-124h50m0 0h42l52 42" className={styles.artLine} fill="none" />
          {[[66, 194], [144, 70], [238, 112]].map(([x, y]) => (
            <rect key={x} x={x - 5} y={y - 5} width="10" height="10" fill={face} className={styles.artEdge} />
          ))}
          <circle cx="94" cy="70" r="4" className={styles.artMint} />
          <circle cx="186" cy="70" r="4" className={styles.artMint} />
        </g>
      </Part>
      <Part>
        <g transform="translate(165 203) rotate(-22)">
          <path d="m0 0 25 8 0 160-12 29-13-29Z" className={styles.artDarkSide} />
          <path d="m0 0 13-7 25 9-13 6Z" className={styles.artSide} />
          <path d="m25 8 13-6v157l-13 9Z" className={styles.artSide} />
          <path d="m0 160 13 29 12-21" className={styles.artMint} />
          <path d="m1 23 24 8" className={styles.artAccentLine} strokeWidth="3" />
        </g>
      </Part>
      <Part>
        <g transform="translate(482 326) skewY(26)">
          <rect width="112" height="79" rx="9" fill={face} className={styles.artEdge} />
          <circle cx="27" cy="30" r="12" className={styles.artDarkSide} />
          <circle cx="55" cy="30" r="12" className={styles.artMint} />
          <circle cx="83" cy="30" r="12" className={styles.artFaint} />
          <path d="M16 58h77" className={styles.artLine} strokeWidth="4" />
        </g>
      </Part>
      <Trace d="m200 426 136 74 61-36" accent />
    </>
  );
}

function DeliveryEngine({ face, shade }: { face: string; shade: string }) {
  return (
    <>
      <Part>
        <path d="m122 364 256-127 239 119-254 135Z" fill={shade} className={styles.artEdge} />
        <path d="M122 364v20l241 131v-24Z" className={styles.artSide} />
        <path d="M363 491v24l254-135v-24Z" className={styles.artDarkSide} />
        <Trace d="m184 367 179 90 189-99" accent />
      </Part>
      <Part>
        <g transform="translate(173 249)">
          <path d="m0 0 84-42 77 39-85 44Z" fill={face} className={styles.artEdge} />
          <path d="M0 0v69l76 42V41Z" className={styles.artSide} />
          <path d="M76 41v70l85-44V-3Z" className={styles.artDarkSide} />
          <path d="m57-8 24-12 24 12-24 12Z" className={styles.artMint} />
          <path d="m19 38 34 18m-34-3 23 12" className={styles.artLine} strokeWidth="4" />
        </g>
      </Part>
      <Part>
        <g transform="translate(319 173)">
          <path d="m0 0 84-42 77 39-85 44Z" fill={face} className={styles.artEdge} />
          <path d="M0 0v102l76 42V41Z" className={styles.artSide} />
          <path d="M76 41v103l85-44V-3Z" className={styles.artDarkSide} />
          <circle cx="80" cy="-6" r="14" className={styles.artMint} />
          <path d="m19 51 34 18m-34-3 23 12" className={styles.artLine} strokeWidth="4" />
        </g>
      </Part>
      <Part>
        <g transform="translate(419 302)">
          <path d="m0 0 84-42 77 39-85 44Z" className={styles.artMint} />
          <path d="M0 0v63l76 42V41Z" className={styles.artSide} />
          <path d="M76 41v64l85-44V-3Z" className={styles.artDarkSide} />
          <path d="m55-4 17 14 40-21" className={styles.artCode} fill="none" strokeWidth="5" />
        </g>
      </Part>
      <Trace d="m249 207 146-74m84 57 28 76M334 302l89 40" accent />
      <Part>
        <g transform="translate(218 113)">
          <path d="M0 0h84v56H38L19 74V56H0Z" fill={face} className={styles.artEdge} />
          <path d="M17 20h49M17 35h33" className={styles.artLine} strokeWidth="4" />
        </g>
      </Part>
      <g data-art-signal="" className={styles.artMint}>
        <circle cx="318" cy="172" r="5" />
        <circle cx="493" cy="224" r="5" />
        <circle cx="378" cy="322" r="5" />
      </g>
    </>
  );
}

const scenes = {
  languages: CodeEngine,
  interfaces: InterfaceEngine,
  intelligence: IntelligenceEngine,
  data: DatabaseEngine,
  design: DesignEngine,
  delivery: DeliveryEngine,
};

export function SkillArtifact({ scene }: { scene: SkillScene }) {
  const id = useId().replace(/:/g, '');
  const Scene = scenes[scene];

  return (
    <svg className={styles.artifact} viewBox="0 0 720 580" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-face`} x1="200" y1="90" x2="490" y2="420" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--skill-face)" />
          <stop offset="1" stopColor="var(--skill-face-low)" />
        </linearGradient>
        <linearGradient id={`${id}-shade`} x1="200" y1="270" x2="470" y2="490" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--skill-face-low)" />
          <stop offset="1" stopColor="var(--skill-shade)" />
        </linearGradient>
        <radialGradient id={`${id}-shadow`}>
          <stop stopColor="var(--skill-shadow)" stopOpacity=".2" />
          <stop offset="1" stopColor="var(--skill-shadow)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="373" cy="476" rx="248" ry="64" fill={`url(#${id}-shadow)`} data-art-shadow="" />
      <g className={styles.artGrid}>
        <path d="m58 402 309 156 298-153M91 385l309 156M126 368l309 156M583 368 280 516M617 385 314 533" />
        <path d="M74 375v18m-9-9h18M638 397v18m-9-9h18" />
      </g>
      <Scene face={`url(#${id}-face)`} shade={`url(#${id}-shade)`} />
    </svg>
  );
}
