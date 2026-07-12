package com.fixerhub.auth.config;

import com.fixerhub.auth.model.User;
import com.fixerhub.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * SECURITY (C1): ADMIN accounts cannot be created via /auth/register.
 * Instead, a single admin is seeded/updated from environment variables on startup:
 *
 *   ADMIN_EMAIL    — email of the platform admin
 *   ADMIN_PASSWORD — password (min 8 chars, at least one number)
 *
 * If both are set, the user is created as ADMIN (or its password/role is updated
 * if the email already exists). If unset, seeding is skipped with a log notice.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AdminSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${ADMIN_EMAIL:}")
    private String adminEmail;

    @Value("${ADMIN_PASSWORD:}")
    private String adminPassword;

    @Override
    public void run(String... args) {
        if (adminEmail == null || adminEmail.isBlank()
                || adminPassword == null || adminPassword.isBlank()) {
            log.info("AdminSeeder: ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping admin seeding.");
            return;
        }

        if (adminPassword.length() < 8 || !adminPassword.matches(".*\\d.*")) {
            log.error("AdminSeeder: ADMIN_PASSWORD must be at least 8 characters and contain a number. Skipping.");
            return;
        }

        userRepository.findByEmail(adminEmail).ifPresentOrElse(existing -> {
            existing.setRole(User.Role.ADMIN);
            existing.setPassword(passwordEncoder.encode(adminPassword));
            userRepository.save(existing);
            log.info("AdminSeeder: existing user '{}' updated to ADMIN.", adminEmail);
        }, () -> {
            User admin = User.builder()
                    .email(adminEmail)
                    .password(passwordEncoder.encode(adminPassword))
                    .role(User.Role.ADMIN)
                    .name("FixerHub Admin")
                    .build();
            userRepository.save(admin);
            log.info("AdminSeeder: admin account '{}' created.", adminEmail);
        });
    }
}
