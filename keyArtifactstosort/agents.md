# Binary artifacts — staging optional

**Primary durable store:** Garage bucket `hangar-library`, served through Hangar
`/api/hangar/library/…`. **Off-cluster mirror:** N5 `/tank/dev-archive/hangar-library/`.
Existence register: `db/hangar/library-manifest.json`.

This tree is an optional intake / staging area. Prefer uploading verified bytes to Garage
(and mirroring to N5) over treating this folder as the only copy. Do not delete binaries
here until the same SHA256 is confirmed in Garage **and** on N5.

Markdown registers (INTAKE-REGISTER, EVIDENCE-MANIFEST) live in Datacore as briefings
`artifact-intake` and `beast-evidence-manifest`. Agents that need the register read it in
Datacore, not from the filesystem.
