package com.fixerhub.worker.controller;

import com.fixerhub.worker.dto.WorkerProfileRequest;
import com.fixerhub.worker.dto.WorkerProfileResponse;
import com.fixerhub.worker.service.WorkerService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/workers")
@RequiredArgsConstructor
public class WorkerController {

    private final WorkerService workerService;

    @GetMapping
    public ResponseEntity<List<WorkerProfileResponse>> getAllWorkers(
            @RequestParam(required = false) String skill) {
        if (skill != null) {
            return ResponseEntity.ok(workerService.getWorkersBySkill(skill));
        }
        return ResponseEntity.ok(workerService.getAllWorkers());
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
}
