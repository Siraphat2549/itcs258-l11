-- MySQL sample database for ITCS258 Auth Lab (NestJS)
-- Usage: mysql -u root -p < database.sql

CREATE DATABASE IF NOT EXISTS nest_auth_lab
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE nest_auth_lab;

-- Users table (matches UsersService: username + password, bcrypt-hashed)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL COMMENT 'bcrypt hash, e.g. $2b$12$...',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Rooms table (for Task 5: protected room endpoints)
CREATE TABLE IF NOT EXISTS rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rooms_user FOREIGN KEY (created_by)
    REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Sample data
-- Password below is bcrypt hash of 'changeme' (rounds 12).
-- Generate your own with: npx bcrypt 'yourpassword' 12  (or via AuthService register)
INSERT INTO users (username, password) VALUES
  ('maria', '$2b$12$KIXxQG8b2aIu0E4vZxGvteN6R8sQwYvJ0pLkM9nVbC1dE2fG3hI4jK'),
  ('john',  '$2b$12$KIXxQG8b2aIu0E4vZxGvteN6R8sQwYvJ0pLkM9nVbC1dE2fG3hI4jK')
ON DUPLICATE KEY UPDATE username = VALUES(username);

INSERT INTO rooms (name, description, created_by) VALUES
  ('Deluxe Room', 'Sea view, king bed', 1),
  ('Standard Room', 'City view, queen bed', 1);
