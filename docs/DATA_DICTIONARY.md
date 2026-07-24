# RescueEye Data Dictionary

Formal column-level specification for the finalized 10-table ERD (see `docs/ERD.txt`). Each table below follows the manuscript format: Column Name, Data Type, Field Size, Null, Description.

---

### Table 10.1

**PLATFORM_ADMIN**

| Column Name | Data Type | Field Size | Null | Description |
|---|---|---|---|---|
| Admin_ID (PK) | INT | – | NOT NULL | Primary key, unique identifier for the platform admin. |
| Admin_Email | VARCHAR | 120 | NOT NULL | Login email address; must be unique across all platform admins. |
| Admin_PasswordHash | VARCHAR | 255 | NOT NULL | Bcrypt-hashed password; never stored or returned in plaintext. |
| Admin_Name | VARCHAR | 100 | NOT NULL | Display name. |
| Admin_CreatedAt | DATETIME | – | NOT NULL | Account creation timestamp. |
| Admin_LastLogin | DATETIME | – | YES | Timestamp of the last successful login. |

---

### Table 10.2

**AGENCY**

| Column Name | Data Type | Field Size | Null | Description |
|---|---|---|---|---|
| Agency_ID (PK) | INT | – | NOT NULL | Primary key, unique identifier for the agency. |
| Agency_Name | VARCHAR | 100 | NOT NULL | Agency/organization name (e.g. "CDRRMO Cebu"). |
| Agency_RegistrationStatus | ENUM | – | NOT NULL | Onboarding gate: PENDING, APPROVED, or REJECTED. Default: PENDING. |
| Agency_SubscriptionStatus | ENUM | – | NOT NULL | Ongoing account state: ACTIVE, EXPIRED, or SUSPENDED. Default: ACTIVE. |
| Agency_CreatedBy (FK) | INT | – | NOT NULL | Foreign key referencing User.User_ID; the Agency Admin who self-registered the agency. |
| Agency_CreatedAt | DATETIME | – | NOT NULL | Self-registration timestamp. |
| Agency_ValidatedBy (FK) | INT | – | YES | Foreign key referencing Platform_Admin.Admin_ID; the platform admin who approved the agency. NULL until reviewed. |
| Agency_ValidatedAt | DATETIME | – | YES | Approval timestamp. |

---

### Table 10.3

**USER**

| Column Name | Data Type | Field Size | Null | Description |
|---|---|---|---|---|
| User_ID (PK) | INT | – | NOT NULL | Primary key, unique identifier for the user. |
| User_Email | VARCHAR | 120 | NOT NULL | Login email address; must be unique. |
| User_PasswordHash | VARCHAR | 255 | NOT NULL | Bcrypt-hashed password; never stored or returned in plaintext. |
| User_Name | VARCHAR | 100 | NOT NULL | Display name. |
| User_Phone | VARCHAR | 20 | YES | Mobile number, used for SMS/push alerts. |
| User_Role | ENUM | – | NOT NULL | Account role: AGENCY_ADMIN, COMMAND_STAFF, or FIELD_RESPONDER. |
| User_AgencyID (FK) | INT | – | NOT NULL | Foreign key referencing Agency.Agency_ID; the agency this account belongs to. |
| User_Active | BOOLEAN | – | NOT NULL | Whether the account can currently log in. Default: TRUE. |
| User_DutyStatus | ENUM | – | NOT NULL | Current availability: AVAILABLE, ON_DUTY, or OFF_DUTY. Default: AVAILABLE. |
| User_CreatedAt | DATETIME | – | NOT NULL | Account creation timestamp. |
| User_LastLogin | DATETIME | – | YES | Timestamp of the last successful login. |

---

### Table 10.4

**DRONE**

| Column Name | Data Type | Field Size | Null | Description |
|---|---|---|---|---|
| Drone_ID (PK) | INT | – | NOT NULL | Primary key, unique identifier for the drone. |
| Drone_Callsign | VARCHAR | 50 | NOT NULL | Human-readable drone name. |
| Drone_Status | ENUM | – | NOT NULL | Current operating state: ACTIVE, IDLE, or OFFLINE. |
| Drone_AddedBy (FK) | INT | – | NOT NULL | Foreign key referencing User.User_ID; the Command Staff who registered the drone. |
| Drone_LastLat | DECIMAL | 9,6 | YES | Last known latitude. |
| Drone_LastLng | DECIMAL | 9,6 | YES | Last known longitude. |
| Drone_LastFeedAt | DATETIME | – | YES | Timestamp of the last received video frame. |

---

### Table 10.5

**DETECTION**

| Column Name | Data Type | Field Size | Null | Description |
|---|---|---|---|---|
| Detection_ID (PK) | INT | – | NOT NULL | Primary key, unique identifier for the detection. |
| Detection_DroneID (FK) | INT | – | NOT NULL | Foreign key referencing Drone.Drone_ID; the source drone feed. |
| Detection_Class | ENUM | – | NOT NULL | Detected object class: CASUALTY, DAMAGE_MINOR, DAMAGE_MAJOR, or DAMAGE_SEVERE. |
| Detection_Confidence | DECIMAL | 5,4 | NOT NULL | AI model confidence score (0–1). |
| Detection_BBoxJSON | TEXT | – | NOT NULL | Serialized bounding box coordinates `[x, y, w, h]`. |
| Detection_ModelName | VARCHAR | 50 | NOT NULL | Name of the YOLO model that produced the detection. |
| Detection_ModelVersion | VARCHAR | 20 | NOT NULL | Version/tag of the deployed model. |
| Detection_Lat | DECIMAL | 9,6 | NOT NULL | Geospatially mapped latitude. |
| Detection_Lng | DECIMAL | 9,6 | NOT NULL | Geospatially mapped longitude. |
| Detection_Timestamp | DATETIME | – | NOT NULL | Detection time. |
| Detection_ReviewStatus | ENUM | – | NOT NULL | Human review state: PENDING, VALID, or FALSE_POSITIVE. Default: PENDING. |
| Detection_ReviewedBy (FK) | INT | – | YES | Foreign key referencing User.User_ID; the command staff who verified/rejected it. |
| Detection_ReviewedAt | DATETIME | – | YES | Verification timestamp. |

---

### Table 10.6

**MEDIA**

| Column Name | Data Type | Field Size | Null | Description |
|---|---|---|---|---|
| Media_ID (PK) | INT | – | NOT NULL | Primary key, unique identifier for the media file. |
| Media_DetectionID (FK) | INT | – | YES | Foreign key referencing Detection.Detection_ID. Exactly one of Media_DetectionID / Media_IncidentID must be set. |
| Media_IncidentID (FK) | INT | – | YES | Foreign key referencing Incident.Incident_ID. Exactly one of Media_DetectionID / Media_IncidentID must be set. |
| Media_Type | ENUM | – | NOT NULL | PHOTO or VIDEO. |
| Media_URL | VARCHAR | 255 | NOT NULL | Storage location of the file. |
| Media_UploadedBy (FK) | INT | – | NOT NULL | Foreign key referencing User.User_ID; the uploader. |
| Media_UploadedAt | DATETIME | – | NOT NULL | Upload timestamp. |

---

### Table 10.7

**INCIDENT**

| Column Name | Data Type | Field Size | Null | Description |
|---|---|---|---|---|
| Incident_ID (PK) | INT | – | NOT NULL | Primary key, unique identifier for the incident. |
| Incident_DetectionID (FK) | INT | – | YES | Foreign key referencing Detection.Detection_ID; identifies the originating AI detection, if applicable. |
| Incident_AgencyID (FK) | INT | – | NOT NULL | Foreign key referencing Agency.Agency_ID; scopes the incident to its owning agency. |
| Incident_Type | ENUM | – | NOT NULL | Incident category: VICTIM_DETECTED, FLOOD, FIRE, STRUCTURAL, or UNKNOWN. |
| Incident_Severity | ENUM | – | NOT NULL | Priority level assigned by Command Staff: CRITICAL, HIGH, MEDIUM, or LOW. |
| Incident_Status | ENUM | – | NOT NULL | Lifecycle state: OPEN, ASSIGNED, IN_PROGRESS, or RESOLVED. Default: OPEN. |
| Incident_Lat | DECIMAL | 9,6 | NOT NULL | Latitude of the incident location, plotted on the geospatial map. |
| Incident_Lng | DECIMAL | 9,6 | NOT NULL | Longitude of the incident location, plotted on the geospatial map. |
| Incident_Description | VARCHAR | 500 | YES | Free-text description entered by Command Staff. |
| Incident_ReportedBy (FK) | INT | – | NOT NULL | Foreign key referencing User.User_ID; identifies the Command Staff who logged or confirmed the incident. |
| Incident_CreatedAt | DATETIME | – | NOT NULL | Creation timestamp. |
| Incident_ResolvedAt | DATETIME | – | YES | Closure timestamp. |

---

### Table 10.8

**RESPONSE**

| Column Name | Data Type | Field Size | Null | Description |
|---|---|---|---|---|
| Response_ID (PK) | INT | – | NOT NULL | Primary key, unique identifier for the response record. |
| Response_IncidentID (FK) | INT | – | NOT NULL | Foreign key referencing Incident.Incident_ID; the incident being responded to. |
| Response_UserID (FK) | INT | – | NOT NULL | Foreign key referencing User.User_ID; the responder assigned. |
| Response_Status | ENUM | – | NOT NULL | ASSIGNED, ACCEPTED, DECLINED, EN_ROUTE, ON_SITE, or COMPLETED. Default: ASSIGNED. |
| Response_Notes | VARCHAR | 500 | YES | Field notes / status remarks. |
| Response_AssignedAt | DATETIME | – | NOT NULL | Assignment timestamp. |
| Response_AcceptedAt | DATETIME | – | YES | Responder acceptance timestamp. |
| Response_ArrivedAt | DATETIME | – | YES | On-site arrival timestamp. |
| Response_CompletedAt | DATETIME | – | YES | Response completion timestamp. |

---

### Table 10.9

**ALERT**

| Column Name | Data Type | Field Size | Null | Description |
|---|---|---|---|---|
| Alert_ID (PK) | INT | – | NOT NULL | Primary key, unique identifier for the alert. |
| Alert_IncidentID (FK) | INT | – | NOT NULL | Foreign key referencing Incident.Incident_ID; the related incident. |
| Alert_RecipientID (FK) | INT | – | NOT NULL | Foreign key referencing User.User_ID; the alert recipient. |
| Alert_Type | ENUM | – | NOT NULL | Delivery channel: SMS, PUSH, or DASHBOARD. |
| Alert_Message | VARCHAR | 300 | NOT NULL | Alert content. |
| Alert_Status | ENUM | – | NOT NULL | Delivery state: SENT, DELIVERED, FAILED, or READ. Default: SENT. |
| Alert_SentAt | DATETIME | – | NOT NULL | Send timestamp. |
| Alert_AcknowledgedAt | DATETIME | – | YES | Timestamp the recipient acknowledged the alert. |

---

### Table 10.10

**STATUS_HISTORY**

| Column Name | Data Type | Field Size | Null | Description |
|---|---|---|---|---|
| History_ID (PK) | INT | – | NOT NULL | Primary key, unique identifier for the history entry. |
| History_EntityType | ENUM | – | NOT NULL | Table the changed row belongs to: INCIDENT, RESPONSE, ALERT, DETECTION, or AGENCY. |
| History_EntityID | INT | – | NOT NULL | ID of the affected row within the table named by History_EntityType. Enforced at the application layer, not a hard FK. |
| History_FieldChanged | VARCHAR | 50 | NOT NULL | Name of the column that changed. |
| History_OldValue | VARCHAR | 255 | YES | Value before the change. |
| History_NewValue | VARCHAR | 255 | YES | Value after the change. |
| History_ChangedBy (FK) | INT | – | NOT NULL | References User.User_ID or Platform_Admin.Admin_ID, depending on actor type. Exactly one applies per row. |
| History_ChangedAt | DATETIME | – | NOT NULL | Timestamp the change was recorded. |

---

## Notes

- **PK** = Primary Key, **FK** = Foreign Key.
- Field Size is left as "–" for data types where it does not apply (INT, ENUM, DATETIME, BOOLEAN, TEXT).
- `MEDIA` and `STATUS_HISTORY.History_ChangedBy` use an "exactly one of two nullable FKs" pattern — not enforceable by a single database constraint, so it must be validated at the application layer.
- Table numbers (10.1–10.10) follow the dependency order used in `docs/ERD.txt` (parent tables first); renumber to match final manuscript chapter placement if needed.
