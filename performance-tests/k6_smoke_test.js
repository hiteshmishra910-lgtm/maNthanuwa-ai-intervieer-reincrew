// Quick smoke test — just reads job_posts
import http from 'k6/http';
import { check } from 'k6';

const SUPABASE_URL = __ENV.SUPBASE_URL || 'https://kczpxtopdbiietknswgz.supabase.co';
const ANON_KEY = __ENV.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjenB4dG9wZGJpaWV0a25zd2d6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0Nzk5MTEsImV4cCI6MjA5OTA1NTkxMX0.J_RNZJgU5Gu5m_-DwcXJGRhB0vEFof32AUzvg8qwkHc';

const HEADERS = {
  'apikey': ANON_KEY,
  'Content-Type': 'application/json',
};

export default function () {
  const res = http.get(`${SUPABASE_URL}/rest/v1/job_posts?limit=1`, { headers: HEADERS });

  console.log(`STATUS: ${res.status}, BODY: ${res.body.substring(0, 100)}`);

  check(res, {
    'status is 200': (r) => r.status === 200,
  });
}
