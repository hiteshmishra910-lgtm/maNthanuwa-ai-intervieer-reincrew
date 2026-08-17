# Deployment Flow

When changing evaluation profiles or models, follow this deployment flow to ensure V2 backwards compatibility.

## Safe Migrations
Never `UPDATE` an existing `evaluation_profile_versions` row in production.
Instead, use Supabase migrations to insert a new version and bump the `current_version` pointer in `evaluation_profiles`.

```sql
-- Correct
INSERT INTO evaluation_profile_versions (profile_id, version_number, weights) 
VALUES ('uuid', 2, '{"Critical": 60}');

UPDATE evaluation_profiles SET current_version = 2 WHERE id = 'uuid';
```

## Cache Invalidation
The application `ProfileService` uses a TTL memory cache.
On deployment, or when manual profile bumps occur, call `ProfileService.invalidateCache(profileId)` to force the next interview session to load the latest schema from Supabase.
