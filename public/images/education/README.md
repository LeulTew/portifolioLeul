# Institution marks

Artwork for the education rail's records
(`src/components/sections/About/EducationRail`).

| File                       | What it is                                        |
| -------------------------- | ------------------------------------------------- |
| `saint-joseph.webp`        | The seal in white, on a transparent background.   |
| `saint-joseph-colour.webp` | The same seal in its own colours, transparent.    |

Both are drawn square and rendered at 9.5rem, so 512x512 is plenty. The
background must be transparent, not white: the seal sits directly on the
section's deep green, and a white plate behind it would show as a box.

A record whose files are missing simply carries no mark -- see
`SaintJosephMark`. HiLCoE's badge is vector and lives in `HilcoeMark.tsx`
instead; there is no file for it here.
