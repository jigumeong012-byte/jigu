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
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    public record Credentials(@NotBlank @Email @Size(max=254) String email, @NotBlank @Size(min=8,max=72) String password, @Size(max=12) String name) {}
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
    public QuestDtos.UserResponse login(@Valid @RequestBody Credentials input, HttpServletRequest request) {
        if (input.password().getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials.");
        User user = users.findByEmail(input.email().strip().toLowerCase(Locale.ROOT)).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "이메일 또는 비밀번호가 일치하지 않습니다."));
        if (user.getPasswordHash() == null || !encoder.matches(input.password(), user.getPasswordHash())) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "이메일 또는 비밀번호가 일치하지 않습니다.");
        HttpSession old = request.getSession(false); if (old != null) old.invalidate();
        request.getSession(true).setAttribute("userId", user.getId());
        return QuestDtos.UserResponse.from(user);
    }
    @GetMapping("/me")
    public QuestDtos.UserResponse me(HttpSession session) { return QuestDtos.UserResponse.from(users.findById(requireUser(session)).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED))); }
    @PostMapping("/logout")
    public void logout(HttpServletRequest request) { HttpSession session = request.getSession(false); if (session != null) session.invalidate(); }
    public static Long requireUser(HttpSession session) { Object id = session.getAttribute("userId"); if (!(id instanceof Long)) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."); return (Long) id; }
}
