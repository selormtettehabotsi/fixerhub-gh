package com.fixerhub.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserResponse {
    private Long id;
    private String email;
    private String name;
    private String profilePicture;
    private String role;
    /** MODERATION: true when the account is suspended by an admin. */
    private Boolean suspended;
    private LocalDateTime createdAt;
}