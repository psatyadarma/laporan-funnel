-- TikTok Events API delivery flag and report-link email delivery.
ALTER TABLE orders ADD COLUMN tiktok_sent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN email_sent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN email_attempts INTEGER NOT NULL DEFAULT 0;
