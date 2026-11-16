package com.lifequest.config;

import com.lifequest.service.RememberMeService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;

@Component
public class RememberMeFilter extends OncePerRequestFilter {
    private final RememberMeService remember;
    public RememberMeFilter(RememberMeService remember) { this.remember = remember; }
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        var session = request.getSession(false);
        if (request.getRequestURI().startsWith("/api/") && (session == null || session.getAttribute("userId") == null)) {
            Long userId = remember.authenticate(request);
            if (userId != null) request.getSession(true).setAttribute("userId", userId);
        }
        chain.doFilter(request, response);
    }
}
