const fetch = globalThis.fetch || require('node-fetch');
const supabaseUrl = 'https://xyzjgwbneozupholofdx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5empnd2JuZW96dXBob2xvZmR4Iiwicm9sIjoiYW5vbiIsImlhdCI6MTczMTQ1Nzk5NywiZXhwIjoyMDQ3MDMzOTk3fQ.nYl7H4XdHZ0pJFWGh1zDEKwNUgDyAOKvg9C0VwPqnzI';
const query = `select account_code, account_name, account_type from chart_of_accounts where account_code in ('2102','2103','2104','2105','2106','2107','1112','7100','7200','7300') order by account_code;`;
(async () => {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Accept': 'application/json'
      },
      body: JSON.stringify({ query })
    });
    console.log('STATUS', res.status, res.statusText);
    const text = await res.text();
    console.log(text);
  } catch (error) {
    console.error('ERROR', error);
  }
})();
