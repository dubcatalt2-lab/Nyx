# Profile decorations

These 54 Profile Effects entries come from the same owner-authorized reference catalog as the Avatar Decorations, requested by the user on September 14, 2026. `catalog.json` records the exact public asset sources and original labels. Original PNG/APNG bytes are retained, including animation; separate still images support reduced motion. Nyx serves the images locally and uses its existing profile picker and authorization. The artwork is not claimed as original Nyx work.

Thirteen source animations play once and end transparent. Their `loopPath` runtime copies change only the APNG play-count metadata and its checksum, preserving every frame and timing chunk. Regenerate those copies with `node scripts/prepare-profile-effect-loops.mjs`. Original `path` assets remain intact.
