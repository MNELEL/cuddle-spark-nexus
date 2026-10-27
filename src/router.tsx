import { MutationCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient: QueryClient = new QueryClient({
    mutationCache: new MutationCache({
      // כל שינוי שנשמר מרענן את תצוגות מערכת השעות המשותפות, כדי שכל מסך יציג את אותה מערכת עדכנית
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ["schedule"] });
      },
    }),
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
