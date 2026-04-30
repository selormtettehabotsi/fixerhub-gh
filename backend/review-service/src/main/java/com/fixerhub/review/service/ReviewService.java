package com.fixerhub.review.service;

import com.fixerhub.review.dto.ReviewRequest;
import com.fixerhub.review.dto.ReviewResponse;
import com.fixerhub.review.model.Review;
import com.fixerhub.review.repository.ReviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.OptionalDouble;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReviewService {

    private final ReviewRepository reviewRepository;

    public ReviewResponse createReview(ReviewRequest request) {
        Review review = Review.builder()
                .bookingId(request.getBookingId())
                .customerId(request.getCustomerId())
                .workerId(request.getWorkerId())
                .rating(request.getRating())
                .comment(request.getComment())
                .build();
        return toResponse(reviewRepository.save(review));
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
