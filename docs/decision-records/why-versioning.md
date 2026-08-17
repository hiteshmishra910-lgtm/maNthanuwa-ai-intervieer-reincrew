# ADR: Why Database Versioning?

## Context
When an interviewer asks "Why did Candidate A get 74 while Candidate B got 74?", we need a deterministic way to prove it. If rubrics, models, and weights change over time without versioning, old reports become invalid digital crime scenes.

## Decision
All evaluation reports must inherently freeze the metadata of their creation:
- `engineVersion`
- `schemaVersion`
- `pipelineVersion`
- `profileVersionId`
- `rubricVersion`
- `model`

All database profiles must retain their historical rows rather than being overwritten. 

## Consequences
- The database schema is slightly more complex (`evaluation_profile_versions` vs just `evaluation_profiles`).
- We can replay past interviews with older rubrics for verification.
- Older reports will always render accurately according to the rules present at the time they were taken.
