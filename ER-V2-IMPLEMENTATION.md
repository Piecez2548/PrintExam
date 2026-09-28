# ER-v2 implementation and requirement coverage

The 13 ER-v2 tables are the canonical business-data projection used for assessment:
`Admin`, `Audiovisual`, `Examination_Conductor`, `Teacher`, `Login`, `Subject`,
`Room`, `Exam`, `Exam_Validation`, `Exam_Print`, `Envelope_Packing`,
`Exam_Delivery`, and `Activity_Log`.

The ER-v2 named tables are now the application's primary data source. The former lowercase
tables and one-way synchronization triggers have been removed. `Exam_Schedule`, `Notification`,
`Envelope_Label`, and `System_Audit_Log` supplement functions required by the specification but
not represented as standalone entities in the ER document.

## Requirement mapping

| Requirement | Implementation | ER-v2 destination |
| --- | --- | --- |
| REQ-0001 | Password login, JWT, 3-minute OTP | `Login` and role profile tables |
| REQ-0002 | User CRUD, suspend, role management | Role profile tables and `Login` |
| REQ-0003 | Course, date, time, room, coordinator schedule | `Subject`, `Room`, `Exam`, `Examination_Conductor` |
| REQ-0004/5 | Exam upload, lookup, edit/cancel rules | `Exam` |
| REQ-0006/7 | Approve/reject with reason and notification | `Exam_Validation` and `Exam` |
| REQ-0008 | Status plus WebSocket notification | `Exam.Status` |
| REQ-0009 | Print operator, copies and timestamp | `Exam_Print` |
| REQ-0010/11 | Cover sheet and envelope packing | `Envelope_Packing` |
| REQ-0012 | Handover notification and receipt | `Exam_Delivery` |
| REQ-0013 | Exam action history | `Activity_Log` |
| REQ-0014 | Filtered dashboards and summaries | ER-v2 business tables plus support metadata |

## Maintenance

Do not rerun the one-time promotion migration. Do not run `prisma db push`, `prisma migrate reset`,
or an introspection that overwrites `schema.prisma`. Apply future structural changes through a
reviewed SQL migration, regenerate Prisma Client, and test one complete workflow.

## Intentional adaptations

- PostgreSQL `varchar`, `text`, `date`, `time`, `timestamptz`, integer, and boolean types are
  used instead of padded `char`/generic datetime types.
- PostgreSQL integer identifiers are used to match the application and avoid padded character IDs.
- Supplementary tables are retained only for functions absent from the ER document.
