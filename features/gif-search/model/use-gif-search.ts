"use client";

import { useState, useEffect } from "react";
import type { Gif } from "@/entities/gif/model";
import { fetchSearch } from "@/shared/api/klipy";

type UseGifSearchResult = {
  results: Gif[];
  loading: boolean;
  error: boolean;
};

export function useGifSearch(query: string): UseGifSearchResult {
  const [results, setResults] = useState<Gif[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!query) {
      setResults([]);
      setError(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(false);
    const timer = setTimeout(() => {
      fetchSearch(query)
        .then(setResults)
        .catch(() => {
          setResults([]);
          setError(true);
        })
        .finally(() => setLoading(false));
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  return { results, loading, error };
}
