package com.fixerhub.auth.config;

import com.fixerhub.auth.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/** M5: the refresh_tokens table would otherwise grow forever — purge daily. */
@Slf4j
@Component
@EnableScheduling
@RequiredArgsConstructor
public class TokenCleanupJob {

    private final RefreshTokenRepository refreshTokenRepository;

    @Scheduled(cron = "0 30 3 * * *") // 03:30 daily
    @Transactional
    public void purgeDeadTokens() {
        int removed = refreshTokenRepository.purgeExpiredAndRevoked(LocalDateTime.now());
        if (removed > 0) log.info("TokenCleanup: purged {} expired/revoked refresh tokens", removed);
    }
}
