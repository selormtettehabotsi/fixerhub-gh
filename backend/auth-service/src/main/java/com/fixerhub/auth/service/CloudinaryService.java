package com.fixerhub.auth.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@Slf4j
@Service
public class CloudinaryService {

    @Value("${cloudinary.cloud-name}")
    private String cloudName;

    @Value("${cloudinary.api-key}")
    private String apiKey;

    @Value("${cloudinary.api-secret}")
    private String apiSecret;

    public String uploadFile(MultipartFile file, String folder) {
        try {
            Cloudinary cloudinary = new Cloudinary(ObjectUtils.asMap(
                    "cloud_name", cloudName,
                    "api_key", apiKey,
                    "api_secret", apiSecret
            ));

            // SECURITY (N5): KYC documents (ID cards, headshots) must never be
            // publicly fetchable. Anything uploaded into a "kyc*" folder is stored
            // with Cloudinary's "authenticated" delivery type — the plain URL
            // returns 401 — and we hand back a signed delivery URL instead, which
            // is unguessable and only ever exposed to the owning worker and admins.
            boolean sensitive = folder != null && folder.startsWith("kyc");

            // "auto" detects image vs video automatically — required for booking video uploads
            Map<String, Object> options = ObjectUtils.asMap(
                    "folder", folder,
                    "resource_type", "auto"
            );
            if (sensitive) {
                options.put("type", "authenticated");
            }

            Map<?, ?> result = cloudinary.uploader().upload(file.getBytes(), options);

            if (sensitive) {
                String publicId = (String) result.get("public_id");
                String format = (String) result.get("format");
                String resourceType = (String) result.get("resource_type");
                return cloudinary.url()
                        .resourceType(resourceType != null ? resourceType : "image")
                        .type("authenticated")
                        .secure(true)
                        .signed(true)
                        .generate(format != null ? publicId + "." + format : publicId);
            }

            return (String) result.get("secure_url");
        } catch (Exception e) {
            log.error("Cloudinary upload failed: {}", e.getMessage());
            throw new RuntimeException("Failed to upload file: " + e.getMessage());
        }
    }
}
