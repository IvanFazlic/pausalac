"use client";

import { useCallback, useState } from "react";

// Holds what a server action returned ({ error, fieldErrors }) for forms that
// keep their values in React state. A field's error disappears as soon as the
// user edits that field, instead of lingering until the next submit.
export function useFormResult() {
  const [result, setResult] = useState(null);

  const clearErrors = useCallback((prefix) => {
    setResult((current) => {
      if (!current?.fieldErrors) return current;
      const fieldErrors = Object.fromEntries(
        Object.entries(current.fieldErrors).filter(
          ([key]) => key !== prefix && !key.startsWith(`${prefix}.`)
        )
      );
      const remaining = Object.keys(fieldErrors).length > 0;
      return { ...current, fieldErrors, error: remaining ? current.error : null };
    });
  }, []);

  return { result, setResult, clearErrors, errors: result?.fieldErrors ?? {} };
}
