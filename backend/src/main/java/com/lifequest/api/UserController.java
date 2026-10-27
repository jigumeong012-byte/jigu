package com.lifequest.api;

import com.lifequest.api.QuestDtos.UserResponse;
import com.lifequest.service.QuestService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {
    private final QuestService questService;

    @GetMapping("/{id}")
    public UserResponse getUser(@PathVariable Long id) {
        return questService.getUser(id);
    }
}
