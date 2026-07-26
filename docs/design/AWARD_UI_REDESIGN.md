# Cave Light Atlas UI redesign

## Concept

The game is presented as a quiet digital heritage laboratory. Players illuminate cultural relationships rather than operate a dashboard. Rock strata, carved contour lines, museum labels and restrained exhibition light are the visual vocabulary.

## Information architecture

The header states the shared objective and round. The left rail identifies the team and the active player. The central atlas is the primary stage. The right inspector gives one focused site task and contextual forecast. The bottom action area makes the next legal action clear without competing with the map.

## Map rules

Regions, routes and nodes share a single SVG world transform. Regions use deterministic soft convex hulls from their member sites; they are visual groupings, not historical boundaries. Routes are curved SVG paths. Core, support and event nodes differ by scale, contour and marker; state uses outline, mark, line style and colour together.

## Type, colour and motion

Chinese serif fallbacks support display text, local sans-serif fallbacks support reading, and a system monospace stack supports AP and round values. Cinnabar is the single primary call to action, mineral blue discovery, green repair, ochre connection, and red-brown risk. Motion is limited to feedback and respects `prefers-reduced-motion`.

## Responsive and accessibility

Desktop preserves the atlas as the main visual area. Tablet and phone switch among map, mission and hand modes instead of shrinking three columns. Interactive controls have visible focus states, SVG nodes support keyboard selection, icons have labels, and decorative illustrations use empty alt text.

## Asset rule

Existing seal, node, role, card and scene assets are used at their intrinsic aspect ratio. Large archived or source images are not loaded as map backgrounds; the map remains an SVG-led information surface.
