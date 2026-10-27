package com.lifequest.api;

import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class HealthController {
    private final JdbcTemplate database;

    @GetMapping("/api/health")
    public ResponseEntity<Map<String, String>> health() {
        try {
            database.queryForObject("SELECT 1", Integer.class);
            return ResponseEntity.ok(Map.of("status", "UP"));
        } catch (DataAccessException exception) {
            return ResponseEntity.status(503).body(Map.of("status", "DOWN"));
        }
    }
}
