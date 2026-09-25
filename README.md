<div align="center">

# ✨ Leul Tewodros Agonafer - Interactive 3D Portfolio ✨

[![React](https://img.shields.io/badge/React-18.x-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React Three Fiber](https://img.shields.io/badge/React_Three_Fiber-8.x-049EF4?style=for-the-badge&logo=three.js&logoColor=white)](https://docs.pmnd.rs/react-three-fiber/)
[![Tests](https://img.shields.io/badge/Tests-Vitest-729B1B?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev/)
[![Status](https://img.shields.io/badge/Status-Deployed-success?style=for-the-badge&logo=vercel&logoColor=white)](https://leul-t-agonafer.vercel.app)

**[🔴 LIVE DEMO: leul-t-agonafer.vercel.app](https://leul-t-agonafer.vercel.app)**

</div>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Key Highlights](#-key-highlights)
- [Performance Optimization](#-performance-optimization)
- [Tech Stack](#-tech-stack)
- [Local Development](#-local-development)

---

## 🚀 Overview

Welcome to my **Interactive 3D Portfolio**. This project is more than just a showcase of my work; it's a demonstration of modern web engineering capabilities. Built with a focus on **performance**, **interactivity**, and **clean architecture**, it features a fully navigable 3D environment where users can explore my skills and projects in an immersive space.

## 🏆 Key Highlights

- **Interactive 3D world**: React Three Fiber connects an animated avatar, a physical television and the portfolio's native reading controls.
- **Typed interaction ownership**: TypeScript, unit tests and real-component integration tests cover camera handoffs, native input, resource lifecycles and recovery.
- **Explicit performance budgets**: Optimized scene assets, device-aware rendering and occlusion gates limit work. Optional television media loads only after a visitor switches it on.
- **Desktop and phone experiences**: The desktop scene retains semantic HTML and a flat WebGL fallback; the separate phone portfolio is selected before loading desktop bundles.

## ⚡ Performance Optimization

The scene uses optimized assets instead of loading its archived source models.
Those archival originals live in `assets/originals/`, and superseded optimized
variants the site no longer loads live in `assets/unshipped/`; neither is under
`public/`, so Vite never copies them into `dist/`. `src/deployment.assets.test.ts`
keeps the published tree free of `original` folders, within its size budget, and
limited to models and videos the site actually references.
Representative shipped file sizes are:

| Asset | File | Size on disk | Loading |
| :---- | :--- | -----------: | :------ |
| Terrain | `terrain-opt.glb` | 3.85 MB | Opening scene; smaller software-renderer variant available |
| Animated avatar | `me-animated-lite.glb` | 847 KB | Opening scene; smaller software-renderer variant available |
| Water normals | `waternormals.jpg` | 249 KB | Opening scene |
| Portrait | `leul-profile.webp` | 42 KB | Hero |
| Television video | `Spy_Movie_Live_Wallpaper_Video-opt.mp4` | 599 KB | Only after the physical TV is switched on |

These are individual file sizes, not an initial-page transfer total or an FPS
guarantee. JavaScript, fonts and other images also contribute to startup.
Measure the production build with normal caching, a cold HTTP cache and explicit
CPU/network profiles; distinguish those simulations from physical low-end hardware.

Scene readiness reads the same per-model parsed cache entries used by the
visible objects instead of parsing a second batch of models. HTML and scroll
controllers remain independent of that readiness check. Model consumers wait
for their shared native prefetch to settle before entering the parsed-resource
cache; the rest of the scene and the page are not held behind a download gate.
Cached bytes remain available until the parsed consumer commits. A failed or
timed-out prefetch releases that model into the ordinary loader retry.
Byte-progress prefetch keeps its awaited native stream reader. Failed
optional prefetches settle visibly and remain recoverable through the ordinary
scene loader; they are not treated as successful scene readiness.

`patches/three@0.161.0.patch` also fixes the pinned upstream FileLoader's missing
body-read rejection forwarding. Without it, an interrupted HTTP-200 response
could leave every subscriber and subsequent retry waiting on the same failed
URL. Bun applies the three-line source/ES-module/CommonJS patch during frozen
installation. Real-HTTP tests check both published module formats, shared
subscribers and successful same-URL retry. Reassess this patch when upgrading
Three; it changes transport error propagation, not rendering or model data.

The loading mask reuses an integer-sized canvas buffer rather than resetting
its width and height on each paint. Its wave is capped at 60 paints per second,
uses elapsed time, and pauses when the document is hidden. Reduced motion keeps
the same byte-progress signal as a static fill, with a short opacity exit instead
of a wave or zoom. Completion stops the drawing loop even when the loader is
used without a parent unmount callback.

### Performance budget

`bun run build && bun run perf:budget` serves `dist` with an owned `vite
preview` -- accepted only while it serves this build's `dist/index.html`, on a
port checked free first -- and drives a headless Chrome over the DevTools
protocol with the mouse wheel from Home to a usable Contact at 4x CPU
throttling, parks on Contact for ten seconds and types into its form. A sample
counts only once it has passed Home, About (its statements, green rise and
Education, in turn), all six Skills chapters one after another, the TV's reader
and a usable Contact, in order, with no uncaught error, console error or
failed request; otherwise the run fails whatever its figures. Each sample's
report keeps the path it travelled and every checkpoint behind it, and a
browser or profile that would not close counts against its sample. The gates in
`scripts/perf-budget.json` apply to the median of three samples: Long Animation
Frames (count, blocking time, worst frame), every frame's interval (p95, and
the share that missed a 60 Hz refresh), parked Contact, and the slowest typing
event (Event Timing). A tighter target is reported beside each gate.

Samples are returning visits by default: one profile, warmed by an unmeasured
visit. `--cold` gives each sample a fresh Chrome and profile, throttles before
navigation and also gates the startup (time until the hero settles, bytes
transferred, blocking during load); cold samples have their own allowance for
the journey's worst frame, where a first-use shader compile lands. `--headed`,
`--chrome <path>`, `--url <origin>`, `--port` and `--runs` cover other browsers,
servers and sample counts. Every process, profile and connection is released
on success, failure or Ctrl+C. The report in `perf-reports/` (ignored by git)
records the commit, the dist hash, the browser, WebGL renderer, cores and
memory, each sample's cache state, and the chapter -- and world quality level --
each long frame fell in, with the script behind any frame over 150ms.

The gates were calibrated on a Windows desktop (8 cores, 32 GB, RTX 5070 Ti
through ANGLE/D3D11, Chrome 153): returning-visit medians of 43 long frames,
0.8s of blocking and a 279ms worst frame over a 42-second journey; cold medians
of an 11.4-second throttled startup, 6.1 MB transferred and 3.0s of blocking
during load. The local preview serves files uncompressed, so the transfer
figure overstates what a visitor downloads: production serves brotli, which
takes the island terrain from 3.76 MB to 2.8 MB. CPU throttling slows the main
thread, not the GPU, so it is a proxy for weak hardware rather than a
measurement of it; another machine should record its own baseline instead of
loosening these numbers. Under the throttle the world lowers its own quality
(below), and the report shows when.

### Adaptive world quality

The GPU tier is read once, at load. While the page runs, the frame gate reports
every frame the world draws to a pressure gauge (`src/lib/render/worldQuality.ts`).
When a third of two seconds of drawn frames arrive more than half a budget
late, the world steps down -- first to 30 redraws a second, then to one device
pixel per CSS pixel -- and after ten calm seconds it tries the step back up,
waiting twice as long after each try that fails, up to 160 seconds. Frames the
world does not draw (covered, hidden or still), stalls over a quarter of a
second and the first three seconds are not judged. The page itself keeps the
display's rate throughout; the canvas publishes `data-world-rate` and
`data-world-quality`.

### Island outline and scene edge continuation

The source terrain is a tilted 60-unit heightfield tile. `bun run bake:island`
reshapes only its outer fringe into unequal headlands and recesses, preserving
the core and every triangle touching the avatar's complete foot-contact zone,
the padded TV footprint, or the prism. This changes the actual top edge and land
volume, not just the faces of the old rectangular tile. Interior position and
normal streams, original UV coordinates, embedded texture bytes, mesh counts and
vertex/triangle counts are preserved. One outer diagonal is flipped in the
optimized asset to prevent a measured 3D reversal in a long, thin source face;
its two replacement faces carry the existing vertices and UVs. No protected
or unchanged vertex participates. Meshopt is used for lossless buffer encoding without global
requantization. Both optimized and software assets are baked independently.
Original terrain heights and the already submerged forward fringe are retained.

`SceneEdgeContinuity` joins each final decoded boundary with its matching static,
faceted shoulder and sloped submerged foot. It borrows Terrain's already-uploaded
albedo and material response, keeps the boundary's original UVs, and samples
inward on the lower rings instead of stretching one border texel down a wall.
A separate static mainland joins the **decoded rear headland** to four coarse
32-station rings near radii 52, 65, 115 and 240 around `[0, -20]`. Side/front joins
start at the existing submerged skirt foot, not the dry top rim: new land must
not form a shallow shelf through the visible sea beside the TV. The rear shoulder
inherits the original rim heights with unequal rocky rises and recesses. The back now continues
as land rather than ending at the old island cliff. This additive surface leaves
the original terrain, protected ground zones and all prop poses untouched. It
shares the skirt's terrain-owned albedo/material response without another texture.
The remote boundary stays beyond the **existing** fog (maximum far distance 92):
camera-envelope tests cover the spline, TV turn/approach, pointer extremes,
Contact flight and reflected flight at compact, 4K and ultrawide aspect ratios.
No camera or fog settings are changed to conceal the edge.

The existing 512-square shore field is rebaked from the final
terrain, skirt **and mainland** at waterline -4, with the same origin `[-90, -110]`,
180-unit span and 48-unit distance range. `bun run bake:shore` can regenerate
only that field; neither command changes the wave algorithm. Near-shore
resolution remains 0.3515625 world units per texel. Buried skirt waterlines
are excluded only when actual adjoining geometry covers them; exposed coast
still has the strict 0.8-unit registration limit in both variants. Outside
the field's X limits the new coast settles at Z=-28, matching the existing
ClampToEdge sampler instead of shrinking near-shore detail or enlarging the texture.

Pristine inputs are pinned to commit
`6a02c49edb33b30e4f0c6d416a5a32fb3f43e03d` and checked by SHA-256. A shallow clone
missing that object must run `git fetch origin 6a02c49edb33b30e4f0c6d416a5a32fb3f43e03d`
before baking. The baker never feeds already-shaped output back into the
transform. Edit `src/lib/scene/terrainOutline.ts` for the original island or
`src/lib/scene/terrainContinuation.ts` for the adjoining land, then run `bun run bake:island`;
commit both GLBs, `terrainRim.ts`, `terrain-outline-bake.json`, and
`public/images/shore-field.png` together. The generated manifest records actual
counts, hashes, byte sizes and measured shore-registration error and supplies
the existing loader's byte estimates.

A separate 32-segment horizon strip still feathers
the fully fogged sea into the actual background at radii 320-900. It matches the
existing theme's water alpha and Three's output-color-space fog; fragments before
full fog are discarded. The existing swell ends at radius 70 and is untouched.

The edge assembly uses **3 draws in the main view and 2 in the existing
reflection**: the mainland adds exactly one batch and 436 triangles (425 on the
software variant) per view. Optimized terrain has 684 skirt triangles, 436 land
triangles and 64 horizon triangles: 1,184 main / 1,120 mirror. Software uses
656 skirt + 425 land + 64 horizon: 1,145 main / 1,081 mirror. The original terrain
triangle counts remain 113,858 and 75,158. The assembly owns three geometries
and two materials, adds no
textures, transparent fill, render targets, shadow passes, or animation loops.
Layer 1 is reserved for the main-only horizon; skirt and land remain on layer 0.
Effect-owned resources survive StrictMode's rehearsal and dispose independently
of Terrain's borrowed texture. These are geometry/draw budgets, not an FPS guarantee.

### Floor-standing TV speaker cabinet

The upper receiver retains its authored angle and silhouette. Its broad roof
spans are planar, but area-weighted normals previously biased opposite ends of
each long quad differently. Angle-weighted normals now remove that diagonal
shading bias only on the cabinet/rear upper lofts, preserving rounded corners.
No positions, indices, bounds, aperture, materials, draws or triangle counts change.

`CRTSpeakerCabinet` replaces the two narrow supports with one integral graphite
lower enclosure, a broad recessed perforated grille, a restrained satin brow and
a closed, full-width ground plinth. It inherits the upper receiver's materials
without changing `CRTHousing`, the 0.55 x 0.32 display aperture, screen transform,
reading-camera fit, project reader or broadcast/input behavior.

The lower cabinet uses **264 static triangles / 3 draws** per view and 600 stored
vertices, with no added lights, shadow casting, render pass, animation loop or
Canvas. When all three batches are visible to the existing water mirror, a
reflection-update frame can submit **528 triangles / 6 draws** across both views;
there are no cabinet shadow submissions. Its opaque 32 x 32 RGBA grille tile is
4,096 bytes before mipmaps (5,460 bytes with the complete mip chain), shared by
the material's color and bump inputs. R3F owns the three declared geometries/materials; the grille
material disposes only its own generated texture. Ground tests raycast both
actual terrain variants and the cabinet buffers, including the full underside
and grille clearance, rather than inferring contact from the former feet. The
terrain has pre-existing voids, independently confirmed in the loaded scene.
A strict 561-cell footprint mask records those original gaps; every gap must
have measured soil on opposite sides within 0.7 world units, beneath the
continuous closed cabinet. New misses fail. The grille clears actual terrain
hits and the measured edges of voids, with no invented ground or terrain edits.
The test fixture uses the existing mesh-BVH implementation to accelerate those
rays and compares representative results with Three's native raycaster. The
full footprint, original void mask and clearance assertions remain unchanged.

## 🛠️ Tech Stack

| Category           | Technologies                                  |
| :----------------- | :-------------------------------------------- |
| **Core**           | React 18, TypeScript, Vite                    |
| **3D & Animation** | React Three Fiber, Drei, Framer Motion, GSAP, Anime.js |
| **Styling**        | Tailwind CSS, CSS Modules                     |
| **Testing**        | Vitest, React Testing Library, native browser workflow checks |
| **Deployment**     | Vercel                                        |

### Physical TV controls and screen modes

The television starts **off**. Its physical power control opens a local CRT
signal in the exposed, front-facing scene; previous/next select the existing
small video or an original animated test card. The former automatic eight-second
video cycle and whole-cabinet click handler are removed. No video is fetched
at startup or counted as a loader-critical asset.

During the Projects approach, reading and retreat, the display belongs
exclusively to the existing semantic project reader. The CRT entertainment
shader does not process project text, images or links. The physical previous/
next keys invoke the reader's original filtered selection callbacks; Details,
categories, keyboard browsing and project selection stay intact. Conventional
project paging remains the fallback when physical 48px targets cannot fit or
the flat reader is used.

The reader can lift out of the screen for reading. A short window has to fit the
whole cabinet, which leaves a small screen (about 455x265 at 900x560); the
enlarge control fills the window between the navbar and the scene controls with
the same reader, over a scrim. Its own previous/next take over from the physical
keys it covers. The same control, Esc, a click beside it or leaving the reader
returns it to the TV.

The project counter is also a native 48px selection control. It jumps directly
to any title in the current category, supports the browser's keyboard type-ahead,
and keeps the selected value synchronized with physical paging. The flat reader
offers the same control. Its native arrow keys and wheel input do not also page
the surrounding reader, and choosing a title returns expanded Details to Preview.

Project implementation notes link to immutable public source revisions rather
than claiming unmeasured results. Amharic IR is identified as collaborative work;
the published author list does not establish individual implementation roles.
Preview assets must exist locally as valid WebP files. Portfolio Leul uses a
genuine local desktop capture; Luna uses original project artwork, explicitly
identified as artwork rather than an application screenshot. Kitefew, AgendaFlow,
Elona Practice, EthioDriveMaster, System Design Guide, CS Exit Practice and Dream
Weaver use 16:10 desktop captures of their own live demos. Every image is
labelled as an interface capture, a presentation mockup or project artwork.
Optional image notes and alternative text are carried through both TV and flat
readers.

Power-off in Projects uses its existing back-to-scene retreat, then leaves
dark glass. Entering Projects always makes the reader available, even when
broadcast was off. A normal exit restores the previous broadcast preference
and channel; it does not conflate those with the current project. The existing
camera, island geometry, water, lighting, avatar, prism and Contact journey are
unchanged.

Native buttons are projected onto the hardware, in a zero-height sticky layer
inside the real scrollport rather than inside covered/inert main content.
Back-facing, occluded, hidden and moving-scene controls cannot be activated.
Separate key targets never overlap. The physical caps and native controls
share one action; physical press/focus/hover feedback does not invent another
navigation handler. A keyboard power-off returns focus to the existing visible
scene-navigation control, not an invisible retired TV surface.

When changing content height makes ScrollControls rebuild its native track,
the app preserves both the visible scroll position and the previously focused
control. Focus recovery yields to subsequent navigation, pointer actions, or
focus in another surface; it never revives a removed, disabled or hidden control.

The complete TV now submits **2,520 triangles in 11 main-view draws**:
1,778 static housing, 476 moving controls, 264 lower cabinet and two display
triangles. The existing water mirror may submit the TV again; that cost is not
an added render pass. Channel-key centers remain at least 54.85px apart even
in the pre-close-up 900x560 shot. One material-batched cap buffer moves the three
keys independently, with 75ms depression, 50ms minimum dwell and 130ms release.
The redundant upper grille is replaced by the broad hardware strip; the approved
lower speaker, original aperture and world bounds remain intact.

Mechanical audio uses the existing muted-by-default Audio FX preference.
One short bounded knock accompanies an accepted action; hover is silent,
repeat input is rate-limited, and ended oscillator/gain nodes disconnect.
Broadcast media remains muted. The screen-local wake, shutdown and tuning
effects honor reduced motion and the 50ms visible-frame cap, without a new
Canvas, light, shadow map or full-scene postprocessing pass.

Only one video element/decoder is created, on deliberate power-on. It pauses
while off, hidden, in Projects or outside useful screen visibility. The owned
video texture cancels its `requestVideoFrameCallback` on pause/disposal
(Three.js r161's built-in implementation does not own that cleanup).
Late playback promises cannot restart a retired source. Playback rejection
and media errors announce a recoverable test-card fallback, never false
successful playback. The test card adds no media download.

### Production addresses and device routing

- Desktop: https://leul-t-agonafer.vercel.app
- Phone portfolio X: https://leul-t-agonafer-x.vercel.app

Both existing `portifolio-leul.vercel.app` and `portifolio-x-leul.vercel.app`
addresses remain supported. On those public aliases, phone identity selects X;
desktop browsers and tablets select the desktop site. The small entry module
uses `location.replace` before loading React or the 3D app, preserving the path,
query and fragment. Resizing a desktop window or using a touchscreen laptop does
not redirect. Localhost and deployment-preview hosts remain isolated for review.
The mobile repository implements the same classification and canonical origins.

Vercel uses the checked-in `bun.lock`, `bun install --frozen-lockfile`,
`bun run build`, and `dist` explicitly. Vercel provisions the Bun version the
lockfile was generated by (here 1.4.x, lockfile format 3), and `packageManager`
pins it too. An earlier `bunx bun@1.4.0` wrapper worked around an older
preinstalled Bun, but on current builds it exits before Bun starts, so keep the
commands plain. The obsolete pnpm lockfile was removed:
automatic pnpm selection previously rejected the out-of-date dependency list
and left production serving an older release. Keep the Bun lockfile current and
verify both published aliases on desktop and phone after deployment.

### Meet the character in the scene

A small, wordless light cue appears only on hover or keyboard focus; the native
model-aligned target remains clickable wherever the avatar is actionable
in the exposed island, including Hero and Projects' revealed pre-TV view. It
waits for the original Hero name entrance, but is not mounted in Hero or in the
covered/inert main content. Its portal remains inside the real scrollport.
Its zero-height sticky layer preserves native wheel travel over the controls;
new entry waits for the existing scroll-track measurement/repair to settle.

Clicking takes the existing camera along a 1.65-second curved approach to a new
three-quarter medium portrait. The original textured figure turns its upper
torso/head and gives a finite nod; the underlying wave is never reset or
replaced. Only identification and a return control accompany the character.
There is no duplicate figure, SVG portrait, extra model, Canvas, lighting rig,
render pass, runtime dependency or mandatory chapter beat.

`CinematicCameraController` remains the only camera writer. It computes the
normal chapter pose separately, then composes the optional encounter. Return
retraces the approach toward the live base; native scrolling and resize blend
out from the displayed pose while chapter input continues normally. Navbar
intent, hidden documents and Contact priority cannot be reclaimed by a stale
return. Reduced motion uses deliberate camera cuts without rig flourishes.
Unavailable WebGL leaves the existing flat portfolio, not a false avatar target.

The same drawn-frame clock paces the camera and acknowledgement, capped at 50ms.
The rig restores its additive offsets without overwriting newer mixer samples
or disposing cached GLTF resources. The avatar's world placement and feet,
terrain, CRT, Contact flight and Hero name reveal remain unchanged. Projects'
revealed controls omit the removed caption while retaining their edge positions.

### The green prism's hidden experiment

The green prism uses the same subtle, wordless hover/focus glint in the exposed
island. Accessible button names remain available to assistive technology,
without visible labels, badges or icons. Deliberate activation lifts the existing object, lets the line tie into
an open spatial knot, and unthreads it back into the exact original beam.
It does not move the camera, open a panel, retime the character or modify the
ocean. The ordinary bob and existing point light keep their original owner.

The curve grows through enlarged subarcs rather than interpolating a straight
shaft through itself. Parallel-transport frames keep the rectangular material
coherent. One capped 644-triangle body and one sparse line cage replace the two
ordinary visible draws only during the interaction; original box geometry and
material references return at rest. Buffers are allocated once and reused.
No additional light, shadow map, render target, shader pass or dependency is
introduced. The interaction material is opaque and lit so crossings remain
readable, including in the dark theme; the ordinary dark additive beam is
restored afterward.

A single drawn-frame clock runs the finite 5.7-second reveal/hold/return and a
shorter requested reversal. Escape, native scroll and resize can reverse it;
navigation, hidden/covered scenes and teardown restore the beam. Reduced motion
retains the stationary object with brief wire-intensity feedback. An exclusive
island-secret lease prevents the prism and avatar encounters from competing.
Both use the real scrollport, stay absent behind opaque chapters, and expose no
imaginary target without WebGL.

### Contact delivery

The Contact form uses the deployed `VITE_EMAILJS_SERVICE_ID`,
`VITE_EMAILJS_TEMPLATE_ID`, and `VITE_EMAILJS_PUBLIC_KEY`. These are client-side
EmailJS identifiers; never put an EmailJS private key in a `VITE_` variable.
The small native REST transport sends `from_name`, `from_email`, `reply_to`, and
`message`; the two email aliases contain the same visitor address. It never
accepts a client-selected recipient or a private key.

Configure the template in the owning EmailJS account:

- Keep **To Email** fixed to the intended portfolio inbox, not a visitor-controlled variable.
- Use the authenticated email service's address for **From Email**. Put
  `{{reply_to}}` (or the compatible `{{from_email}}` alias) in **Reply To**.
- Use `{{from_name}}` and `{{message}}` in the subject/body as appropriate.
- Confirm that the service, template and public key belong together, that the
  outbound service remains connected, and that the production origin is allowed.
- Inspect the matching Email History entry and actual recipient inbox/spam
  folder for an explicitly authorized diagnostic message. A successful HTTP
  response alone cannot establish inbox delivery.

**Abuse controls are the provider's, not the page's.** The service, template
and public key are public by design, so anyone can call EmailJS with them from
outside this page; the form's limits, duplicate guard and cooldown constrain
only this interface. The accepted residual risk is unsolicited mail to the
fixed portfolio inbox, bounded by the provider. The owner verifies, in the
EmailJS dashboard, and re-checks after any account change:

- [ ] **To Email** is fixed to the portfolio inbox (no template variable).
- [ ] **Security → Allowed origins** lists only the production origin (and a
      local origin only while testing).
- [ ] **CAPTCHA stays off.** The page sends no challenge token and its CSP
      allows no challenge script, so enabling EmailJS's CAPTCHA would reject
      every genuine message. Adding one is a code change (widget, token field,
      CSP entries), not a dashboard toggle.
- [ ] **Rate limit** per sender is set as low as a genuine visitor needs.
- [ ] Monthly **quota** usage is monitored, with an alert before it runs out.

If abuse outgrows these, the supported step is a server-owned endpoint that
holds the credentials and enforces its own limits; client-side guards are not
enforcement.

The **Submitted** confirmation appears only after EmailJS accepts the request
and explicitly distinguishes acceptance from inbox delivery. Invalid fields are
labelled inline, duplicate submissions are prevented, and fields stay read-only
while sending so a late response cannot erase a newer draft. Accepted content
stays in the original native form through its fold and flight; **Send another
message** clears it and restores the same fields without reloading. Requests
have a 20-second deadline and abort on form unmount. Late or cancelled responses
cannot accept a newer draft or start another animation. Aborting a browser
request does not recall a message the provider may already have accepted:
network/timeout feedback therefore says submission is unconfirmed, never
asserts that nothing was delivered, and never retries automatically.

On failure the draft remains, with an explicit email-app fallback. Rate-limit,
configuration and provider failures explain the available recovery. The same
draft link remains available after acceptance for a direct follow-up; opening it
does not send anything automatically. Contact email and phone links remain
native `mailto:` and `tel:` links.

Submission focus is parked on the stable message group, outside the moving
sheet. Failure returns it to Send; a completed flight moves it to the new-draft
action only while that group still owns focus. A visitor who navigates elsewhere
is not pulled back by a late response.

The Contact finale carries the existing Skills typography and chamfered control
language into an asymmetric cloud-clearing composition: direct contact links on
the left and one message surface on the right. Its authored folded-plane SVG
responds to field focus. After provider acceptance, the filled message panel folds
into that same authored plane geometry and flies toward the cloud opening on one
2.35-second GSAP score. The native form is never cloned or reparented, and the
animation never sends another request. Its inner sheet owns the send transforms;
Motion still owns the outer entrance, independently of the camera presentation.
Only visible time advances (at most 50ms per frame), with no idle animation loop.
Reduced motion skips the flight. Navigation, resize, or a live reduced-motion
change settles to the truthful, recoverable **Submitted** confirmation; cleanup cancels
the score. Focus moves to the reset control only if it was still in the retiring
form, never back from navigation. The existing camera handoff still reveals the
same form subtree during its final easing. No new dependency or WebGL canvas is
needed. QA must intercept EmailJS requests; simulated provider responses belong
only in tests, never in the application.

About's paired squares unfold into their corresponding text blocks, left first,
then right, on the existing arrival/swap/clear clock. Shape transforms and text
clipping share geometry measured only on layout changes; reverse travel folds
the second statement back into its square. There is no separate scroll exit,
animation loop, or added rest. Inside the morph, the left thesis hinges open
before its ink reveal; the right lead resolves from its exposed edge, with
quieter supporting copy and opposing-axis metadata. These derived text windows
finish and reverse on the same phase values. Readable desktop copy remains
selectable and forwards wheel travel to the real scrollport without cancelling
input or doubling native document scrolling. Narrow and reduced-motion layouts omit the
decorative geometry. Passive highlight labels use shared surface/ink tokens,
compact typography and square corners rather than blurred button-like pills.
Project filters retain their rounded control shape, use the same theme tokens
and type scale, and expose 48px targets, visible keyboard focus and pressed state.

Education uses a paused Anime.js timeline for split typography and credential
artwork, driven by the existing GSAP chapter clock. Each record transition is
authored as one second, with no independent animation loop or post-animation
cooldown. Text starts late enough to remain visibly animated as the incoming
record enters, in either direction. About retains navigation
ownership until Education releases the
viewport; natural departure lands on Skills rather than spending later sections
behind the reader. Narrow and reduced-motion layouts expose every record in
normal document flow.
Explicit Home/About navigation starts a fresh Education chapter; natural upward
return from Skills preserves the trailing record. Shared kinetic headings and
Contact panels use ownership-aware one-shot entrances, so crossing their
geometric bounds under the covered chapter does not consume their animations.

Certification totals use explicit lower bounds in `cvData`, independent of the
featured course lists. The displayed years describe those selections, not the
completion date of every credential in the total.

The credential artwork adapts [React Bits TiltedCard](https://reactbits.dev/components/tilted-card)
to the existing Framer Motion runtime: pointer-local springs, cached geometry,
and immediate reset when a record stops being interactive. The typography takes
its splitting approach from [SplitText](https://reactbits.dev/text-animations/split-text),
but its finite glyphs are authored in React and animated by Anime.js rather than
adding another scroll trigger. Each institution has its own text profile and
cue order, including different treatments within the course lists:

- HiLCoE pairs a folded heading/award with lateral assemblies and
  a decimal [CountUp](https://reactbits.dev/text-animations/count-up) GPA.
- Saint Joseph alone uses center-out letterpress and smooth word-level ink reveals.
- Boot.dev decodes its name and selected metadata, types its build titles using
  [TextType](https://reactbits.dev/text-animations/text-type), and varies the
  coursework with discrete terminal scans and resolving text.
- freeCodeCamp alone uses alternating letter/word waves and
  [BlurText](https://reactbits.dev/text-animations/blur-text).

These motion families are exclusive to each institution, including its metadata
and individual course rows; repetition is allowed within one record, not across
records. Pairwise ownership and actual intermediate trajectories are covered by
regression tests.

These adaptations retain the chapter clock instead of adding one-shot observers,
independent timers, or per-frame React state. The one soft-focus phrase uses one
small filter, never per-word blur surfaces. Typing keeps whole-word layout slots
so partial words do not jump between lines. The source text remains accessible
and selectable while aria-hidden paint layers change. Cipher frames are bounded
to ten steps; typing and counting use at most 24 precomputed steps and preserve
exact final values. All text and transient perspective finish inside the same
one-second crossing and are restored to plain, unpromoted text before input
becomes ready.
Reveal painting is bounded to 60fps on high-refresh displays; the existing track
clock remains unchanged and the exact completed frame is never skipped.
The [React Bits license](public/licenses/react-bits.txt)
is MIT plus Commons Clause, not unrestricted MIT. Bricolage Grotesque is
self-hosted with its [SIL Open Font License](public/fonts/OFL-BricolageGrotesque.txt).

While the Education stage is opaque, the covered HTML and old pinned overlays
stop painting; the scrollport and layout remain available. They are restored
before the stage uncovers them. Their temporary `data-education-covered` marker
also pauses invisible button tracers, avoiding animation-driven style work.
The same tracer guard applies when Skills makes `main` inert; visible button
motion is unchanged. Settled Drei translations cache CSSOM's rounded
serialization, avoiding repeated layout reads and false progress publications
on high-refresh displays.
Anime timelines are assembled without intermediate composition and initialized
once, so adding glyphs and rows does not repeatedly seek partially built motion.
Every incoming record replays its text and artwork, including backward crossings
and re-entry from Skills. Reverse arrivals mirror the glyph direction and decode
order, not the semantic text. Completed reveals are disposed immediately, so
reading retains no text filters, transforms or cipher work. Frame departure stays
simple and uses the same completion gate.

Boot.dev's supplied color and white artwork is cropped into small transparent
WebP assets, with no rectangular backing: white at rest, color only on hover.
Hover owns the image crossfade; the arrival clock only animates their wrapper.
Its desktop record is a two-tone editorial layout using the same mineral paper
and pine ink: a larger display title, readable build ledger, and full-height
curriculum column. The white mark sits on that contrasting curriculum surface,
not loose on the paper. Rows share the available space without adding an inner
scroll area, fake project links, invented totals, or a longer animation lock.
Saint Joseph keeps its green disc at rest and removes it in the colored hover
state. Academic artwork assets are unchanged. The two freeCodeCamp records carry lightweight
algorithm-flow and responsive-layout SVG illustrations, not invented issuer
badges. These draw on the same reveal clock and add no pointer or scroll traps.

## ⚙️ Local Development

```bash
# 1. Clone
git clone https://github.com/LeulTew/portifolioLeul.git
cd portifolioLeul

# 2. Install
bun install --frozen-lockfile

# 3. Configure Environment
# Create .env.local and add the public EmailJS configuration:
# VITE_EMAILJS_SERVICE_ID=...
# VITE_EMAILJS_TEMPLATE_ID=...
# VITE_EMAILJS_PUBLIC_KEY=...

# 4. Run
bun run dev
```

All three EmailJS settings are required for form submission. Missing or
incomplete configuration explains that the form is unavailable and preserves
the entered fields with a direct-email fallback. Do not put a private EmailJS
key in the client configuration. Provider acceptance and actual inbox receipt
must be verified separately.

---

<div align="center">
  <p>Made with ❤️ by Leul Tewodros Agonafer</p>
</div>
