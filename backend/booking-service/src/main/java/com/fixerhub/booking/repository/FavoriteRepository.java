package com.fixerhub.booking.repository;

import com.fixerhub.booking.model.Favorite;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface FavoriteRepository extends JpaRepository<Favorite, Long> {
    List<Favorite> findByCustomerUserIdOrderByIdDesc(Long customerUserId);
    boolean existsByCustomerUserIdAndWorkerId(Long customerUserId, Long workerId);

    @Transactional
    void deleteByCustomerUserIdAndWorkerId(Long customerUserId, Long workerId);
}
