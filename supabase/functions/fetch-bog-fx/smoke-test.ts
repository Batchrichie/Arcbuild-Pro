import { parseRates } from './index.ts'

const sampleHtml = `
<table>
  <tbody>
    <tr>
      <td>19 May 2026</td>
      <td>US Dollar</td>
      <td>USDGHS</td>
      <td>11.5142</td>
      <td>11.5258</td>
      <td>11.5200</td>
    </tr>
    <tr>
      <td>19 May 2026</td>
      <td>Euro</td>
      <td>EURGHS</td>
      <td>13.3578</td>
      <td>13.3710</td>
      <td>13.3644</td>
    </tr>
  </tbody>
</table>
`

const rates = parseRates(sampleHtml)
console.log(JSON.stringify(rates, null, 2))
