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
    private Long timestamp;
}
