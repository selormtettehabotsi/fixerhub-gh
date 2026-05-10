package com.fixerhub.worker.repository;

import com.fixerhub.worker.model.Worker;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface WorkerRepository extends JpaRepository<Worker, Long> {
    List<Worker> findBySkill(String skill);
    List<Worker> findByAvailable(Boolean available);
    List<Worker> findByLocation(String location);
}
