package com.fixerhub.worker.service;

import com.fixerhub.worker.dto.WorkerProfileRequest;
import com.fixerhub.worker.dto.WorkerProfileResponse;
import com.fixerhub.worker.model.VerificationStatus;
import com.fixerhub.worker.model.Worker;
import com.fixerhub.worker.repository.WorkerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
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

        if (request.getLocation() != null && !request.getLocation().isEmpty()) {
            double[] coords = geocodingService.geocode(request.getLocation());
            if (coords != null) {
                worker.setLatitude(coords[0]);
                worker.setLongitude(coords[1]);
            }
        }

        return toResponse(workerRepository.save(worker));
    }

    @Cacheable(value = "worker", key = "#id")
    public WorkerProfileResponse getWorkerById(Long id) {
        Worker worker = workerRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Worker not found"));
        return toResponse(worker);
    }

    @Caching(evict = {
        @CacheEvict(value = "worker", allEntries = true),
        @CacheEvict(value = "nearby", allEntries = true)
    })
    public WorkerProfileResponse updateAvailability(Long id, Boolean available) {
        Worker worker = workerRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Worker not found"));
        worker.setAvailable(available);
        return toResponse(workerRepository.save(worker));
    }

    @Caching(evict = {
        @CacheEvict(value = "worker", allEntries = true),
        @CacheEvict(value = "nearby", allEntries = true)
    })
    public WorkerProfileResponse updateAvailabilityByUserId(Long userId, String email, Boolean available) {
        Worker worker = findWorkerByUserIdOrEmail(userId, email);
        worker.setAvailable(available);
        return toResponse(workerRepository.save(worker));
    }

    /** EDIT PROFILE (internal): auth-service syncs name/email/phone after a user edit. */
    @Caching(evict = {
        @CacheEvict(value = "worker", allEntries = true),
        @CacheEvict(value = "nearby", allEntries = true)
    })
    public WorkerProfileResponse updateContact(Long userId, String name, String email, String phone) {
        Worker worker = workerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Worker not found"));
        if (name != null && !name.isBlank()) worker.setName(name.trim());
        if (email != null && !email.isBlank()) worker.setEmail(email.trim());
        if (phone != null && !phone.isBlank()) worker.setPhone(phone.trim());
        return toResponse(workerRepository.save(worker));
    }

    /** EDIT PROFILE: worker changes their trade (skill) and/or base location. */
    @Caching(evict = {
        @CacheEvict(value = "worker", allEntries = true),
        @CacheEvict(value = "nearby", allEntries = true)
    })
    public WorkerProfileResponse updateWork(Long userId, String skill, String location) {
        Worker worker = workerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Worker not found"));
        if (skill != null && !skill.isBlank()) worker.setSkill(skill.trim());
        if (location != null && !location.isBlank()) {
            worker.setLocation(location.trim());
            double[] coords = geocodingService.geocode(location.trim());
            if (coords != null) {
                worker.setLatitude(coords[0]);
                worker.setLongitude(coords[1]);
            }
        }
        return toResponse(workerRepository.save(worker));
    }

    /**
     * LIVE DISTANCE: the worker app pushes its real GPS position here so
     * nearby-search distances reflect where the worker actually IS, not the
     * address geocoded once at signup. Evicts both caches so customers see
     * the updated distance on their next fetch.
     */
    @Caching(evict = {
        @CacheEvict(value = "worker", allEntries = true),
        @CacheEvict(value = "nearby", allEntries = true)
    })
    public WorkerProfileResponse updateLiveLocation(Long userId, Double lat, Double lng) {
        if (lat == null || lng == null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            throw new IllegalArgumentException("Invalid coordinates");
        }
        Worker worker = workerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Worker not found"));
        worker.setLatitude(lat);
        worker.setLongitude(lng);
        return toResponse(workerRepository.save(worker));
    }

    public WorkerProfileResponse getWorkerByUserId(Long userId, String email) {
        return toResponse(findWorkerByUserIdOrEmail(userId, email));
    }

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

    @Caching(evict = {
        @CacheEvict(value = "worker", allEntries = true),
        @CacheEvict(value = "nearby", allEntries = true)
    })
    public WorkerProfileResponse updateRating(Long id, Double rating) {
        Worker worker = workerRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Worker not found"));
        worker.setRating(rating);
        log.info("Updated rating for workerId={} to {}", id, rating);
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

    @Caching(evict = {
        @CacheEvict(value = "worker", allEntries = true),
        @CacheEvict(value = "nearby", allEntries = true)
    })
    public WorkerProfileResponse verifyWorker(Long id) {
        Worker worker = workerRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Worker not found"));
        worker.setVerified(true);
        return toResponse(workerRepository.save(worker));
    }

    @Caching(evict = {
        @CacheEvict(value = "worker", allEntries = true),
        @CacheEvict(value = "nearby", allEntries = true)
    })
    public WorkerProfileResponse unverifyWorker(Long id) {
        Worker worker = workerRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Worker not found"));
        worker.setVerified(false);
        return toResponse(workerRepository.save(worker));
    }

    @Caching(evict = {
        @CacheEvict(value = "worker", allEntries = true),
        @CacheEvict(value = "nearby", allEntries = true)
    })
    public WorkerProfileResponse saveDocumentUrl(Long id, String documentUrl) {
        Worker worker = workerRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Worker not found"));
        worker.setVerificationDocumentUrl(documentUrl);
        return toResponse(workerRepository.save(worker));
    }

    // ─── KYC Verification ────────────────────────────────────────────────────

    @Caching(evict = {
        @CacheEvict(value = "worker", allEntries = true),
        @CacheEvict(value = "nearby", allEntries = true)
    })
    public WorkerProfileResponse submitVerificationDocs(Long id, String idFrontUrl,
                                                        String idBackUrl, String headshotUrl) {
        Worker worker = workerRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Worker not found"));
        worker.setIdFrontUrl(idFrontUrl);
        worker.setIdBackUrl(idBackUrl);
        worker.setHeadshotUrl(headshotUrl);
        worker.setVerificationStatus(VerificationStatus.PENDING);
        worker.setVerificationNote(null);
        return toResponse(workerRepository.save(worker));
    }

    @Caching(evict = {
        @CacheEvict(value = "worker", allEntries = true),
        @CacheEvict(value = "nearby", allEntries = true)
    })
    public WorkerProfileResponse approveVerification(Long id) {
        Worker worker = workerRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Worker not found"));
        worker.setVerificationStatus(VerificationStatus.APPROVED);
        worker.setVerified(true);
        worker.setVerificationNote(null);
        return toResponse(workerRepository.save(worker));
    }

    @Caching(evict = {
        @CacheEvict(value = "worker", allEntries = true),
        @CacheEvict(value = "nearby", allEntries = true)
    })
    public WorkerProfileResponse declineVerification(Long id, String note) {
        Worker worker = workerRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Worker not found"));
        worker.setVerificationStatus(VerificationStatus.DECLINED);
        worker.setVerified(false);
        worker.setVerificationNote(note);
        return toResponse(workerRepository.save(worker));
    }

    @Caching(evict = {
        @CacheEvict(value = "worker", allEntries = true),
        @CacheEvict(value = "nearby", allEntries = true)
    })
    public WorkerProfileResponse requestResubmit(Long id, String note) {
        Worker worker = workerRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Worker not found"));
        worker.setVerificationStatus(VerificationStatus.RESUBMIT_REQUESTED);
        worker.setVerificationNote(note);
        return toResponse(workerRepository.save(worker));
    }

    /** Update pricing info (min/max price + pricing style). */
    @Caching(evict = {
        @CacheEvict(value = "worker", allEntries = true),
        @CacheEvict(value = "nearby", allEntries = true)
    })
    public WorkerProfileResponse updatePricing(Long userId, BigDecimal minPrice, BigDecimal maxPrice, String pricingStyle) {
        Worker worker = workerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Worker not found for userId: " + userId));
        worker.setMinPrice(minPrice);
        worker.setMaxPrice(maxPrice);
        // Only overwrite pricingStyle when the client actually sent one — the
        // profile screen saves min/max only, and used to silently wipe the style.
        if (pricingStyle != null) {
            worker.setPricingStyle(pricingStyle);
        }
        return toResponse(workerRepository.save(worker));
    }

    /** Sync the profile picture URL from auth-service into the worker profile. */
    @Caching(evict = {
        @CacheEvict(value = "worker", allEntries = true),
        @CacheEvict(value = "nearby", allEntries = true)
    })
    public WorkerProfileResponse updateProfilePicture(Long userId, String profilePicture) {
        Worker worker = workerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Worker not found for userId: " + userId));
        worker.setProfilePicture(profilePicture);
        return toResponse(workerRepository.save(worker));
    }

    public List<WorkerProfileResponse> getPendingVerifications() {
        return workerRepository.findByVerificationStatus(VerificationStatus.PENDING)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    public List<WorkerProfileResponse> getAllWorkersForAdmin() {
        return workerRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Cacheable(value = "nearby", key = "#lat + ':' + #lng + ':' + #radiusKm + ':' + #skill + ':' + #minRating + ':' + #verified")
    public List<WorkerProfileResponse> getNearbyWorkers(double lat, double lng,
                                                         double radiusKm, String skill,
                                                         Double minRating, Boolean verified) {
        List<Worker> workers = workerRepository.findAllAvailableOrUnset();

        List<WorkerProfileResponse> withCoords = workers.stream()
                .filter(w -> w.getLatitude() != null && w.getLongitude() != null)
                .filter(w -> skill == null || skill.isEmpty() || skill.equalsIgnoreCase(w.getSkill()))
                .filter(w -> minRating == null || (w.getRating() != null && w.getRating() >= minRating))
                .filter(w -> verified == null || !verified || Boolean.TRUE.equals(w.getVerified()))
                .map(w -> {
                    double distance = geocodingService.distanceKm(lat, lng, w.getLatitude(), w.getLongitude());
                    WorkerProfileResponse response = toResponse(w);
                    response.setDistanceKm(Math.round(distance * 10.0) / 10.0);
                    return response;
                })
                // Closest first; PRO workers win ties within the same ~0.5 km bucket
                .sorted(java.util.Comparator
                        .comparingDouble((WorkerProfileResponse r) -> Math.ceil(r.getDistanceKm() * 2))
                        .thenComparing(r -> !"PRO".equals(r.getPlan()))
                        .thenComparingDouble(WorkerProfileResponse::getDistanceKm))
                .collect(Collectors.toList());

        List<WorkerProfileResponse> withoutCoords = workers.stream()
                .filter(w -> w.getLatitude() == null || w.getLongitude() == null)
                .filter(w -> skill == null || skill.isEmpty() || skill.equalsIgnoreCase(w.getSkill()))
                .filter(w -> minRating == null || (w.getRating() != null && w.getRating() >= minRating))
                .filter(w -> verified == null || !verified || Boolean.TRUE.equals(w.getVerified()))
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
                .email(w.getEmail())
                .phone(w.getPhone())
                .skill(w.getSkill())
                .location(w.getLocation())
                .rating(w.getRating())
                .available(w.getAvailable())
                .latitude(w.getLatitude())
                .longitude(w.getLongitude())
                .verified(w.getVerified() != null ? w.getVerified() : false)
                .profilePicture(w.getProfilePicture())
                .verificationDocumentUrl(w.getVerificationDocumentUrl())
                .idFrontUrl(w.getIdFrontUrl())
                .idBackUrl(w.getIdBackUrl())
                .headshotUrl(w.getHeadshotUrl())
                .verificationStatus(w.getVerificationStatus() != null
                        ? w.getVerificationStatus() : VerificationStatus.NONE)
                .verificationNote(w.getVerificationNote())
                .minPrice(w.getMinPrice())
                .maxPrice(w.getMaxPrice())
                .pricingStyle(w.getPricingStyle())
                .momoNetwork(w.getMomoNetwork() != null ? w.getMomoNetwork() : "MTN")
                .plan(effectivePlan(w))
                .planExpiresAt(w.getPlanExpiresAt())
                .build();
    }

    /** SUBSCRIPTION: PRO only counts while unexpired — no cleanup job needed. */
    private static String effectivePlan(Worker w) {
        boolean pro = "PRO".equalsIgnoreCase(w.getPlan())
                && w.getPlanExpiresAt() != null
                && w.getPlanExpiresAt().isAfter(java.time.LocalDateTime.now());
        return pro ? "PRO" : "FREE";
    }

    /** SUBSCRIPTION (internal): payment-service activates a plan after a verified charge. */
    @Caching(evict = {
        @CacheEvict(value = "worker", allEntries = true),
        @CacheEvict(value = "nearby", allEntries = true)
    })
    public WorkerProfileResponse activatePlan(Long userId, String plan, int days) {
        Worker worker = workerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Worker not found"));
        worker.setPlan(plan);
        // Extend from the current expiry when renewing early, else from now
        java.time.LocalDateTime base =
                worker.getPlanExpiresAt() != null && worker.getPlanExpiresAt().isAfter(java.time.LocalDateTime.now())
                        ? worker.getPlanExpiresAt() : java.time.LocalDateTime.now();
        worker.setPlanExpiresAt(base.plusDays(days));
        log.info("Plan {} activated for workerUserId={} until {}", plan, userId, worker.getPlanExpiresAt());
        return toResponse(workerRepository.save(worker));
    }

    /** Update the worker's mobile money network for automated payouts. */
    @Caching(evict = {
        @CacheEvict(value = "worker", allEntries = true),
        @CacheEvict(value = "nearby", allEntries = true)
    })
    public WorkerProfileResponse updateMomoNetwork(Long userId, String momoNetwork) {
        Worker worker = workerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Worker not found for userId: " + userId));
        worker.setMomoNetwork(momoNetwork);
        return toResponse(workerRepository.save(worker));
    }

    /** M4: remove the worker profile when the owning account is deleted. */
    @Caching(evict = {
        @CacheEvict(value = "worker", allEntries = true),
        @CacheEvict(value = "nearby", allEntries = true)
    })
    public void deleteByUserId(Long userId) {
        workerRepository.findByUserId(userId).ifPresent(workerRepository::delete);
    }
}
