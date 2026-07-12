package com.fixerhub.review.repository;

import com.fixerhub.review.model.Review;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface ReviewRepository extends JpaRepository<Review, Long> {
    List<Review> findByWorkerId(Long workerId);
    List<Review> findByCustomerId(Long customerId);
    boolean existsByBookingId(Long bookingId);

    // M2: bounded, newest-first list for the public worker page
    List<Review> findByWorkerIdOrderByIdDesc(Long workerId, Pageable pageable);

    // M2: average in SQL instead of loading every review row
    @Query("SELECT COALESCE(AVG(r.rating), 0) FROM Review r WHERE r.workerId = :workerId")
    double averageRatingByWorkerId(@Param("workerId") Long workerId);
}
