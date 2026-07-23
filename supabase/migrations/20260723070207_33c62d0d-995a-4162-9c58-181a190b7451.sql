CREATE OR REPLACE FUNCTION public.export_my_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
declare
  result jsonb;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select jsonb_build_object(
    'exported_at', now(),
    'classes', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from classes c where c.owner_id = uid),
    'students', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from students s join classes c on c.id = s.class_id where c.owner_id = uid),
    'grades', (select coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb) from grades g join classes c on c.id = g.class_id where c.owner_id = uid),
    'attendance', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from attendance a join classes c on c.id = a.class_id where c.owner_id = uid),
    'behavior_points', (select coalesce(jsonb_agg(to_jsonb(bp)), '[]'::jsonb) from behavior_points bp join classes c on c.id = bp.class_id where c.owner_id = uid),
    'discipline_events', (select coalesce(jsonb_agg(to_jsonb(de)), '[]'::jsonb) from discipline_events de join classes c on c.id = de.class_id where c.owner_id = uid),
    'rewards', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from rewards r join classes c on c.id = r.class_id where c.owner_id = uid),
    'reward_redemptions', (select coalesce(jsonb_agg(to_jsonb(rr)), '[]'::jsonb) from reward_redemptions rr join classes c on c.id = rr.class_id where c.owner_id = uid),
    'campaigns', (select coalesce(jsonb_agg(to_jsonb(cm)), '[]'::jsonb) from campaigns cm join classes c on c.id = cm.class_id where c.owner_id = uid),
    'parent_communications', (select coalesce(jsonb_agg(to_jsonb(pc)), '[]'::jsonb) from parent_communications pc join students s on s.id = pc.student_id join classes c on c.id = s.class_id where c.owner_id = uid),
    'student_documents', (select coalesce(jsonb_agg(to_jsonb(sd)), '[]'::jsonb) from student_documents sd join students s on s.id = sd.student_id join classes c on c.id = s.class_id where c.owner_id = uid),
    'teaching_resources', (select coalesce(jsonb_agg(to_jsonb(tr)), '[]'::jsonb) from teaching_resources tr where tr.owner_id = uid),
    'resource_collections', (select coalesce(jsonb_agg(to_jsonb(rc)), '[]'::jsonb) from resource_collections rc where rc.owner_id = uid),
    'resource_collection_items', (select coalesce(jsonb_agg(to_jsonb(rci)), '[]'::jsonb) from resource_collection_items rci join resource_collections rc on rc.id = rci.collection_id where rc.owner_id = uid),
    'weekly_bulletins', (select coalesce(jsonb_agg(to_jsonb(wb)), '[]'::jsonb) from weekly_bulletins wb join classes c on c.id = wb.class_id where c.owner_id = uid),
    'seating_configs', (select coalesce(jsonb_agg(to_jsonb(sc)), '[]'::jsonb) from seating_configs sc join classes c on c.id = sc.class_id where c.owner_id = uid),
    'groups', (select coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb) from groups g join classes c on c.id = g.class_id where c.owner_id = uid),
    'student_groups', (select coalesce(jsonb_agg(to_jsonb(sg)), '[]'::jsonb) from student_groups sg join groups g on g.id = sg.group_id join classes c on c.id = g.class_id where c.owner_id = uid),
    'student_relations', (select coalesce(jsonb_agg(to_jsonb(sr)), '[]'::jsonb) from student_relations sr join students s on s.id = sr.student_id join classes c on c.id = s.class_id where c.owner_id = uid),
    'teacher_style_profile', (select coalesce(jsonb_agg(to_jsonb(tsp)), '[]'::jsonb) from teacher_style_profile tsp where tsp.user_id = uid),
    'reminders', (select coalesce(jsonb_agg(to_jsonb(rm)), '[]'::jsonb) from reminders rm left join classes c on c.id = rm.class_id where c.owner_id = uid)
  ) into result;

  return result;
end;
$function$;