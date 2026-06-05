import { supabase } from '../lib/supabase'

export async function revalueAsset(assetId, fairValue, valuationDate, valuerName) {
  const { data: asset, error: assetError } = await supabase
    .from('assets')
    .select('id, cost, accumulated_depreciation, net_book_value')
    .eq('id', assetId)
    .maybeSingle()

  if (assetError) throw assetError
  if (!asset) throw new Error('Asset not found')

  const carryingAmountBefore = Number(asset.net_book_value || asset.cost - asset.accumulated_depreciation)
  const { data: revaluation, error: insertError } = await supabase
    .from('asset_revaluations')
    .insert({
      asset_id: assetId,
      revaluation_date: valuationDate,
      carrying_amount_before: carryingAmountBefore,
      fair_value: fairValue,
      valuer_name: valuerName,
    })
    .select()
    .single()

  if (insertError) throw insertError

  const { data: result, error: rpcError } = await supabase.rpc('post_revaluation_journal', {
    p_revaluation_id: revaluation.id,
  })

  if (rpcError) throw rpcError
  return { revaluation, result }
}

export async function addAssetComponent(assetId, componentData) {
  const payload = {
    parent_asset_id: assetId,
    component_name: componentData.component_name,
    cost: componentData.cost,
    useful_life_years: componentData.useful_life_years,
    depreciation_method: componentData.depreciation_method || 'straight_line',
    accumulated_depreciation: componentData.accumulated_depreciation || 0,
    is_disposed: componentData.is_disposed ?? false,
  }

  const { data, error } = await supabase
    .from('asset_components')
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getAssetRollForward(financialYear) {
  let query = supabase.from('asset_roll_forward_view').select('*')
  if (financialYear) {
    query = query.eq('fiscal_year', financialYear)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}
