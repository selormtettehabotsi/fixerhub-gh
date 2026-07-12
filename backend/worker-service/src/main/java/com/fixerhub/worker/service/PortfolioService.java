package com.fixerhub.worker.service;

import com.fixerhub.worker.dto.PortfolioItemResponse;
import com.fixerhub.worker.model.WorkerPortfolio;
import com.fixerhub.worker.repository.WorkerPortfolioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PortfolioService {

    private final WorkerPortfolioRepository portfolioRepository;

    public PortfolioItemResponse addPortfolioItem(Long workerId, String imageUrl, String caption) {
        WorkerPortfolio item = WorkerPortfolio.builder()
                .workerId(workerId).imageUrl(imageUrl).caption(caption).build();
        return toResponse(portfolioRepository.save(item));
    }

    public List<PortfolioItemResponse> getPortfolioByWorker(Long workerId) {
        return portfolioRepository.findByWorkerIdOrderByCreatedAtDesc(workerId)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    public void deletePortfolioItem(Long portfolioId) {
        portfolioRepository.deleteById(portfolioId);
    }

    private PortfolioItemResponse toResponse(WorkerPortfolio item) {
        return PortfolioItemResponse.builder()
                .id(item.getId()).workerId(item.getWorkerId())
                .imageUrl(item.getImageUrl()).caption(item.getCaption())
                .createdAt(item.getCreatedAt()).build();
    }
}
