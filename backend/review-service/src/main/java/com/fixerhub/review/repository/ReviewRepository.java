package com.fixerhub.review.repository;

import com.fixerhub.review.model.Review;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ReviewRepository extends JpaRepository<Review, Long> {
    List<Review> findByWorkerId(Long workerId);
    List<Review> findByCustomerId(Long customerId);
}
