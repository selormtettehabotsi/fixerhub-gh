package com.fixerhub.payment.exception;

/** ERRORS (H5): typed exception mapped to a proper 4xx status by GlobalExceptionHandler. */
public class UnauthorizedException extends RuntimeException {
    public UnauthorizedException(String message) {
        super(message);
    }
}
