package com.lifequest.config;

import com.lifequest.domain.User;
import com.lifequest.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "lifequest.seed-user", havingValue = "true")
public class InitialUser implements ApplicationRunner {
    private final UserRepository users;

    @Override
    public void run(ApplicationArguments args) {
        if (users.count() == 0) {
            User user = new User();
            user.setUsername("LifeQuest");
            users.save(user);
        }
    }
}
