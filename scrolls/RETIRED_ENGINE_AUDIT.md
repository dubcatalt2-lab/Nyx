# Retired engine release audit

The public default branch had fallen behind the deployed release. Release updates must now keep `main` and `agent/pirate-cove` synchronized so the default checkout represents the supported application.

`node rituals/check-retired-engine.mjs . --tracked` checks tracked paths, source, manifests, bundled game documents, character escapes and embedded base64 executable payloads. It fails on retired engine identifiers, runtime filenames and routes. Its own signature definitions are the only explicit source exception and are printed in the report. `npm run check:deploy` runs this check; the production build also checks generated output after encoding. GitHub runs the source check for both supported branches and pull requests.

Media and archive containers are counted separately. Release archives must also be extracted and audited. Texture-coordinate identifiers in graphics code and incidental bytes in compressed game data are not connection engines and must not be renamed or removed.

Four release rechecks cover the working source, a fresh checkout and installed dependency inventory, rebuilt hosted/static artifacts, and the public default/release branches plus production endpoints. The default-branch update uses a fast-forward; existing history and retired development branches are not rewritten or deleted. Those historical references are outside the supported release and can still contain removed code.

Account data, saved settings, game saves, legal notices, advertising configuration and independent sibling projects remain unchanged.
