package com.fixerhub.auth.dto;

import lombok.Data;

@Data
public class ResetPasswordRequest {
    private String phone;
    private String otp;
    private String newPassword;
}
