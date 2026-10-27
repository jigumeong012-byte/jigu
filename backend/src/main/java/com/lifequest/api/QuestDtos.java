package com.lifequest.api;

import com.lifequest.domain.Quest;
import com.lifequest.domain.User;
import jakarta.validation.constraints.*;
import java.time.LocalDateTime;

public final class QuestDtos {
    private QuestDtos() {}

    public record CreateQuestRequest(
        @NotNull @Positive Long userId,
        @NotBlank @Size(max = 100) String title,
        @NotBlank @Pattern(regexp = "공부|개발|운동|생활|독서") String category,
        @NotNull Quest.Difficulty difficulty
    ) {}

    public record UpdateQuestRequest(
        @NotBlank @Size(max = 100) String title,
        @NotBlank @Pattern(regexp = "공부|개발|운동|생활|독서") String category,
        @NotNull Quest.Difficulty difficulty
    ) {}

    public record QuestResponse(Long id, Long userId, String title, String category,
                                Quest.Difficulty difficulty, int rewardExp, boolean completed,
                                LocalDateTime createdAt) {
        public static QuestResponse from(Quest quest) {
            return new QuestResponse(quest.getId(), quest.getUser().getId(), quest.getTitle(),
                quest.getCategory(), quest.getDifficulty(), quest.getRewardExp(),
                quest.isCompleted(), quest.getCreatedAt());
        }
    }

    public record UserResponse(Long id, String username, int level, int exp) {
        public static UserResponse from(User user) {
            return new UserResponse(user.getId(), user.getUsername(), user.getLevel(), user.getExp());
        }
    }
}
