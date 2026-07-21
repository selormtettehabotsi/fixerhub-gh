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

    /** READ RECEIPTS: mark everything the other party sent as read. Returns #rows flipped. */
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query(
            "UPDATE ChatMessage m SET m.read = true " +
            "WHERE m.conversationId = :conversationId AND m.senderId <> :readerId " +
            "AND (m.read = false OR m.read IS NULL)")
    int markConversationRead(
            @org.springframework.data.repository.query.Param("conversationId") String conversationId,
            @org.springframework.data.repository.query.Param("readerId") String readerId);
}
