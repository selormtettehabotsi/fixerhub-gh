package com.fixerhub.review.service;

import com.fixerhub.review.config.AuthContext;
import com.fixerhub.review.dto.ReviewRequest;
import com.fixerhub.review.dto.ReviewResponse;
import com.fixerhub.review.model.Review;
import com.fixerhub.review.repository.ReviewRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.util.OptionalDouble;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final RestTemplate restTemplate;

    public ReviewResponse createReview(ReviewRequest request) {
        if (request.getRating() < 1 || request.getRating() > 5) {
            throw new RuntimeException("Rating must be between 1 and 5");
        }
        if (reviewRepository.existsByBookingId(request.getBookingId())) {
            throw new RuntimeException("Review already exists for this booking");
        }

        // SECURITY (N8): a review must come from the booking's own customer,
        // for the booking's own worker, and only after the job is COMPLETED.
        // Otherwise anyone could invent bookingIds and poison worker ratings.
        Map<String, Object> booking = fetchBooking(request.getBookingId());
        if (booking == null) {
            throw new RuntimeException("Booking not found");
        }
        Long callerId = AuthContext.userId();
        Long bookingCustomerId = asLong(booking.get("customerId"));
        Long bookingWorkerId = asLong(booking.get("workerId"));
        if (!AuthContext.isAdmin() && (callerId == null || !callerId.equals(bookingCustomerId))) {
            throw new RuntimeException("You can only review your own bookings");
        }
        if (!"COMPLETED".equals(String.valueOf(booking.get("status")))) {
            throw new RuntimeException("You can only review a completed job");
        }

        Review review = Review.builder()
                .bookingId(request.getBookingId())
                // N8: identity fields come from the verified booking, not the client
                .customerId(bookingCustomerId)
                .workerId(bookingWorkerId)
                .rating(request.getRating())
                .comment(request.getComment())
                .customerName(request.getCustomerName())
                .customerProfilePicture(request.getCustomerProfilePicture())
                .build();
        Review saved = reviewRepository.save(review);
        double avgRating = getAverageRating(saved.getWorkerId());
        restTemplate.put(
                "http://worker-service/workers/" + saved.getWorkerId() + "/rating?rating=" + avgRating,
                null);
        return toResponse(saved);
    }

    /** M2: bounded page (newest first, max 100 per call). */
    public List<ReviewResponse> getWorkerReviews(Long workerId, int page, int size) {
        var pageable = org.springframework.data.domain.PageRequest.of(
                Math.max(0, page), Math.min(Math.max(1, size), 100));
        return reviewRepository.findByWorkerIdOrderByIdDesc(workerId, pageable).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public double getAverageRating(Long workerId) {
        // M2: AVG in SQL instead of loading every review row
        return reviewRepository.averageRatingByWorkerId(workerId);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> fetchBooking(Long bookingId) {
        try {
            return restTemplate.getForObject(
                    "http://booking-service/bookings/internal/" + bookingId, Map.class);
        } catch (Exception e) {
            log.warn("Could not fetch booking {} for review validation: {}", bookingId, e.getMessage());
            return null;
        }
    }

    private static Long asLong(Object v) {
        return v == null ? null : Long.valueOf(String.valueOf(v));
    }

    private ReviewResponse toResponse(Review r) {
        return ReviewResponse.builder()
                .id(r.getId())
                .bookingId(r.getBookingId())
                .customerId(r.getCustomerId())
                .workerId(r.getWorkerId())
                .rating(r.getRating())
                .comment(r.getComment())
                .customerName(r.getCustomerName())
                .customerProfilePicture(r.getCustomerProfilePicture())
                .createdAt(r.getCreatedAt())
                .build();
    }
}
