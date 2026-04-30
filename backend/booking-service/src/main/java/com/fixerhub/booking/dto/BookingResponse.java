package com.fixerhub.booking.dto;

import com.fixerhub.booking.model.Booking;
import lombok.*;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BookingResponse {
    private Long id;
    private Long customerId;
    private Long workerId;
    private String serviceType;
    private Booking.Status status;
    private LocalDateTime scheduledAt;
    private LocalDateTime createdAt;
}
