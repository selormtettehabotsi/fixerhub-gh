package com.fixerhub.worker.model;

public enum VerificationStatus {
    NONE,               // No documents submitted yet
    PENDING,            // Documents submitted, awaiting admin review
    APPROVED,           // Admin approved — worker is verified
    DECLINED,           // Admin rejected the documents
    RESUBMIT_REQUESTED  // Admin asked for clearer photos
}
