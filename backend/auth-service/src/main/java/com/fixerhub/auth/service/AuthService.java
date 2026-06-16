package com.fixerhub.auth.service;

import com.fixerhub.auth.config.JwtConfig;
import com.fixerhub.auth.dto.AuthResponse;
import com.fixerhub.auth.dto.LoginRequest;
import com.fixerhub.auth.dto.RegisterRequest;
import com.fixerhub.auth.dto.UserResponse;
import com.fixerhub.auth.model.User;
import com.fixerhub.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtConfig jwtConfig;

    public AuthResponse register(RegisterRequest request) {
        String password = request.getPassword();

        if (password == null || password.length() < 8 || !password.matches(".*\\d.*")) {
            throw new RuntimeException(
                    "Password must be at least 8 characters and contain at least one number"
            );
        }

        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new RuntimeException("Email already in use");
        }

        User user = User.builder()
                .email(request.getEmail())
                .password(passwordEncoder.encode(password))
                .role(request.getRole())
                .build();

        userRepository.save(user);

        String token = jwtConfig.generateToken(user.getEmail());
        return AuthResponse.builder().token(token).role(user.getRole()).build();
    }

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("Invalid credentials"));
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("Invalid credentials");
        }
        String token = jwtConfig.generateToken(user.getEmail());
        return AuthResponse.builder().token(token).role(user.getRole()).build();
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
}