package com.lifequest.repository;

import com.lifequest.domain.Quest;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface QuestRepository extends JpaRepository<Quest, Long> {
    List<Quest> findAllByUserIdOrderByCreatedAtAscIdAsc(Long userId);
    long countByCompletedTrue();

    @Query("""
        SELECT q.user.id AS userId, COUNT(q) AS total,
            SUM(CASE WHEN q.completed = true THEN 1 ELSE 0 END) AS completed
        FROM Quest q WHERE q.user.id IN :userIds GROUP BY q.user.id
        """)
    List<UserQuestCounts> countForUsers(@Param("userIds") List<Long> userIds);

    interface UserQuestCounts {
        Long getUserId();
        long getTotal();
        long getCompleted();
    }

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT q FROM Quest q WHERE q.id = :id")
    Optional<Quest> findByIdForUpdate(@Param("id") Long id);
}
