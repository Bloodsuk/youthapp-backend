# SOP Acknowledgement — implementation notes

Spec: `sop-acknowledgement-app-spec` (Lou / Wajid, item 4).

## Checklist vs code

| Spec item | Status |
|---|---|
| Only 3 required docs get ticks | `requires_acknowledgement` + title/code inference |
| Reference library: view only, no tick | `status: reference`, no sign-off UI |
| Safeguarding Presentation excluded | Hidden from SOP list (`YR_SD_016` / title filter + deactivated) |
| Legacy dashboard “Presentation pending” | Policy ack mirrors to Presentation; Presentation `is_active=0` |
| Opens tracking | `npn_sop_document_views` (spec name `npn_sop_opens`) |
| Version notifications table | `npn_sop_version_notifications` (flag-only; email = item 5) |
| Individual “I have read and understood this” | App + `POST /sops/:id/acknowledge` |
| Read all (3 separate rows) | `POST /sops/acknowledge-all` |
| Version bump → unacknowledged | Join on `current_version` (unchanged) + queue notification flags |
| Version from DB, not filename | Uses `npn_sop_documents.current_version` |
| `phleb_id` = logged-in phleb id | JWT `sessionUser.id` (same as rest of phleb APIs) |

## Migrate DB

```bash
ENV_FILE=env/live.env node scripts/migrate_npn_sop_acknowledgement_spec.js
```

Or full deploy script (includes additive SOP migration).

## App API

- `GET /phlebotomists/sops` → `{ documents, required_total, required_opened, required_acknowledged, can_acknowledge_all }`
- `POST /phlebotomists/sops/:id/view`
- `POST /phlebotomists/sops/:id/acknowledge`
- `POST /phlebotomists/sops/acknowledge-all`
