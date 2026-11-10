package com.lifequest.api;

import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class WebAppController {
    @GetMapping(value = "/manifest.webmanifest", produces = "application/manifest+json")
    public ResponseEntity<Resource> manifest() {
        return ResponseEntity.ok().contentType(MediaType.parseMediaType("application/manifest+json"))
            .cacheControl(CacheControl.noCache())
            .body(new ClassPathResource("static/manifest.webmanifest"));
    }
}
