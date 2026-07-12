package com.fixerhub.payment.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fixerhub.payment.model.Payment;
import com.fixerhub.payment.repository.PaymentRepository;
import com.fixerhub.payment.service.PaystackService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** M4: event parsing (JSON + legacy) and exact BigDecimal commission math. */
@ExtendWith(MockitoExtension.class)
class JobCompletedConsumerTest {

    @Mock
    private PaystackService paystackService;

    @Mock
    private PaymentRepository paymentRepository;

    @Mock
    private RestTemplate restTemplate;

    private JobCompletedConsumer consumer;

    @BeforeEach
    void setUp() {
        consumer = new JobCompletedConsumer(
                paystackService, paymentRepository, restTemplate, new ObjectMapper());
        ReflectionTestUtils.setField(consumer, "commissionRate", new BigDecimal("0.05"));
    }

    private void stubPaystackInit() {
        when(paystackService.initializePayment(any(), any(BigDecimal.class), anyLong()))
                .thenReturn(Map.of("reference", "FH-REF", "authorizationUrl", "https://pay"));
    }

    @Test
    void jsonCompletedEvent_createsPaymentWithExactCommission() {
        when(paymentRepository.findByBookingId(3L)).thenReturn(Optional.empty());
        stubPaystackInit();

        consumer.consume("{\"type\":\"COMPLETED\",\"bookingId\":3,\"customerId\":1," +
                "\"customerPhone\":\"+233241234567\",\"amount\":150.00,\"workerId\":2}");

        ArgumentCaptor<Payment> captor = ArgumentCaptor.forClass(Payment.class);
        verify(paymentRepository).save(captor.capture());
        Payment saved = captor.getValue();

        assertEquals(3L, saved.getBookingId());
        assertEquals(1L, saved.getCustomerId());
        assertEquals(2L, saved.getWorkerId());
        assertEquals(new BigDecimal("150.00"), saved.getAmount());
        assertEquals(new BigDecimal("7.50"), saved.getCommissionAmount());
        assertEquals(new BigDecimal("142.50"), saved.getWorkerAmount());
        // worker share + commission must add back to the exact total
        assertEquals(saved.getAmount(), saved.getCommissionAmount().add(saved.getWorkerAmount()));
        assertEquals("FH-REF", saved.getPaystackReference());
    }

    @Test
    void legacyColonEvent_stillParsed() {
        when(paymentRepository.findByBookingId(3L)).thenReturn(Optional.empty());
        stubPaystackInit();

        consumer.consume("COMPLETED:3:1:+233241234567:150.0:2");

        ArgumentCaptor<Payment> captor = ArgumentCaptor.forClass(Payment.class);
        verify(paymentRepository).save(captor.capture());
        assertEquals(new BigDecimal("150.00"), captor.getValue().getAmount());
        assertEquals("+233241234567", captor.getValue().getCustomerPhone());
    }

    @Test
    void nonCompletedEvent_isIgnored() {
        consumer.consume("{\"type\":\"STATUS_UPDATE\",\"bookingId\":3,\"status\":\"ACCEPTED\",\"workerId\":2}");
        consumer.consume("QUOTE_SUBMITTED:3:1:100.0");

        verify(paymentRepository, never()).save(any());
        verify(paystackService, never()).initializePayment(any(), any(), anyLong());
    }

    @Test
    void existingPayment_isNotDuplicated() {
        when(paymentRepository.findByBookingId(3L)).thenReturn(Optional.of(new Payment()));

        consumer.consume("{\"type\":\"COMPLETED\",\"bookingId\":3,\"customerId\":1," +
                "\"customerPhone\":\"+233241234567\",\"amount\":150.00,\"workerId\":2}");

        verify(paymentRepository, never()).save(any());
        verify(paystackService, never()).initializePayment(any(), any(), anyLong());
    }

    @Test
    void oddAmount_roundsCommissionHalfUpAndWorkerGetsRemainder() {
        when(paymentRepository.findByBookingId(4L)).thenReturn(Optional.empty());
        stubPaystackInit();

        // 0.05 * 33.33 = 1.6665 → commission 1.67 (HALF_UP), worker 31.66
        consumer.consume("{\"type\":\"COMPLETED\",\"bookingId\":4,\"customerId\":1," +
                "\"customerPhone\":\"+233\",\"amount\":33.33,\"workerId\":2}");

        ArgumentCaptor<Payment> captor = ArgumentCaptor.forClass(Payment.class);
        verify(paymentRepository).save(captor.capture());
        Payment saved = captor.getValue();
        assertEquals(new BigDecimal("1.67"), saved.getCommissionAmount());
        assertEquals(new BigDecimal("31.66"), saved.getWorkerAmount());
        assertEquals(saved.getAmount(), saved.getCommissionAmount().add(saved.getWorkerAmount()));
    }
}
