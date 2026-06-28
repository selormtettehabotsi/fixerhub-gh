package com.fixerhub.auth.dto;

import com.fixerhub.auth.model.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponse {
    private String token;
    private User.Role role;
    private Long userId;
    private String name;
    private String email;
    private String phone;
    private String profilePicture;
}
