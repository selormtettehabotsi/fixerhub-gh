package com.fixerhub.auth.dto;

import com.fixerhub.auth.model.User;
import lombok.Data;

@Data
public class RegisterRequest {
    private String email;
    private String password;
    private User.Role role;
}
