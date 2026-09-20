"use client";

import { useEffect } from "react";
import { useAuth } from "@/shared/lib/use-auth";
import { identifyUser } from "@/shared/lib/umami";

export function UmamiIdentity() {
  const { userId } = useAuth();

  useEffect(() => {
    if (userId) identifyUser(userId);
  }, [userId]);

  return null;
}
