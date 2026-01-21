
### Add these conventions
- **Domain**: rules + state transitions (no PocketBase imports)
- **Data**: PocketBase mapping + repositories (CRUD)
- **Usecases**: orchestration (“do the thing”) calling domain + repos
- **UI**: components/stores (thin) calling usecases

### Steps
- [ ] Add `src/lib/core/errors.ts` (simple error types)
- [ ] Add `src/lib/core/ids.ts` (helper for ID formatting if needed)
- [ ] Add `src/lib/data/pb/pb.client.ts` (single PocketBase client factory)

---

## Phase 2 — Define Your “Core Aggregates” (The Backbone)

### Outcomes
- Your app’s giant feature list becomes manageable because ownership boundaries are clear.

### Competition Context (real league)
**Aggregate roots**
- `Season`
- `Tournament` (owns rounds + groups + scoring state)
- `Course` (owns holes)
**Entities**
- `Team` (ALWAYS exactly 1 male pro + 1 female pro)
- `Pro`
- `Group` (pairings) under a tournament round
**Value-ish objects**
- `HoleScoreEvent` (hole-by-hole entries)

### Fantasy Context
**Aggregate roots**
- `FantasySeason`
- `FantasyLeague` (owns participants + draft + rosters)
**Entities**
- `Draft`, `DraftPick`, `FantasyRoster`, `FantasyParticipant`
**Policies**
- `SnakeDraftOrder`
- `DraftRules` (round 1–2 no filter; rounds 3–4 filter by roster composition)
- `RecommendationEngine` + `AutoPickPolicy`

### Steps
- [ ] Write a short “ownership note” in `/docs/domain.md`:
  - Tournament owns groups & scoring rules
  - FantasyLeague owns draft rules & roster composition
  - Course edits do not rewrite past tournaments (tournament stores a snapshot reference or snapshot data)

---

## Phase 3 — Zod Schemas for Data Contracts (Playground → Code)

### Outcomes
- Every object has a validated shape.
- Repositories always return validated DTOs.

### Steps (repeat per object)
- [ ] Create `*.schema.ts` for:
  - [ ] `Season`
  - [ ] `Tournament`
  - [ ] `Course`
  - [ ] `Hole`
  - [ ] `Pro` (includes `gender: "male" | "female"`)
  - [ ] `Team` (male_pro_id, female_pro_id)
  - [ ] `TournamentRound`, `Group`, `HoleScoreEvent`
  - [ ] `FantasySeason`, `FantasyLeague`, `FantasyParticipant`
  - [ ] `DraftSettings`, `Draft`, `DraftPick`, `FantasyRoster`
- [ ] Add strict invariants where they belong:
  - Team must have 1 male + 1 female (validate via lookup in usecase, not schema-only)
  - Draft composition rules enforced by `DraftRules` policy (not in UI)

---

## Phase 4 — Domain Classes (Behavior Lives Here)

### Outcomes
- You stop scattering logic across UI/components.
- You can unit test rules without PB.

### Create domain classes
- `Tournament`:
  - `createRound(roundNo)`
  - `addGroup(roundNo, group)`
  - `submitHoleScore(event)`
  - `finalizeRound(roundNo)`
  - `finalizeTournament()`
- `FantasyLeague`:
  - `startDraft(settings)`
  - `getDraftOptions(participantId, roundNo, availablePros)`
  - `makePick(participantId, proId)`
  - `autoPickIfExpired(now)`
  - `lockDraft()`

### Steps
- [ ] Implement state machines with statuses:
  - Tournament: `scheduled -> live -> final`
  - Draft: `not_started -> in_progress -> locked`
- [ ] Ensure domain methods enforce status checks (no scoring if tournament not live, etc.)

---

## Phase 5 — Repositories (PocketBase CRUD + Mapping)

### Outcomes
- PocketBase is a replaceable detail.
- The rest of your app works with DTOs/domain objects.

### Repos to create
- `SeasonRepo`, `TournamentRepo`, `CourseRepo`, `HoleRepo`, `ProRepo`, `TeamRepo`
- `RoundRepo`, `GroupRepo`, `ScoreEventRepo`
- `FantasySeasonRepo`, `FantasyLeagueRepo`, `ParticipantRepo`, `DraftRepo`, `PickRepo`, `RosterRepo`

### Steps
- [ ] Every repo method returns Zod-validated DTOs (`Schema.parse(record)`)
- [ ] Create a thin mapping layer if PB field names differ
- [ ] Keep relations as IDs in DTOs (avoid nested object trees)

---

## Phase 6 — Use Cases (The “App Actions” Layer)

### Outcomes
- UI calls one function per action.
- Rules, persistence, and validation are centralized.

### Competition Use Cases
- [ ] `CreateSeason`
- [ ] `CreateTournament`
- [ ] `CreateCourseAndHoles`
- [ ] `CreateTeamsFromPros`
- [ ] `CreateGroupsForRound` (pairings)
- [ ] `AssignScorekeeperToGroup`
- [ ] `SubmitHoleScore` (writes event; updates derived totals if you cache them)
- [ ] `FinalizeRound`
- [ ] `FinalizeTournament`

### Fantasy Use Cases
- [ ] `CreateFantasySeason`
- [ ] `CreateFantasyLeague`
- [ ] `StartSnakeDraft`
- [ ] `GetDraftOptions` (FILTER + RECOMMEND)
- [ ] `MakeDraftPick`
- [ ] `AutoPickOnTimeout` (uses recommendation)
- [ ] `LockDraft`

---

## Phase 7 — Pairings & Live Scoring (Groups as the Organizer)

### Outcomes
- Hole-by-hole scoring is organized by group.
- Scorekeepers have a clear workflow: “I’m scoring Group X for Round Y”.

### Core design
- A `Group` belongs to a `TournamentRound`
- A `HoleScoreEvent` includes:
  - tournament_id, round_no, group_id
  - pro_id, hole_no, throws
  - entered_by_user_id, entered_at
- Derived views (optional):
  - scorecards per pro/per round (computed from events)

### Steps
- [ ] Create group management UI that calls usecases
- [ ] Create scorekeeper UI that loads:
  - current group
  - current hole
  - roster of pros in group
- [ ] Write scores as events (append-only)
- [ ] Add validation:
  - hole_no exists
  - throws reasonable bounds
  - scorekeeper assigned to group

---

## Phase 8 — Fantasy Draft Engine (Snake + Filtering + Recommendation + AutoPick)

### Outcomes
- Draft is deterministic and consistent.
- UI stays dumb: it renders the options + recommendation returned by usecase.

### Snake draft policy
- Implement `SnakeDraftOrder`:
  - Round 1: 1→N
  - Round 2: N→1
  - Round 3: 1→N
  - Round 4: N→1
  - ...repeat

### Filtering rules (your requirement)
- Draft pool starts with 12 male + 12 female (available list)
- Rounds 1–2: show all available pros
- Rounds 3–4:
  - if roster has 2 males already → only show available females
  - if roster has 2 females already → only show available males
  - else show all available

### Recommendation engine
- Always return 1 recommended pro from the filtered list:
  - Start simple: highest rating or highest projected points (whichever you store)
  - Add tie-breakers later (avoid repeats, rank tiers, etc.)

### AutoPick
- If timer expires:
  - call `AutoPickOnTimeout`
  - it uses the same recommendation logic
  - records a pick event and advances the clock

### Steps
- [ ] Build `GetDraftOptions` usecase:
  - loads participant roster + available pros
  - computes allowed list
  - computes recommendation
  - returns both
- [ ] Build `MakeDraftPick` usecase:
  - validates it is the correct participant on the clock
  - validates pro is available + allowed
  - writes pick
  - advances to next pick
- [ ] Build `AutoPickOnTimeout` usecase:
  - checks expiration
  - uses recommendation
  - writes pick
  - advances

---

## Phase 9 — Integrate Back Into the Working UI (Gradual Swap)

### Outcomes
- You keep the working client alive while refactoring.
- You replace features one at a time.

### Strategy
- Keep existing screens
- Swap their data calls to usecases gradually:
  - scoring screen → `SubmitHoleScore`
  - draft screen → `GetDraftOptions` + `MakeDraftPick` + `AutoPickOnTimeout`
  - admin screens → create/update via repos/usecases

### Steps
- [ ] Start with read-only lists (lowest risk)
- [ ] Then scoring submission (medium)
- [ ] Then draft flow (highest impact)

---

## Phase 10 — Add Auth / Roles (After Refactor)

### Outcomes
- Roles are applied to already-clean usecases.
- You don’t bake auth assumptions into every component.

### Roles you mentioned
- admin sees everything
- leaders see departments
- vendors see their department
- pros see their info
- scorekeepers score assigned groups

### Steps
- [ ] Add auth to PB (users)
- [ ] Add role fields + access checks at the usecase layer:
  - `SubmitHoleScore` checks scorekeeper assignment
  - admin-only for `FinalizeTournament`, etc.
- [ ] Add audit fields to events (entered_by, updated_by)

---

## Phase 11 — Hardening (Tests, Auditing, Performance)

### Outcomes
- Confidence + speed.
- Easier debugging during live events.

### Steps
- [ ] Unit test policies:
  - Snake order
  - filtering rules
  - recommendation selection
- [ ] Add conflict handling for scoring:
  - last-write-wins OR explicit correction events
- [ ] Add caching/derived totals (optional) if needed for speed:
  - tournament leaderboard materialized view table

---

## Phase 12 — Deployment Readiness (When Local Is Solid)

### Outcomes
- You can deploy PB + client without changing architecture.

### Steps
- [ ] Ensure environment config is centralized
- [ ] Confirm PB migrations / schema management strategy
- [ ] Seed scripts for dev/test
- [ ] Logging hooks for critical usecases (draft pick, score submit)

---

# Immediate Next Task (Recommended)

## Build these 3 usecases first (highest leverage)
1) `CreateGroupsForRound`
2) `SubmitHoleScore`
3) `GetDraftOptions` (filter + recommend)

Once these are stable, the rest of the refactor becomes straightforward.

---

# Notes to Fill In (your specifics)
- **How many draft rounds?** (sounds like at least 4 today)
- **Roster target after round 4:** likely `2 male + 2 female`
- **Recommendation basis:** rating, projected points, manual rank, tiers
- **Scoring format:** 18 holes par-3; confirm bounds for throws
