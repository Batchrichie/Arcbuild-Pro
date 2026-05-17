import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { liabilityBalance } from '../../lib/formatGhs'
import TaxLiabilitiesPanel from './TaxLiabilitiesPanel'

export default function TaxOverview() {
  const [balances, setBalances] = useState({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('balance_sheet')
      .select('account_code, balance')
      .in('account_code', ['2102', '2103', '2104', '2105', '2106'])
    const map = {}
    ;(data ?? []).forEach((r) => {
      map[r.account_code] = liabilityBalance(r.balance)
    })
    setBalances(map)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-4">
      <TaxLiabilitiesPanel balances={balances} loading={loading} />
    </div>
  )
}
