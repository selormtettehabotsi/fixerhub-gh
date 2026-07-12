package com.fixerhub.worker.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "worker_portfolio")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkerPortfolio {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long workerId;
    private String imageUrl;
    private String caption;
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() { createdAt = LocalDateTime.now(); }
}
