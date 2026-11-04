# Orb setup

`.agents/setup` prepares fresh orbs unless Amp reuses an exact project snapshot. It checks
Node >=22.18 and runs `npm ci`. It can run again after a stale snapshot is updated. Version control
uses vanilla Git. No `.agents/resume` exists because nothing needs authentication or repair on wake.

`.amp/services.yaml` declares the `web` service (`npm run web -- --port 8082`). Port 8081 is
often occupied, so the port is fixed. Start it with `amp orb services ensure`.

Native iOS builds need the owner's Mac. See `ios-builds.md`. The orb verifies only
`npm run typecheck`, `npm test`, and the web preview.

Local files do not configure future orbs until they reach the default branch of the repository
configured in the Amp project. Changing this checkout's `origin` alone does not change that project
association. This project's move from Amp hosting to GitHub must account for both.
