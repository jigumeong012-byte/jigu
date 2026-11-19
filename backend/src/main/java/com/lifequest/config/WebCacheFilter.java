package com.lifequest.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;

@Component
public class WebCacheFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getRequestURI();
        response.setHeader("X-Content-Type-Options", "nosniff");
        if (path.equals("/") || path.endsWith(".html")) {
            response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; "
                + "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                + "font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; object-src 'none'; "
                + "base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
        }
        if (path.equals("/") || path.endsWith(".html") || path.endsWith(".js") || path.startsWith("/api/")) {
            response.setHeader("Cache-Control", "no-store");
        }
        chain.doFilter(request, response);
    }
}
