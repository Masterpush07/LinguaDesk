// Multi-seller schema (v2). Safe to re-run. New table names on purpose: the original single-shop demo keeps its own tables
// (conversations, messages, orders, shop_settings) and keeps working until the webhook is switched over.
// Run with: node --env-file=.env scripts/migrate-v2.mjs
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const statements = [
  // One row per shop. nexconn_user_id is the chat identity every message to the shop is addressed to.
  `CREATE TABLE IF NOT EXISTS sellers (
    id text PRIMARY KEY,
    slug text UNIQUE NOT NULL,
    shop_name text NOT NULL,
    owner_name text NOT NULL,
    country text NOT NULL DEFAULT '',
    tagline text NOT NULL DEFAULT '',
    about text NOT NULL DEFAULT '',
    languages text[] NOT NULL DEFAULT '{en}',
    nexconn_user_id text UNIQUE NOT NULL,
    hours text NOT NULL DEFAULT '',
    shipping jsonb NOT NULL DEFAULT '{}'::jsonb,
    policies jsonb NOT NULL DEFAULT '{}'::jsonb,
    response_target_min integer NOT NULL DEFAULT 15,
    tone text NOT NULL DEFAULT 'neutral',
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  // Owner and agents of a shop. passcode_hash is scrypt, never the passcode itself.
  `CREATE TABLE IF NOT EXISTS staff (
    id text PRIMARY KEY,
    seller_id text NOT NULL REFERENCES sellers (id) ON DELETE CASCADE,
    name text NOT NULL,
    role text NOT NULL CHECK (role IN ('owner', 'agent')),
    languages text[] NOT NULL DEFAULT '{en}',
    skills text[] NOT NULL DEFAULT '{}',
    max_concurrent integer NOT NULL DEFAULT 5,
    available boolean NOT NULL DEFAULT true,
    last_seen timestamptz,
    passcode_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS staff_name_idx ON staff (seller_id, lower(name))`,
  // One-time codes the owner hands to an agent so they can join the shop's team.
  `CREATE TABLE IF NOT EXISTS invites (
    code text PRIMARY KEY,
    seller_id text NOT NULL REFERENCES sellers (id) ON DELETE CASCADE,
    role text NOT NULL DEFAULT 'agent',
    created_by text REFERENCES staff (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    used_at timestamptz,
    used_by text
  )`,
  `CREATE TABLE IF NOT EXISTS products (
    id text PRIMARY KEY,
    seller_id text NOT NULL REFERENCES sellers (id) ON DELETE CASCADE,
    name text NOT NULL,
    description text NOT NULL DEFAULT '',
    category text NOT NULL DEFAULT '',
    price_usd integer NOT NULL CHECK (price_usd > 0),
    colors text[] NOT NULL DEFAULT '{}',
    sizes text[] NOT NULL DEFAULT '{}',
    stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
    image_url text,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS products_seller_idx ON products (seller_id)`,
  // What the AI is allowed to answer from, besides products and policies.
  `CREATE TABLE IF NOT EXISTS faqs (
    id text PRIMARY KEY,
    seller_id text NOT NULL REFERENCES sellers (id) ON DELETE CASCADE,
    q text NOT NULL,
    a text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  // rule 'keep' = never translate the term; 'fixed' = always use the given translation note.
  `CREATE TABLE IF NOT EXISTS glossary (
    id text PRIMARY KEY,
    seller_id text NOT NULL REFERENCES sellers (id) ON DELETE CASCADE,
    term text NOT NULL,
    rule text NOT NULL DEFAULT 'keep' CHECK (rule IN ('keep', 'fixed')),
    note text NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS canned_replies (
    id text PRIMARY KEY,
    seller_id text NOT NULL REFERENCES sellers (id) ON DELETE CASCADE,
    title text NOT NULL,
    body text NOT NULL
  )`,
  // Guests are identified by their Nexconn user ID. No sign-up is required to chat.
  `CREATE TABLE IF NOT EXISTS buyers (
    id text PRIMARY KEY,
    name text,
    language text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  // One conversation per buyer and shop. status: ai -> waiting -> assigned -> resolved.
  `CREATE TABLE IF NOT EXISTS threads (
    id text PRIMARY KEY,
    seller_id text NOT NULL REFERENCES sellers (id) ON DELETE CASCADE,
    buyer_id text NOT NULL REFERENCES buyers (id) ON DELETE CASCADE,
    product_id text REFERENCES products (id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'ai' CHECK (status IN ('ai', 'waiting', 'assigned', 'resolved')),
    priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'critical')),
    language text,
    subject text NOT NULL DEFAULT '',
    summary text,
    assigned_staff_id text REFERENCES staff (id) ON DELETE SET NULL,
    last_text text NOT NULL DEFAULT '',
    last_at timestamptz NOT NULL DEFAULT now(),
    handoff_at timestamptz,
    sla_due_at timestamptz,
    first_response_at timestamptz,
    resolved_at timestamptz,
    rating integer CHECK (rating BETWEEN 1 AND 5),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (seller_id, buyer_id)
  )`,
  `CREATE INDEX IF NOT EXISTS threads_queue_idx ON threads (seller_id, status, last_at DESC)`,
  `CREATE INDEX IF NOT EXISTS threads_buyer_idx ON threads (buyer_id, last_at DESC)`,
  // text is what the receiver saw; text_en is the English version for the shop team.
  `CREATE TABLE IF NOT EXISTS thread_messages (
    id text PRIMARY KEY,
    thread_id text NOT NULL REFERENCES threads (id) ON DELETE CASCADE,
    sender text NOT NULL CHECK (sender IN ('buyer', 'ai', 'staff', 'system')),
    staff_id text REFERENCES staff (id) ON DELETE SET NULL,
    text text NOT NULL,
    text_en text,
    lang text,
    voice_seconds integer,
    confidence real,
    numbers_verified boolean NOT NULL DEFAULT false,
    order_id text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS thread_messages_idx ON thread_messages (thread_id, created_at)`,
  // Append-only history: assigned, transferred, escalated, resolved, reopened, order events.
  `CREATE TABLE IF NOT EXISTS thread_events (
    id bigserial PRIMARY KEY,
    thread_id text NOT NULL REFERENCES threads (id) ON DELETE CASCADE,
    type text NOT NULL,
    actor text NOT NULL DEFAULT 'system',
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS thread_events_idx ON thread_events (thread_id, at)`,
  `CREATE TABLE IF NOT EXISTS thread_notes (
    id text PRIMARY KEY,
    thread_id text NOT NULL REFERENCES threads (id) ON DELETE CASCADE,
    staff_id text REFERENCES staff (id) ON DELETE SET NULL,
    text text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  // The card is stored exactly as the buyer saw it. Payment and courier tracking are manual: the seller types them in.
  `CREATE TABLE IF NOT EXISTS orders_v2 (
    id text PRIMARY KEY,
    seller_id text NOT NULL REFERENCES sellers (id) ON DELETE CASCADE,
    thread_id text REFERENCES threads (id) ON DELETE SET NULL,
    buyer_id text NOT NULL REFERENCES buyers (id) ON DELETE CASCADE,
    card jsonb NOT NULL,
    total integer NOT NULL,
    status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled')),
    courier text,
    tracking text,
    created_at timestamptz NOT NULL DEFAULT now(),
    confirmed_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS orders_v2_seller_idx ON orders_v2 (seller_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS orders_v2_buyer_idx ON orders_v2 (buyer_id, created_at DESC)`,
];

for (const statement of statements) await sql.query(statement);

const tables = await sql.query(
  "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
);
console.log("tables now in the database:", tables.map((t) => t.table_name).join(", "));
