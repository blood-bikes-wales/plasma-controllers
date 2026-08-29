# Glossary

Terms used when talking about Plasma Controller and Blood Bikes Wales operations. Definitions stay short and free of implementation detail unless needed for clarity.

| Term | Meaning |
|------|---------|
| Plasma Controller | This web app: the tool controllers use to manage jobs, shifts, and directory lookups |
| plasma-api | The backend service that stores jobs, shifts, and volunteer data; verifies Google sign-in |
| Blood Bikes Wales / Beiciau Gwaed Cymru | The charity that runs the volunteer medical courier service |
| Controller | Volunteer (or staff) who takes hospital calls and dispatches riders |
| Admin | User with full operational access, including job creation and shift management |
| Rider | Volunteer courier who collects and delivers items |
| Driver | Volunteer who may drive rather than ride; has access to the same app areas |
| Trustee | Oversight role with access to operational screens |
| Role | What the signed-in user is acting as in this session (controller, rider, etc.); some users have more than one |
| Job | A single courier task (with a reference like JB-1042) from pickup to delivery |
| Job status | Where the job is in its lifecycle: New, Allocated, Collected, Delivered, or Cancelled |
| Allocated | A rider has been assigned to the job |
| Relay job | A job split across legs with rendezvous handover points between riders |
| Shift | A period when a rider is logged on duty with a specific bike and start mileage |
| Logon / logoff | Starting or ending a rider’s on-duty shift |
| Directory | Search tool for volunteers and charity bikes (registration, mileage history) |
| Service area | Geographic region for a job: South Area or North Area |
| Pickup | Where the rider collects from (usually a hospital, sometimes a ward/department) |
| Delivery | Where the rider takes the items |
| Sender | Person at the hospital who requested the courier (name, phone, organisation) |
| Contents | What is being carried (e.g. samples, notes) |
| Google account | How users sign in; must be an authorised Blood Bikes Wales Workspace account |

<!-- Add rows as jargon appears in code, ops, or stakeholder conversations. -->
