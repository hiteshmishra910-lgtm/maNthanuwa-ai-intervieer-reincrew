-- Migration: 20260805000004_seed_admin_users.sql
-- Seed Admin & HR team member emails into public.admin_users

INSERT INTO public.admin_users (email, role)
VALUES
  ('shreyayadav9885@gmail.com', 'admin'),
  ('pranitakhobe22@gmail.com', 'admin'),
  ('rohitnalbuga2@gmail.com', 'admin'),
  ('aaditya0257@gmail.com', 'admin'),
  ('shivamjpatil2007@gmail.com', 'admin'),
  ('riddhinahar028@gmail.com', 'admin'),
  ('harshkatole30@gmail.com', 'admin'),
  ('shreyayadav2703@gmail.com', 'admin'),
  ('dakshitadekate@gmail.com', 'admin')
ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role;
