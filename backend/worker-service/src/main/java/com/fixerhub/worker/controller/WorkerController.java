package com.fixerhub.worker.controller;

import com.fixerhub.worker.config.AuthContext;
import com.fixerhub.worker.dto.PortfolioItemResponse;
import com.fixerhub.worker.dto.WorkerProfileRequest;
import com.fixerhub.worker.dto.WorkerProfileResponse;
import com.fixerhub.worker.service.PortfolioService;
import com.fixerhub.worker.service.WorkerService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/workers")
@RequiredArgsConstructor
public class WorkerController {

    private final WorkerService workerService;
    private final PortfolioService portfolioService;

    // ─── SECURITY (H1): public-safe DTO ──────────────────────────────────────

    /** Strips PII (phone, email, momo network, KYC document URLs) for unauthenticated routes. */
    private static WorkerProfileResponse sanitize(WorkerProfileResponse w) {
        if (w == null) return null;
        w.setPhone(null);
        w.setEmail(null);
        w.setMomoNetwork(null);
        w.setVerificationDocumentUrl(null);
        w.setIdFrontUrl(null);
        w.setIdBackUrl(null);
        w.setHeadshotUrl(null);
        w.setVerificationNote(null);
        w.setPlanExpiresAt(null); // billing detail — plan badge itself stays public
        // SECURITY (N6): never expose a worker's exact home coordinates publicly.
        // Round to 2 decimal places (~1.1 km) — enough for a map pin, not enough
        // to locate a house. distanceKm stays precise (computed server-side).
        if (w.getLatitude() != null)  w.setLatitude(Math.round(w.getLatitude() * 100.0) / 100.0);
        if (w.getLongitude() != null) w.setLongitude(Math.round(w.getLongitude() * 100.0) / 100.0);
        return w;
    }

    private static List<WorkerProfileResponse> sanitize(List<WorkerProfileResponse> workers) {
        return workers.stream().map(WorkerController::sanitize).collect(Collectors.toList());
    }

    @GetMapping
    public ResponseEntity<?> getAllWorkers(
            @RequestParam(required = false) String skill,
            @RequestParam(required = false) String location,
            Pageable pageable) {
        if (skill != null) {
            return ResponseEntity.ok(sanitize(workerService.getWorkersBySkill(skill)));
        }
        if (location != null) {
            return ResponseEntity.ok(sanitize(workerService.getWorkersByLocation(location)));
        }
        return ResponseEntity.ok(workerService.getAllWorkers(pageable).map(WorkerController::sanitize));
    }

    @GetMapping("/{id}")
    public ResponseEntity<WorkerProfileResponse> getWorkerById(@PathVariable Long id) {
        return ResponseEntity.ok(sanitize(workerService.getWorkerById(id)));
    }

    /** Internal: full (unsanitized) worker record for service-to-service calls — blocked at the gateway.
     *  Uses the UNGATED lookup: internal callers (booking-service's approval
     *  check, chat peer resolution, ownership checks) must be able to read
     *  workers who aren't publicly visible yet. */
    @GetMapping("/internal/{id}")
    public ResponseEntity<WorkerProfileResponse> getWorkerInternal(@PathVariable Long id) {
        return ResponseEntity.ok(workerService.getWorkerByIdInternal(id));
    }

    /** M4 (internal): auth-service removes the worker profile when the account is deleted. */
    @DeleteMapping("/internal/by-user/{userId}")
    public ResponseEntity<Void> deleteByUserIdInternal(@PathVariable Long userId) {
        workerService.deleteByUserId(userId);
        return ResponseEntity.noContent().build();
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

    @GetMapping("/nearby")
    public ResponseEntity<?> getNearbyWorkers(
            @RequestParam double lat,
            @RequestParam double lng,
            @RequestParam(defaultValue = "10") double radius,
            @RequestParam(required = false) String skill,
            @RequestParam(required = false) Double minRating,
            @RequestParam(required = false) Boolean verified) {
        return ResponseEntity.ok(sanitize(workerService.getNearbyWorkers(lat, lng, radius, skill, minRating, verified)));
    }

    /** SECURITY (H1): full own-profile view — authenticated, self or admin only. */
    @GetMapping("/by-user/{userId}")
    public ResponseEntity<WorkerProfileResponse> getWorkerByUserId(
            @PathVariable Long userId,
            HttpServletRequest request) {
        if (!AuthContext.isAdmin() && !userId.equals(AuthContext.userId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only view your own worker profile");
        }
        String email = request.getHeader("X-User-Email");
        return ResponseEntity.ok(workerService.getWorkerByUserId(userId, email));
    }

    /** Update pricing range and style for a worker. */
    @PutMapping("/by-user/{userId}/pricing")
    public ResponseEntity<WorkerProfileResponse> updatePricing(
            @PathVariable Long userId,
            @RequestBody Map<String, Object> body) {
        BigDecimal minPrice = body.get("minPrice") != null ? new BigDecimal(body.get("minPrice").toString()) : null;
        BigDecimal maxPrice = body.get("maxPrice") != null ? new BigDecimal(body.get("maxPrice").toString()) : null;
        String pricingStyle = (String) body.get("pricingStyle");
        return ResponseEntity.ok(workerService.updatePricing(userId, minPrice, maxPrice, pricingStyle));
    }

    /** Update the worker's mobile money network for automated payouts. */
    @PutMapping("/by-user/{userId}/momo-network")
    public ResponseEntity<WorkerProfileResponse> updateMomoNetwork(
            @PathVariable Long userId,
            @RequestBody Map<String, String> body) {
        String momoNetwork = body.getOrDefault("momoNetwork", "MTN");
        return ResponseEntity.ok(workerService.updateMomoNetwork(userId, momoNetwork));
    }

    /** Sync profile picture from auth-service into the worker profile record. */
    @PutMapping("/by-user/{userId}/profile-picture")
    public ResponseEntity<WorkerProfileResponse> updateProfilePicture(
            @PathVariable Long userId,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(workerService.updateProfilePicture(userId, body.getOrDefault("profilePicture", "")));
    }

    /** SUBSCRIPTION (internal): payment-service activates a plan after a verified charge. */
    @PutMapping("/internal/by-user/{userId}/plan")
    public ResponseEntity<WorkerProfileResponse> activatePlanInternal(
            @PathVariable Long userId,
            @RequestBody Map<String, String> body) {
        String plan = body.getOrDefault("plan", "PRO");
        int days = Integer.parseInt(body.getOrDefault("days", "30"));
        return ResponseEntity.ok(workerService.activatePlan(userId, plan, days));
    }

    /** EDIT PROFILE (internal): auth-service syncs contact info — blocked at the gateway. */
    @PutMapping("/internal/by-user/{userId}/contact")
    public ResponseEntity<WorkerProfileResponse> updateContactInternal(
            @PathVariable Long userId,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(workerService.updateContact(
                userId, body.get("name"), body.get("email"), body.get("phone")));
    }

    /** EDIT PROFILE: worker changes their trade/skill (and optionally base location). Self or admin. */
    @PutMapping("/by-user/{userId}/work")
    public ResponseEntity<WorkerProfileResponse> updateWork(
            @PathVariable Long userId,
            @RequestBody Map<String, String> body) {
        if (!AuthContext.isAdmin() && !userId.equals(AuthContext.userId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only update your own profile");
        }
        return ResponseEntity.ok(workerService.updateWork(userId, body.get("skill"), body.get("location")));
    }

    /**
     * LIVE DISTANCE: worker app pushes its current GPS so nearby distances
     * track where the worker actually is. Self or admin only.
     */
    @PutMapping("/by-user/{userId}/location")
    public ResponseEntity<WorkerProfileResponse> updateLiveLocation(
            @PathVariable Long userId,
            @RequestBody Map<String, Object> body) {
        if (!AuthContext.isAdmin() && !userId.equals(AuthContext.userId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only update your own location");
        }
        Double lat = body.get("lat") != null ? Double.valueOf(body.get("lat").toString()) : null;
        Double lng = body.get("lng") != null ? Double.valueOf(body.get("lng").toString()) : null;
        return ResponseEntity.ok(sanitize(workerService.updateLiveLocation(userId, lat, lng)));
    }

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

    @PostMapping("/{id}/upload-document")
    public ResponseEntity<WorkerProfileResponse> uploadDocument(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(workerService.saveDocumentUrl(id, body.get("documentUrl")));
    }

    // ─── KYC Verification ────────────────────────────────────────────────────

    /** Worker submits ID front, ID back, and headshot for admin review */
    @PostMapping("/{id}/verification/submit")
    public ResponseEntity<WorkerProfileResponse> submitVerificationDocs(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(workerService.submitVerificationDocs(
                id, body.get("idFrontUrl"), body.get("idBackUrl"), body.get("headshotUrl")));
    }

    /** Admin approves a worker's KYC documents */
    @PutMapping("/{id}/verification/approve")
    public ResponseEntity<WorkerProfileResponse> approveVerification(@PathVariable Long id) {
        return ResponseEntity.ok(workerService.approveVerification(id));
    }

    /** Admin declines a worker's KYC documents with a reason */
    @PutMapping("/{id}/verification/decline")
    public ResponseEntity<WorkerProfileResponse> declineVerification(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(workerService.declineVerification(id, body.get("note")));
    }

    /** Admin asks the worker to resubmit clearer photos */
    @PutMapping("/{id}/verification/request-resubmit")
    public ResponseEntity<WorkerProfileResponse> requestResubmit(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(workerService.requestResubmit(id, body.get("note")));
    }

    /** Internal: admin-service fetches all workers pending KYC review */
    @GetMapping("/internal/verification/pending")
    public ResponseEntity<List<WorkerProfileResponse>> getPendingVerifications() {
        return ResponseEntity.ok(workerService.getPendingVerifications());
    }

    /** Internal: admin-service approves KYC (no JWT required — trusted service call) */
    @PutMapping("/internal/{id}/verification/approve")
    public ResponseEntity<WorkerProfileResponse> approveVerificationInternal(@PathVariable Long id) {
        return ResponseEntity.ok(workerService.approveVerification(id));
    }

    /** Internal: admin-service declines KYC (no JWT required — trusted service call) */
    @PutMapping("/internal/{id}/verification/decline")
    public ResponseEntity<WorkerProfileResponse> declineVerificationInternal(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(workerService.declineVerification(id, body.get("note")));
    }

    /** Internal: admin-service requests KYC resubmission (no JWT required — trusted service call) */
    @PutMapping("/internal/{id}/verification/request-resubmit")
    public ResponseEntity<WorkerProfileResponse> requestResubmitInternal(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(workerService.requestResubmit(id, body.get("note")));
    }

    @PostMapping("/{id}/portfolio")
    public ResponseEntity<PortfolioItemResponse> addPortfolioItem(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(portfolioService.addPortfolioItem(id, body.get("imageUrl"), body.get("caption")));
    }

    @GetMapping("/{id}/portfolio")
    public ResponseEntity<List<PortfolioItemResponse>> getPortfolio(@PathVariable Long id) {
        return ResponseEntity.ok(portfolioService.getPortfolioByWorker(id));
    }

    @DeleteMapping("/portfolio/{portfolioId}")
    public ResponseEntity<Void> deletePortfolioItem(@PathVariable Long portfolioId) {
        portfolioService.deletePortfolioItem(portfolioId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/internal/all")
    public ResponseEntity<List<WorkerProfileResponse>> getAllWorkersInternal() {
        return ResponseEntity.ok(workerService.getAllWorkersForAdmin());
    }

    @GetMapping("/internal/active-count")
    public ResponseEntity<Map<String, Integer>> getActiveWorkerCount() {
        int count = workerService.getActiveWorkerCount();
        return ResponseEntity.ok(Map.of("activeWorkers", count));
    }

    /** ADMIN STATS (internal): how many workers hold an active PRO plan. */
    @GetMapping("/internal/pro-count")
    public ResponseEntity<Map<String, Long>> getProCount() {
        return ResponseEntity.ok(Map.of("proWorkers", workerService.activeProCount()));
    }
}