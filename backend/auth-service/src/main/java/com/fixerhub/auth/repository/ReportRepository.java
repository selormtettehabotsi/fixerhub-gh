package com.fixerhub.auth.repository;

import com.fixerhub.auth.model.Report;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ReportRepository extends JpaRepository<Report, Long> {
    List<Report> findAllByOrderByCreatedAtDesc();

    /** M6: is there an unresolved payment dispute for this booking? */
    boolean existsByBookingIdAndCategoryAndStatusNot(Long bookingId, String category, String status);
}
