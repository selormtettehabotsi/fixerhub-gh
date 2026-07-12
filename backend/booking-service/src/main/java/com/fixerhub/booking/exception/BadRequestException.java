package com.fixerhub.booking.exception;

/** ERRORS (H5): typed exception mapped to a proper 4xx status by GlobalExceptionHandler. */
public class BadRequestException extends RuntimeException {
    public BadRequestException(String message) {
        super(message);
    }
}
