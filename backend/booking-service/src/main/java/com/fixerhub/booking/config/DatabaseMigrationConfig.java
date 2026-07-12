package com.fixerhub.booking.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Runs once after the application context is fully started.
 *
 * Hibernate's ddl-auto=update adds new columns but never modifies existing
 * check constraints. The original bookings_status_check was created without
 * WORKER_ON_THE_WAY, so we drop it and recreate it with all current statuses.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DatabaseMigrationConfig {

    private final JdbcTemplate jdbcTemplate;

    @EventListener(ApplicationReadyEvent.class)
    public void fixStatusCheckConstraint() {
        try {
            // Drop the old constraint (if it exists) and recreate with all statuses
            jdbcTemplate.execute(
                "ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check"
            );
            jdbcTemplate.execute(
                "ALTER TABLE bookings ADD CONSTRAINT bookings_status_check " +
                "CHECK (status IN ('PENDING','ACCEPTED','WORKER_ON_THE_WAY','IN_PROGRESS','COMPLETED','CANCELLED'))"
            );
            log.info("bookings_status_check constraint updated successfully.");
        } catch (Exception e) {
            // Log but don't crash — the service can still operate if the constraint
            // was already correct or the table doesn't exist yet.
            log.warn("Could not update bookings_status_check constraint: {}", e.getMessage());
        }
    }
}
