package com.fixerhub.payment.repository;

import com.fixerhub.payment.model.Payment;
import com.fixerhub.payment.model.PaymentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    Optional<Payment> findByBookingId(Long bookingId);
    /** WEBHOOK: Paystack identifies transactions by reference. */
    Optional<Payment> findByPaystackReference(String paystackReference);
    List<Payment> findByCustomerId(Long customerId);
    List<Payment> findByWorkerId(Long workerId);

    /**
     * RACE GUARD (N10): atomically claims the transition to SUCCESS. Returns 1
     * for exactly one caller; concurrent/replayed verifies get 0 and must not
     * re-send receipts or re-initiate the payout.
     */
    @Modifying
    @Transactional
    @Query("UPDATE Payment p SET p.status = :success, p.paystackStatus = 'success' " +
           "WHERE p.id = :id AND p.status <> :success")
    int claimSuccess(@Param("id") Long id, @Param("success") PaymentStatus success);

    // M2: bounded, newest-first list variants
    List<Payment> findByCustomerIdOrderByIdDesc(Long customerId, org.springframework.data.domain.Pageable pageable);
    List<Payment> findByWorkerIdOrderByIdDesc(Long workerId, org.springframework.data.domain.Pageable pageable);

    // M2: per-worker earnings aggregated in SQL
    @Query("SELECT COALESCE(SUM(p.workerAmount), 0) FROM Payment p WHERE p.workerId = :workerId")
    java.math.BigDecimal sumWorkerAmountByWorkerId(@Param("workerId") Long workerId);

    long countByWorkerId(Long workerId);

    // M2: aggregate in SQL — never load the whole payments table into memory
    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM Payment p")
    java.math.BigDecimal sumAmount();

    @Query("SELECT COALESCE(SUM(p.commissionAmount), 0) FROM Payment p")
    java.math.BigDecimal sumCommission();

    @Query("SELECT COALESCE(SUM(p.workerAmount), 0) FROM Payment p")
    java.math.BigDecimal sumWorkerPayouts();

    /** ENGAGEMENT: per-worker earnings since a date — [workerId, totalWorkerAmount, jobCount]. */
    @Query("SELECT p.workerId, COALESCE(SUM(p.workerAmount), 0), COUNT(p) FROM Payment p " +
           "WHERE p.status = :status AND p.createdAt >= :since AND p.workerId IS NOT NULL " +
           "GROUP BY p.workerId")
    List<Object[]> earningsByWorkerSince(@Param("since") java.time.LocalDateTime since,
                                         @Param("status") PaymentStatus status);

    /** ADMIN CHARTS: settled revenue per calendar day since the given moment. */
    @Query(value = "SELECT CAST(created_at AS date) AS day, COALESCE(SUM(amount), 0) AS total " +
                   "FROM payments WHERE status = 'SUCCESS' AND created_at >= :since " +
                   "GROUP BY CAST(created_at AS date) ORDER BY day",
           nativeQuery = true)
    List<Object[]> revenuePerDaySince(@Param("since") java.time.LocalDateTime since);
}
