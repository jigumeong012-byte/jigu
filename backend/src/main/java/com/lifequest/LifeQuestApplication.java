package com.lifequest;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class LifeQuestApplication {
    public static void main(String[] args) {
        SpringApplication.run(LifeQuestApplication.class, args);
    }
}
