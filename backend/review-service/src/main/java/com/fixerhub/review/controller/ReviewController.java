package com.fixerhub.review.controller;

import com.fixerhub.review.dto.ReviewRequest;
import com.fixerhub.review.dto.ReviewResponse;
import com.fixerhub.review.service.ReviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/reviews")
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;

    @PostMapping
    public ResponseEntity<ReviewResponse> createReview(@RequestBody ReviewRequest request) {
        return ResponseEntity.ok(reviewService.createReview(request));
    }

    /** M2: bounded list — newest 50 by default, ?page=&size= (max 100) for more. */
    @GetMapping("/worker/{workerId}")
    public ResponseEntity<List<ReviewResponse>> getWorkerReviews(
            @PathVariable Long workerId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(reviewService.getWorkerReviews(workerId, page, size));
    }

    @GetMapping("/worker/{workerId}/rating")
    public ResponseEntity<Map<String, Double>> getAverageRating(@PathVariable Long workerId) {
        return ResponseEntity.ok(Map.of("averageRating", reviewService.getAverageRating(workerId)));
    }
}
