# RescueEye Database Design

Relational schema for the RescueEye capstone manuscript. Table names are full descriptive names; every column carries a 4-letter table-prefix (e.g. `USER_ID`, `INCD_Severity`), following the `Cust_ID`-style convention. This design formalizes the platform's current Firestore collections (`users`, `teams`, `incidents`, `messages`, `drill_sessions`) into a normalized relational model, and adds the entities needed to fully cover the workflow: drones, AI detections, dispatch missions, and alerts/notifications.

## Entity Overview

| Table | Prefix | Purpose |
|---|---|---|
| `Agency` | `AGCY_` | A subscribing organization (e.g. a CDRRMO/BFP office) onboarded by a System Admin |
| `User` | `USER_` | All platform accounts: System Admins, Agency Admins, Command Staff, SAR responders, EMS responders, drone operators |
| `Drone` | `DRNE_` | Drones providing live video feeds |
| `Detection` | `DETC_` | AI-generated casualty/damage detections from a drone feed |
| `Incident` | `INCD_` | Incidents (verified detections or manually reported events) |
| `Team` | `TEAM_` | Field responder teams (SAR or EMS) |
| `TeamMember` | `TMEM_` | Junction table: which users belong to which team |
| `Mission` | `MISS_` | A dispatch of one team to one incident (the mission lifecycle) |
| `Alert` | `ALRT_` | System-generated alerts / SMS / push notifications |
| `Message` | `MESG_` | Free-text comms log tied to an incident |
| `DrillSession` | `DRIL_` | Drill/training session metadata |

---

## Agency — Subscribing Organizations

| Column | Type | Constraint | Description |
|---|---|---|---|
| `AGCY_ID` | VARCHAR(20) | PK | Unique agency identifier |
| `AGCY_Name` | VARCHAR(100) | NOT NULL | Agency/organization name (e.g. "CDRRMO Cebu") |
| `AGCY_SubscriptionStatus` | VARCHAR(20) | NOT NULL, DEFAULT `ACTIVE` | `ACTIVE`, `SUSPENDED` |
| `AGCY_CreatedBy` | VARCHAR(20) | FK → `User.USER_ID` | The System Admin who onboarded this agency |
| `AGCY_CreatedAt` | DATETIME | NOT NULL | Onboarding timestamp |

## User — Platform Accounts

| Column | Type | Constraint | Description |
|---|---|---|---|
| `USER_ID` | VARCHAR(20) | PK | Unique user identifier |
| `USER_Email` | VARCHAR(120) | UNIQUE, NOT NULL | Login email |
| `USER_Name` | VARCHAR(100) | NOT NULL | Display name |
| `USER_Phone` | VARCHAR(20) | NULL | Mobile number, used for SMS alerts |
| `USER_PasswordHash` | VARCHAR(255) | NOT NULL | Bcrypt-hashed password (never stored/returned in plaintext) |
| `USER_Role` | VARCHAR(20) | NOT NULL | `SYSTEM_ADMIN`, `AGENCY_ADMIN`, `COMMAND_STAFF`, `SAR_RESPONDER`, `EMS_RESPONDER`, `DRONE_OPERATOR`, `COORDINATOR` |
| `USER_AgencyID` | VARCHAR(20) | FK → `Agency.AGCY_ID`, NULL | The agency this account belongs to (NULL for System Admins) |
| `USER_Org` | VARCHAR(100) | NULL | Organization/agency display name (denormalized copy of `Agency.AGCY_Name`) |
| `USER_Active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Whether the account can currently log in |
| `USER_CreatedAt` | DATETIME | NOT NULL | Account creation timestamp |
| `USER_LastLogin` | DATETIME | NULL | Last successful login |

### Account creation hierarchy

- **System Admin** is a platform-operator role, seeded once at deployment (not created through the app UI).
- **System Admin → creates → Agency Admin**, together with the `Agency` record itself, in one combined onboarding step when an organization subscribes.
- **Agency Admin → creates → Command Staff** (`incident_commander`, `drone_operator`, `coordinator`) **and Field Responders** (`sar_responder`, `ems_responder`), always scoped to their own `USER_AgencyID` — an Agency Admin can only see/manage users within their own agency.

## Drone

| Column | Type | Constraint | Description |
|---|---|---|---|
| `DRNE_ID` | VARCHAR(20) | PK | Unique drone identifier |
| `DRNE_Callsign` | VARCHAR(50) | NOT NULL | Human-readable drone name |
| `DRNE_Status` | VARCHAR(20) | NOT NULL | `ACTIVE`, `IDLE`, `OFFLINE` |
| `DRNE_OperatorID` | VARCHAR(20) | FK → `User.USER_ID` | Assigned drone operator |
| `DRNE_LastLat` | DECIMAL(9,6) | NULL | Last known latitude |
| `DRNE_LastLng` | DECIMAL(9,6) | NULL | Last known longitude |
| `DRNE_LastFeedAt` | DATETIME | NULL | Timestamp of last received frame |

## Detection — AI Detections

| Column | Type | Constraint | Description |
|---|---|---|---|
| `DETC_ID` | VARCHAR(20) | PK | Unique detection identifier |
| `DETC_DroneID` | VARCHAR(20) | FK → `Drone.DRNE_ID` | Source drone feed |
| `DETC_Class` | VARCHAR(30) | NOT NULL | `CASUALTY`, `DAMAGE_MINOR`, `DAMAGE_MAJOR`, `DAMAGE_SEVERE` |
| `DETC_Confidence` | DECIMAL(5,4) | NOT NULL | AI model confidence score (0–1) |
| `DETC_BBoxJSON` | TEXT | NOT NULL | Serialized bounding box `[x, y, w, h]` |
| `DETC_Lat` | DECIMAL(9,6) | NOT NULL | Geospatially mapped latitude |
| `DETC_Lng` | DECIMAL(9,6) | NOT NULL | Geospatially mapped longitude |
| `DETC_Timestamp` | DATETIME | NOT NULL | Detection time |
| `DETC_ReviewStatus` | VARCHAR(20) | NOT NULL, DEFAULT `PENDING` | `PENDING`, `VALID`, `FALSE_POSITIVE` |
| `DETC_ReviewedBy` | VARCHAR(20) | FK → `User.USER_ID`, NULL | Command staff who verified/rejected |
| `DETC_ReviewedAt` | DATETIME | NULL | Verification timestamp |

## Incident

| Column | Type | Constraint | Description |
|---|---|---|---|
| `INCD_ID` | VARCHAR(20) | PK | Unique incident identifier |
| `INCD_DetectionID` | VARCHAR(20) | FK → `Detection.DETC_ID`, NULL | Originating AI detection, if any |
| `INCD_Type` | VARCHAR(30) | NOT NULL | `VICTIM_DETECTED`, `FLOOD`, `FIRE`, `STRUCTURAL`, `UNKNOWN` |
| `INCD_Severity` | VARCHAR(10) | NOT NULL | `CRITICAL`, `HIGH`, `MEDIUM`, `LOW` |
| `INCD_Status` | VARCHAR(20) | NOT NULL, DEFAULT `OPEN` | `OPEN`, `ASSIGNED`, `IN_PROGRESS`, `RESOLVED` |
| `INCD_Lat` | DECIMAL(9,6) | NOT NULL | Incident latitude |
| `INCD_Lng` | DECIMAL(9,6) | NOT NULL | Incident longitude |
| `INCD_Description` | VARCHAR(500) | NULL | Free-text description |
| `INCD_ReportedBy` | VARCHAR(20) | FK → `User.USER_ID` | Command staff who logged/confirmed it |
| `INCD_CreatedAt` | DATETIME | NOT NULL | Creation timestamp |
| `INCD_ResolvedAt` | DATETIME | NULL | Closure timestamp |

## Team — Field Responder Teams

| Column | Type | Constraint | Description |
|---|---|---|---|
| `TEAM_ID` | VARCHAR(20) | PK | Unique team identifier (e.g. `T001`) |
| `TEAM_Name` | VARCHAR(50) | NOT NULL | Team display name |
| `TEAM_Type` | VARCHAR(10) | NOT NULL | `SAR` or `EMS` |
| `TEAM_Status` | VARCHAR(20) | NOT NULL, DEFAULT `STANDBY` | `STANDBY`, `DISPATCHED`, `ON_SITE`, `COMPLETE` |
| `TEAM_UpdatedAt` | DATETIME | NOT NULL | Last status change |

## TeamMember (junction)

| Column | Type | Constraint | Description |
|---|---|---|---|
| `TMEM_ID` | VARCHAR(20) | PK | Unique membership record |
| `TMEM_TeamID` | VARCHAR(20) | FK → `Team.TEAM_ID`, NOT NULL | Team reference |
| `TMEM_UserID` | VARCHAR(20) | FK → `User.USER_ID`, NOT NULL | Responder reference |
| `TMEM_Role` | VARCHAR(20) | NOT NULL, DEFAULT `MEMBER` | `LEADER` or `MEMBER` |

## Mission — Dispatch Missions

One row per team dispatched to an incident. An incident can have **two concurrent `Mission` rows** — one `SAR`-type team and one `EMS`-type team — modeling the parallel SAR/EMS branches from the activity diagram.

| Column | Type | Constraint | Description |
|---|---|---|---|
| `MISS_ID` | VARCHAR(20) | PK | Unique mission identifier |
| `MISS_IncidentID` | VARCHAR(20) | FK → `Incident.INCD_ID`, NOT NULL | Incident being responded to |
| `MISS_TeamID` | VARCHAR(20) | FK → `Team.TEAM_ID`, NOT NULL | Team dispatched |
| `MISS_AssignedBy` | VARCHAR(20) | FK → `User.USER_ID`, NOT NULL | Command staff who assigned/approved |
| `MISS_Status` | VARCHAR(20) | NOT NULL, DEFAULT `ASSIGNED` | `ASSIGNED`, `ACCEPTED`, `EN_ROUTE`, `ON_SITE`, `RESCUED`, `TREATING`, `COMPLETED` |
| `MISS_MedicalRequired` | BOOLEAN | NULL | Set by EMS track after assessment |
| `MISS_ApprovedAt` | DATETIME | NULL | Dispatch approval timestamp |
| `MISS_AcceptedAt` | DATETIME | NULL | Responder acceptance timestamp |
| `MISS_CompletedAt` | DATETIME | NULL | Mission completion timestamp |
| `MISS_Notes` | VARCHAR(500) | NULL | Field notes / status remarks |

## Alert — Alerts & Notifications

| Column | Type | Constraint | Description |
|---|---|---|---|
| `ALRT_ID` | VARCHAR(20) | PK | Unique alert identifier |
| `ALRT_IncidentID` | VARCHAR(20) | FK → `Incident.INCD_ID`, NOT NULL | Related incident |
| `ALRT_RecipientID` | VARCHAR(20) | FK → `User.USER_ID`, NOT NULL | Alert recipient |
| `ALRT_Type` | VARCHAR(20) | NOT NULL | `SMS`, `PUSH`, `DASHBOARD` |
| `ALRT_Message` | VARCHAR(300) | NOT NULL | Alert content |
| `ALRT_Status` | VARCHAR(20) | NOT NULL, DEFAULT `SENT` | `SENT`, `DELIVERED`, `FAILED`, `READ` |
| `ALRT_SentAt` | DATETIME | NOT NULL | Send timestamp |

## Message

| Column | Type | Constraint | Description |
|---|---|---|---|
| `MESG_ID` | VARCHAR(20) | PK | Unique message identifier |
| `MESG_IncidentID` | VARCHAR(20) | FK → `Incident.INCD_ID`, NOT NULL | Related incident |
| `MESG_SenderID` | VARCHAR(20) | FK → `User.USER_ID`, NOT NULL | Message author |
| `MESG_Content` | VARCHAR(1000) | NOT NULL | Message body |
| `MESG_Type` | VARCHAR(30) | NOT NULL | `SITUATION_REPORT`, `RESOURCE_REQUEST`, `UPDATE`, `ALERT` |
| `MESG_Timestamp` | DATETIME | NOT NULL | Sent time |

## DrillSession

| Column | Type | Constraint | Description |
|---|---|---|---|
| `DRIL_ID` | VARCHAR(20) | PK | Unique drill session identifier |
| `DRIL_StartedBy` | VARCHAR(20) | FK → `User.USER_ID`, NOT NULL | User who started the drill |
| `DRIL_StartedAt` | DATETIME | NOT NULL | Start timestamp |
| `DRIL_StoppedAt` | DATETIME | NULL | Stop timestamp |
| `DRIL_Active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Whether the drill is running |
| `DRIL_IncidentCount` | INT | NOT NULL, DEFAULT 0 | Incidents generated during drill |
| `DRIL_MessageCount` | INT | NOT NULL, DEFAULT 0 | Messages sent during drill |
| `DRIL_DetectionCount` | INT | NOT NULL, DEFAULT 0 | Detections generated during drill |
| `DRIL_AvgResponseMs` | INT | NULL | Average response time metric |

---

## Relationships

| Relationship | Cardinality |
|---|---|
| `User` (System Admin) creates `Agency` | 1 : N |
| `Agency` has `User` (Agency Admin, Command Staff, Field Responders) | 1 : N |
| `User` operates `Drone` | 1 : N |
| `Drone` produces `Detection` | 1 : N |
| `Detection` reviewed by `User` | N : 1 |
| `Detection` escalates to `Incident` | 1 : 0..1 |
| `User` reports `Incident` | 1 : N |
| `Team` has `TeamMember` | 1 : N |
| `User` belongs to `TeamMember` | 1 : N |
| `Incident` has `Mission` | 1 : N (typically 1–2: one SAR, one EMS) |
| `Team` performs `Mission` | 1 : N |
| `User` assigns `Mission` | 1 : N |
| `Incident` triggers `Alert` | 1 : N |
| `User` receives `Alert` | 1 : N |
| `Incident` has `Message` | 1 : N |
| `User` sends `Message` | 1 : N |
| `User` starts `DrillSession` | 1 : N |

## Notes on Migration from Current Firestore Schema

- `User`, `Team`, `Incident`, `Message`, `DrillSession` map directly to the existing `/users`, `/teams`, `/incidents`, `/messages`, `/drill_sessions` Firestore collections (`server/firebase-schema.md`), with camelCase fields renamed to the `XXXX_FieldName` convention.
- `Detection` formalizes the transient, in-memory `StoredDetection` object currently in `api/services/detection_store.py` (ring buffer, not persisted) into a durable table with a review workflow.
- `Drone`, `TeamMember`, `Mission`, and `Alert` are new tables — they don't exist in the current implementation but are required to represent the full activity-diagram workflow (drone tracking, team membership, dispatch lifecycle, and notification delivery) in a normalized relational model.
