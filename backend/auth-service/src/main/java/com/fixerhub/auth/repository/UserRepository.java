package com.fixerhub.auth.repository;

import com.fixerhub.auth.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    Optional<User> findByPhone(String phone);
    Optional<User> findByReferralCode(String referralCode);

    /** ADMIN STATS: users who signed up with someone's referral code. */
    long countByReferredByIsNotNull();

    /** REFERRALS: how many people signed up using THIS user's code. */
    long countByReferredBy(Long referrerId);

    /** ADMIN STATS: referrals that converted (invitee made a first payment). */
    @org.springframework.data.jpa.repository.Query(
            "SELECT COALESCE(SUM(u.referralCount), 0) FROM User u")
    long totalCreditedReferrals();
}
