CREATE OR REPLACE FUNCTION public.get_db_usage_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  result jsonb;
  tables_arr jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'name', t.tablename,
      'size_bytes', pg_total_relation_size(format('%I.%I', t.schemaname, t.tablename)::regclass),
      'row_count', (SELECT n_live_tup FROM pg_stat_user_tables s WHERE s.schemaname = t.schemaname AND s.relname = t.tablename)
    )
    ORDER BY pg_total_relation_size(format('%I.%I', t.schemaname, t.tablename)::regclass) DESC
  )
  INTO tables_arr
  FROM pg_tables t
  WHERE t.schemaname = 'public';

  result := jsonb_build_object(
    'total_bytes', pg_database_size(current_database()),
    'tables', COALESCE(tables_arr, '[]'::jsonb)
  );
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_db_usage_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_db_usage_stats() TO service_role;