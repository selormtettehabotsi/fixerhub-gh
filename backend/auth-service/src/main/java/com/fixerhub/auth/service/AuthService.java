package com.fixerhub.auth.service;

import com.fixerhub.auth.config.JwtConfig;
import com.fixerhub.auth.dto.*;
import com.fixerhub.auth.model.User;
import com.fixerhub.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtConfig jwtConfig;
    private final RestTemplate restTemplate;

    @Value("${africastalking.username}")
    private String atUsername;

    @Value("${africastalking.api-key}")
    private String atApiKey;

    @Value("${africastalking.sms-url}")
    private String atSmsUrl;

    // ------------------------------------------------------------------ //
    //  REGISTER
    // ------------------------------------------------------------------ //
    public AuthResponse register(RegisterRequest request) {
        String password = request.getPassword();

        if (password == null || password.length() < 8 || !password.matches(".*\\d.*")) {
            throw new RuntimeException(
                    "Password must be at least 8 characters and contain at least one number");
        }

        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new RuntimeException("Email already in use");
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

        String token = jwtConfig.generateToken(user.getEmail(), user.getRole().name());
        return AuthResponse.builder()
                .token(token)
                .role(user.getRole())
                .userId(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .profilePicture(user.getProfilePicture())
                .build();
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

    // ------------------------------------------------------------------ //
    //  LOGIN
    // ------------------------------------------------------------------ //
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("Invalid credentials"));
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("Invalid credentials");
        }
        String token = jwtConfig.generateToken(user.getEmail(), user.getRole().name());
        return AuthResponse.builder()
                .token(token)
                .role(user.getRole())
                .userId(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .profilePicture(user.getProfilePicture())
                .build();
    }

    // ------------------------------------------------------------------ //
    //  FORGOT PASSWORD — send OTP via SMS
    // ------------------------------------------------------------------ //
    public Map<String, String> forgotPassword(ForgotPasswordRequest request) {
        User user = userRepository.findByPhone(request.getPhone())
                .orElseThrow(() -> new RuntimeException("No account found with that phone number"));

        String otp = String.valueOf(100000 + new Random().nextInt(900000)); // 6-digit OTP
        user.setResetOtp(otp);
        user.setOtpExpiresAt(LocalDateTime.now().plusMinutes(10));
        userRepository.save(user);

        sendSms(request.getPhone(), "Your FixerHub password reset OTP is: " + otp + ". Valid for 10 minutes.");
        log.info("OTP sent to phone: {}", request.getPhone());

        return Map.of("message", "OTP sent to your phone number");
    }

    // ------------------------------------------------------------------ //
    //  RESET PASSWORD — verify OTP and update password
    // ------------------------------------------------------------------ //
    public Map<String, String> resetPassword(ResetPasswordRequest request) {
        User user = userRepository.findByPhone(request.getPhone())
                .orElseThrow(() -> new RuntimeException("No account found with that phone number"));

        if (user.getResetOtp() == null || !user.getResetOtp().equals(request.getOtp())) {
            throw new RuntimeException("Invalid OTP");
        }

        if (user.getOtpExpiresAt() == null || LocalDateTime.now().isAfter(user.getOtpExpiresAt())) {
            throw new RuntimeException("OTP has expired. Please request a new one");
        }

        String newPassword = request.getNewPassword();
        if (newPassword == null || newPassword.length() < 8 || !newPassword.matches(".*\\d.*")) {
            throw new RuntimeException(
                    "Password must be at least 8 characters and contain at least one number");
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        user.setResetOtp(null);
        user.setOtpExpiresAt(null);
        userRepository.save(user);

        log.info("Password reset successfully for phone: {}", request.getPhone());
        return Map.of("message", "Password reset successfully. You can now log in.");
    }

    // ------------------------------------------------------------------ //
    //  INTERNAL
    // ------------------------------------------------------------------ //
    public void updateProfilePicture(String email, String url) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setProfilePicture(url);
        userRepository.save(user);
    }

    public List<UserResponse> getAllUsers() {
        return userRepository.findAll().stream()
                .map(user -> UserResponse.builder()
                        .id(user.getId())
                        .email(user.getEmail())
                        .role(user.getRole().name())
                        .createdAt(user.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
    }

    // ------------------------------------------------------------------ //
    //  HELPERS
    // ------------------------------------------------------------------ //
    private void sendSms(String phoneNumber, String message) {
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
        } catch (Exception e) {
            log.error("Failed to send OTP SMS to {}: {}", phoneNumber, e.getMessage());
        }
    }
}
