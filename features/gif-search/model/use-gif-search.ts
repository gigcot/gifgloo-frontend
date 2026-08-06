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
    if (!query) {
      setResults([]);
      setError(false);
      setLoading(false);
      setLoadingMore(false);
      setHasMore(false);
      setPage(1);
      return;
    }

    setLoading(true);
    setError(false);
    const timer = setTimeout(() => {
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

  return { results, loading, loadingMore, error, hasMore, loadMore };
}
