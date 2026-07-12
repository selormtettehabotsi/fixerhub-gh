package com.fixerhub.worker.repository;

import com.fixerhub.worker.model.WorkerPortfolio;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface WorkerPortfolioRepository extends JpaRepository<WorkerPortfolio, Long> {
    List<WorkerPortfolio> findByWorkerIdOrderByCreatedAtDesc(Long workerId);
}
