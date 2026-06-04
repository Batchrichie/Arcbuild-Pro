import { supabase } from '../lib/supabase'

export async function receiveMaterial(itemData, movementData) {
  let item

  if (itemData?.id) {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('id', itemData.id)
      .single()

    if (error) throw error
    if (!data) throw new Error('Inventory item not found')
    item = data
  } else {
    const { data, error } = await supabase
      .from('inventory_items')
      .insert({
        item_name: itemData.item_name,
        project_id: itemData.project_id,
        quantity: 0,
        unit_cost: 0,
        nrv: itemData.nrv || 0,
        created_by: itemData.created_by,
      })
      .select('*')
      .single()

    if (error) throw error
    item = data
  }

  const movementPayload = {
    inventory_item_id: item.id,
    movement_date: movementData.movement_date || new Date().toISOString().split('T')[0],
    movement_type: 'purchase',
    quantity: movementData.quantity,
    unit_cost: movementData.unit_cost,
    project_cost_id: movementData.project_cost_id,
    reference: movementData.reference,
    created_by: movementData.created_by,
  }

  const { data: movement, error: movementError } = await supabase
    .from('inventory_movements')
    .insert(movementPayload)
    .select('*')
    .single()

  if (movementError) throw movementError

  const { error: rpcError } = await supabase.rpc('update_weighted_average_cost', {
    p_item_id: item.id,
    p_new_qty: movement.quantity,
    p_new_cost: movement.unit_cost,
  })

  if (rpcError) throw rpcError

  const { data: updatedItem, error: updatedItemError } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('id', item.id)
    .single()

  if (updatedItemError) throw updatedItemError

  return { item: updatedItem, movement }
}

export async function consumeMaterial(itemId, qty, projectCostId, createdBy) {
  const { data: item, error: itemError } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('id', itemId)
    .single()

  if (itemError) throw itemError
  if (!item) throw new Error('Inventory item not found')
  if (qty <= 0) throw new Error('Quantity must be greater than zero')
  if (Number(item.quantity || 0) < qty) throw new Error('Insufficient inventory quantity')

  const movementPayload = {
    inventory_item_id: itemId,
    movement_date: new Date().toISOString().split('T')[0],
    movement_type: 'consumption',
    quantity: qty,
    unit_cost: item.unit_cost,
    project_cost_id: projectCostId,
    reference: null,
    created_by: createdBy,
  }

  const { data: movement, error: movementError } = await supabase
    .from('inventory_movements')
    .insert(movementPayload)
    .select('*')
    .single()

  if (movementError) throw movementError

  const { error: updateError } = await supabase
    .from('inventory_items')
    .update({
      quantity: Number(item.quantity || 0) - qty,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)

  if (updateError) throw updateError

  return movement
}

export async function runPeriodEndNRVTest(projectId) {
  let query = supabase.from('inventory_items').select('*')
  if (projectId) query = query.eq('project_id', projectId)

  const { data: items, error } = await query
  if (error) throw error

  const results = []
  for (const item of items || []) {
    const { data, error: rpcError } = await supabase.rpc('run_nrv_test', {
      p_item_id: item.id,
      p_nrv: item.nrv || 0,
    })
    if (rpcError) throw rpcError
    results.push(data)
  }

  return results
}

export async function getInventoryMovementSchedule(month, year) {
  let query = supabase.from('inventory_movement_schedule_view').select('*')
  if (month) query = query.eq('month', month)
  if (year) query = query.eq('year', year)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function getInventoryValuation() {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .order('item_name', { ascending: true })

  if (error) throw error
  return data || []
}
