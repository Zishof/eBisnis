=== stock_movement for order 1 ===
SELECT product_id, movement_type, quantity, reference_type, reference_id
  FROM "uat_finance_15643".stock_movement WHERE reference_id = '81d5a5c7-3839-4ad1-8f07-be2238cb5050'::uuid;
