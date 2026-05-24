const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function convertHundreds(n) {
  let words = ''
  if (n >= 100) {
    const h = Math.floor(n / 100)
    words += units[h] + ' Hundred'
    const rem = n % 100
    if (rem > 0) words += ' and '
    n = rem
  }

  if (n >= 20) {
    const t = Math.floor(n / 10)
    words += tens[t]
    const u = n % 10
    if (u > 0) words += ' ' + units[u]
  } else if (n > 0) {
    words += units[n]
  }

  return words
}

export function numberToWords(amount, currency = 'GHS') {
  if (typeof amount !== 'number') {
    amount = Number(amount) || 0
  }

  if (amount < 0) amount = Math.abs(amount)

  const integerPart = Math.floor(amount)
  const cents = Math.round((amount - integerPart) * 100)

  if (integerPart === 0) {
    var integerWords = 'Zero'
  } else {
    const parts = []

    const millions = Math.floor(integerPart / 1000000)
    const thousands = Math.floor((integerPart % 1000000) / 1000)
    const remainder = integerPart % 1000

    if (millions > 0) {
      parts.push(convertHundreds(millions) + ' Million')
    }
    if (thousands > 0) {
      parts.push(convertHundreds(thousands) + ' Thousand')
    }
    if (remainder > 0) {
      parts.push(convertHundreds(remainder))
    }

    integerWords = parts.filter(Boolean).join(' ')
  }

  let currencyName = 'Ghana Cedis'
  if (currency === 'USD') currencyName = 'US Dollars'
  else if (currency === 'GBP') currencyName = 'Pounds Sterling'
  else if (currency === 'EUR') currencyName = 'Euros'

  if (cents === 0) {
    return `${integerWords} ${currencyName} Only`
  }

  const fractionalWords = convertHundreds(cents)
  let fractionalLabel = 'Cents'
  if (currency === 'GHS') fractionalLabel = cents === 1 ? 'Pesewa' : 'Pesewas'
  else if (currency === 'GBP') fractionalLabel = cents === 1 ? 'Penny' : 'Pence'

  return `${integerWords} ${currencyName} and ${fractionalWords} ${fractionalLabel}`
}

export default numberToWords
