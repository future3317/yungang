# Redesign baseline

The pre-redesign build used a three-column game shell with a dense bottom action tray. The map was visually secondary to panel edges, and its SVG routes and HTML node layer used separate transforms, creating avoidable drift risk during zoom. Regions were axis-aligned bounding rectangles rather than atlas areas.

The screenshot script uses the production room creation contract with deterministic input. The former direct game endpoints are intentionally removed; callers must let the server create the room and use the returned identifier.
