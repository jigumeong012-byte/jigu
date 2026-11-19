package com.lifequest.api;

import com.lifequest.domain.User;
import com.lifequest.repository.QuestRepository;
import com.lifequest.repository.UserRepository;
import com.lifequest.service.QuestService;
import jakarta.servlet.http.HttpSession;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class AdminController {
    private static final int PAGE_SIZE = 20;
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
        requireAdmin(session);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .body(new Overview(users.count(), quests.count(), quests.countByCompletedTrue()));
    }

    @GetMapping("/api/admin/users")
    public ResponseEntity<UserDirectory> directory(HttpSession session,
            @RequestParam(defaultValue = "") String query, @RequestParam(defaultValue = "0") int page) {
        requireAdmin(session);
        String search = query.strip();
        if (search.length() > 254 || page < 0 || page > Integer.MAX_VALUE / PAGE_SIZE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "검색어 또는 페이지 범위를 확인해주세요.");
        }
        var pagination = PageRequest.of(page, PAGE_SIZE, Sort.by(Sort.Direction.DESC, "id"));
        var accounts = search.isEmpty() ? users.findAll(pagination)
            : users.findByUsernameContainingIgnoreCaseOrEmailContainingIgnoreCase(search, search, pagination);
        Map<Long, QuestRepository.UserQuestCounts> counts = accounts.isEmpty() ? Map.of()
            : quests.countForUsers(accounts.map(User::getId).getContent()).stream()
                .collect(Collectors.toMap(QuestRepository.UserQuestCounts::getUserId, Function.identity()));
        var rows = accounts.map(user -> {
            var count = counts.get(user.getId());
            return new Account(user.getId(), user.getUsername(), user.getEmail(),
                QuestService.levelProgress(user.getTotalExp()).level(), user.getTotalExp(),
                count == null ? 0 : count.getTotal(), count == null ? 0 : count.getCompleted());
        });
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .body(new UserDirectory(rows.getContent(), page, accounts.getTotalPages(), accounts.getTotalElements()));
    }

    private void requireAdmin(HttpSession session) {
        long userId = AuthController.requireUser(session);
        if (adminUserId <= 0 || userId != adminUserId || !users.existsById(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "관리자 권한이 필요합니다.");
        }
    }

    public record Overview(long users, long quests, long completedQuests) {}
    public record Account(long id, String username, String email, int level, long totalExp,
                          long quests, long completedQuests) {}
    public record UserDirectory(List<Account> accounts, int page, int totalPages, long totalAccounts) {}
}
