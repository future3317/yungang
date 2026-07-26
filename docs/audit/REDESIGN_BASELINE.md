# Redesign baseline

The pre-redesign build used a three-column game shell with a dense bottom action tray. The map was visually secondary to panel edges, and its SVG routes and HTML node layer used separate transforms, creating avoidable drift risk during zoom. Regions were axis-aligned bounding rectangles rather than atlas areas.

The initial screenshot script could not create its fixed audit session because the compatibility endpoint rejected an empty request body. It was updated to use the production `POST /api/games` contract with deterministic input before final capture.
