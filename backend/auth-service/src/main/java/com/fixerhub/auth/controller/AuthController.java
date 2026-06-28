package com.fixerhub.auth.controller;

import com.fixerhub.auth.dto.*;
import com.fixerhub.auth.service.AuthService;
import com.fixerhub.auth.service.CloudinaryService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
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

    /** Upload any image to S3 — returns { url } */
    @PostMapping("/upload")
    public ResponseEntity<Map<String, String>> uploadImage(@RequestParam("file") MultipartFile file,
                                                           @RequestParam(value = "folder", defaultValue = "general") String folder) {
        String url = cloudinaryService.uploadFile(file, folder);
        return ResponseEntity.ok(Map.of("url", url));
    }

    /** Save profile picture URL for the logged-in user — email comes from gateway header only */
    @PutMapping("/profile/picture")
    public ResponseEntity<Map<String, String>> updateProfilePicture(@RequestBody Map<String, String> body,
                                                                     HttpServletRequest request) {
        // Always use the gateway-forwarded header — never trust email from request body
        String email = request.getHeader("X-User-Email");
        if (email == null || email.isBlank()) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        String url = body.get("url");
        authService.updateProfilePicture(email, url);
        return ResponseEntity.ok(Map.of("profilePicture", url));
    }
}
