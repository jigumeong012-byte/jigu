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
    public QuestResponse updateQuest(Long id, UpdateQuestRequest request) {
        Quest quest = lockedQuest(id);
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
    public QuestResponse completeQuest(Long id) {
        Quest quest = lockedQuest(id);
        if (quest.isCompleted()) return QuestResponse.from(quest);

        User user = userRepository.findByIdForUpdate(quest.getUser().getId())
            .orElseThrow(() -> missing("사용자"));
        int rewardExp = quest.getDifficulty().getRewardExp();
        int totalExp = user.getExp() + rewardExp;
        int level = user.getLevel();
        while (totalExp >= 100) {
            level++;
            totalExp -= 100;
        }
        user.setLevel(level);
        user.setExp(totalExp);
        quest.setRewardExp(rewardExp);
        quest.setCompleted(true);
        return QuestResponse.from(quest);
    }

    @Transactional
    public void deleteQuest(Long id) {
        questRepository.delete(lockedQuest(id));
    }

    private Quest lockedQuest(Long id) {
        return questRepository.findByIdForUpdate(id).orElseThrow(() -> missing("퀘스트"));
    }

    private ResponseStatusException missing(String resource) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, resource + "를 찾을 수 없습니다.");
    }
}
