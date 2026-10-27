package com.lifequest.domain;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.time.ZoneId;

@Data
@NoArgsConstructor
@Entity
@Table(name = "quests")
public class Quest {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, foreignKey = @ForeignKey(name = "fk_quests_user"))
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private User user;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(nullable = false, length = 50)
    private String category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Difficulty difficulty;

    @Column(name = "reward_exp", nullable = false)
    private int rewardExp;

    @Column(nullable = false)
    private boolean completed;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    private void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now(ZoneId.of("Asia/Seoul"));
    }

    @Getter
    @RequiredArgsConstructor
    public enum Difficulty {
        쉬움(10), 보통(30), 어려움(50);
        private final int rewardExp;
    }
}
