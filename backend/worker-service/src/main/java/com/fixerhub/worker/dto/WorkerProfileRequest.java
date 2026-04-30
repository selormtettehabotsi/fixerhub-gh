package com.fixerhub.worker.dto;

import lombok.Data;

@Data
public class WorkerProfileRequest {
    private Long userId;
    private String name;
    private String phone;
    private String skill;
    private String location;
}
