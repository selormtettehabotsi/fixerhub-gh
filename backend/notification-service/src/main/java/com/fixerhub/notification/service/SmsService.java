package com.fixerhub.notification.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class SmsService {

    /**
     * Stub for SMS sending via Hubtel or Twilio.
     * Replace with actual API calls using your SMS provider credentials.
     */
    public void sendSms(String phoneNumber, String message) {
        log.info("SMS -> {} : {}", phoneNumber, message);
        // TODO: Integrate Hubtel SMS API or Twilio here
    }
}
