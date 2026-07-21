package com.fixerhub.booking.controller;

import com.fixerhub.booking.config.AuthContext;
import com.fixerhub.booking.model.ChatMessage;
import com.fixerhub.booking.repository.ChatMessageRepository;
import com.fixerhub.booking.service.BookingAccessGuard;
import com.fixerhub.booking.service.WsAccessGuard;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.List;

@RestController
@RequiredArgsConstructor
public class ChatController {

    private final ChatMessageRepository chatMessageRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final WsAccessGuard wsAccessGuard;
    private final BookingAccessGuard bookingAccessGuard;
    private final org.springframework.web.client.RestTemplate loadBalancedRestTemplate;

    // ─── Persistent customer↔worker conversation room ────────────────────────

    /** WebSocket handler for room-based chat: destination /app/chat/room/{conversationId}
     *  conversationId format: "c{customerId}_w{workerId}"
     *  SECURITY (N1): access is enforced by WebSocketAuthInterceptor; senderId
     *  comes from the authenticated principal, never from the client payload. */
    @MessageMapping("/chat/room/{conversationId}")
    public void handleRoomMessage(@DestinationVariable String conversationId,
                                  ChatMessageRequest request,
                                  Principal principal) {
        ChatMessage message = ChatMessage.builder()
                .conversationId(conversationId)
                .senderId(principal.getName())          // authenticated userId (N1)
                .senderName(request.getSenderName())    // display name only — cosmetic
                .text(request.getText())
                .audioUrl(request.getAudioUrl())        // VOICE MESSAGES
                .read(false)                            // READ RECEIPTS
                .timestamp(System.currentTimeMillis())
                .build();
        try {
            message = chatMessageRepository.save(message);
        } catch (Exception e) {
            // Broadcast without persisting so real-time delivery still works
        }
        messagingTemplate.convertAndSend("/topic/chat/room/" + conversationId, message);
    }

    /** Full conversation history — participants only (N1). */
    @GetMapping("/chat/room/{conversationId}/history")
    public ResponseEntity<List<ChatMessage>> getRoomHistory(@PathVariable String conversationId) {
        String role = AuthContext.isAdmin() ? "ADMIN" : "USER";
        if (!wsAccessGuard.canAccessConversation(AuthContext.userId(), role, conversationId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not part of this conversation");
        }
        try {
            return ResponseEntity.ok(
                    chatMessageRepository.findByConversationIdOrderByTimestampAsc(conversationId));
        } catch (Exception e) {
            return ResponseEntity.ok(List.of());
        }
    }

    /**
     * READ RECEIPTS: caller marks every message the OTHER party sent in this
     * conversation as read. A receipt frame is broadcast on the room topic so
     * the sender's ✓ flips to ✓✓ live.
     */
    @org.springframework.web.bind.annotation.PutMapping("/chat/room/{conversationId}/read")
    public ResponseEntity<java.util.Map<String, Object>> markRead(@PathVariable String conversationId) {
        String role = AuthContext.isAdmin() ? "ADMIN" : "USER";
        Long userId = AuthContext.userId();
        if (!wsAccessGuard.canAccessConversation(userId, role, conversationId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not part of this conversation");
        }
        String me = String.valueOf(userId);
        int flipped = chatMessageRepository.markConversationRead(conversationId, me);
        if (flipped > 0) {
            messagingTemplate.convertAndSend("/topic/chat/room/" + conversationId,
                    java.util.Map.of("receipt", "READ", "readerId", me, "conversationId", conversationId));
        }
        return ResponseEntity.ok(java.util.Map.of("marked", flipped));
    }

    /**
     * CHAT HEADER: the other participant's display info — name, picture and
     * phone (for the in-header call button). Participants only.
     * conversationId format: "c{customerUserId}_w{workerProfileId}".
     */
    @GetMapping("/chat/room/{conversationId}/peer")
    @SuppressWarnings("unchecked")
    public ResponseEntity<java.util.Map<String, Object>> peerInfo(@PathVariable String conversationId) {
        String role = AuthContext.isAdmin() ? "ADMIN" : "USER";
        Long userId = AuthContext.userId();
        if (!wsAccessGuard.canAccessConversation(userId, role, conversationId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not part of this conversation");
        }
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("^c(\\d+)_w(\\d+)$").matcher(conversationId);
        if (!m.matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bad conversation id");
        }
        long customerUserId = Long.parseLong(m.group(1));
        long workerProfileId = Long.parseLong(m.group(2));
        java.util.Map<String, Object> peer = new java.util.HashMap<>();
        try {
            if (userId == customerUserId) {
                // Caller is the customer → peer is the worker (full internal record has phone)
                java.util.Map<String, Object> w = loadBalancedRestTemplate.getForObject(
                        "http://worker-service/workers/internal/" + workerProfileId, java.util.Map.class);
                if (w != null) {
                    peer.put("name", w.get("name"));
                    peer.put("phone", w.get("phone"));
                    peer.put("profilePicture", w.get("profilePicture"));
                }
            } else {
                // Caller is the worker → peer is the customer
                java.util.Map<String, Object> u = loadBalancedRestTemplate.getForObject(
                        "http://auth-service/auth/internal/users/" + customerUserId + "/contact", java.util.Map.class);
                if (u != null) peer.putAll(u);
            }
        } catch (Exception e) {
            // best effort — the header falls back to the name from messages
        }
        return ResponseEntity.ok(peer);
    }

    /**
     * UNREAD BADGES: batch unread counts for the chat list screens.
     * Body: { "conversations": [ { "conversationId": "c1_w2", "since": 1720000000000 }, … ] }
     * Returns { "c1_w2": 3, … } — only conversations the caller participates in.
     */
    @org.springframework.web.bind.annotation.PostMapping("/chat/unread-counts")
    public ResponseEntity<java.util.Map<String, Long>> unreadCounts(
            @org.springframework.web.bind.annotation.RequestBody UnreadCountsRequest request) {
        String role = AuthContext.isAdmin() ? "ADMIN" : "USER";
        Long userId = AuthContext.userId();
        String me = String.valueOf(userId);
        java.util.Map<String, Long> counts = new java.util.HashMap<>();
        if (request.getConversations() != null) {
            for (UnreadQuery q : request.getConversations()) {
                if (q.getConversationId() == null) continue;
                if (!wsAccessGuard.canAccessConversation(userId, role, q.getConversationId())) continue;
                long since = q.getSince() != null ? q.getSince() : 0L;
                counts.put(q.getConversationId(),
                        chatMessageRepository.countByConversationIdAndTimestampGreaterThanAndSenderIdNot(
                                q.getConversationId(), since, me));
            }
        }
        return ResponseEntity.ok(counts);
    }

    @Data
    public static class UnreadCountsRequest {
        private List<UnreadQuery> conversations;
    }

    @Data
    public static class UnreadQuery {
        private String conversationId;
        private Long since;
    }

    // ─── Legacy: per-booking room (kept for backward compat) ─────────────────

    @MessageMapping("/chat/{bookingId}")
    public void handleMessage(@DestinationVariable Long bookingId,
                              ChatMessageRequest request,
                              Principal principal) {
        ChatMessage message = ChatMessage.builder()
                .bookingId(bookingId)
                .senderId(principal.getName())          // authenticated userId (N1)
                .senderName(request.getSenderName())
                .text(request.getText())
                .timestamp(System.currentTimeMillis())
                .build();
        ChatMessage saved = chatMessageRepository.save(message);
        messagingTemplate.convertAndSend("/topic/chat/" + bookingId, saved);
    }

    @GetMapping("/chat/{bookingId}/history")
    public ResponseEntity<List<ChatMessage>> getHistory(@PathVariable Long bookingId) {
        bookingAccessGuard.assertParticipant(bookingId);   // N1: participants only
        return ResponseEntity.ok(chatMessageRepository.findByBookingIdOrderByTimestampAsc(bookingId));
    }

    @Data
    public static class ChatMessageRequest {
        private String senderId;   // ignored — kept for payload compat
        private String senderName;
        private String text;
        /** VOICE MESSAGES: Cloudinary URL of the uploaded clip. */
        private String audioUrl;
    }
}
