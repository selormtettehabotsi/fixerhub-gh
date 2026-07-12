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
}
