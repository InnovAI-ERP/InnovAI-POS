/*
  # Create user settings table

  1. New Tables
    - `user_settings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `company_name` (text)
      - `identification_type` (text)
      - `identification_number` (text)
      - `commercial_name` (text)
      - `province` (text)
      - `canton` (text)
      - `district` (text)
      - `address` (text)
      - `phone` (text)
      - `email` (text)
      - `economic_activity` (text)
      - `api_username` (text)
      - `api_password` (text, encrypted)
      - `api_key_path` (text)
      - `api_pin` (text, encrypted)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `user_settings` table
    - Add policy for authenticated users to manage their own settings
*/

CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) UNIQUE,
  company_name text NOT NULL,
  identification_type text NOT NULL,
  identification_number text NOT NULL,
  commercial_name text,
  province text,
  canton text,
  district text,
  address text,
  phone text,
  email text,
  economic_activity text,
  api_username text,
  api_password text,
  api_key_path text,
  api_pin text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own settings"
  ON user_settings
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);