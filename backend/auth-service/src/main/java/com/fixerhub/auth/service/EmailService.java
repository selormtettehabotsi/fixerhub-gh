package com.fixerhub.auth.service;

import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

/**
 * BRANDED EMAILS: HTML templates in FixerHub colors (burnt orange #a33900 on
 * warm surfaces) with a plain-text fallback for clients that block HTML.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username:}")
    private String fromAddress;

    /** VERIFICATION: email-ownership OTP. */
    public void sendVerificationOtp(String toEmail, String otp) {
        send(toEmail,
                "FixerHub Email Verification Code",
                "Verify your email",
                "Use this code to verify your email address on FixerHub.",
                otp);
    }

    /** PASSWORD RESET: OTP fallback when SMS is unavailable. */
    public void sendOtp(String toEmail, String otp) {
        send(toEmail,
                "FixerHub Password Reset OTP",
                "Reset your password",
                "Use this code to reset your FixerHub password.",
                otp);
    }

    private void send(String toEmail, String subject, String heading, String intro, String otp) {
        try {
            MimeMessage mime = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mime, true, "UTF-8");
            if (fromAddress != null && !fromAddress.isBlank()) {
                helper.setFrom(fromAddress, "FixerHub");
            }
            helper.setTo(toEmail);
            helper.setSubject(subject);

            String plain = heading + "\n\n" + intro + "\n\nYour code: " + otp
                    + "\n\nValid for 10 minutes. Do not share this code with anyone.";
            helper.setText(plain, buildHtml(heading, intro, otp));

            mailSender.send(mime);
            log.info("Email '{}' sent to {}", subject, toEmail);
        } catch (Exception e) {
            log.error("Failed to send email '{}' to {}: {}", subject, toEmail, e.getMessage());
            throw new RuntimeException("Failed to send email", e);
        }
    }

    /** Inline-styled HTML (email clients ignore <style> blocks — inline only). */
    private static String buildHtml(String heading, String intro, String otp) {
        return """
            <div style="margin:0;padding:24px;background-color:#f8f9fa;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
              <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2bfb2;">
                <div style="background:#a33900;padding:26px 32px;">
                  <div style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">FixerHub</div>
                  <div style="font-size:12.5px;color:#ffdbce;margin-top:2px;">Trusted hands for every fix, one tap away</div>
                </div>
                <div style="padding:30px 32px;">
                  <div style="font-size:19px;font-weight:700;color:#191c1d;margin-bottom:8px;">%s</div>
                  <div style="font-size:14px;color:#5a4138;line-height:1.6;margin-bottom:22px;">%s</div>
                  <div style="background:#ffdbce;border-radius:12px;padding:18px;text-align:center;margin-bottom:22px;">
                    <span style="font-size:32px;font-weight:800;letter-spacing:10px;color:#a33900;">%s</span>
                  </div>
                  <div style="font-size:13px;color:#5a4138;line-height:1.6;">
                    This code is valid for <b>10 minutes</b>.<br/>
                    Never share it with anyone &mdash; FixerHub will never ask you for it.
                  </div>
                </div>
                <div style="background:#f3f4f5;padding:16px 32px;font-size:11.5px;color:#8e7166;">
                  If you didn't request this code, you can safely ignore this email.<br/>
                  &copy; FixerHub &middot; Kumasi, Ghana
                </div>
              </div>
            </div>
            """.formatted(heading, intro, otp);
    }
}
