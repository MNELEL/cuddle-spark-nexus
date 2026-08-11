REVOKE ALL ON TABLE
  public.app_security, public.attendance, public.behavior_points, public.brand_settings,
  public.bulletin_resources, public.campaigns, public.certificate_notes, public.checklist_leads,
  public.class_events, public.class_resource_usage, public.classes, public.custom_sounds,
  public.discipline_events, public.grade_weights, public.grades, public.groups,
  public.ingest_jobs, public.institution_staff, public.institutions, public.lesson_transcripts,
  public.parent_communications, public.parent_share_tokens, public.partner_leads, public.poll_votes,
  public.polls, public.profiles, public.reminder_preferences, public.reminders,
  public.resource_collection_items, public.resource_collections, public.reward_redemptions, public.rewards,
  public.seating_configs, public.sent_reminder_alerts, public.student_documents, public.student_groups,
  public.student_relations, public.teacher_style_profile, public.teaching_resources, public.topics,
  public.user_roles, public.weekly_bulletins, public.weekly_lessons
FROM anon;

-- public lead-capture forms post as the publishable (anon) role and are guarded
-- by INSERT-only policies; they keep insert access and nothing else.
GRANT INSERT ON public.checklist_leads TO anon;
GRANT INSERT ON public.partner_leads TO anon;