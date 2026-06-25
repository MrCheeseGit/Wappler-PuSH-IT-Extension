-- PuSH-IT: suggested MySQL table for Web Push subscriptions
-- Run once in your project database. Adjust schema name as needed.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  subscription_uuid CHAR(36) NOT NULL,
  endpoint VARCHAR(512) NOT NULL,
  p256dh VARCHAR(255) NOT NULL,
  auth VARCHAR(255) NOT NULL,
  user_uuid VARCHAR(64) NULL COMMENT 'Portal user id, if logged in',
  entity_id VARCHAR(64) NULL COMMENT 'Scoped resource e.g. property id',
  event_types VARCHAR(255) NULL COMMENT 'Optional comma list: reservation,account',
  subscription_json TEXT NOT NULL COMMENT 'Full browser PushSubscription JSON backup',
  user_agent VARCHAR(512) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_date DATETIME NOT NULL,
  updated_date DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_push_subscriptions_endpoint (endpoint),
  KEY idx_push_subscriptions_entity_active (entity_id, active),
  KEY idx_push_subscriptions_active_id (active, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
