# Architekturentscheidungen (ADRs)

Kurze Begründungen für die wichtigsten technischen Entscheidungen.

---

## ADR-001: Modularer Monolith statt Microservices (MVP)

**Entscheidung**: Ein Next.js Full-Stack-Monolith mit klar getrennten Modulen.

**Begründung**: Microservices erhöhen Komplexität (Service Discovery, Netzwerk-Latenz, separate Deployments) ohne Nutzen im MVP-Stadium. Die Modulgrenze ist sauber definiert — spätere Extraktion ist möglich.

**Ausnahme**: Der Python ECU-Parser ist von Anfang an separat, da er technologisch inkompatibel ist (Rust/Python ≠ Node.js).

---

## ADR-002: Supabase als Backend-as-a-Service

**Entscheidung**: Supabase für DB, Auth, Realtime und Edge Functions.

**Begründung**: Eliminiert Auth-Boilerplate, Row Level Security gibt feingranulare Zugriffskontrolle direkt in der DB, Realtime ist für Phase-2-Collaboration bereits eingebaut.

**Risiko**: Vendor Lock-in. Mitigation: Prisma als ORM-Abstraktionsschicht, sodass DB-Migration möglich bleibt.

---

## ADR-003: WASM für Browser-seitiges ECU-Parsing

**Entscheidung**: Rust → WASM für die Browser-Parsing-Engine.

**Begründung**: ECU-Dateien müssen nicht vollständig hochgeladen werden für Preview. Offline-Nutzung möglich. Rust garantiert Memory-Safety beim Parsen potenziell malformed binaries. Performance für Hex-Rendering mit großen Buffern.

**Alternative verworfen**: Reines JavaScript — zu langsam für 2MB+ Binaries mit Echtzeit-Hex-View.

---

## ADR-004: Eigene Versionierungsschicht (kein Git)

**Entscheidung**: Versionierung über PostgreSQL-Tabellen (Branch/Commit/FileVersion).

**Begründung**: Git ist für Binärdateien ungeeignet (kein sinnvolles Diffing). Binary Diffs via xdelta3 sind spezialisierter. Das Datenmodell ist einfacher zu querien (Commit-Geschichte, Forks) als bare Git-Repos.

**Alternative verworfen**: Gitea/Forgejo als Backend — zu viel Overhead, Binary-Handling bleibt trotzdem Problem.

---

## ADR-005: Claude API für AI Copilot (kein Fine-Tuning)

**Entscheidung**: Claude API mit sorgfältig konstruierten Prompts, kein eigenes Fine-Tuning.

**Begründung**: ECU-Domain-Wissen kann über System-Prompts + Few-Shot-Beispiele vermittelt werden. Fine-Tuning ist kostenintensiv und benötigt kuratierten Trainingsdatensatz, der noch nicht existiert. Prompt-basierter Ansatz ist flexibler anpassbar.

**Zukünftig**: Fine-Tuning auf Community-Daten in Phase 3 prüfen.

---

## ADR-006: Cloudflare R2 statt AWS S3

**Entscheidung**: R2 für alle ECU-Datei-Storage.

**Begründung**: Kein Egress-Cost ist entscheidend — ECU-Dateien werden häufig heruntergeladen (Community-Sharing). Bei 10.000 Downloads à 1MB wären AWS S3 Egress-Kosten ~$0.09/GB, R2 = $0.

**MVP-Abweichung (temporär)**: Aktuell wird **Supabase Storage** verwendet, da R2 noch nicht als Infrastruktur aufgesetzt ist und Supabase ohne neue Credentials sofort nutzbar war. Die gesamte Upload-Logik ist in einer einzigen Funktion (`uploadCommit` in `apps/web/src/app/actions/projects.ts`) isoliert — der Swap zu R2 ist ein reiner Infrastruktur-Tausch ohne App-Code-Änderungen außerhalb dieser Funktion.

**Migration zu R2**: Cloudflare-Account + Bucket + API-Token → Env-Vars setzen → `uploadCommit` auf `@aws-sdk/client-s3` (S3-kompatible R2-API) umstellen.

---

## ADR-007: pnpm + Turborepo als Monorepo-Tooling

**Entscheidung**: pnpm Workspaces + Turborepo für Build-Orchestrierung.

**Begründung**: WASM-Build, Python-Service und Next.js müssen koordiniert gebaut werden. Turborepo cached Builds intelligent. pnpm ist effizienter als npm/yarn bei gemeinsamen Dependencies.

---

## ADR-008: Kein automatisches Tuning / One-Click-Flash

**Entscheidung**: Die Plattform bietet keine Funktion, die eigenständig Tuning-Werte schreibt und eine flashfertige Datei ausgibt.

**Begründung**: Sicherheitsrisiko (fehlerhafte KI-Werte können Motoren zerstören), rechtliche Haftung, Vertrauensverlust in die Plattform. Der Nutzer muss immer manuell bestätigen und verstehen, was er ändert.

**Grenzfall**: Der AI Copilot darf Änderungsvorschläge anzeigen, aber der Nutzer muss diese manuell übernehmen (wie GitHub Copilot Tab-to-Accept).
