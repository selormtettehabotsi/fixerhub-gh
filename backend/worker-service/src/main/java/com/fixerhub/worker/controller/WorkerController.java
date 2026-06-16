package com.fixerhub.worker.controller;

import com.fixerhub.worker.dto.WorkerProfileRequest;
import com.fixerhub.worker.dto.WorkerProfileResponse;
import com.fixerhub.worker.service.WorkerService;
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
}
