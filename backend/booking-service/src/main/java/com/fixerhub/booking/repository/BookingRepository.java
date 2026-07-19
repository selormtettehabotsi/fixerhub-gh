package com.fixerhub.booking.repository;

import com.fixerhub.booking.model.Booking;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface BookingRepository extends JpaRepository<Booking, Long> {
    List<Booking> findByCustomerId(Long customerId);
    List<Booking> findByWorkerId(Long workerId);

    // M2: bounded, newest-first variants — list endpoints must never return unbounded tables
    List<Booking> findByCustomerIdOrderByIdDesc(Long customerId, Pageable pageable);
    List<Booking> findByWorkerIdOrderByIdDesc(Long workerId, Pageable pageable);

    /** MILESTONES: completed-jobs count shown as a badge on the public profile. */
    long countByWorkerIdAndStatus(Long workerId, Booking.Status status);

    /** ADMIN CHARTS: bookings created per calendar day since the given moment. */
    @org.springframework.data.jpa.repository.Query(
            value = "SELECT CAST(created_at AS date) AS day, COUNT(*) AS cnt " +
                    "FROM bookings WHERE created_at >= :since " +
                    "GROUP BY CAST(created_at AS date) ORDER BY day",
            nativeQuery = true)
    List<Object[]> countPerDaySince(@org.springframework.data.repository.query.Param("since") java.time.LocalDateTime since);
}
