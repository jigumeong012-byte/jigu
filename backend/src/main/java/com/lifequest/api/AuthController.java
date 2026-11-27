package com.lifequest.api;

import com.lifequest.domain.User;
import com.lifequest.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.Locale;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final UserRepository users;
    private final com.lifequest.service.RememberMeService remember;
    private final com.lifequest.service.LoginAttemptGuard loginAttempts;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    public record Credentials(@NotBlank @Email @Size(max=254) String email, @NotBlank @Size(min=8,max=72) String password, @Size(max=12) String name, Boolean remember) {}
    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public void signup(@Valid @RequestBody Credentials input) {
        String email = input.email().strip().toLowerCase(Locale.ROOT);
        if (input.password().getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password is too long.");
        if (input.name() == null || input.name().strip().length() < 2) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이름을 2자 이상 입력해주세요.");
        if (!input.password().matches("(?s)^(?=.*[A-Za-z])(?=.*[0-9])(?=.*\\p{Punct}).*$")) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "비밀번호는 영문, 숫자, 특수문자를 포함한 8자 이상이어야 합니다.");
        if (users.findByEmail(email).isPresent()) throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 가입된 이메일입니다.");
        User user = new User(); user.setUsername(input.name().strip()); user.setEmail(email); user.setPasswordHash(encoder.encode(input.password())); users.save(user);
    }
    @PostMapping("/login")
    public QuestDtos.UserResponse login(@Valid @RequestBody Credentials input, HttpServletRequest request,
                                        jakarta.servlet.http.HttpServletResponse response) {
        String email = input.email().strip().toLowerCase(Locale.ROOT);
        String attemptKey = loginAttempts.key(email, request.getRemoteAddr());
        loginAttempts.checkAllowed(attemptKey);

        User user = authenticate(email, input.password(), attemptKey);
        loginAttempts.recordSuccess(attemptKey);

        HttpSession previous = request.getSession(false);
        if (previous != null) previous.invalidate();
        remember.clear(request, response);
        request.getSession(true).setAttribute("userId", user.getId());
        if (Boolean.TRUE.equals(input.remember())) remember.issue(user.getId(), request, response);
        return QuestDtos.UserResponse.from(user);
    }

    private User authenticate(String email, String password, String attemptKey) {
        boolean oversized = password.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72;
        User user = oversized ? null : users.findByEmail(email).orElse(null);
        if (user == null || user.getPasswordHash() == null || !encoder.matches(password, user.getPasswordHash())) {
            loginAttempts.recordFailure(attemptKey);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "이메일 또는 비밀번호가 일치하지 않습니다.");
        }
        return user;
    }
    @GetMapping("/me")
    public QuestDtos.UserResponse me(HttpSession session, HttpServletRequest request,
                                    @RequestParam(defaultValue = "false") boolean rememberedOnly) {
        Long userId = requireUser(session);
        if (rememberedOnly && !userId.equals(remember.authenticate(request))) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        return QuestDtos.UserResponse.from(users.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED)));
    }
    @PostMapping("/logout")
    public void logout(HttpServletRequest request, jakarta.servlet.http.HttpServletResponse response) { remember.clear(request, response); HttpSession session = request.getSession(false); if (session != null) session.invalidate(); }
    public static Long requireUser(HttpSession session) { Object id = session.getAttribute("userId"); if (!(id instanceof Long)) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."); return (Long) id; }
}
