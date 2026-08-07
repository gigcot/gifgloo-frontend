"use client";

import { useState, useEffect, useCallback } from "react";
import type { Gif } from "@/entities/gif/model";
import { fetchSearchPage } from "@/shared/api/klipy";

type UseGifSearchResult = {
  results: Gif[];
  loading: boolean;
  loadingMore: boolean;
  error: boolean;
  hasMore: boolean;
  loadMore: () => void;
};

export function useGifSearch(query: string): UseGifSearchResult {
  const [results, setResults] = useState<Gif[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (!query) return;

    const timer = setTimeout(() => {
      setLoading(true);
      setError(false);
      fetchSearchPage(query, 1)
        .then((result) => {
          setResults(result.items);
          setPage(result.currentPage);
          setHasMore(result.hasNext);
        })
        .catch(() => {
          setResults([]);
          setError(true);
          setHasMore(false);
        })
        .finally(() => setLoading(false));
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  const loadMore = useCallback(() => {
    if (!query || loading || loadingMore || !hasMore) return;

    const nextPage = page + 1;
    setLoadingMore(true);
    setError(false);
    fetchSearchPage(query, nextPage)
      .then((result) => {
        setResults((prev) => [...prev, ...result.items]);
        setPage(result.currentPage);
        setHasMore(result.hasNext);
      })
      .catch(() => setError(true))
      .finally(() => setLoadingMore(false));
  }, [hasMore, loading, loadingMore, page, query]);

  if (!query) {
    return {
      results: [],
      loading: false,
      loadingMore: false,
      error: false,
      hasMore: false,
      loadMore,
    };
  }

  return { results, loading, loadingMore, error, hasMore, loadMore };
}
