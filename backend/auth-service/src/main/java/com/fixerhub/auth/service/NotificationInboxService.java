package com.fixerhub.auth.service;

import com.fixerhub.auth.exception.NotFoundException;
import com.fixerhub.auth.exception.UnauthorizedException;
import com.fixerhub.auth.model.Notification;
import com.fixerhub.auth.model.User;
import com.fixerhub.auth.repository.NotificationRepository;
import com.fixerhub.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/**
 * NOTIFICATION CENTER: stores + serves the in-app notification history.
 * notification-service records entries via the internal endpoint; the app
 * reads them through the authenticated /auth/notifications endpoints.
 */
@Service
@RequiredArgsConstructor
public class NotificationInboxService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    /** Internal (service-to-service): record a notification for a user. */
    public void record(Long userId, String title, String body, String type, Long bookingId) {
        if (userId == null) return;
        notificationRepository.save(Notification.builder()
                .userId(userId)
                .title(title)
                .body(body)
                .type(type == null ? "SYSTEM" : type)
                .bookingId(bookingId)
                .read(false)
                .build());
    }

    public List<Notification> list(String email, int page, int size) {
        Long userId = userIdFor(email);
        return notificationRepository.findByUserIdOrderByIdDesc(
                userId, PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 100)));
    }

    public Map<String, Long> unreadCount(String email) {
        return Map.of("unread", notificationRepository.countByUserIdAndReadFalse(userIdFor(email)));
    }

    @Transactional
    public void markRead(String email, Long notificationId) {
        Long userId = userIdFor(email);
        Notification n = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new NotFoundException("Notification not found"));
        if (!userId.equals(n.getUserId())) {
            throw new UnauthorizedException("Not your notification");
        }
        n.setRead(true);
        notificationRepository.save(n);
    }

    @Transactional
    public void markAllRead(String email) {
        notificationRepository.markAllRead(userIdFor(email));
    }

    private Long userIdFor(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new NotFoundException("User not found"));
        return user.getId();
    }
}
