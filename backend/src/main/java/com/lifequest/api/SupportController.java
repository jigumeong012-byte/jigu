package com.lifequest.api;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SupportController {
    private final String email;

    public SupportController(@Value("${LIFEQUEST_SUPPORT_EMAIL:}") String email) {
        this.email = email.strip();
    }

    @GetMapping("/api/support/contact")
    public Contact contact() {
        return new Contact(email);
    }

    public record Contact(String email) {}
}
