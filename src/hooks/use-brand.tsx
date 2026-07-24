import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBrand, EMPTY_BRAND, type BrandSettings } from "@/lib/brand.functions";

/** Loads the current teacher's institution brand (name/logo/etc.). */
export function useBrand(): { brand: BrandSettings; isLoading: boolean } {
  const fn = useServerFn(getBrand);
  const { data, isLoading } = useQuery({
    queryKey: ["brand-settings"],
    queryFn: () => fn(),
    staleTime: 5 * 60_000,
  });
  return { brand: data ?? EMPTY_BRAND, isLoading };
}
