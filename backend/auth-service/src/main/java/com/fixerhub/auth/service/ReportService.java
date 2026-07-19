package com.fixerhub.auth.service;

import com.fixerhub.auth.dto.ReportRequest;
import com.fixerhub.auth.dto.ReportResponse;
import com.fixerhub.auth.exception.BadRequestException;
import com.fixerhub.auth.exception.NotFoundException;
import com.fixerhub.auth.model.Report;
import com.fixerhub.auth.model.User;
import com.fixerhub.auth.repository.ReportRepository;
import com.fixerhub.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ReportService {

    /** Statuses that no longer hold a disputed payout. */
    private static final List<String> CLOSED_STATUSES = List.of("RESOLVED", "DISMISSED");

    /** Allowed transitions: which statuses each current status may move to. */
    private static final Map<String, Set<String>> TRANSITIONS = Map.of(
            "OPEN",      Set.of("REVIEWING", "RESOLVED", "DISMISSED"),
            "REVIEWING", Set.of("RESOLVED", "DISMISSED", "OPEN"),
            "RESOLVED",  Set.of("REVIEWING"),   // reopen if it wasn't actually fixed
            "DISMISSED", Set.of("REVIEWING")
    );

    private final ReportRepository reportRepository;
    private final UserRepository userRepository;

    public ReportResponse submitReport(String email, ReportRequest request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new NotFoundException("User not found"));

        Report report = Report.builder()
                .reporterId(user.getId())
                .reporterEmail(email)
                .reporterName(user.getName())
                .reporterProfilePicture(user.getProfilePicture())
                .category(request.getCategory())
                .description(request.getDescription())
                .bookingId(request.getBookingId())   // M6
                .build();

        return toResponse(reportRepository.save(report));
    }

    /**
     * DISPUTE RESOLUTION (admin): move a report through its lifecycle.
     * Resolving/dismissing a PAYMENT_PROBLEM report lifts the payout hold —
     * the admin then releases the payout (or refunds) from the reports screen.
     */
    public ReportResponse updateStatus(Long reportId, String newStatus, String note) {
        Report report = reportRepository.findById(reportId)
                .orElseThrow(() -> new NotFoundException("Report not found: " + reportId));

        String target = newStatus == null ? "" : newStatus.trim().toUpperCase();
        String current = report.getStatus() == null ? "OPEN" : report.getStatus();
        Set<String> allowed = TRANSITIONS.getOrDefault(current, Set.of());
        if (!allowed.contains(target)) {
            throw new BadRequestException(
                    "Cannot move report from " + current + " to '" + newStatus + "'. Allowed: " + allowed);
        }

        report.setStatus(target);
        if (note != null && !note.isBlank()) report.setResolutionNote(note.trim());
        report.setResolvedAt(CLOSED_STATUSES.contains(target) ? LocalDateTime.now() : null);
        return toResponse(reportRepository.save(report));
    }

    /** M6: payment-service asks this before paying a worker out. */
    public boolean hasOpenPaymentProblem(Long bookingId) {
        return reportRepository.existsByBookingIdAndCategoryAndStatusNotIn(
                bookingId, "PAYMENT_PROBLEM", CLOSED_STATUSES);
    }

    public List<ReportResponse> getAllReports() {
        return reportRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toResponse)
                .toList();
    }

    private ReportResponse toResponse(Report report) {
        return ReportResponse.builder()
                .id(report.getId())
                .reporterId(report.getReporterId())
                .reporterEmail(report.getReporterEmail())
                .reporterName(report.getReporterName())
                .reporterProfilePicture(report.getReporterProfilePicture())
                .category(report.getCategory())
                .bookingId(report.getBookingId())
                .description(report.getDescription())
                .status(report.getStatus())
                .resolutionNote(report.getResolutionNote())
                .resolvedAt(report.getResolvedAt())
                .createdAt(report.getCreatedAt())
                .build();
    }
}
