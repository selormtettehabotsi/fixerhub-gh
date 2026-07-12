package com.fixerhub.worker.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    @Value("${gateway.secret}")
    private String gatewaySecret;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String email     = request.getHeader("X-User-Email");
        String role      = request.getHeader("X-User-Role");
        String userId    = request.getHeader("X-User-Id");
        String signature = request.getHeader("X-Gateway-Signature");

        // SECURITY (C3): only trust identity headers that carry a valid
        // gateway HMAC signature — forged headers on direct calls are ignored.
        if (email != null && role != null
                && GatewaySignature.verify(gatewaySecret, email, role, userId, signature)) {

            // "ROLE_" prefix makes @PreAuthorize("hasRole('CUSTOMER')") work correctly
            SimpleGrantedAuthority authority = new SimpleGrantedAuthority("ROLE_" + role);

            UsernamePasswordAuthenticationToken auth =
                    new UsernamePasswordAuthenticationToken(email, null, List.of(authority));

            // SECURITY (C4): caller's numeric userId, used for ownership checks.
            Long uid = null;
            try {
                if (userId != null && !userId.isBlank()) uid = Long.valueOf(userId);
            } catch (NumberFormatException ignored) { }
            auth.setDetails(uid);

            SecurityContextHolder.getContext().setAuthentication(auth);
        }

        filterChain.doFilter(request, response);
    }
}
