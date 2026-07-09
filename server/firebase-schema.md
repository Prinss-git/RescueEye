# RescueEye — Firestore Schema

## /users/{userId}
```
{
  uid:          string,          // Firebase Auth UID
  email:        string,
  displayName:  string,
  role:         'system_admin' | 'agency_admin' | 'command_staff' | 'field_responder',
  organization: string,          // e.g. "CDRRMO Cebu"
  createdAt:    Timestamp,
  lastLogin:    Timestamp
}
```

## /teams/{teamId}
```
{
  id:           string,          // T001–T005
  name:         string,
  status:       'STANDBY' | 'DISPATCHED' | 'ON_SITE' | 'COMPLETE',
  members:      string[],        // displayNames
  assignedTo:   string | null,   // incidentId
  updatedAt:    Timestamp
}
```

## /incidents/{incidentId}
```
{
  id:           string,          // auto-generated
  type:         'VICTIM_DETECTED' | 'FLOOD' | 'FIRE' | 'STRUCTURAL' | 'UNKNOWN',
  severity:     'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
  status:       'OPEN' | 'ASSIGNED' | 'RESOLVED',
  lat:          number,
  lng:          number,
  description:  string,
  reportedBy:   string,          // userId or 'AI_SYSTEM'
  assignedTeam: string | null,   // teamId
  isDrill:      boolean,         // SIMULATED incidents during drill
  drillSessionId: string | null,
  createdAt:    Timestamp,
  resolvedAt:   Timestamp | null
}
```

## /messages/{messageId}
```
{
  id:            string,         // auto-generated
  incidentId:    string,
  senderId:      string,
  senderName:    string,
  senderOrg:     string,
  content:       string,
  type:          'SITUATION_REPORT' | 'RESOURCE_REQUEST' | 'UPDATE' | 'ALERT',
  timestamp:     Timestamp,
  isDrill:       boolean
}
```

## /drill_sessions/{sessionId}
```
{
  id:            string,
  startedBy:     string,         // userId
  startedAt:     Timestamp,
  stoppedAt:     Timestamp | null,
  active:        boolean,
  incidentCount: number,
  messageCount:  number,
  teamActions:   number,
  detectionCount: number,
  avgResponseMs: number
}
```

## Security Rules (summary)
- All reads/writes require `request.auth != null`
- Only `command_staff` role can start/stop drills
- Messages: any authenticated user can read; only authenticated users can write their own messages
- Teams: any authenticated user can read; only `command_staff` can PATCH status
- All Firestore writes must go through the Node.js server, never directly from the frontend
