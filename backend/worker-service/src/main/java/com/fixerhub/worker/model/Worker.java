package com.fixerhub.worker.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "workers")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Worker {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;
    private String name;
    private String phone;
    private String skill;
    private String location;
    private Double rating;
    private Boolean available;
}
