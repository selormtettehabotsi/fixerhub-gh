package com.fixerhub.auth.controller;

import com.fixerhub.auth.dto.*;
import com.fixerhub.auth.service.AuthService;
import com.fixerhub.auth.service.CloudinaryService;
import com.fixerhub.auth.service.ReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final CloudinaryService cloudinaryService;
    private final ReportService reportService;
    private final com.fixerhub.auth.service.NotificationInboxService notificationInboxService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    /** TOKENS (H6): exchange a refresh token for a new access JWT (rotates the refresh token). */
    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(@RequestBody Map<String, String> body) {
        return ResponseEntity.ok(authService.refresh(body.get("refreshToken")));
    }

    /** TOKENS (H6): revoke a refresh token on logout. */
    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(@RequestBody(required = false) Map<String, String> body) {
        return ResponseEntity.ok(authService.logout(body != null ? body.get("refreshToken") : null));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, String>> forgotPassword(@RequestBody ForgotPasswordRequest request) {
        return ResponseEntity.ok(authService.forgotPassword(request));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, String>> resetPassword(@RequestBody ResetPasswordRequest request) {
        return ResponseEntity.ok(authService.resetPassword(request));
    }

    @GetMapping("/users")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<UserResponse>> getAllUsers(
            @RequestParam(required = false) Integer page,
            @RequestParam(defaultValue = "50") int size) {
        // M2: paged when ?page= is provided; full list otherwise (dashboard counts)
        return ResponseEntity.ok(page == null
                ? authService.getAllUsers()
                : authService.getUsersPaged(page, size));
    }

    /** MODERATION (ADMIN): suspend or unsuspend an account. */
    @PutMapping("/users/{id}/suspend")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserResponse> setSuspended(
            @PathVariable Long id, @RequestBody Map<String, Boolean> body) {
        boolean suspended = Boolean.TRUE.equals(body.get("suspended"));
        return ResponseEntity.ok(authService.setSuspended(id, suspended));
    }

    /** Internal endpoint for service-to-service calls (no auth required).
     *  M2: paged when ?page= is provided (admin Users screen); full list otherwise. */
    @GetMapping("/internal/users")
    public ResponseEntity<List<UserResponse>> getAllUsersInternal(
            @RequestParam(required = false) Integer page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(page == null
                ? authService.getAllUsers()
                : authService.getUsersPaged(page, size));
    }

    /** M6 (internal): payment-service checks for unresolved payment disputes before paying out. */
    @GetMapping("/internal/reports/payment-hold/{bookingId}")
    public ResponseEntity<Map<String, Boolean>> paymentHold(@PathVariable Long bookingId) {
        return ResponseEntity.ok(Map.of("held", reportService.hasOpenPaymentProblem(bookingId)));
    }

    /** Public endpoint — returns name + profilePicture for any user by ID.
     *  Used by worker/customer views to show each other's profile pictures. */
    @GetMapping("/users/{id}/public")
    public ResponseEntity<UserResponse> getUserPublic(@PathVariable Long id) {
        return ResponseEntity.ok(authService.getUserById(id));
    }

    // ------------------------------------------------------------------ //
    //  REPORTS
    // ------------------------------------------------------------------ //
    @PostMapping("/reports")
    public ResponseEntity<ReportResponse> submitReport(@RequestBody ReportRequest request) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return ResponseEntity.ok(reportService.submitReport(email, request));
    }

    @GetMapping("/reports")
    public ResponseEntity<List<ReportResponse>> getAllReports() {
        return ResponseEntity.ok(reportService.getAllReports());
    }

    /** DISPUTE RESOLUTION (ADMIN): move a report OPEN → REVIEWING → RESOLVED/DISMISSED.
     *  Closing a PAYMENT_PROBLEM report lifts the payout hold on its booking. */
    @PutMapping("/reports/{id}/status")
    public ResponseEntity<ReportResponse> updateReportStatus(
            @PathVariable Long id, @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(reportService.updateStatus(id, body.get("status"), body.get("note")));
    }

    /** Permanently delete the currently logged-in account. Requires password confirmation. */
    @DeleteMapping("/account")
    public ResponseEntity<Map<String, String>> deleteAccount(@RequestBody Map<String, String> body) {
        org.springframework.security.core.Authentication auth =
                org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        String email = (auth != null && auth.isAuthenticated()) ? auth.getName() : null;
        if (email == null || email.isBlank() || "anonymousUser".equals(email)) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        String password = body.get("password");
        if (password == null || password.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Password is required"));
        }
        return ResponseEntity.ok(authService.deleteAccount(email, password));
    }

    /** EDIT PROFILE: update the logged-in user's name / email / phone.
     *  Returns fresh tokens in the payload when the email (JWT identity) changed. */
    @PutMapping("/profile")
    public ResponseEntity<AuthResponse> updateProfile(@RequestBody Map<String, String> body) {
        org.springframework.security.core.Authentication auth =
                org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        String email = (auth != null && auth.isAuthenticated()) ? auth.getName() : null;
        if (email == null || email.isBlank() || "anonymousUser".equals(email)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(
                authService.updateProfile(email, body.get("name"), body.get("email"), body.get("phone")));
    }

    // ------------------------------------------------------------------ //
    //  PUSH TOKENS
    // ------------------------------------------------------------------ //

    /** PUSH: the app registers its FCM device token here on login. */
    @PutMapping("/fcm-token")
    public ResponseEntity<Map<String, String>> updateFcmToken(@RequestBody Map<String, String> body) {
        String email = principalEmail();
        if (email == null) return ResponseEntity.status(401).build();
        authService.updateFcmToken(email, body.get("token"));
        return ResponseEntity.ok(Map.of("status", "saved"));
    }

    /** Internal (blocked at gateway): booking-service resolves chat-peer contact
     *  info (name, phone, picture) for the chat header + call button. */
    @GetMapping("/internal/users/{id}/contact")
    public ResponseEntity<Map<String, String>> getUserContactInternal(@PathVariable Long id) {
        return ResponseEntity.ok(authService.userContact(id));
    }

    /** Internal (blocked at gateway): notification-service resolves a user's push token. */
    @GetMapping("/internal/users/{id}/fcm-token")
    public ResponseEntity<Map<String, String>> getFcmTokenInternal(@PathVariable Long id) {
        String token = authService.getFcmToken(id);
        return ResponseEntity.ok(Map.of("token", token == null ? "" : token));
    }

    // ------------------------------------------------------------------ //
    //  REFERRALS
    // ------------------------------------------------------------------ //

    /** Own referral code + how many invitees completed their first paid booking. */
    @GetMapping("/referrals/me")
    public ResponseEntity<Map<String, Object>> myReferral() {
        String email = principalEmail();
        if (email == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(authService.referralInfo(email));
    }

    // ------------------------------------------------------------------ //
    //  NOTIFICATION CENTER (bell + history)
    // ------------------------------------------------------------------ //

    /** Internal (blocked at gateway): notification-service records a fan-out here. */
    @PostMapping("/internal/notifications")
    public ResponseEntity<Void> recordNotification(@RequestBody Map<String, Object> body) {
        Long userId = body.get("userId") != null ? Long.valueOf(String.valueOf(body.get("userId"))) : null;
        Long bookingId = body.get("bookingId") != null ? Long.valueOf(String.valueOf(body.get("bookingId"))) : null;
        notificationInboxService.record(userId,
                (String) body.get("title"), (String) body.get("body"),
                (String) body.get("type"), bookingId);
        return ResponseEntity.ok().build();
    }

    /** In-app notification history for the logged-in user (newest first). */
    @GetMapping("/notifications")
    public ResponseEntity<List<com.fixerhub.auth.model.Notification>> myNotifications(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size) {
        return ResponseEntity.ok(notificationInboxService.list(principalEmail(), page, size));
    }

    /** Unread badge count for the bell icon. */
    @GetMapping("/notifications/unread-count")
    public ResponseEntity<Map<String, Long>> notificationUnreadCount() {
        return ResponseEntity.ok(notificationInboxService.unreadCount(principalEmail()));
    }

    @PutMapping("/notifications/{id}/read")
    public ResponseEntity<Void> markNotificationRead(@PathVariable Long id) {
        notificationInboxService.markRead(principalEmail(), id);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/notifications/read-all")
    public ResponseEntity<Void> markAllNotificationsRead() {
        notificationInboxService.markAllRead(principalEmail());
        return ResponseEntity.ok().build();
    }

    /** ADMIN STATS (internal): referral programme totals for the dashboard. */
    @GetMapping("/internal/referrals/stats")
    public ResponseEntity<Map<String, Long>> referralStats() {
        return ResponseEntity.ok(authService.referralStats());
    }

    /** Internal (blocked at gateway): payment-service reports a user's first successful payment. */
    @PostMapping("/internal/referrals/first-payment/{userId}")
    public ResponseEntity<Void> referralFirstPayment(@PathVariable Long userId) {
        authService.creditReferrerForFirstPayment(userId);
        return ResponseEntity.ok().build();
    }

    // ------------------------------------------------------------------ //
    //  EMAIL / PHONE VERIFICATION
    // ------------------------------------------------------------------ //

    private String principalEmail() {
        org.springframework.security.core.Authentication auth =
                org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        String email = (auth != null && auth.isAuthenticated()) ? auth.getName() : null;
        return (email == null || email.isBlank() || "anonymousUser".equals(email)) ? null : email;
    }

    /** Send an OTP to the logged-in user's email or phone. Body: { channel: "EMAIL" | "PHONE" } */
    @PostMapping("/verify/send")
    public ResponseEntity<Map<String, String>> sendVerificationOtp(@RequestBody Map<String, String> body) {
        String email = principalEmail();
        if (email == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(authService.sendVerificationOtp(email, body.get("channel")));
    }

    /** Confirm the OTP. Body: { channel, otp } → { emailVerified, phoneVerified } */
    @PostMapping("/verify/confirm")
    public ResponseEntity<Map<String, Object>> confirmVerification(@RequestBody Map<String, String> body) {
        String email = principalEmail();
        if (email == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(authService.confirmVerification(email, body.get("channel"), body.get("otp")));
    }

    /** Current verification badges for the logged-in user. */
    @GetMapping("/verify/status")
    public ResponseEntity<Map<String, Object>> verificationStatus() {
        String email = principalEmail();
        if (email == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(authService.verificationStatus(email));
    }

    /** CHANGE PASSWORD (logged-in): { currentPassword, newPassword }.
     *  Revokes all refresh tokens and returns a fresh token pair. */
    @PutMapping("/password")
    public ResponseEntity<AuthResponse> changePassword(@RequestBody Map<String, String> body) {
        org.springframework.security.core.Authentication auth =
                org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        String email = (auth != null && auth.isAuthenticated()) ? auth.getName() : null;
        if (email == null || email.isBlank() || "anonymousUser".equals(email)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(
                authService.changePassword(email, body.get("currentPassword"), body.get("newPassword")));
    }

    /** Upload any image to S3 — returns { url } */
    @PostMapping("/upload")
    public ResponseEntity<Map<String, String>> uploadImage(@RequestParam("file") MultipartFile file,
                                                           @RequestParam(value = "folder", defaultValue = "general") String folder) {
        String url = cloudinaryService.uploadFile(file, folder);
        return ResponseEntity.ok(Map.of("url", url));
    }

    /** Save profile picture URL for the logged-in user.
     *  Auth-service validates the JWT itself via JwtAuthFilter, so we read
     *  the principal from SecurityContextHolder (not from gateway headers). */
    @PutMapping("/profile/picture")
    public ResponseEntity<Map<String, String>> updateProfilePicture(@RequestBody Map<String, String> body) {
        org.springframework.security.core.Authentication auth =
                org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        String email = (auth != null && auth.isAuthenticated()) ? auth.getName() : null;
        if (email == null || email.isBlank() || "anonymousUser".equals(email)) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        String url = body.getOrDefault("url", "");
        authService.updateProfilePicture(email, url);
        return ResponseEntity.ok(Map.of("profilePicture", url));
    }
}
