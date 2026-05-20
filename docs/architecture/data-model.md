# Datenmodell

## Übersicht

```
User ──────────── Project ──────── Branch
  │                  │                │
  │              FileUpload        Commit
  │                  │                │
  │           FileVersion ◄──────────┘
  │                  │
  ├──── Like         │
  ├──── Comment ─────┤
  ├──── Follow       │
  └──── Vehicle      Map[]
```

---

## Schema (PostgreSQL / Prisma)

### User

```prisma
model User {
  id            String   @id @default(uuid())
  username      String   @unique
  email         String   @unique
  avatarUrl     String?
  bio           String?
  role          Role     @default(USER)
  reputation    Int      @default(0)
  verified      Boolean  @default(false)
  createdAt     DateTime @default(now())

  projects      Project[]
  vehicles      Vehicle[]
  likes         Like[]
  comments      Comment[]
  following     Follow[]  @relation("following")
  followers     Follow[]  @relation("followers")
}

enum Role {
  USER
  VERIFIED_TUNER
  MODERATOR
  ADMIN
}
```

### Project

```prisma
model Project {
  id          String      @id @default(uuid())
  name        String
  description String?
  visibility  Visibility  @default(PRIVATE)
  ownerId     String
  owner       User        @relation(fields: [ownerId], references: [id])
  vehicleId   String?
  vehicle     Vehicle?    @relation(fields: [vehicleId], references: [id])
  ecuType     String?
  fuelType    String?
  stage       String?
  forkOfId    String?
  forkOf      Project?    @relation("forks", fields: [forkOfId], references: [id])
  forks       Project[]   @relation("forks")
  branches    Branch[]
  likes       Like[]
  comments    Comment[]
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
}

enum Visibility {
  PUBLIC
  PRIVATE
  UNLISTED
}
```

### Versionierungssystem

```prisma
model Branch {
  id        String   @id @default(uuid())
  name      String
  projectId String
  project   Project  @relation(fields: [projectId], references: [id])
  headId    String?  // aktueller HEAD-Commit
  commits   Commit[]
  createdAt DateTime @default(now())

  @@unique([projectId, name])
}

model Commit {
  id          String      @id @default(uuid())
  message     String
  branchId    String
  branch      Branch      @relation(fields: [branchId], references: [id])
  parentId    String?
  parent      Commit?     @relation("commitTree", fields: [parentId], references: [id])
  children    Commit[]    @relation("commitTree")
  authorId    String
  fileVersion FileVersion @relation(fields: [fileVersionId], references: [id])
  fileVersionId String
  diffKey     String?     // R2-Key für BinaryDiff zum Parent
  createdAt   DateTime    @default(now())
}

model FileVersion {
  id          String   @id @default(uuid())
  storageKey  String   @unique  // R2/S3 Pfad
  checksum    String            // SHA-256
  size        Int
  format      FileFormat
  commits     Commit[]
  maps        Map[]
  parsedAt    DateTime?
  createdAt   DateTime @default(now())
}

enum FileFormat {
  BIN
  HEX
  FRF
  OLS
  XDF
  A2L
  DAMOS
}
```

### ECU Maps

```prisma
model Map {
  id            String      @id @default(uuid())
  fileVersionId String
  fileVersion   FileVersion @relation(fields: [fileVersionId], references: [id])
  name          String?
  aiLabel       String?     // KI-erkannter Name
  type          MapType?
  offset        Int         // Byte-Offset in der Datei
  rows          Int
  cols          Int
  xAxisLabel    String?
  yAxisLabel    String?
  valueUnit     String?
  values        Json        // 2D-Array der Rohwerte
  scaledValues  Json?       // Skalierte Werte (Faktor/Offset angewendet)
  safetyFlags   Json?       // Ergebnisse der Plausibilitätsprüfung
}

enum MapType {
  INJECTION
  IGNITION
  BOOST
  LAMBDA
  TORQUE
  DRIVER_WISH
  FUEL_CUTOFF
  UNKNOWN
}
```

### Community

```prisma
model Like {
  userId    String
  user      User    @relation(fields: [userId], references: [id])
  projectId String
  project   Project @relation(fields: [projectId], references: [id])
  createdAt DateTime @default(now())

  @@id([userId, projectId])
}

model Comment {
  id        String   @id @default(uuid())
  content   String
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
  projectId String
  project   Project  @relation(fields: [projectId], references: [id])
  mapId     String?  // optionaler Map-Bezug (Kommentar zu spezifischer Map)
  parentId  String?  // Threading
  parent    Comment? @relation("replies", fields: [parentId], references: [id])
  replies   Comment[] @relation("replies")
  createdAt DateTime @default(now())
}

model Follow {
  followerId  String
  follower    User   @relation("following", fields: [followerId], references: [id])
  followingId String
  following   User   @relation("followers", fields: [followingId], references: [id])

  @@id([followerId, followingId])
}
```

### Fahrzeug

```prisma
model Vehicle {
  id       String   @id @default(uuid())
  userId   String
  user     User     @relation(fields: [userId], references: [id])
  make     String   // VW
  model    String   // Golf
  year     Int?
  variant  String?  // GTI, R
  engine   String?  // 2.0 TSI
  ecu      String?  // Bosch MED17.5
  projects Project[]
}
```

---

## Indizes

```sql
-- Häufig abgefragte Felder
CREATE INDEX idx_project_owner ON projects(owner_id);
CREATE INDEX idx_project_visibility ON projects(visibility);
CREATE INDEX idx_commit_branch ON commits(branch_id);
CREATE INDEX idx_map_filever ON maps(file_version_id);
CREATE INDEX idx_map_type ON maps(type);

-- Fulltext Search
CREATE INDEX idx_project_search ON projects USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));
```

## pgvector (AI-Embeddings)

```sql
-- Map-Embeddings für Ähnlichkeitssuche
CREATE TABLE map_embeddings (
  map_id     UUID REFERENCES maps(id),
  embedding  vector(1536),  -- OpenAI / Claude Embedding-Dimension
  model      TEXT
);
CREATE INDEX ON map_embeddings USING ivfflat (embedding vector_cosine_ops);
```
