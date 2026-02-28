-- Admin Dashboard RPCs (cross-tenant aggregation)
-- These functions use SECURITY DEFINER and are only accessible via service_role

-- Signups grouped by month
CREATE OR REPLACE FUNCTION admin_signups_by_month(months_back INTEGER DEFAULT 12)
RETURNS TABLE(month TEXT, count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    to_char(date_trunc('month', c.created_at), 'YYYY-MM') AS month,
    COUNT(*)::BIGINT AS count
  FROM condos c
  WHERE c.created_at >= date_trunc('month', NOW()) - (months_back || ' months')::INTERVAL
  GROUP BY date_trunc('month', c.created_at)
  ORDER BY date_trunc('month', c.created_at);
END;
$$;

-- Revenue from PAID invoices grouped by month
CREATE OR REPLACE FUNCTION admin_revenue_by_month(months_back INTEGER DEFAULT 12)
RETURNS TABLE(month TEXT, total NUMERIC, count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    to_char(date_trunc('month', i.paid_at), 'YYYY-MM') AS month,
    COALESCE(SUM(i.amount), 0)::NUMERIC AS total,
    COUNT(*)::BIGINT AS count
  FROM invoices i
  WHERE i.status = 'PAID'
    AND i.paid_at >= date_trunc('month', NOW()) - (months_back || ' months')::INTERVAL
  GROUP BY date_trunc('month', i.paid_at)
  ORDER BY date_trunc('month', i.paid_at);
END;
$$;

-- Revoke public access, only service_role can call these
REVOKE ALL ON FUNCTION admin_signups_by_month(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_revenue_by_month(INTEGER) FROM PUBLIC;
