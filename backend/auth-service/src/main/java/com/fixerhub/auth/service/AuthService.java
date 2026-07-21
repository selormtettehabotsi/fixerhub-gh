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
    private final RestTemplate restTemplate;           // @LoadBalanced — internal service calls only
    private final RestTemplate externalRestTemplate;   // plain — external APIs (African's Talking)
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

        // REFERRALS: resolve the inviter's code (invalid codes are ignored, not fatal)
        Long referredBy = null;
        if (request.getReferralCode() != null && !request.getReferralCode().isBlank()) {
            referredBy = userRepository.findByReferralCode(request.getReferralCode().trim().toUpperCase())
                    .map(User::getId).orElse(null);
        }

        User user = User.builder()
                .email(request.getEmail())
                .password(passwordEncoder.encode(password))
                .role(request.getRole())
                .name(request.getName())
                .phone(request.getPhone())
                .referralCode(generateReferralCode())
                .referredBy(referredBy)
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
        // MODERATION: suspended accounts cannot sign in.
        if (Boolean.TRUE.equals(user.getSuspended())) {
            throw new UnauthorizedException("Your account has been suspended. Contact FixerHub support.");
        }
        return buildAuthResponse(user);
    }

    // ------------------------------------------------------------------ //
    //  EDIT PROFILE
    // ------------------------------------------------------------------ //

    /**
     * Update the logged-in user's name / email / phone.
     * Email is the JWT identity ("sub"), so when it changes we revoke every
     * refresh token and return a fresh token pair — the client swaps them in
     * and the session continues seamlessly. Worker contact info is synced to
     * worker-service (best effort).
     */
    @Transactional
    public AuthResponse updateProfile(String currentEmail, String name, String newEmail, String phone) {
        User user = userRepository.findByEmail(currentEmail)
                .orElseThrow(() -> new NotFoundException("User not found"));

        boolean emailChanged = newEmail != null && !newEmail.isBlank()
                && !newEmail.trim().equalsIgnoreCase(user.getEmail());

        if (emailChanged) {
            String normalized = newEmail.trim().toLowerCase();
            if (!normalized.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
                throw new BadRequestException("Please enter a valid email address");
            }
            if (userRepository.findByEmail(normalized).isPresent()) {
                throw new BadRequestException("That email is already in use");
            }
            user.setEmail(normalized);
            user.setEmailVerified(false); // new address must be re-verified
        }

        if (phone != null && !phone.isBlank() && !phone.trim().equals(user.getPhone())) {
            String trimmed = phone.trim();
            userRepository.findByPhone(trimmed)
                    .filter(other -> !other.getId().equals(user.getId()))
                    .ifPresent(other -> {
                        throw new BadRequestException("That phone number is already in use");
                    });
            user.setPhone(trimmed);
            user.setPhoneVerified(false); // new number must be re-verified
        }

        if (name != null && !name.isBlank()) {
            user.setName(name.trim());
        }

        userRepository.save(user);

        // Keep the worker profile's public contact info in sync.
        if (user.getRole() == User.Role.WORKER) {
            try {
                restTemplate.put(
                        "http://worker-service/workers/internal/by-user/" + user.getId() + "/contact",
                        Map.of(
                                "name", user.getName() == null ? "" : user.getName(),
                                "email", user.getEmail(),
                                "phone", user.getPhone() == null ? "" : user.getPhone()));
            } catch (Exception e) {
                log.warn("Could not sync worker profile contact info for userId={}: {}",
                        user.getId(), e.getMessage());
            }
        }

        if (emailChanged) {
            refreshTokenRepository.revokeAllForUser(user.getId());
            return buildAuthResponse(user); // fresh access + refresh tokens
        }

        return AuthResponse.builder()
                .role(user.getRole())
                .userId(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .profilePicture(user.getProfilePicture())
                .build();
    }

    // ------------------------------------------------------------------ //
    //  PUSH TOKENS
    // ------------------------------------------------------------------ //

    @Transactional
    public void updateFcmToken(String email, String token) {
        userRepository.findByEmail(email).ifPresent(user -> {
            user.setFcmToken(token);
            userRepository.save(user);
        });
    }

    public String getFcmToken(Long userId) {
        return userRepository.findById(userId).map(User::getFcmToken).orElse(null);
    }

    // ------------------------------------------------------------------ //
    //  REFERRALS
    // ------------------------------------------------------------------ //

    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

    /** Short, unambiguous, collision-checked share code like FH-4X7K9C. */
    private String generateReferralCode() {
        for (int attempt = 0; attempt < 10; attempt++) {
            StringBuilder sb = new StringBuilder("FH-");
            for (int i = 0; i < 6; i++) {
                sb.append(CODE_ALPHABET.charAt(SECURE_RANDOM.nextInt(CODE_ALPHABET.length())));
            }
            String code = sb.toString();
            if (userRepository.findByReferralCode(code).isEmpty()) return code;
        }
        throw new IllegalStateException("Could not generate a unique referral code");
    }

    /** Own referral card data: code (lazily created for pre-referral accounts) + credited count. */
    @Transactional
    public Map<String, Object> referralInfo(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new NotFoundException("User not found"));
        if (user.getReferralCode() == null) {
            user.setReferralCode(generateReferralCode());
            userRepository.save(user);
        }
        return Map.of(
                "code", user.getReferralCode(),
                "count", user.getReferralCount() == null ? 0 : user.getReferralCount());
    }

    /**
     * REFERRALS (internal, called by payment-service): the referred user just
     * completed their FIRST successful payment — credit the referrer once.
     * Tying the credit to a real payment is the anti-fraud mechanism.
     */
    @Transactional
    public void creditReferrerForFirstPayment(Long payerUserId) {
        userRepository.findById(payerUserId).ifPresent(payer -> {
            if (payer.getReferredBy() == null || Boolean.TRUE.equals(payer.getReferralCredited())) return;
            payer.setReferralCredited(true);
            userRepository.save(payer);
            userRepository.findById(payer.getReferredBy()).ifPresent(referrer -> {
                int count = referrer.getReferralCount() == null ? 0 : referrer.getReferralCount();
                referrer.setReferralCount(count + 1);
                userRepository.save(referrer);
                log.info("Referral credited: user {} (referred by {}) made first payment — referrer count now {}",
                        payerUserId, referrer.getId(), count + 1);
            });
        });
    }

    // ------------------------------------------------------------------ //
    //  EMAIL / PHONE VERIFICATION (badge-only)
    // ------------------------------------------------------------------ //

    /** Send a 6-digit OTP to the user's own email (EMAIL) or phone (PHONE). */
    @Transactional
    public Map<String, String> sendVerificationOtp(String email, String channel) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new NotFoundException("User not found"));

        boolean isEmail = "EMAIL".equalsIgnoreCase(channel);
        boolean isPhone = "PHONE".equalsIgnoreCase(channel);
        if (!isEmail && !isPhone) throw new BadRequestException("channel must be EMAIL or PHONE");
        if (isEmail && Boolean.TRUE.equals(user.getEmailVerified()))
            throw new BadRequestException("Email is already verified");
        if (isPhone && Boolean.TRUE.equals(user.getPhoneVerified()))
            throw new BadRequestException("Phone is already verified");
        if (isPhone && (user.getPhone() == null || user.getPhone().isBlank()))
            throw new BadRequestException("Add a phone number to your profile first");

        String otp = String.format("%06d", SECURE_RANDOM.nextInt(1_000_000));
        user.setVerifyOtp(otp);
        user.setVerifyOtpChannel(isEmail ? "EMAIL" : "PHONE");
        user.setVerifyOtpExpiresAt(LocalDateTime.now().plusMinutes(10));
        user.setVerifyOtpAttempts(0);
        userRepository.save(user);

        if (isEmail) {
            emailService.sendVerificationOtp(user.getEmail(), otp);
        } else {
            boolean sent = trySendSms(user.getPhone(),
                    "Your FixerHub verification code is: " + otp + ". Valid for 10 minutes.");
            if (!sent) throw new BadRequestException("Could not send SMS right now — please try again later");
        }
        return Map.of("message", "Verification code sent");
    }

    /** Confirm the OTP: marks the channel verified. Max 5 wrong guesses. */
    @Transactional
    public Map<String, Object> confirmVerification(String email, String channel, String otp) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new NotFoundException("User not found"));

        if (user.getVerifyOtp() == null || user.getVerifyOtpExpiresAt() == null
                || !String.valueOf(channel).equalsIgnoreCase(user.getVerifyOtpChannel())) {
            throw new BadRequestException("No pending verification — request a new code");
        }
        if (LocalDateTime.now().isAfter(user.getVerifyOtpExpiresAt())) {
            clearVerifyOtp(user);
            throw new BadRequestException("Code expired — request a new one");
        }
        int attempts = user.getVerifyOtpAttempts() == null ? 0 : user.getVerifyOtpAttempts();
        if (attempts >= 5) {
            clearVerifyOtp(user);
            throw new BadRequestException("Too many wrong attempts — request a new code");
        }
        if (otp == null || !otp.trim().equals(user.getVerifyOtp())) {
            user.setVerifyOtpAttempts(attempts + 1);
            userRepository.save(user);
            throw new BadRequestException("Incorrect code");
        }

        if ("EMAIL".equalsIgnoreCase(channel)) user.setEmailVerified(true);
        else user.setPhoneVerified(true);
        clearVerifyOtp(user);

        return Map.of(
                "emailVerified", Boolean.TRUE.equals(user.getEmailVerified()),
                "phoneVerified", Boolean.TRUE.equals(user.getPhoneVerified()));
    }

    public Map<String, Object> verificationStatus(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new NotFoundException("User not found"));
        return Map.of(
                "emailVerified", Boolean.TRUE.equals(user.getEmailVerified()),
                "phoneVerified", Boolean.TRUE.equals(user.getPhoneVerified()));
    }

    private void clearVerifyOtp(User user) {
        user.setVerifyOtp(null);
        user.setVerifyOtpChannel(null);
        user.setVerifyOtpExpiresAt(null);
        user.setVerifyOtpAttempts(null);
        userRepository.save(user);
    }

    /**
     * CHANGE PASSWORD (logged-in): requires the current password. All refresh
     * tokens are revoked (kills any other device's session) and a fresh token
     * pair is returned so THIS session continues seamlessly.
     */
    @Transactional
    public AuthResponse changePassword(String email, String currentPassword, String newPassword) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new NotFoundException("User not found"));
        if (currentPassword == null || !passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw new UnauthorizedException("Current password is incorrect");
        }
        if (newPassword == null || newPassword.length() < 6) {
            throw new BadRequestException("New password must be at least 6 characters");
        }
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        refreshTokenRepository.revokeAllForUser(user.getId());
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

        // MODERATION: suspended accounts cannot refresh their session.
        if (Boolean.TRUE.equals(user.getSuspended())) {
            throw new UnauthorizedException("Your account has been suspended. Contact FixerHub support.");
        }

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

    /** CHAT HEADER (internal): peer contact info for the chat screen. */
    public Map<String, String> userContact(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("User not found"));
        Map<String, String> out = new java.util.HashMap<>();
        out.put("name", user.getName());
        out.put("phone", user.getPhone());
        out.put("profilePicture", user.getProfilePicture());
        return out;
    }

    /** ADMIN STATS: referral programme totals for the dashboard. */
    public Map<String, Long> referralStats() {
        return Map.of(
                "referredSignups", userRepository.countByReferredByIsNotNull(),
                "creditedReferrals", userRepository.totalCreditedReferrals());
    }

    public List<UserResponse> getAllUsers() {
        return userRepository.findAll().stream()
                .map(this::toUserResponse)
                .collect(Collectors.toList());
    }

    /** M2: paged variant for the admin Users screen (page/size capped at 100). */
    public List<UserResponse> getUsersPaged(int page, int size) {
        int cappedSize = Math.min(Math.max(size, 1), 100);
        return userRepository.findAll(
                        org.springframework.data.domain.PageRequest.of(
                                Math.max(page, 0), cappedSize,
                                org.springframework.data.domain.Sort.by("createdAt").descending()))
                .map(this::toUserResponse)
                .getContent();
    }

    /**
     * MODERATION (admin): suspend/unsuspend an account. Suspending revokes all
     * refresh tokens, so live sessions die when the 15-min access token expires.
     */
    @Transactional
    public UserResponse setSuspended(Long userId, boolean suspended) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found: " + userId));
        if (user.getRole() == User.Role.ADMIN) {
            throw new BadRequestException("Admin accounts cannot be suspended");
        }
        user.setSuspended(suspended);
        userRepository.save(user);
        if (suspended) {
            refreshTokenRepository.revokeAllForUser(userId);
        }
        log.info("User {} {} by admin", userId, suspended ? "SUSPENDED" : "unsuspended");
        return toUserResponse(user);
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
                .suspended(Boolean.TRUE.equals(user.getSuspended()))
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
            // SMS FIX: must use the plain (non-load-balanced) RestTemplate — the
            // @LoadBalanced one treats the AT hostname as a Eureka service and fails.
            ResponseEntity<String> resp = externalRestTemplate.postForEntity(atSmsUrl, entity, String.class);
            String bodyStr = resp.getBody();
            log.info("OTP SMS to {} — AT status {} response: {}", phoneNumber, resp.getStatusCode(), bodyStr);

            // Treat it as sent unless African's Talking explicitly reports a failure
            // recipient status (400/401/403/404/40x). Matches the fire-and-log
            // behaviour of notification-service, which works. An over-strict
            // "must contain Success" check caused false negatives → email fallback.
            if (bodyStr != null && (bodyStr.contains("\"statusCode\":401")   // invalid credentials
                                 || bodyStr.contains("\"statusCode\":403")   // not allowed / blacklisted
                                 || bodyStr.contains("\"statusCode\":404")   // invalid number
                                 || bodyStr.contains("\"statusCode\":400"))) { // bad request
                log.warn("SMS to {} rejected by African's Talking: {}", phoneNumber, bodyStr);
                return false;
            }
            return true;
        } catch (Exception e) {
            log.error("Failed to send OTP SMS to {}: {}", phoneNumber, e.getMessage());
            return false;
        }
    }
}