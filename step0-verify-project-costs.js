const supabaseUrl = 'https://xyzjgwbneozupholofdx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5empnd2JuZW96dXBob2xvZmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE0NTc5OTcsImV4cCI6MjA0NzAzMzk5N30.nYl7H4XdHZ0pJFWGh1zDEKwNUgDyAOKvg9C0VwPqnzI'

async function checkProjectCosts() {
  try {
    // Use REST API to query information_schema directly
    const query = `
      select column_name, data_type, column_default
      from information_schema.columns
      where table_name = 'project_costs'
        and table_schema = 'public'
      order by ordinal_position
    `

    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey
      },
      body: JSON.stringify({ query })
    })

    if (!response.ok) {
      // Try alternative approach using the table directly
      console.log('PROJECT_COSTS TABLE STRUCTURE:')
      console.log('=' .repeat(80))
      console.log('(Attempting direct table introspection...)')
      
      const tableResponse = await fetch(
        `${supabaseUrl}/rest/v1/information_schema.columns?table_name=eq.project_costs&table_schema=eq.public&order=ordinal_position.asc`,
        {
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey,
            'Accept': 'application/json'
          }
        }
      )

      if (tableResponse.ok) {
        const columns = await tableResponse.json()
        columns.forEach(col => {
          console.log(`${col.column_name.padEnd(25)} ${col.data_type.padEnd(20)} ${col.column_default || '(null)'}`)
        })
      } else {
        console.error('Failed to query table structure')
        console.log('Response status:', tableResponse.status)
      }
      return
    }

    const result = await response.json()
    console.log('PROJECT_COSTS TABLE STRUCTURE:')
    console.log('=' .repeat(80))
    if (result && result.length > 0) {
      result.forEach(row => {
        console.log(`${row.column_name.padEnd(25)} ${row.data_type.padEnd(20)} ${row.column_default || '(null)'}`)
      })
    }
  } catch (err) {
    console.error('Error:', err.message)
  }
}

checkProjectCosts()
