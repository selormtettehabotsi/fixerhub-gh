package com.fixerhub.auth.service;

import com.fixerhub.auth.config.JwtConfig;
import com.fixerhub.auth.dto.*;
import com.fixerhub.auth.exception.BadRequestException;
import com.fixerhub.auth.exception.NotFoundException;
import com.fixerhub.auth.exception.UnauthorizedException;
import com.fixerhub.auth.model.RefreshToken;
import com.fixerhub.auth.model.User;
import com.fixerhub.auth.repository.RefreshTokenRepository;
import com.fixerhub.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtConfig jwtConfig;
    private final RestTemplate restTemplate;
    private final EmailService emailService;

    @Value("${africastalking.username}")
    private String atUsername;

    @Value("${africastalking.api-key}")
    private String atApiKey;

    @Value("${africastalking.sms-url}")
    private String atSmsUrl;

    /** TOKENS (H6): refresh token lifetime in ms (default 7 days). */
    @Value("${jwt.refresh-expiration:604800000}")
    private long refreshExpirationMs;

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();


    //  REGISTER

    public AuthResponse register(RegisterRequest request) {
        String password = request.getPassword();

        // SECURITY (C1): self-registration may only create CUSTOMER or WORKER accounts.
        // ADMIN accounts are provisioned via the env-based AdminSeeder, never through this endpoint.
        if (request.getRole() != User.Role.CUSTOMER && request.getRole() != User.Role.WORKER) {
            throw new BadRequestException("Invalid role. Allowed roles: CUSTOMER, WORKER");
        }

        if (password == null || password.length() < 8 || !password.matches(".*\\d.*")) {
            throw new BadRequestException(
                    "Password must be at least 8 characters and contain at least one number");
        }

        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new BadRequestException("Email already in use");
        }

        User user = User.builder()
                .email(request.getEmail())
                .password(passwordEncoder.encode(password))
                .role(request.getRole())
                .name(request.getName())
                .phone(request.getPhone())
                .build();

        userRepository.save(user);

        // Auto-create worker profile if role is WORKER
        if (request.getRole() == User.Role.WORKER) {
            createWorkerProfile(user, request);
        }

        return buildAuthResponse(user);
    }

    private void createWorkerProfile(User user, RegisterRequest request) {
        try {
            Map<String, Object> workerRequest = Map.of(
                    "userId", user.getId(),
                    "email", user.getEmail() != null ? user.getEmail() : "",
                    "name", user.getName() != null ? user.getName() : "",
                    "phone", user.getPhone() != null ? user.getPhone() : "",
                    "skill", request.getSkill() != null ? request.getSkill() : "General",
                    "location", request.getLocation() != null ? request.getLocation() : ""
            );

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(workerRequest, headers);

            restTemplate.postForEntity("http://worker-service/workers", entity, Object.class);
            log.info("Worker profile created for userId={}", user.getId());
        } catch (Exception e) {
            log.error("Failed to auto-create worker profile for userId={}: {}", user.getId(), e.getMessage());
        }
    }


    //  LOGIN

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new UnauthorizedException("Invalid credentials"));
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new UnauthorizedException("Invalid credentials");
        }
        return buildAuthResponse(user);
    }

    // ------------------------------------------------------------------ //
    //  REFRESH / LOGOUT (H6)
    // ------------------------------------------------------------------ //

    /** Builds the auth payload: short-lived access JWT + rotated refresh token. */
    private AuthResponse buildAuthResponse(User user) {
        String token = jwtConfig.generateToken(user.getEmail(), user.getRole().name(), user.getId());
        return AuthResponse.builder()
                .token(token)
                .refreshToken(issueRefreshToken(user.getId()))
                .role(user.getRole())
                .userId(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .profilePicture(user.getProfilePicture())
                .build();
    }

    /** SECURITY (N9): only a SHA-256 digest of the refresh token is stored, so a
     *  database leak cannot be replayed as live sessions. */
    private static String sha256(String value) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    private String issueRefreshToken(Long userId) {
        byte[] bytes = new byte[48];
        SECURE_RANDOM.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        refreshTokenRepository.save(RefreshToken.builder()
                .token(sha256(token))   // N9: store the hash, hand out the raw token
                .userId(userId)
                .expiresAt(LocalDateTime.now().plusNanos(refreshExpirationMs * 1_000_000L))
                .revoked(false)
                .build());
        return token;
    }

    /** Exchanges a valid refresh token for a new access JWT + rotated refresh token. */
    @Transactional
    public AuthResponse refresh(String refreshTokenValue) {
        if (refreshTokenValue == null || refreshTokenValue.isBlank()) {
            throw new UnauthorizedException("Refresh token is required");
        }
        RefreshToken stored = refreshTokenRepository.findByToken(sha256(refreshTokenValue))   // N9
                .orElseThrow(() -> new UnauthorizedException("Invalid refresh token"));
        if (Boolean.TRUE.equals(stored.getRevoked()) || LocalDateTime.now().isAfter(stored.getExpiresAt())) {
            throw new UnauthorizedException("Refresh token expired or revoked. Please log in again.");
        }
        User user = userRepository.findById(stored.getUserId())
                .orElseThrow(() -> new UnauthorizedException("Account no longer exists"));

        // Rotation: the used token is revoked and a fresh one issued.
        stored.setRevoked(true);
        refreshTokenRepository.save(stored);
        return buildAuthResponse(user);
    }

    /** Revokes the given refresh token (logout). Safe to call with an unknown token. */
    @Transactional
    public Map<String, String> logout(String refreshTokenValue) {
        if (refreshTokenValue != null && !refreshTokenValue.isBlank()) {
            refreshTokenRepository.findByToken(sha256(refreshTokenValue)).ifPresent(rt -> {   // N9
                rt.setRevoked(true);
                refreshTokenRepository.save(rt);
            });
        }
        return Map.of("message", "Logged out");
    }

    // ------------------------------------------------------------------ //
    //  FORGOT PASSWORD — send OTP via SMS
    // ------------------------------------------------------------------ //
    public Map<String, String> forgotPassword(ForgotPasswordRequest request) {
        User user = userRepository.findByPhone(request.getPhone())
                .orElseThrow(() -> new NotFoundException("No account found with that phone number"));

        // SECURITY (N3): cryptographically secure OTP; fresh attempt budget
        String otp = String.valueOf(100000 + SECURE_RANDOM.nextInt(900000)); // 6-digit OTP
        user.setResetOtp(otp);
        user.setOtpExpiresAt(LocalDateTime.now().plusMinutes(10));
        user.setOtpAttempts(0);
        userRepository.save(user);

        boolean smsSent = trySendSms(request.getPhone(), "Your FixerHub password reset OTP is: " + otp + ". Valid for 10 minutes.");

        if (!smsSent && user.getEmail() != null && !user.getEmail().isEmpty()) {
            log.info("SMS failed; falling back to email OTP for userId={}", user.getId());
            emailService.sendOtp(user.getEmail(), otp);
            return Map.of("message", "OTP sent to your email address");
        }

        log.info("OTP sent to phone: {}", request.getPhone());
        return Map.of("message", "OTP sent to your phone number");
    }

    // ------------------------------------------------------------------ //
    //  RESET PASSWORD — verify OTP and update password
    // ------------------------------------------------------------------ //
    @Transactional
    public Map<String, String> resetPassword(ResetPasswordRequest request) {
        User user = userRepository.findByPhone(request.getPhone())
                .orElseThrow(() -> new NotFoundException("No account found with that phone number"));

        if (user.getResetOtp() == null) {
            throw new BadRequestException("No active OTP. Please request a new one");
        }

        if (user.getOtpExpiresAt() == null || LocalDateTime.now().isAfter(user.getOtpExpiresAt())) {
            throw new BadRequestException("OTP has expired. Please request a new one");
        }

        // SECURITY (N3): a 6-digit OTP survives at most 5 wrong guesses —
        // after that it's invalidated and a new one must be requested.
        if (!user.getResetOtp().equals(request.getOtp())) {
            int attempts = (user.getOtpAttempts() == null ? 0 : user.getOtpAttempts()) + 1;
            if (attempts >= 5) {
                user.setResetOtp(null);
                user.setOtpExpiresAt(null);
                user.setOtpAttempts(null);
                userRepository.save(user);
                throw new BadRequestException("Too many incorrect attempts. Please request a new OTP");
            }
            user.setOtpAttempts(attempts);
            userRepository.save(user);
            throw new BadRequestException("Invalid OTP");
        }

        String newPassword = request.getNewPassword();
        if (newPassword == null || newPassword.length() < 8 || !newPassword.matches(".*\\d.*")) {
            throw new BadRequestException(
                    "Password must be at least 8 characters and contain at least one number");
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        user.setResetOtp(null);
        user.setOtpExpiresAt(null);
        user.setOtpAttempts(null);
        userRepository.save(user);

        // TOKENS (H6): a password reset invalidates every active session.
        refreshTokenRepository.revokeAllForUser(user.getId());

        log.info("Password reset successfully for phone: {}", request.getPhone());
        return Map.of("message", "Password reset successfully. You can now log in.");
    }

    // ------------------------------------------------------------------ //
    //  DELETE ACCOUNT
    // ------------------------------------------------------------------ //
    @Transactional
    public Map<String, String> deleteAccount(String email, String password) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new NotFoundException("Account not found"));
        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new UnauthorizedException("Incorrect password. Please try again.");
        }

        // M4: cascade — kill all sessions and remove the public worker profile.
        refreshTokenRepository.revokeAllForUser(user.getId());
        if (User.Role.WORKER.equals(user.getRole())) {
            try {
                restTemplate.delete("http://worker-service/workers/internal/by-user/" + user.getId());
            } catch (Exception e) {
                log.warn("Could not delete worker profile for userId={}: {}", user.getId(), e.getMessage());
            }
        }
        // Note: bookings/payments/chats are retained for financial records —
        // full DPA-grade anonymization is tracked separately (audit M4).

        userRepository.delete(user);
        log.info("Account deleted for email={}", email);
        return Map.of("message", "Your account has been permanently deleted.");
    }

    // ------------------------------------------------------------------ //
    //  INTERNAL
    // ------------------------------------------------------------------ //
    public void updateProfilePicture(String email, String url) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new NotFoundException("User not found"));
        user.setProfilePicture(url);
        userRepository.save(user);

        // If this user is a WORKER, sync the picture to worker-service so it
        // shows up on the public profile and the nearby workers list.
        if (User.Role.WORKER.equals(user.getRole()) && user.getId() != null) {
            try {
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                HttpEntity<Map<String, String>> entity = new HttpEntity<>(
                        Map.of("profilePicture", url != null ? url : ""), headers);
                restTemplate.exchange(
                        "http://worker-service/workers/by-user/" + user.getId() + "/profile-picture",
                        HttpMethod.PUT, entity, Object.class);
            } catch (Exception e) {
                log.warn("Could not sync profile picture to worker-service for userId={}: {}", user.getId(), e.getMessage());
            }
        }
    }

    public List<UserResponse> getAllUsers() {
        return userRepository.findAll().stream()
                .map(this::toUserResponse)
                .collect(Collectors.toList());
    }

    public UserResponse getUserById(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("User not found"));
        return toUserResponse(user);
    }

    private UserResponse toUserResponse(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .name(user.getName())
                .profilePicture(user.getProfilePicture())
                .role(user.getRole().name())
                .createdAt(user.getCreatedAt())
                .build();
    }

    // ------------------------------------------------------------------ //
    //  HELPERS
    // ------------------------------------------------------------------ //
    /** Returns true if SMS sent successfully; false if it threw. */
    private boolean trySendSms(String phoneNumber, String message) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            headers.set("apiKey", atApiKey);
            headers.set("Accept", "application/json");

            MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
            body.add("username", atUsername);
            body.add("to", phoneNumber);
            body.add("message", message);

            HttpEntity<MultiValueMap<String, String>> entity = new HttpEntity<>(body, headers);
            restTemplate.postForEntity(atSmsUrl, entity, String.class);
            log.info("OTP SMS sent to {}", phoneNumber);
            return true;
        } catch (Exception e) {
            log.error("Failed to send OTP SMS to {}: {}", phoneNumber, e.getMessage());
            return false;
        }
    }
}