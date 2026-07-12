package com.fixerhub.auth.repository;

import com.fixerhub.auth.model.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    Optional<RefreshToken> findByToken(String token);

    /** Revokes every active refresh token for a user (logout-all / password reset). */
    @Modifying
    @Query("UPDATE RefreshToken rt SET rt.revoked = true WHERE rt.userId = :userId AND rt.revoked = false")
    void revokeAllForUser(@Param("userId") Long userId);

    /** M5: daily housekeeping — dead rows have no security value. */
    @Modifying
    @Query("DELETE FROM RefreshToken rt WHERE rt.revoked = true OR rt.expiresAt < :now")
    int purgeExpiredAndRevoked(@Param("now") java.time.LocalDateTime now);
}
