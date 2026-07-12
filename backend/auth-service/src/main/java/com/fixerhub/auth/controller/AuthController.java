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
    public ResponseEntity<List<UserResponse>> getAllUsers() {
        return ResponseEntity.ok(authService.getAllUsers());
    }

    /** Internal endpoint for service-to-service calls (no auth required). */
    @GetMapping("/internal/users")
    public ResponseEntity<List<UserResponse>> getAllUsersInternal() {
        return ResponseEntity.ok(authService.getAllUsers());
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
