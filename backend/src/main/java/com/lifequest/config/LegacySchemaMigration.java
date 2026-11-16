package com.lifequest.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class LegacySchemaMigration implements ApplicationRunner {
    private final JdbcTemplate jdbc;
    public LegacySchemaMigration(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    @Override public void run(ApplicationArguments args) {
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'users' AND index_name = 'uk_users_username'", Integer.class);
        if (count != null && count > 0) jdbc.execute("ALTER TABLE users DROP INDEX uk_users_username");
        Integer check = jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.check_constraints WHERE constraint_schema = DATABASE() AND constraint_name = 'ck_users_exp' AND check_clause LIKE '%100%'", Integer.class);
        if (check != null && check > 0) {
            jdbc.execute("ALTER TABLE users DROP CHECK ck_users_exp");
            jdbc.execute("ALTER TABLE users ADD CONSTRAINT ck_users_exp CHECK (exp >= 0)");
        }
        jdbc.update("UPDATE users SET total_exp = (CAST(level AS SIGNED) - 1) * 100 + exp WHERE total_exp IS NULL");
    }
}
