package com.lifequest.service;

import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 같은 이메일과 IP 조합의 로그인 실패를 세어 무작위 비밀번호 대입을 늦춥니다.
 * 기록은 메모리에만 두므로 서버를 다시 시작하면 초기화됩니다.
 */
@Service
public class LoginAttemptGuard {
    private static final int MAX_FAILURES = 5;
    private static final Duration WINDOW = Duration.ofMinutes(10);
    private static final int MAX_ENTRIES = 10_000;

    private record Attempt(int failures, Instant expiresAt) {}

    private final Map<String, Attempt> attempts = new ConcurrentHashMap<>();

    public String key(String email, String clientAddress) {
        return email + '|' + (clientAddress == null ? "" : clientAddress);
    }

    /** 실패 횟수가 한도를 넘었으면 429로 거절합니다. */
    public void checkAllowed(String key) {
        Attempt attempt = attempts.get(key);
        if (attempt == null) return;
        if (attempt.expiresAt().isBefore(Instant.now())) {
            attempts.remove(key);
            return;
        }
        if (attempt.failures() >= MAX_FAILURES) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.");
        }
    }

    public void recordFailure(String key) {
        if (attempts.size() >= MAX_ENTRIES) purgeExpired();
        Instant now = Instant.now();
        attempts.merge(key, new Attempt(1, now.plus(WINDOW)), (current, fresh) ->
            current.expiresAt().isBefore(now) ? fresh
                : new Attempt(current.failures() + 1, current.expiresAt()));
    }

    public void recordSuccess(String key) {
        attempts.remove(key);
    }

    @Scheduled(initialDelay = 60_000, fixedDelay = 10 * 60 * 1000)
    public void purgeExpired() {
        Instant now = Instant.now();
        attempts.values().removeIf(attempt -> attempt.expiresAt().isBefore(now));
    }
}
