package com.fixerhub.admin.controller;

import com.fixerhub.admin.service.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    @GetMapping("/users")
    public ResponseEntity<List<Map<String, Object>>> getAllUsers(
            @RequestParam(required = false) Integer page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(adminService.getAllUsers(page, size));
    }

    @GetMapping("/bookings")
    public ResponseEntity<List<Map<String, Object>>> getAllBookings(
            @RequestParam(required = false) Integer page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(adminService.getAllBookings(page, size));
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getDashboardStats() {
        return ResponseEntity.ok(adminService.getDashboardStats());
    }

    /** ADMIN CHARTS: bookings + revenue per day for the dashboard trends. */
    @GetMapping("/stats/daily")
    public ResponseEntity<Map<String, Object>> getDailyStats(
            @RequestParam(defaultValue = "14") int days) {
        return ResponseEntity.ok(adminService.getDailyStats(days));
    }

    @GetMapping("/workers")
    public ResponseEntity<List<Map<String, Object>>> getAllWorkers() {
        return ResponseEntity.ok(adminService.getAllWorkers());
    }

    @PutMapping("/workers/{id}/verify")
    public ResponseEntity<Map<String, Object>> verifyWorker(@PathVariable Long id) {
        return ResponseEntity.ok(adminService.verifyWorker(id));
    }

    @PutMapping("/workers/{id}/unverify")
    public ResponseEntity<Map<String, Object>> unverifyWorker(@PathVariable Long id) {
        return ResponseEntity.ok(adminService.unverifyWorker(id));
    }

    // ─── KYC Verification Review ─────────────────────────────────────────────

    @GetMapping("/workers/verification/pending")
    public ResponseEntity<List<Map<String, Object>>> getPendingVerifications() {
        return ResponseEntity.ok(adminService.getPendingVerifications());
    }

    @PutMapping("/workers/{id}/verification/approve")
    public ResponseEntity<Map<String, Object>> approveVerification(@PathVariable Long id) {
        return ResponseEntity.ok(adminService.approveVerification(id));
    }

    @PutMapping("/workers/{id}/verification/decline")
    public ResponseEntity<Map<String, Object>> declineVerification(
            @PathVariable Long id, @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(adminService.declineVerification(id, body));
    }

    @PutMapping("/workers/{id}/verification/request-resubmit")
    public ResponseEntity<Map<String, Object>> requestResubmit(
            @PathVariable Long id, @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(adminService.requestResubmit(id, body));
    }
}
