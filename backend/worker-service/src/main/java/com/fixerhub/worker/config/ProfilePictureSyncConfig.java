package com.fixerhub.worker.config;

import com.fixerhub.worker.model.Worker;
import com.fixerhub.worker.repository.WorkerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.cache.CacheManager;
import org.springframework.context.event.EventListener;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class ProfilePictureSyncConfig {

    private final WorkerRepository workerRepository;
    private final RestTemplate restTemplate;
    private final CacheManager cacheManager;

    /**
     * On startup, fetch all users from auth-service and backfill any worker
     * whose profilePicture column is null. This fixes workers who uploaded
     * their picture before the sync endpoint existed.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void syncMissingProfilePictures() {
        try {
            ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                    "http://auth-service/auth/internal/users",
                    HttpMethod.GET,
                    null,
                    new ParameterizedTypeReference<List<Map<String, Object>>>() {}
            );

            List<Map<String, Object>> users = response.getBody();
            if (users == null || users.isEmpty()) return;

            // Build a map: userId -> profilePicture (only WORKER users with a picture)
            Map<Long, String> pictures = users.stream()
                    .filter(u -> "WORKER".equals(u.get("role")))
                    .filter(u -> u.get("profilePicture") != null && !u.get("profilePicture").toString().isBlank())
                    .collect(Collectors.toMap(
                            u -> ((Number) u.get("id")).longValue(),
                            u -> u.get("profilePicture").toString()
                    ));

            if (pictures.isEmpty()) return;

            // Update any worker who has a null/blank profilePicture in our DB
            List<Worker> toUpdate = workerRepository.findAll().stream()
                    .filter(w -> w.getUserId() != null)
                    .filter(w -> (w.getProfilePicture() == null || w.getProfilePicture().isBlank()))
                    .filter(w -> pictures.containsKey(w.getUserId()))
                    .collect(Collectors.toList());

            for (Worker w : toUpdate) {
                w.setProfilePicture(pictures.get(w.getUserId()));
            }

            if (!toUpdate.isEmpty()) {
                workerRepository.saveAll(toUpdate);
                // Evict stale cache so the updated pictures are served immediately
                cacheManager.getCacheNames().forEach(name -> {
                    var cache = cacheManager.getCache(name);
                    if (cache != null) cache.clear();
                });
                log.info("Backfilled profile pictures for {} worker(s)", toUpdate.size());
            }

        } catch (Exception e) {
            log.warn("Could not sync profile pictures from auth-service on startup: {}", e.getMessage());
        }
    }
}
