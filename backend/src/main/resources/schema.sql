CREATE TABLE IF NOT EXISTS users (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    level INT NOT NULL DEFAULT 1,
    exp INT NOT NULL DEFAULT 0,
    CONSTRAINT uk_users_username UNIQUE (username),
    CONSTRAINT ck_users_level CHECK (level >= 1),
    CONSTRAINT ck_users_exp CHECK (exp >= 0 AND exp < 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS quests (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    difficulty ENUM('쉬움', '보통', '어려움') NOT NULL,
    reward_exp INT NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_quests_user_id (user_id),
    CONSTRAINT fk_quests_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT ck_quests_completed CHECK (completed IN (0, 1)),
    CONSTRAINT ck_quests_reward CHECK (
        (difficulty = '쉬움' AND reward_exp = 10)
        OR (difficulty = '보통' AND reward_exp = 30)
        OR (difficulty = '어려움' AND reward_exp = 50)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
