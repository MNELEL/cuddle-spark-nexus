-- Gamification: campaigns, rewards catalog, redemptions

CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  prize TEXT NOT NULL DEFAULT '',
  target_points INTEGER NOT NULL DEFAULT 100,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY campaigns_owner_all ON public.campaigns FOR ALL
  USING (EXISTS (SELECT 1 FROM classes c WHERE c.id = campaigns.class_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM classes c WHERE c.id = campaigns.class_id AND c.owner_id = auth.uid()));

CREATE TABLE public.rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  points_cost INTEGER NOT NULL DEFAULT 10,
  stock INTEGER,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rewards TO authenticated;
GRANT ALL ON public.rewards TO service_role;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY rewards_owner_all ON public.rewards FOR ALL
  USING (EXISTS (SELECT 1 FROM classes c WHERE c.id = rewards.class_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM classes c WHERE c.id = rewards.class_id AND c.owner_id = auth.uid()));

CREATE TABLE public.reward_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL,
  student_id UUID NOT NULL,
  reward_id UUID,
  campaign_id UUID,
  prize_name TEXT NOT NULL DEFAULT '',
  points_spent INTEGER NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reward_redemptions TO authenticated;
GRANT ALL ON public.reward_redemptions TO service_role;
ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY reward_redemptions_owner_all ON public.reward_redemptions FOR ALL
  USING (EXISTS (SELECT 1 FROM classes c WHERE c.id = reward_redemptions.class_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM classes c WHERE c.id = reward_redemptions.class_id AND c.owner_id = auth.uid()));

CREATE INDEX idx_campaigns_class ON public.campaigns(class_id);
CREATE INDEX idx_rewards_class ON public.rewards(class_id);
CREATE INDEX idx_redemptions_class_student ON public.reward_redemptions(class_id, student_id);