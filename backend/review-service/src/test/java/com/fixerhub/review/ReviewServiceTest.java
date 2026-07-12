package com.fixerhub.review;

import com.fixerhub.review.model.Review;
import com.fixerhub.review.repository.ReviewRepository;
import com.fixerhub.review.service.ReviewService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestTemplate;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class ReviewServiceTest {

    @Mock
    private ReviewRepository reviewRepository;

    @Mock
    private RestTemplate restTemplate;

    @InjectMocks
    private ReviewService reviewService;

    @Test
    void getAverageRating_returnsCorrectAverage() {
        // M2: averaging now happens in SQL — the repository aggregate is the contract
        when(reviewRepository.averageRatingByWorkerId(1L)).thenReturn(4.0);

        double avg = reviewService.getAverageRating(1L);

        assertEquals(4.0, avg);
        verify(reviewRepository, times(1)).averageRatingByWorkerId(1L);
    }

    @Test
    void getAverageRating_returnsZeroWhenNoReviews() {
        when(reviewRepository.averageRatingByWorkerId(1L)).thenReturn(0.0);

        double avg = reviewService.getAverageRating(1L);

        assertEquals(0.0, avg);
    }
}

