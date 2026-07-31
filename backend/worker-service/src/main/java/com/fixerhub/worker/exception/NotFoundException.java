package com.fixerhub.worker.exception;

/**
 * Thrown when a worker record doesn't exist, OR exists but isn't publicly
 * visible yet (KYC not approved). Both cases return the same 404 on purpose:
 * a distinct "exists but unverified" response would let anyone enumerate
 * pending workers by walking IDs.
 */
public class NotFoundException extends RuntimeException {
    public NotFoundException(String message) {
        super(message);
    }
}
