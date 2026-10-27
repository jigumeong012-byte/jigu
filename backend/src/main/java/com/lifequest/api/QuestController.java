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
    public List<QuestResponse> getQuests(@RequestParam(defaultValue = "1") Long userId) {
        return questService.getQuests(userId);
    }

    @PostMapping
    public ResponseEntity<QuestResponse> createQuest(@Valid @RequestBody CreateQuestRequest request) {
        QuestResponse quest = questService.createQuest(request);
        return ResponseEntity.created(URI.create("/api/quests/" + quest.id())).body(quest);
    }

    @PutMapping("/{id}")
    public QuestResponse updateQuest(@PathVariable Long id, @Valid @RequestBody UpdateQuestRequest request) {
        return questService.updateQuest(id, request);
    }

    @PostMapping("/{id}/complete")
    public QuestResponse completeQuest(@PathVariable Long id) {
        return questService.completeQuest(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteQuest(@PathVariable Long id) {
        questService.deleteQuest(id);
        return ResponseEntity.noContent().build();
    }
}
