
CREATE OR REPLACE FUNCTION public.track_guest_order(
  p_order_number text,
  p_phone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_phone text;
BEGIN
  -- Nettoyer le téléphone saisi.
  v_phone := regexp_replace(
    COALESCE(p_phone, ''),
    '[^0-9]',
    '',
    'g'
  );

  IF COALESCE(trim(p_order_number), '') = ''
     OR length(v_phone) < 8 THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'order_number', o.order_number,
    'status', o.status,
    'payment_status', o.payment_status,
    'payment_method', o.payment_method,
    'subtotal', o.subtotal,
    'shipping_amount', o.shipping_amount,
    'discount_amount', o.discount_amount,
    'total', o.total,
    'created_at', o.created_at,
    'items', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'product_name', oi.product_name,
            'variant_label', oi.variant_label,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'total', oi.total
          )
        ),
        '[]'::jsonb
      )
      FROM public.order_items oi
      WHERE oi.order_id = o.id
    )
  )
  INTO v_result
  FROM public.orders o
  WHERE lower(trim(o.order_number::text))
        = lower(trim(p_order_number))
    AND regexp_replace(
          COALESCE(o.shipping_address->>'phone', ''),
          '[^0-9]',
          '',
          'g'
        ) = v_phone
  LIMIT 1;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.track_guest_order(text, text)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.track_guest_order(text, text)
TO anon, authenticated;
