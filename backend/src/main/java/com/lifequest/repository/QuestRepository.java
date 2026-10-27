package com.lifequest.repository;

import com.lifequest.domain.Quest;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface QuestRepository extends JpaRepository<Quest, Long> {
    List<Quest> findAllByUserIdOrderByCreatedAtAscIdAsc(Long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT q FROM Quest q WHERE q.id = :id")
    Optional<Quest> findByIdForUpdate(@Param("id") Long id);
}
