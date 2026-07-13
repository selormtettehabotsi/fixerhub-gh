package com.fixerhub.auth.dto;

import com.fixerhub.auth.model.User;
import lombok.Data;

@Data
public class RegisterRequest {
    private String email;
    private String password;
    private User.Role role;
    private String name;
    private String phone;
    private String skill;
    private String location;
    /** REFERRALS: optional code of the user who invited this person. */
    private String referralCode;
}
