package com.fixerhub.payment.service;

import com.fixerhub.payment.dto.PaymentRequest;
import com.fixerhub.payment.dto.PaymentResponse;
import com.fixerhub.payment.model.Transaction;
import com.fixerhub.payment.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PaymentService {

    private final TransactionRepository transactionRepository;
    private final MomoService momoService;

    public PaymentResponse initiatePayment(PaymentRequest request) {
        String reference = momoService.initiatePayment(request.getMomoNumber(), request.getAmount());
        Transaction transaction = Transaction.builder()
                .bookingId(request.getBookingId())
                .amount(request.getAmount())
                .momoReference(reference)
                .build();
        return toResponse(transactionRepository.save(transaction));
    }

    public List<PaymentResponse> getByBookingId(Long bookingId) {
        return transactionRepository.findByBookingId(bookingId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    private PaymentResponse toResponse(Transaction t) {
        return PaymentResponse.builder()
                .id(t.getId())
                .bookingId(t.getBookingId())
                .amount(t.getAmount())
                .currency(t.getCurrency())
                .momoReference(t.getMomoReference())
                .status(t.getStatus())
                .createdAt(t.getCreatedAt())
                .build();
    }
}
