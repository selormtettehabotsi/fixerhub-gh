package com.fixerhub.worker.service;

import com.fixerhub.worker.dto.WorkerProfileRequest;
import com.fixerhub.worker.dto.WorkerProfileResponse;
import com.fixerhub.worker.model.Worker;
import com.fixerhub.worker.repository.WorkerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WorkerService {

    private final WorkerRepository workerRepository;

    public WorkerProfileResponse createProfile(WorkerProfileRequest request) {
        Worker worker = Worker.builder()
                .userId(request.getUserId())
                .name(request.getName())
                .phone(request.getPhone())
                .skill(request.getSkill())
                .location(request.getLocation())
                .rating(0.0)
                .available(true)
                .build();
        return toResponse(workerRepository.save(worker));
    }

    public WorkerProfileResponse getWorkerById(Long id) {
        Worker worker = workerRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Worker not found"));
        return toResponse(worker);
    }

    public WorkerProfileResponse updateAvailability(Long id, Boolean available) {
        Worker worker = workerRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Worker not found"));
        worker.setAvailable(available);
        return toResponse(workerRepository.save(worker));
    }

    public WorkerProfileResponse updateRating(Long id, Double rating) {
        Worker worker = workerRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Worker not found"));
        worker.setRating(rating);
        return toResponse(workerRepository.save(worker));
    }

    public List<WorkerProfileResponse> getWorkersBySkill(String skill) {
        return workerRepository.findBySkill(skill).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public List<WorkerProfileResponse> getWorkersByLocation(String location) {
        return workerRepository.findByLocation(location).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public Page<WorkerProfileResponse> getAllWorkers(Pageable pageable) {
        return workerRepository.findAll(pageable).map(this::toResponse);
    }

    private WorkerProfileResponse toResponse(Worker w) {
        return WorkerProfileResponse.builder()
                .id(w.getId())
                .userId(w.getUserId())
                .name(w.getName())
                .phone(w.getPhone())
                .skill(w.getSkill())
                .location(w.getLocation())
                .rating(w.getRating())
                .available(w.getAvailable())
                .build();
    }
}
