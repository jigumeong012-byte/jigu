package com.lifequest.service;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.HexFormat;

@Service
public class RememberMeService {
    private static final String COOKIE = "lifequest_remember";
    private static final Duration LIFETIME = Duration.ofDays(30);
    private final JdbcTemplate jdbc;
    private final SecureRandom random = new SecureRandom();
    public RememberMeService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public void issue(Long userId, HttpServletRequest request, HttpServletResponse response) {
        byte[] token = new byte[32]; random.nextBytes(token);
        String value = Base64.getUrlEncoder().withoutPadding().encodeToString(token);
        jdbc.update("INSERT INTO remember_tokens (token_hash,user_id,expires_at) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY))", hash(value), userId);
        cookie(response, request, value, LIFETIME);
    }
    public Long authenticate(HttpServletRequest request) {
        String value = token(request);
        if (value == null || !value.matches("[A-Za-z0-9_-]{43}")) return null;
        var ids = jdbc.query("SELECT user_id FROM remember_tokens WHERE token_hash=? AND expires_at > UTC_TIMESTAMP()", (rs,n)->rs.getLong(1), hash(value));
        return ids.isEmpty() ? null : ids.getFirst();
    }
    public void clear(HttpServletRequest request, HttpServletResponse response) {
        String value = token(request);
        if (value != null && value.matches("[A-Za-z0-9_-]{43}")) jdbc.update("DELETE FROM remember_tokens WHERE token_hash=?", hash(value));
        cookie(response, request, "", Duration.ZERO);
    }
    private String token(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) for (Cookie cookie : cookies) if (COOKIE.equals(cookie.getName())) return cookie.getValue();
        return null;
    }
    private void cookie(HttpServletResponse response, HttpServletRequest request, String value, Duration age) {
        response.addHeader(HttpHeaders.SET_COOKIE, ResponseCookie.from(COOKIE, value).httpOnly(true).secure(request.isSecure()).sameSite("Lax").path("/").maxAge(age).build().toString());
    }
    private String hash(String token) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(java.nio.charset.StandardCharsets.US_ASCII))); }
        catch (java.security.NoSuchAlgorithmException ex) { throw new IllegalStateException(ex); }
    }
}
