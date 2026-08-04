-- =========================================================================
-- V043 -- POS Apotik sebagai layar kasir terpisah
--
-- Mesin transaksinya tetap POS yang sama, tetapi apotik membutuhkan layar
-- berbeda: resep dokter, racikan, batch-expiry, high-alert, dan obat terkendali
-- tidak boleh tenggelam di pola kasir retail umum.
-- =========================================================================

DO $$
DECLARE
  pos_parent_id UUID;
  menu_id UUID;
  action_id UUID;
  action_code TEXT;
BEGIN
  SELECT id INTO pos_parent_id
    FROM "{{TENANT_SCHEMA}}".menu
   WHERE code = 'POS' AND deleted_at IS NULL;

  IF pos_parent_id IS NULL THEN
    RAISE EXCEPTION 'Menu POS belum ada; V043 menuntut seed POS lebih dahulu.';
  END IF;

  INSERT INTO "{{TENANT_SCHEMA}}".menu
    (code, parent_id, name, translation_key, route, icon, module_code,
     platform_target, path, level, is_coming_soon, is_system, sort_order)
  VALUES
    ('POS_PHARMACY', pos_parent_id, 'POS Apotik', 'menu.pos.pharmacy',
     '/app/apotik/pos', 'pill', 'POS', 'WEB', '/POS/POS_PHARMACY', 1,
     FALSE, TRUE, 2)
  ON CONFLICT DO NOTHING;

  SELECT id INTO menu_id
    FROM "{{TENANT_SCHEMA}}".menu
   WHERE code = 'POS_PHARMACY' AND deleted_at IS NULL;

  UPDATE "{{TENANT_SCHEMA}}".menu
     SET sort_order = sort_order + 1,
         updated_at = now()
   WHERE parent_id = pos_parent_id
     AND code NOT IN ('POS_SALE', 'POS_PHARMACY')
     AND sort_order >= 2
     AND deleted_at IS NULL;

  FOREACH action_code IN ARRAY ARRAY[
    'READ', 'CREATE', 'UPDATE', 'DELETE', 'PRINT',
    'SELL', 'HOLD', 'RESUME',
    'DISCOUNT_LINE', 'DISCOUNT_CART', 'PRICE_OVERRIDE',
    'APPROVE', 'REJECT',
    'VIEW_AMOUNT', 'VIEW_COST'
  ]
  LOOP
    SELECT id INTO action_id
      FROM "{{TENANT_SCHEMA}}".permission_action
     WHERE code = action_code AND deleted_at IS NULL;

    IF action_id IS NULL THEN
      RAISE EXCEPTION 'Aksi POS % tidak ditemukan; jangan lewati diam-diam.', action_code;
    END IF;

    INSERT INTO "{{TENANT_SCHEMA}}".menu_action (menu_id, permission_action_id)
    VALUES (menu_id, action_id)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
