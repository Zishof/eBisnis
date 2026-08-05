-- =========================================================================
-- H070 -- TRANSAKSI APOTIK: POS, RESEP, RACIKAN, DAN PRODUKSI
-- =========================================================================
-- Mesin uang, stok, harga, dan jurnal tetap POS/Inventory. Tabel di bawah
-- hanya menyimpan hal yang tidak dikenal kasir retail: resep yang menaungi
-- transaksi, formula racikan, etiket, serta snapshot komponennya.

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".rx_pos_sale_context (
  pos_sale_id          UUID PRIMARY KEY REFERENCES "{{TENANT_SCHEMA}}".pos_sale (id) ON DELETE RESTRICT,
  transaction_mode    VARCHAR(24) NOT NULL,
  prescription_id     UUID REFERENCES "{{TENANT_SCHEMA}}".rx_prescription (id) ON DELETE RESTRICT,
  reference_number    VARCHAR(96),
  formula_name        VARCHAR(180),
  dosage_form         VARCHAR(64),
  label_instruction   TEXT,
  workflow_status     VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  validated_at        TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  created_by          UUID NOT NULL,
  updated_by          UUID NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  version             INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT rx_pos_mode_valid CHECK (
    transaction_mode IN ('OTC', 'PRESCRIPTION', 'COMPOUND', 'PRODUCTION')
  ),
  CONSTRAINT rx_pos_status_valid CHECK (
    workflow_status IN ('DRAFT', 'VALIDATED', 'COMPLETED', 'CANCELLED')
  ),
  CONSTRAINT rx_pos_prescription_required CHECK (
    transaction_mode NOT IN ('PRESCRIPTION', 'COMPOUND') OR prescription_id IS NOT NULL
  ),
  CONSTRAINT rx_pos_compound_formula_required CHECK (
    transaction_mode <> 'COMPOUND' OR
    (formula_name IS NOT NULL AND length(trim(formula_name)) >= 3 AND
     label_instruction IS NOT NULL AND length(trim(label_instruction)) >= 3)
  ),
  CONSTRAINT rx_pos_production_reference_required CHECK (
    transaction_mode <> 'PRODUCTION' OR
    (reference_number IS NOT NULL AND length(trim(reference_number)) >= 3)
  )
);

CREATE INDEX IF NOT EXISTS ix_rx_pos_context_worklist
  ON "{{TENANT_SCHEMA}}".rx_pos_sale_context (transaction_mode, workflow_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS ix_rx_pos_context_prescription
  ON "{{TENANT_SCHEMA}}".rx_pos_sale_context (prescription_id)
  WHERE prescription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".rx_pos_compound_component (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_sale_id         UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".rx_pos_sale_context (pos_sale_id) ON DELETE RESTRICT,
  pos_sale_line_id    UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".pos_sale_line (id) ON DELETE RESTRICT,
  product_id          UUID NOT NULL REFERENCES "{{TENANT_SCHEMA}}".product (id) ON DELETE RESTRICT,
  quantity            NUMERIC(14,4) NOT NULL,
  uom_id              UUID REFERENCES "{{TENANT_SCHEMA}}".uom (id) ON DELETE RESTRICT,
  unit_cost_snapshot  NUMERIC(18,4) NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rx_pos_component_quantity_positive CHECK (quantity > 0),
  CONSTRAINT ux_rx_pos_component_line UNIQUE (pos_sale_id, pos_sale_line_id)
);

DO $$
DECLARE
  t TEXT;
  pos_parent_id UUID;
  menu_id UUID;
  action_id UUID;
  item RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY['rx_pos_sale_context', 'rx_pos_compound_component'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON %2$I.%1$I', t, '{{TENANT_SCHEMA}}');
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %2$I.%1$I '
      || 'FOR EACH ROW EXECUTE FUNCTION %3$I.audit_row_trigger()',
      t, '{{TENANT_SCHEMA}}', '{{AUDIT_SCHEMA}}'
    );
  END LOOP;

  SELECT id INTO pos_parent_id FROM "{{TENANT_SCHEMA}}".menu
   WHERE code = 'POS' AND deleted_at IS NULL;
  IF pos_parent_id IS NULL THEN
    RAISE EXCEPTION 'Menu POS belum ada; H070 menuntut migrasi V043 lebih dahulu.';
  END IF;

  FOR item IN SELECT * FROM (VALUES
    ('POS_PHARMACY_SALES', 'Penjualan Obat', '/app/apotik/penjualan', 'shopping-cart', 3),
    ('POS_PHARMACY_PURCHASING', 'Pembelian PBF', '/app/apotik/pembelian', 'truck', 4),
    ('POS_PHARMACY_COMPOUND', 'Racikan dan Produksi', '/app/apotik/racikan', 'flask-conical', 5)
  ) AS x(code, name, route, icon, sort_order)
  LOOP
    INSERT INTO "{{TENANT_SCHEMA}}".menu
      (code, parent_id, name, translation_key, route, icon, module_code,
       platform_target, path, level, is_coming_soon, is_system, sort_order)
    VALUES
      (item.code, pos_parent_id, item.name, 'menu.pos.pharmacy', item.route, item.icon,
       'POS', 'WEB', '/POS/' || item.code, 1, FALSE, TRUE, item.sort_order)
    ON CONFLICT DO NOTHING;

    SELECT id INTO menu_id FROM "{{TENANT_SCHEMA}}".menu
     WHERE code = item.code AND deleted_at IS NULL;
    SELECT id INTO action_id FROM "{{TENANT_SCHEMA}}".permission_action
     WHERE code = 'READ' AND deleted_at IS NULL;
    IF menu_id IS NULL OR action_id IS NULL THEN
      RAISE EXCEPTION 'Menu atau aksi READ untuk % tidak ditemukan.', item.code;
    END IF;
    INSERT INTO "{{TENANT_SCHEMA}}".menu_action (menu_id, permission_action_id)
    VALUES (menu_id, action_id) ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
