package com.fixerhub.payment.jobs;

import com.fixerhub.payment.model.PaymentStatus;
import com.fixerhub.payment.repository.PaymentRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * ENGAGEMENT: every Monday 08:00, each worker who earned money last week gets
 * a summary push + SMS ("You earned GH₵420 from 3 jobs last week"). Workers
 * stay where their earnings are visible.
 */
@Slf4j
@Component
@EnableScheduling
public class WeeklyEarningsSummaryJob {

    private final PaymentRepository paymentRepository;
    private final RestTemplate loadBalancedRestTemplate;

    public WeeklyEarningsSummaryJob(PaymentRepository paymentRepository,
                                    @Qualifier("loadBalancedRestTemplate") RestTemplate loadBalancedRestTemplate) {
        this.paymentRepository = paymentRepository;
        this.loadBalancedRestTemplate = loadBalancedRestTemplate;
    }

    @Scheduled(cron = "0 0 8 * * MON")
    public void sendWeeklySummaries() {
        List<Object[]> rows = paymentRepository.earningsByWorkerSince(
                LocalDateTime.now().minusDays(7), PaymentStatus.SUCCESS);
        log.info("Weekly earnings summary: {} workers earned last week", rows.size());

        for (Object[] row : rows) {
            try {
                Long workerId = ((Number) row[0]).longValue();          // worker PROFILE id
                BigDecimal earned = ((BigDecimal) row[1]).setScale(2, RoundingMode.HALF_UP);
                long jobs = ((Number) row[2]).longValue();

                // Resolve profile -> userId + phone for delivery
                @SuppressWarnings("unchecked")
                Map<String, Object> worker = loadBalancedRestTemplate.getForObject(
                        "http://worker-service/workers/internal/" + workerId, Map.class);
                if (worker == null) continue;

                String jobsWord = jobs == 1 ? "job" : "jobs";
                String message = "You earned GH₵" + earned.toPlainString() + " from " + jobs + " " + jobsWord
                        + " on FixerHub last week. Keep it up!";

                Map<String, String> body = new HashMap<>();
                if (worker.get("userId") != null) body.put("userId", String.valueOf(worker.get("userId")));
                body.put("title", "Your week on FixerHub 💪");
                body.put("body", message);
                if (worker.get("phone") != null) {
                    body.put("phone", String.valueOf(worker.get("phone")));
                    body.put("sms", message);
                }
                loadBalancedRestTemplate.postForEntity(
                        "http://notification-service/notifications/push", body, Void.class);
            } catch (Exception e) {
                log.warn("Weekly summary failed for row {}: {}", row[0], e.getMessage());
            }
        }
    }
}
