package com.fixerhub.auth.service;

import com.fixerhub.auth.dto.ReportRequest;
import com.fixerhub.auth.dto.ReportResponse;
import com.fixerhub.auth.exception.NotFoundException;
import com.fixerhub.auth.model.Report;
import com.fixerhub.auth.model.User;
import com.fixerhub.auth.repository.ReportRepository;
import com.fixerhub.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ReportService {

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

    /** M6: payment-service asks this before paying a worker out. */
    public boolean hasOpenPaymentProblem(Long bookingId) {
        return reportRepository.existsByBookingIdAndCategoryAndStatusNot(
                bookingId, "PAYMENT_PROBLEM", "RESOLVED");
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
                .description(report.getDescription())
                .status(report.getStatus())
                .createdAt(report.getCreatedAt())
                .build();
    }
}
