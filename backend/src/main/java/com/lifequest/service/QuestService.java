package com.lifequest.service;

import com.lifequest.api.QuestDtos.*;
import com.lifequest.domain.*;
import com.lifequest.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class QuestService {
    private final QuestRepository questRepository;
    private final UserRepository userRepository;

    public List<QuestResponse> getQuests(Long userId) {
        getUser(userId);
        return questRepository.findAllByUserIdOrderByCreatedAtAscIdAsc(userId).stream()
            .map(QuestResponse::from).toList();
    }

    public UserResponse getUser(Long userId) {
        return UserResponse.from(userRepository.findById(userId)
            .orElseThrow(() -> missing("사용자")));
    }

    @Transactional
    public QuestResponse createQuest(CreateQuestRequest request) {
        User user = userRepository.findById(request.userId()).orElseThrow(() -> missing("사용자"));
        Quest quest = new Quest();
        quest.setUser(user);
        quest.setTitle(request.title().strip());
        quest.setCategory(request.category().strip());
        quest.setDifficulty(request.difficulty());
        quest.setRewardExp(request.difficulty().getRewardExp());
        return QuestResponse.from(questRepository.save(quest));
    }

    @Transactional
    public QuestResponse updateQuest(Long id, UpdateQuestRequest request, Long userId) {
        Quest quest = lockedQuest(id, userId);
        if (quest.isCompleted() && quest.getDifficulty() != request.difficulty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "완료한 퀘스트의 난이도는 변경할 수 없습니다.");
        }
        quest.setTitle(request.title().strip());
        quest.setCategory(request.category().strip());
        quest.setDifficulty(request.difficulty());
        quest.setRewardExp(request.difficulty().getRewardExp());
        return QuestResponse.from(quest);
    }

    @Transactional
    public QuestResponse completeQuest(Long id, Long userId) {
        Quest quest = lockedQuest(id, userId);
        if (quest.isCompleted()) return QuestResponse.from(quest);

        User user = userRepository.findByIdForUpdate(quest.getUser().getId())
            .orElseThrow(() -> missing("사용자"));
        int rewardExp = quest.getDifficulty().getRewardExp();
        updateExperience(user, user.getTotalExp() + rewardExp);
        quest.setRewardExp(rewardExp);
        quest.setCompleted(true);
        quest.setCompletedAt(java.time.LocalDateTime.now(java.time.ZoneId.of("Asia/Seoul")));
        return QuestResponse.from(quest);
    }

    public static int experienceForLevel(int level) {
        return Math.toIntExact(100L + (level - 1L) * 10L);
    }

    public record LevelProgress(int level, int exp, int required) {}

    public static LevelProgress levelProgress(long totalExp) {
        int level = 1;
        int required = experienceForLevel(level);
        while (totalExp >= required) {
            totalExp -= required;
            required = experienceForLevel(++level);
        }
        return new LevelProgress(level, Math.toIntExact(totalExp), required);
    }

    private void updateExperience(User user, long totalExp) {
        LevelProgress progress = levelProgress(totalExp);
        user.setLevel(progress.level());
        user.setExp(progress.exp());
        user.setTotalExp(totalExp);
    }

    @Transactional
    public QuestResponse undoCompletion(Long id, Long userId) {
        Quest quest = lockedQuest(id, userId);
        if (!quest.isCompleted()) return QuestResponse.from(quest);
        User user = userRepository.findByIdForUpdate(userId).orElseThrow(() -> missing("사용자"));
        int reward = quest.getRewardExp();
        if (user.getTotalExp() < reward) throw new ResponseStatusException(HttpStatus.CONFLICT, "경험치 기록을 확인할 수 없습니다.");
        updateExperience(user, user.getTotalExp() - reward);
        quest.setCompleted(false);
        quest.setCompletedAt(null);
        return QuestResponse.from(quest);
    }

    @Transactional
    public void deleteQuest(Long id, Long userId) {
        questRepository.delete(lockedQuest(id, userId));
    }

    private Quest lockedQuest(Long id, Long userId) {
        Quest quest = questRepository.findByIdForUpdate(id).orElseThrow(() -> missing("Quest"));
        if (!quest.getUser().getId().equals(userId)) throw missing("Quest");
        return quest;
    }

    private ResponseStatusException missing(String resource) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, resource + "를 찾을 수 없습니다.");
    }
}
