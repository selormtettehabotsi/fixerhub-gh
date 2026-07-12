package com.fixerhub.review.config;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * SECURITY (N8): access to the authenticated caller's identity, as verified
 * by JwtAuthFilter (gateway-signed headers). userId is stored in auth details.
 */
public final class AuthContext {

    private AuthContext() {}

    public static Long userId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return (auth != null && auth.getDetails() instanceof Long id) ? id : null;
    }

    public static boolean isAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
    }
}
