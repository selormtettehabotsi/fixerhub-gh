package com.fixerhub.booking.repository;

import com.fixerhub.booking.model.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    /** Legacy: lookup by bookingId */
    List<ChatMessage> findByBookingIdOrderByTimestampAsc(Long bookingId);

    /** New: lookup by customer-worker conversation key */
    List<ChatMessage> findByConversationIdOrderByTimestampAsc(String conversationId);

    /** UNREAD BADGES: messages from the other party newer than the caller's last-read mark. */
    long countByConversationIdAndTimestampGreaterThanAndSenderIdNot(
            String conversationId, Long timestamp, String senderId);
}
