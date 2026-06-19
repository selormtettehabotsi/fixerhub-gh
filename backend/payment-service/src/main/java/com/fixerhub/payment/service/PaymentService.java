/*package com.fixerhub.payment.service;

import com.fixerhub.payment.dto.PaymentResponse;
import com.fixerhub.payment.model.Payment;
import com.fixerhub.payment.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository paymentRepository;

    public PaymentResponse getPaymentByBookingId(Long bookingId) {
        Payment payment = paymentRepository.findByBookingId(bookingId)
                .orElseThrow(() -> new RuntimeException("Payment not found for bookingId: " + bookingId));
        return toResponse(payment);
    }

    public List<PaymentResponse> getPaymentsByCustomer(Long customerId) {
        return paymentRepository.findByCustomerId(customerId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    private PaymentResponse toResponse(Payment p) {
        return PaymentResponse.builder()
                .id(p.getId())
                .bookingId(p.getBookingId())
                .customerId(p.getCustomerId())
                .amount(p.getAmount())
                .status(p.getStatus().name())
                .momoReference(p.getMomoReference())
                .createdAt(p.getCreatedAt())
                .build();
    }
}

 */