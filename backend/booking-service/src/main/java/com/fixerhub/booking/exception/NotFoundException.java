package com.fixerhub.booking.exception;

/** ERRORS (H5): typed exception mapped to a proper 4xx status by GlobalExceptionHandler. */
public class NotFoundException extends RuntimeException {
    public NotFoundException(String message) {
        super(message);
    }
}
