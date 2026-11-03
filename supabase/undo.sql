-- Takes the Testing and Feedback Kit out of a Supabase database again: its tables, functions and storage rules.
-- Every ticket, comment and history line is lost. Files stay in the bucket until you empty and delete the bucket
-- feedback-files in the Supabase dashboard (Storage), which this file cannot do for you.
-- Run it in the SQL editor, or with psql. It is one transaction: either all of it happens or none of it.

begin;

drop policy if exists "feedback-files: the list reads" on storage.objects;
drop policy if exists "feedback-files: the list adds to a ticket's folder" on storage.objects;

drop function if exists public.feedback_remove_member(text);
drop function if exists public.feedback_add_member(text, text, text);
drop function if exists public.feedback_mark_all_read();
drop function if exists public.feedback_mark_read(uuid);
drop function if exists public.feedback_my_notices();
drop function if exists public.feedback_add_file(uuid, text, text);
drop function if exists public.feedback_folder_ticket(text);
drop function if exists public.feedback_comment(uuid, text);
drop function if exists public.feedback_move(uuid, text, text);
drop function if exists public.feedback_edit(uuid, jsonb);
drop function if exists public.feedback_file(jsonb);
drop function if exists public.feedback_kind_word(text);
drop function if exists public.feedback_status_word(text);
drop function if exists public.feedback_whoami();

drop table if exists public.feedback_notices;
drop table if exists public.feedback_events;
drop table if exists public.feedback_files;
drop table if exists public.feedback_comments;
drop table if exists public.feedback_tickets;
drop table if exists public.feedback_members;

drop function if exists public.feedback_role();
drop function if exists public.feedback_email();

commit;
