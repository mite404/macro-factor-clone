# Orb setup

`.agents/setup` runs once per fresh Amp orb. It checks Node >=22.18, installs the GitButler CLI
(`but`) with the official installer when missing, and runs `npm ci`. It takes about 7 seconds
warm. No `.agents/resume` exists because nothing needs authentication or repair on wake.

`.amp/services.yaml` declares the `web` service (`npm run web -- --port 8082`). Port 8081 is
often occupied, so the port is fixed. Start it with `amp orb services ensure`.

Native iOS builds need the owner's Mac. See `ios-builds.md`. The orb verifies only
`npm run typecheck`, `npm test`, and the web preview.
