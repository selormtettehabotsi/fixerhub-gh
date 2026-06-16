package com.fixerhub.auth.service;

import com.fixerhub.auth.config.JwtConfig;
import com.fixerhub.auth.dto.AuthResponse;
import com.fixerhub.auth.dto.LoginRequest;
import com.fixerhub.auth.dto.RegisterRequest;
import com.fixerhub.auth.model.User;
import com.fixerhub.auth.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtConfig jwtConfig;

    @InjectMocks
    private AuthService authService;

    // ─── register() tests ────────────────────────────────────────────

    @Test
    void register_success() {
        RegisterRequest request = new RegisterRequest();
        request.setEmail("kelvin@test.com");
        request.setPassword("secure123");
        request.setRole(User.Role.CUSTOMER);

        when(userRepository.findByEmail("kelvin@test.com")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("encodedPassword");
        when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));
        when(jwtConfig.generateToken(anyString())).thenReturn("mock-jwt-token");

        AuthResponse response = authService.register(request);

        assertNotNull(response);
        assertNotNull(response.getToken());
        assertEquals("mock-jwt-token", response.getToken());
    }

    @Test
    void register_fail_duplicateEmail() {
        RegisterRequest request = new RegisterRequest();
        request.setEmail("kelvin@test.com");
        request.setPassword("secure123");
        request.setRole(User.Role.CUSTOMER);

        when(userRepository.findByEmail("kelvin@test.com"))
                .thenReturn(Optional.of(new User()));

        RuntimeException ex = assertThrows(RuntimeException.class,
                () -> authService.register(request));

        assertEquals("Email already in use", ex.getMessage());
    }

    @Test
    void register_fail_passwordTooShort() {
        RegisterRequest request = new RegisterRequest();
        request.setEmail("kelvin@test.com");
        request.setPassword("12345");
        request.setRole(User.Role.CUSTOMER);

        RuntimeException ex = assertThrows(RuntimeException.class,
                () -> authService.register(request));

        assertEquals("Password must be at least 8 characters and contain at least one number",
                ex.getMessage());
    }

    @Test
    void register_fail_passwordNoDigit() {
        RegisterRequest request = new RegisterRequest();
        request.setEmail("kelvin@test.com");
        request.setPassword("abcdefgh");
        request.setRole(User.Role.CUSTOMER);

        RuntimeException ex = assertThrows(RuntimeException.class,
                () -> authService.register(request));

        assertEquals("Password must be at least 8 characters and contain at least one number",
                ex.getMessage());
    }

    // ─── login() tests ────────────────────────────────────────────────

    @Test
    void login_success() {
        LoginRequest request = new LoginRequest();
        request.setEmail("kelvin@test.com");
        request.setPassword("secure123");

        User user = User.builder()
                .email("kelvin@test.com")
                .password("encodedPassword")
                .role(User.Role.CUSTOMER)
                .build();

        when(userRepository.findByEmail("kelvin@test.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("secure123", "encodedPassword")).thenReturn(true);
        when(jwtConfig.generateToken(anyString())).thenReturn("mock-jwt-token");

        AuthResponse response = authService.login(request);

        assertNotNull(response);
        assertEquals("mock-jwt-token", response.getToken());
    }

    @Test
    void login_fail_emailNotFound() {
        LoginRequest request = new LoginRequest();
        request.setEmail("ghost@test.com");
        request.setPassword("secure123");

        when(userRepository.findByEmail("ghost@test.com")).thenReturn(Optional.empty());

        RuntimeException ex = assertThrows(RuntimeException.class,
                () -> authService.login(request));

        assertEquals("Invalid credentials", ex.getMessage());
    }

    @Test
    void login_fail_wrongPassword() {
        LoginRequest request = new LoginRequest();
        request.setEmail("kelvin@test.com");
        request.setPassword("wrongpassword");

        User user = User.builder()
                .email("kelvin@test.com")
                .password("encodedPassword")
                .role(User.Role.CUSTOMER)
                .build();

        when(userRepository.findByEmail("kelvin@test.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrongpassword", "encodedPassword")).thenReturn(false);

        RuntimeException ex = assertThrows(RuntimeException.class,
                () -> authService.login(request));

        assertEquals("Invalid credentials", ex.getMessage());
    }
}