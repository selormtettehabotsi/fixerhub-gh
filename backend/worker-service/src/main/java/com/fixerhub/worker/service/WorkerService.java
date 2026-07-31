package com.fixerhub.worker.service;

import com.fixerhub.worker.dto.WorkerProfileRequest;
import com.fixerhub.worker.dto.WorkerProfileResponse;
import com.fixerhub.worker.exception.NotFoundException;
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
    /** Load-balanced (Eureka) — used to fan KYC decisions out to the worker. */
    private final org.springframework.web.client.RestTemplate restTemplate;

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

    /**
     * VISIBILITY GATE: a worker is only discoverable by customers once an admin
     * has APPROVED their KYC.
     *
     * This is enforced here, in the service, rather than by the client passing
     * `verified=true`. The customer app did send that flag, but a flag the
     * caller controls is not a rule — anyone hitting the API directly, or a
     * future screen that forgets the parameter, would surface unvetted workers.
     */
    private boolean isPubliclyVisible(Worker w) {
        return VerificationStatus.APPROVED.equals(w.getVerificationStatus());
    }

    @Cacheable(value = "worker", key = "#id")
    public WorkerProfileResponse getWorkerById(Long id) {
        Worker worker = workerRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Worker not found"));
        // Deliberately the same error as a missing worker: an unapproved
        // profile shouldn't be probeable by guessing IDs. Owners still read
        // their own profile via /workers/by-user/{userId}, and service-to-
        // service callers use getWorkerByIdInternal below.
        if (!isPubliclyVisible(worker)) {
            throw new NotFoundException("Worker not found");
        }
        return toResponse(worker);
    }

    /**
     * SERVICE-TO-SERVICE lookup — NOT gated on verification.
     *
     * This exists because /workers/internal/{id} used to share getWorkerById.
     * Gating that method alone would have broken every internal caller for
     * exactly the workers the gate cares about: booking-service's own approval
     * check would 404 and fall through to its "allow on error" branch, chat
     * peer lookup would fail for existing conversations, and ownership checks
     * that resolve workerId -> userId would return null.
     *
     * Separate cache key so the gated and ungated results can't collide in the
     * "worker" cache.
     */
    @Cacheable(value = "worker", key = "'internal:' + #id")
    public WorkerProfileResponse getWorkerByIdInternal(Long id) {
        Worker worker = workerRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Worker not found"));
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

    /** PUBLIC browse list — approved workers only (see isPubliclyVisible). */
    public Page<WorkerProfileResponse> getAllWorkers(Pageable pageable) {
        return workerRepository.findByVerificationStatus(VerificationStatus.APPROVED, pageable)
                .map(this::toResponse);
    }

    /** ADMIN STATS: "active" means discoverable by customers, so unapproved
     *  workers no longer inflate the number. */
    public int getActiveWorkerCount() {
        return (int) workerRepository.findAllAvailableOrUnset().stream()
                .filter(this::isPubliclyVisible)
                .count();
    }

    /** ADMIN STATS: workers whose PRO plan hasn't expired yet. */
    public long activeProCount() {
        return workerRepository.countByPlanAndPlanExpiresAtAfter("PRO", java.time.LocalDateTime.now());
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
        Worker saved = workerRepository.save(worker);
        notifyDecision(saved, "You're verified ✅",
                "Your identity has been verified. You now appear in customer searches and can start "
                        + "receiving job requests.");
        return toResponse(saved);
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
        Worker saved = workerRepository.save(worker);
        notifyDecision(saved, "Verification declined",
                (note == null || note.isBlank())
                        ? "Your documents could not be verified. Open the app to submit clearer photos."
                        : "Reason: " + note.trim());
        return toResponse(saved);
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
        Worker saved = workerRepository.save(worker);
        notifyDecision(saved, "New documents needed",
                (note == null || note.isBlank())
                        ? "Please upload clearer photos of your ID and headshot, then resubmit."
                        : "What we need: " + note.trim());
        return toResponse(saved);
    }

    /**
     * KYC DECISIONS: tell the worker what happened.
     *
     * Approve/decline/resubmit used to update the row and stop there, so a
     * declined worker was never told — they'd only find out by reopening the
     * verification screen on the off-chance. notification-service records every
     * push in the in-app inbox too, so this still works without a live FCM
     * token (Expo Go, or a worker who declined push permissions).
     *
     * Best-effort by design: a notification outage must not fail the admin's
     * review action, which has already been committed above.
     */
    private void notifyDecision(Worker worker, String title, String body) {
        if (worker.getUserId() == null) {
            log.warn("Worker {} has no userId — cannot notify of KYC decision", worker.getId());
            return;
        }
        try {
            java.util.Map<String, String> payload = new java.util.HashMap<>();
            payload.put("userId", String.valueOf(worker.getUserId()));
            payload.put("title", title);
            payload.put("body", body);
            // SMS as well: verification matters enough to reach a worker who
            // isn't in the app, and the phone is already on the profile.
            if (worker.getPhone() != null && !worker.getPhone().isBlank()) {
                payload.put("phone", worker.getPhone());
                payload.put("sms", "FixerHub: " + title + ". " + body);
            }
            restTemplate.postForEntity(
                    "http://notification-service/notifications/push", payload, Void.class);
        } catch (Exception e) {
            log.warn("Could not notify worker {} of KYC decision '{}': {}",
                    worker.getId(), title, e.getMessage());
        }
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

    /**
     * Nearby search. The `verified` parameter is retained so existing clients
     * keep working, but it no longer affects the result — KYC approval is a
     * precondition for appearing at all. It's also dropped from the cache key,
     * since keying on a parameter that can't change the output would just
     * store the same list twice.
     */
    @Cacheable(value = "nearby", key = "#lat + ':' + #lng + ':' + #radiusKm + ':' + #skill + ':' + #minRating")
    public List<WorkerProfileResponse> getNearbyWorkers(double lat, double lng,
                                                         double radiusKm, String skill,
                                                         Double minRating, Boolean verified) {
        List<Worker> workers = workerRepository.findAllAvailableOrUnset();

        List<WorkerProfileResponse> withCoords = workers.stream()
                .filter(w -> w.getLatitude() != null && w.getLongitude() != null)
                .filter(w -> skill == null || skill.isEmpty() || skill.equalsIgnoreCase(w.getSkill()))
                .filter(w -> minRating == null || (w.getRating() != null && w.getRating() >= minRating))
                // KYC GATE: unconditional. The `verified` request param used to
                // decide this, so a caller that simply omitted it saw unvetted
                // workers. Admin approval is now a precondition for being
                // discoverable, and the param can no longer widen the set.
                .filter(this::isPubliclyVisible)
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
                // KYC GATE: unconditional. The `verified` request param used to
                // decide this, so a caller that simply omitted it saw unvetted
                // workers. Admin approval is now a precondition for being
                // discoverable, and the param can no longer widen the set.
                .filter(this::isPubliclyVisible)
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
