package com.fixerhub.worker.controller;

import com.fixerhub.worker.dto.WorkerProfileRequest;
import com.fixerhub.worker.dto.WorkerProfileResponse;
import com.fixerhub.worker.service.WorkerService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/workers")
@RequiredArgsConstructor
public class WorkerController {

    private final WorkerService workerService;

    @GetMapping
    public ResponseEntity<?> getAllWorkers(
            @RequestParam(required = false) String skill,
            @RequestParam(required = false) String location,
            Pageable pageable) {
        if (skill != null) {
            return ResponseEntity.ok(workerService.getWorkersBySkill(skill));
        }
        if (location != null) {
            return ResponseEntity.ok(workerService.getWorkersByLocation(location));
        }
        return ResponseEntity.ok(workerService.getAllWorkers(pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<WorkerProfileResponse> getWorkerById(@PathVariable Long id) {
        return ResponseEntity.ok(workerService.getWorkerById(id));
    }

    @PostMapping
    public ResponseEntity<WorkerProfileResponse> createWorker(@RequestBody WorkerProfileRequest request) {
        return ResponseEntity.ok(workerService.createProfile(request));
    }

    @PutMapping("/{id}/availability")
    public ResponseEntity<WorkerProfileResponse> updateAvailability(
            @PathVariable Long id,
            @RequestParam Boolean available) {
        return ResponseEntity.ok(workerService.updateAvailability(id, available));
    }

    @PutMapping("/{id}/rating")
    public ResponseEntity<WorkerProfileResponse> updateRating(
            @PathVariable Long id,
            @RequestParam Double rating) {
        return ResponseEntity.ok(workerService.updateRating(id, rating));
    }

    /**
     * Find available workers near a location.
     * Example: GET /workers/nearby?lat=5.6037&lng=-0.1870&radius=10&skill=Plumbing
     */
    @GetMapping("/nearby")
    public ResponseEntity<?> getNearbyWorkers(
            @RequestParam double lat,
            @RequestParam double lng,
            @RequestParam(defaultValue = "10") double radius,
            @RequestParam(required = false) String skill) {
        return ResponseEntity.ok(workerService.getNearbyWorkers(lat, lng, radius, skill));
    }

    /** Get a worker profile by their auth userId (used by the worker's own dashboard). */
    @GetMapping("/by-user/{userId}")
    public ResponseEntity<WorkerProfileResponse> getWorkerByUserId(
            @PathVariable Long userId,
            HttpServletRequest request) {
        String email = request.getHeader("X-User-Email");
        return ResponseEntity.ok(workerService.getWorkerByUserId(userId, email));
    }

    /** Update availability using the auth userId (used by the worker's own toggle). */
    @PutMapping("/by-user/{userId}/availability")
    public ResponseEntity<WorkerProfileResponse> updateAvailabilityByUserId(
            @PathVariable Long userId,
            @RequestParam Boolean available,
            HttpServletRequest request) {
        String email = request.getHeader("X-User-Email");
        return ResponseEntity.ok(workerService.updateAvailabilityByUserId(userId, email, available));
    }

    @PutMapping("/{id}/verify")
    public ResponseEntity<WorkerProfileResponse> verifyWorker(@PathVariable Long id) {
        return ResponseEntity.ok(workerService.verifyWorker(id));
    }

    @PutMapping("/{id}/unverify")
    public ResponseEntity<WorkerProfileResponse> unverifyWorker(@PathVariable Long id) {
        return ResponseEntity.ok(workerService.unverifyWorker(id));
    }

    /** Internal endpoint for admin-service — returns all workers. */
    @GetMapping("/internal/all")
    public ResponseEntity<java.util.List<WorkerProfileResponse>> getAllWorkersInternal() {
        return ResponseEntity.ok(workerService.getAllWorkersForAdmin());
    }

    /** Internal endpoint for admin-service — returns count of available workers. */
    @GetMapping("/internal/active-count")
    public ResponseEntity<java.util.Map<String, Integer>> getActiveWorkerCount() {
        int count = workerService.getActiveWorkerCount();
        return ResponseEntity.ok(java.util.Map.of("activeWorkers", count));
    }
}
