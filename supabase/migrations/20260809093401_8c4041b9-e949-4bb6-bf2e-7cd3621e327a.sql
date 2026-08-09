grant execute on function private.is_institution_admin(uuid, uuid) to authenticated, service_role;
revoke execute on function private.is_institution_admin(uuid, uuid) from anon, public;