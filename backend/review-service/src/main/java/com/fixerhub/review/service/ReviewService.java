package com.fixerhub.review.service;

import com.fixerhub.review.dto.ReviewRequest;
import com.fixerhub.review.dto.ReviewResponse;
import com.fixerhub.review.model.Review;
import com.fixerhub.review.repository.ReviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.OptionalDouble;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final RestTemplate restTemplate;

    public ReviewResponse createReview(ReviewRequest request) {
        if (request.getRating() < 1 || request.getRating() > 5) {
            throw new IllegalArgumentException("Rating must be between 1 and 5");
        }
        if (reviewRepository.existsByBookingId(request.getBookingId())) {
            throw new IllegalStateException("Review already exists for this booking");
        }
        Review review = Review.builder()
                .bookingId(request.getBookingId())
                .customerId(request.getCustomerId())
                .workerId(request.getWorkerId())
                .rating(request.getRating())
                .comment(request.getComment())
                .build();
        Review saved = reviewRepository.save(review);
        double avgRating = getAverageRating(saved.getWorkerId());
        restTemplate.put("http://worker-service/workers/" + saved.getWorkerId() + "/rating?rating=" + avgRating, null);
        return toResponse(saved);
    }

    public List<ReviewResponse> getWorkerReviews(Long workerId) {
        return reviewRepository.findByWorkerId(workerId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public double getAverageRating(Long workerId) {
        List<Review> reviews = reviewRepository.findByWorkerId(workerId);
        OptionalDouble avg = reviews.stream().mapToInt(Review::getRating).average();
        return avg.orElse(0.0);
    }

    private ReviewResponse toResponse(Review r) {
        return ReviewResponse.builder()
                .id(r.getId())
                .bookingId(r.getBookingId())
                .customerId(r.getCustomerId())
                .workerId(r.getWorkerId())
                .rating(r.getRating())
                .comment(r.getComment())
                .createdAt(r.getCreatedAt())
                .build();
    }
}