package com.fixerhub.booking.controller;

import com.fixerhub.booking.config.AuthContext;
import com.fixerhub.booking.model.Favorite;
import com.fixerhub.booking.repository.FavoriteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/** RETENTION: customer favorites ("Your workers") for one-tap rebooking. */
@RestController
@RequestMapping("/favorites")
@RequiredArgsConstructor
public class FavoriteController {

    private final FavoriteRepository favoriteRepository;

    private static Long callerId() {
        Long id = AuthContext.userId();
        if (id == null) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Missing user identity");
        return id;
    }

    /** The caller's favorite worker profile ids (newest first). */
    @GetMapping
    public ResponseEntity<List<Long>> myFavorites() {
        return ResponseEntity.ok(favoriteRepository.findByCustomerUserIdOrderByIdDesc(callerId())
                .stream().map(Favorite::getWorkerId).toList());
    }

    /** Add a favorite (idempotent). */
    @PostMapping("/{workerId}")
    public ResponseEntity<Void> add(@PathVariable Long workerId) {
        Long me = callerId();
        if (!favoriteRepository.existsByCustomerUserIdAndWorkerId(me, workerId)) {
            favoriteRepository.save(Favorite.builder().customerUserId(me).workerId(workerId).build());
        }
        return ResponseEntity.ok().build();
    }

    /** Remove a favorite (idempotent). */
    @DeleteMapping("/{workerId}")
    public ResponseEntity<Void> remove(@PathVariable Long workerId) {
        favoriteRepository.deleteByCustomerUserIdAndWorkerId(callerId(), workerId);
        return ResponseEntity.noContent().build();
    }
}
