package com.lifequest.api;

import com.lifequest.api.QuestDtos.*;
import com.lifequest.service.QuestService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/quests")
@RequiredArgsConstructor
public class QuestController {
    private final QuestService questService;

    @GetMapping
    public List<QuestResponse> getQuests(jakarta.servlet.http.HttpSession session) {
        return questService.getQuests(AuthController.requireUser(session));
    }

    @PostMapping
    public ResponseEntity<QuestResponse> createQuest(@Valid @RequestBody CreateQuestRequest request, jakarta.servlet.http.HttpSession session) {
        QuestResponse quest = questService.createQuest(new CreateQuestRequest(AuthController.requireUser(session), request.title(), request.category(), request.difficulty()));
        return ResponseEntity.created(URI.create("/api/quests/" + quest.id())).body(quest);
    }

    @PutMapping("/{id}")
    public QuestResponse updateQuest(@PathVariable Long id, @Valid @RequestBody UpdateQuestRequest request, jakarta.servlet.http.HttpSession session) {
        return questService.updateQuest(id, request, AuthController.requireUser(session));
    }

    @PostMapping("/{id}/complete")
    public QuestResponse completeQuest(@PathVariable Long id, jakarta.servlet.http.HttpSession session) {
        return questService.completeQuest(id, AuthController.requireUser(session));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteQuest(@PathVariable Long id, jakarta.servlet.http.HttpSession session) {
        questService.deleteQuest(id, AuthController.requireUser(session));
        return ResponseEntity.noContent().build();
    }
}
