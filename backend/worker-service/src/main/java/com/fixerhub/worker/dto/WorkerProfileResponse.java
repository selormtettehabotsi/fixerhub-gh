package com.fixerhub.worker.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkerProfileResponse {
    private Long id;
    private Long userId;
    private String name;
    private String phone;
    private String skill;
    private String location;
    private Double rating;
    private Boolean available;
}
