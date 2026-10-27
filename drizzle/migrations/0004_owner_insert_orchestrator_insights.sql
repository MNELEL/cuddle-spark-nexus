CREATE POLICY owner_insert_insights
ON public.orchestrator_insights
FOR INSERT
TO authenticated
WITH CHECK (
  owner_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.classes AS owned_class
    WHERE owned_class.id = orchestrator_insights.class_id
      AND owned_class.owner_id = (SELECT auth.uid())
  )
);