# Database Schema

The core V2 architecture relies heavily on database versioning rather than monolithic code structures.

## `evaluation_profiles` & `evaluation_profile_versions`
Instead of hardcoding profiles (e.g. "Backend Engineer"), they are stored in `evaluation_profiles` with a pointer `current_version`.
The actual weights, rubrics, and settings exist immutably in `evaluation_profile_versions`.
- **Primary Key**: `profile_id` + `version_number`.
- **Purpose**: If a rubric changes, old reports still point to the specific version used to score them, preserving historical accuracy.

## `evaluation_audit_log`
Stores a lightweight log of all external evaluation events.
- **Fields**: `session_id`, `evaluated_at`, `profile_version_id`, `has_fallback`, `debug_snapshot`.
- **Purpose**: Used purely for debugging, compliance, and tracing provider failures without cluttering the main reports.

## `evaluation_reports`
The final, immutable output of `MasterEvaluationReport`.
- Inherits all versioning metadata (`engineVersion`, `schemaVersion`, `profileVersionId`).
- A V1 report lacking metadata will simply fall back to default rendering in the application layer.
