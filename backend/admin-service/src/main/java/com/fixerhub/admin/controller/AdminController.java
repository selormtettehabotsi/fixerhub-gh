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
    public ResponseEntity<List<Map<String, Object>>> getAllUsers() {
        return ResponseEntity.ok(adminService.getAllUsers());
    }

    @GetMapping("/bookings")
    public ResponseEntity<List<Map<String, Object>>> getAllBookings() {
        return ResponseEntity.ok(adminService.getAllBookings());
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getDashboardStats() {
        return ResponseEntity.ok(adminService.getDashboardStats());
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
}
