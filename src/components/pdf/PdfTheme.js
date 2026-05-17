import { StyleSheet, Font } from '@react-pdf/renderer'

Font.register({
  family: 'DMSans',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/dmsans/v14/rP2Hp2ywxg089UriCZOIHQ.ttf' },
    { src: 'https://fonts.gstatic.com/s/dmsans/v14/rP2Cp2ywxg089UriASitCBimCw.ttf', fontWeight: 'bold' },
  ],
})

export const colors = {
  amber: '#F59E0B',
  dark: '#0F1117',
  surface: '#1A1D27',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  green: '#10B981',
  red: '#EF4444',
  white: '#FFFFFF',
}

export const pdfStyles = StyleSheet.create({
  page: {
    fontFamily: 'DMSans',
    fontSize: 10,
    color: colors.textPrimary,
    padding: 40,
    backgroundColor: colors.white,
  },
  headerBar: {
    backgroundColor: colors.dark,
    padding: 20,
    marginBottom: 24,
    borderRadius: 4,
  },
  companyName: {
    color: colors.amber,
    fontSize: 16,
    fontWeight: 'bold',
  },
  companyTagline: {
    color: colors.white,
    fontSize: 8,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: `1px solid ${colors.border}`,
  },
  sectionRow: {
    marginBottom: 8,
  },
  label: {
    fontSize: 9,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  value: {
    fontSize: 9,
    color: colors.textPrimary,
  },
  table: {
    marginBottom: 16,
    width: '100%',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: `1px solid ${colors.border}`,
    paddingVertical: 6,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.dark,
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  tableHeaderCell: {
    color: colors.white,
    fontSize: 8,
    fontWeight: 'bold',
    flex: 1,
  },
  tableCell: {
    flex: 1,
    fontSize: 9,
  },
  amountCell: {
    flex: 1,
    fontSize: 9,
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: '#F9FAFB',
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTop: `1px solid ${colors.border}`,
    paddingTop: 8,
    fontSize: 8,
    color: colors.textSecondary,
    textAlign: 'center',
  },
})
