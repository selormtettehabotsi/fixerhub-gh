package com.fixerhub.worker.service;

import com.fixerhub.worker.dto.WorkerProfileRequest;
import com.fixerhub.worker.dto.WorkerProfileResponse;
import com.fixerhub.worker.model.Worker;
import com.fixerhub.worker.repository.WorkerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class WorkerService {

    private final WorkerRepository workerRepository;
    private final GeocodingService geocodingService;

    public WorkerProfileResponse createProfile(WorkerProfileRequest request) {
        Worker worker = Worker.builder()
                .userId(request.getUserId())
                .email(request.getEmail())
                .name(request.getName())
                .phone(request.getPhone())
                .skill(request.getSkill())
                .location(request.getLocation())
                .rating(0.0)
                .available(true)
                .build();

        // Geocode location to lat/lng
        if (request.getLocation() != null && !request.getLocation().isEmpty()) {
            double[] coords = geocodingService.geocode(request.getLocation());
            if (coords != null) {
                worker.setLatitude(coords[0]);
                worker.setLongitude(coords[1]);
            }
        }

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

    public WorkerProfileResponse updateAvailabilityByUserId(Long userId, String email, Boolean available) {
        Worker worker = findWorkerByUserIdOrEmail(userId, email);
        worker.setAvailable(available);
        return toResponse(workerRepository.save(worker));
    }

    public WorkerProfileResponse getWorkerByUserId(Long userId, String email) {
        return toResponse(findWorkerByUserIdOrEmail(userId, email));
    }

    /**
     * Finds a worker by userId, falls back to email. If still not found, creates a minimal
     * profile so the worker can use the app without re-registering.
     */
    private Worker findWorkerByUserIdOrEmail(Long userId, String email) {
        return workerRepository.findByUserId(userId).orElseGet(() ->
            workerRepository.findByEmail(email).map(w -> {
                w.setUserId(userId);
                return workerRepository.save(w);
            }).orElseGet(() -> {
                log.warn("Auto-creating missing worker profile for userId={} email={}", userId, email);
                Worker w = Worker.builder()
                        .userId(userId)
                        .email(email)
                        .name(email != null ? email.split("@")[0] : "Worker")
                        .skill("General")
                        .location("")
                        .rating(0.0)
                        .available(true)
                        .build();
                return workerRepository.save(w);
            })
        );
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

    public int getActiveWorkerCount() {
        return workerRepository.findAllAvailableOrUnset().size();
    }

    public WorkerProfileResponse verifyWorker(Long id) {
        Worker worker = workerRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Worker not found"));
        worker.setVerified(true);
        return toResponse(workerRepository.save(worker));
    }

    public WorkerProfileResponse unverifyWorker(Long id) {
        Worker worker = workerRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Worker not found"));
        worker.setVerified(false);
        return toResponse(workerRepository.save(worker));
    }

    public List<WorkerProfileResponse> getAllWorkersForAdmin() {
        return workerRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    /**
     * Returns all available workers sorted by distance from the customer (nearest first).
     * Workers without coordinates are appended at the end.
     */
    public List<WorkerProfileResponse> getNearbyWorkers(double lat, double lng,
                                                         double radiusKm, String skill) {
        List<Worker> workers = workerRepository.findAllAvailableOrUnset();

        List<WorkerProfileResponse> withCoords = workers.stream()
                .filter(w -> w.getLatitude() != null && w.getLongitude() != null)
                .filter(w -> skill == null || skill.isEmpty()
                        || skill.equalsIgnoreCase(w.getSkill()))
                .map(w -> {
                    double distance = geocodingService.distanceKm(lat, lng,
                            w.getLatitude(), w.getLongitude());
                    WorkerProfileResponse response = toResponse(w);
                    response.setDistanceKm(Math.round(distance * 10.0) / 10.0);
                    return response;
                })
                .sorted((a, b) -> Double.compare(a.getDistanceKm(), b.getDistanceKm()))
                .collect(Collectors.toList());

        List<WorkerProfileResponse> withoutCoords = workers.stream()
                .filter(w -> w.getLatitude() == null || w.getLongitude() == null)
                .filter(w -> skill == null || skill.isEmpty()
                        || skill.equalsIgnoreCase(w.getSkill()))
                .map(this::toResponse)
                .collect(Collectors.toList());

        withCoords.addAll(withoutCoords);
        return withCoords;
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
                .latitude(w.getLatitude())
                .longitude(w.getLongitude())
                .verified(w.getVerified() != null ? w.getVerified() : false)
                .build();
    }
}
