package com.fixerhub.booking.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "chat_messages")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Legacy: per-booking room key (kept for backward compat) */
    private Long bookingId;

    /** New: persistent customer↔worker conversation key — "c{customerId}_w{workerId}" */
    private String conversationId;

    private String senderId;
    private String senderName;
    private String text;

    /** VOICE MESSAGES: Cloudinary URL of a recorded audio clip (text may be empty). */
    private String audioUrl;

    /** READ RECEIPTS: true once the other participant has opened the conversation.
     *  NOT NULL column — defaulted so no code path can ever insert null. */
    @Builder.Default
    @Column(name = "is_read", nullable = false)
    private Boolean read = false;

    private Long timestamp;

    @PrePersist
    protected void onCreate() {
        if (read == null) read = false;   // NOT NULL column safety net
    }
}
