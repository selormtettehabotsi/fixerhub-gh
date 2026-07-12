package com.fixerhub.worker.config;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * SECURITY (C4): access to the authenticated caller's identity, as verified
 * by JwtAuthFilter (gateway-signed headers). userId is stored in auth details.
 */
public final class AuthContext {

    private AuthContext() {}

    public static Long userId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return (auth != null && auth.getDetails() instanceof Long id) ? id : null;
    }

    public static String email() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? String.valueOf(auth.getPrincipal()) : null;
    }

    public static boolean hasRole(String role) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> ("ROLE_" + role).equals(a.getAuthority()));
    }

    public static boolean isAdmin() {
        return hasRole("ADMIN");
    }
}
