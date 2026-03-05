# Archived Migrations

These 22 SQL files were manually applied to both databases (Project Opus dev
and Revizo Prod) but were never tracked in the Drizzle migration journal
(`meta/_journal.json`). They were moved here to prevent `drizzle-kit migrate`
from attempting to re-apply them.

The corresponding schema changes are already reflected in the Drizzle-generated
migrations that ARE tracked in the journal (0000–0010).

**Do not delete these files** — they serve as historical reference for what was
applied to the databases.

Archived on: 2026-03-04
