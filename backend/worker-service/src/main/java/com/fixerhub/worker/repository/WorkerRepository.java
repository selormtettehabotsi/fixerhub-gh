package com.fixerhub.worker.repository;

import com.fixerhub.worker.model.VerificationStatus;
import com.fixerhub.worker.model.Worker;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.Optional;

public interface WorkerRepository extends JpaRepository<Worker, Long> {
    List<Worker> findBySkill(String skill);
    List<Worker> findByAvailable(Boolean available);
    List<Worker> findByLocation(String location);
    Optional<Worker> findByUserId(Long userId);
    Optional<Worker> findByEmail(String email);

    List<Worker> findByVerificationStatus(VerificationStatus status);

    @Query("SELECT w FROM Worker w WHERE w.available = true OR w.available IS NULL")
    List<Worker> findAllAvailableOrUnset();

    /** ADMIN STATS: workers whose PRO plan is currently active. */
    long countByPlanAndPlanExpiresAtAfter(String plan, java.time.LocalDateTime now);
}
