package com.lifequest.api;

import com.lifequest.repository.QuestRepository;
import com.lifequest.repository.UserRepository;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class AdminController {
    private final long adminUserId;
    private final UserRepository users;
    private final QuestRepository quests;

    public AdminController(@Value("${LIFEQUEST_ADMIN_USER_ID:0}") long adminUserId,
                           UserRepository users, QuestRepository quests) {
        this.adminUserId = adminUserId;
        this.users = users;
        this.quests = quests;
    }

    @GetMapping("/api/admin/overview")
    public ResponseEntity<Overview> overview(HttpSession session) {
        long userId = AuthController.requireUser(session);
        if (adminUserId <= 0 || userId != adminUserId || !users.existsById(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "관리자 권한이 필요합니다.");
        }
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .body(new Overview(users.count(), quests.count(), quests.countByCompletedTrue()));
    }

    public record Overview(long users, long quests, long completedQuests) {}
}
